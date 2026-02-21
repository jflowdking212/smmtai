import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateRandomToken,
  hashToken,
} from '../utils/tokens.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import { emailService } from './email.service.js';
import type { OAuthIdentity } from './oauth.service.js';

const SALT_ROUNDS = 12;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export class AuthService {
  async register(data: { name: string; email: string; password: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
        },
      });

      const workspaceId = await this.createDefaultWorkspace(tx, newUser.id, data.name);
      return { ...newUser, workspaceId };
    });

    const verificationToken = await this.createEmailVerificationToken(user.id);
    const verificationLink = `${config.frontend.url}/auth/verify-email?token=${verificationToken}`;
    await emailService.sendVerificationEmail(user.email, user.name, verificationLink);

    const tokens = this.generateTokenPair(user.id, user.workspaceId);

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      workspaceId: user.workspaceId,
      role: 'editor' as const,
      tier: 'basic' as const,
      ...tokens,
    };
  }

  /**
   * Provision an account during a public checkout flow.
   * - No password is set initially; user completes setup via "set password" email.
   * - Creates a default workspace + basic subscription immediately.
   */
  async provisionCheckoutAccount(data: { name: string; email: string }) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new AppError('An account with this email already exists. Please log in to continue.', 409, 'EMAIL_EXISTS');
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: normalizedEmail,
        },
      });
      const workspaceId = await this.createDefaultWorkspace(tx, user.id, user.name);
      return { user, workspaceId };
    });

    const resetToken = await this.createPasswordResetToken(result.user.id);
    const setPasswordLink = `${config.frontend.url}/auth/reset-password?token=${resetToken}`;
    const verificationToken = await this.createEmailVerificationToken(result.user.id);
    const verifyEmailLink = `${config.frontend.url}/auth/verify-email?token=${verificationToken}`;

    await emailService.sendWelcomeSetPasswordEmail({
      email: result.user.email,
      name: result.user.name,
      setPasswordLink,
      loginLink: `${config.frontend.url}/auth/login`,
      verifyEmailLink,
    });

    return {
      user: this.sanitizeUser(result.user),
      workspaceId: result.workspaceId,
    };
  }

  async login(data: { email: string; password: string }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        workspaces: {
          include: { workspace: true },
          where: { role: 'owner' },
          take: 1,
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const workspaceId = user.workspaces[0]?.workspaceId;
    const tokens = this.generateTokenPair(user.id, workspaceId);

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const { role, tier } = await this.getWorkspaceContext(user.id, workspaceId);

    return {
      user: this.sanitizeUser(user),
      workspaceId,
      role,
      tier,
      ...tokens,
    };
  }

  async loginWithOAuth(identity: OAuthIdentity) {
    const normalizedEmail = identity.email.toLowerCase();

    const result = await prisma.$transaction(async (tx: any) => {
      const existingOAuth = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerId: {
            provider: identity.provider,
            providerId: identity.providerId,
          },
        },
      });

      let user: any;

      if (existingOAuth) {
        user = await tx.user.update({
          where: { id: existingOAuth.userId },
          data: {
            name: identity.name || undefined,
            avatar: identity.avatar,
            emailVerified: identity.emailVerified ? true : undefined,
          },
        });

        await tx.oAuthAccount.update({
          where: { id: existingOAuth.id },
          data: {
            accessToken: identity.providerAccessToken ?? existingOAuth.accessToken,
            refreshToken: identity.providerRefreshToken ?? existingOAuth.refreshToken,
            expiresAt: identity.providerTokenExpiry ?? existingOAuth.expiresAt,
          },
        });
      } else {
        const existingUser = await tx.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (existingUser) {
          user = await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: existingUser.name || identity.name,
              avatar: identity.avatar ?? existingUser.avatar,
              emailVerified: existingUser.emailVerified || identity.emailVerified,
            },
          });
        } else {
          user = await tx.user.create({
            data: {
              email: normalizedEmail,
              name: identity.name || normalizedEmail.split('@')[0],
              avatar: identity.avatar,
              emailVerified: identity.emailVerified,
            },
          });
        }

        await tx.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: identity.provider,
            providerId: identity.providerId,
            accessToken: identity.providerAccessToken ?? null,
            refreshToken: identity.providerRefreshToken ?? null,
            expiresAt: identity.providerTokenExpiry ?? null,
          },
        });
      }

      const workspaceId = await this.getWorkspaceIdForUser(tx, user.id, user.name);
      return { user, workspaceId };
    });

    const tokens = this.generateTokenPair(result.user.id, result.workspaceId);
    await this.storeRefreshToken(result.user.id, tokens.refreshToken);

    const { role, tier } = await this.getWorkspaceContext(result.user.id, result.workspaceId);

    return {
      user: this.sanitizeUser(result.user),
      workspaceId: result.workspaceId,
      role,
      tier,
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);

      const stored = await prisma.refreshToken.findUnique({
        where: { token: hashToken(refreshToken) },
      });

      if (!stored || stored.expiresAt < new Date()) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Rotate: delete old, create new
      await prisma.refreshToken.delete({ where: { id: stored.id } });

      const tokens = this.generateTokenPair(payload.userId, payload.workspaceId);
      await this.storeRefreshToken(payload.userId, tokens.refreshToken);

      return tokens;
    } catch {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
  }

  async logout(refreshToken: string) {
    const hashed = hashToken(refreshToken);
    await prisma.refreshToken.deleteMany({ where: { token: hashed } });
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return;

    const resetToken = await this.createPasswordResetToken(user.id);
    const resetLink = `${config.frontend.url}/auth/reset-password?token=${resetToken}`;

    try {
      await emailService.sendPasswordResetEmail(user.email, user.name, resetLink);
    } catch (err) {
      console.error('[EMAIL ERROR] Password reset email failed:', err);
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = hashToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId },
      });

      await tx.refreshToken.deleteMany({
        where: { userId: resetToken.userId },
      });
    });
  }

  async verifyEmail(token: string) {
    const hashedToken = hashToken(token);
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token: hashedToken },
    });

    if (!verificationToken || verificationToken.expiresAt < new Date()) {
      throw new AppError('Invalid or expired verification token', 400, 'INVALID_VERIFICATION_TOKEN');
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      });

      await tx.emailVerificationToken.deleteMany({
        where: { userId: verificationToken.userId },
      });
    });
  }

  private async createDefaultWorkspace(tx: any, userId: string, userName: string): Promise<string> {
    const workspaceSlug = `${slugify(userName)}-${userId.slice(-6)}`;
    const workspace = await tx.workspace.create({
      data: {
        name: `${userName}'s Workspace`,
        slug: workspaceSlug,
        ownerId: userId,
      },
    });

    await tx.workspaceMember.create({
      data: {
        userId,
        workspaceId: workspace.id,
        role: 'editor',
      },
    });

    await tx.subscription.create({
      data: {
        workspaceId: workspace.id,
        tier: 'basic',        status: 'active',
      },
    });

    return workspace.id;
  }

  private async getWorkspaceIdForUser(tx: any, userId: string, userName: string): Promise<string> {
    const ownerMembership = await tx.workspaceMember.findFirst({
      where: { userId, role: 'owner' },
      orderBy: { id: 'asc' },
    });

    if (ownerMembership?.workspaceId) {
      return ownerMembership.workspaceId;
    }

    return this.createDefaultWorkspace(tx, userId, userName);
  }

  private generateTokenPair(userId: string, workspaceId?: string) {
    return {
      accessToken: generateAccessToken({ userId, workspaceId }),
      refreshToken: generateRefreshToken({ userId, workspaceId }),
    };
  }

  private async getWorkspaceContext(userId: string, workspaceId?: string): Promise<{ role: string; tier: string }> {
    let role = 'viewer';
    let tier = 'basic';
    if (!workspaceId) return { role, tier };
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (membership) role = membership.role;
    const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
    if (subscription) tier = subscription.tier;
    return { role, tier };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashed = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.refreshToken.create({
      data: { token: hashed, userId, expiresAt },
    });
  }

  private async createEmailVerificationToken(userId: string): Promise<string> {
    const token = generateRandomToken();
    const hashed = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.emailVerificationToken.upsert({
      where: { userId },
      create: { userId, token: hashed, expiresAt },
      update: { token: hashed, expiresAt },
    });

    return token;
  }

  private async createPasswordResetToken(userId: string): Promise<string> {
    const token = generateRandomToken();
    const hashed = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.passwordResetToken.upsert({
      where: { userId },
      create: { userId, token: hashed, expiresAt },
      update: { token: hashed, expiresAt },
    });

    return token;
  }

  private sanitizeUser(user: { id: string; email: string; name: string; avatar: string | null; timezone: string; emailVerified: boolean; createdAt: Date }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      timezone: user.timezone,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
