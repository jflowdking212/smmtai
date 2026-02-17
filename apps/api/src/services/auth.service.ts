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

      // Create default workspace
      const workspaceSlug = slugify(data.name) + '-' + newUser.id.slice(-6);
      const workspace = await tx.workspace.create({
        data: {
          name: `${data.name}'s Workspace`,
          slug: workspaceSlug,
          ownerId: newUser.id,
        },
      });

      // Add owner as member
      await tx.workspaceMember.create({
        data: {
          userId: newUser.id,
          workspaceId: workspace.id,
          role: 'owner',
        },
      });

      // Create free subscription
      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          tier: 'free',
          status: 'active',
        },
      });

      return { ...newUser, workspaceId: workspace.id };
    });

    // Generate verification token
    const verificationToken = generateRandomToken();
    // TODO: Store token and send verification email (Milestone 2.4)

    const tokens = this.generateTokenPair(user.id, user.workspaceId);

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      workspaceId: user.workspaceId,
      ...tokens,
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

    return {
      user: this.sanitizeUser(user),
      workspaceId,
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

    const resetToken = generateRandomToken();
    // TODO: Store reset token with expiry and send email (Milestone 2.4)
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
  }

  async resetPassword(token: string, newPassword: string) {
    // TODO: Verify token from store (Milestone 2.4)
    // For now, this is a stub
    throw new AppError('Not yet implemented', 501, 'NOT_IMPLEMENTED');
  }

  private generateTokenPair(userId: string, workspaceId?: string) {
    return {
      accessToken: generateAccessToken({ userId, workspaceId }),
      refreshToken: generateRefreshToken({ userId, workspaceId }),
    };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashed = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.refreshToken.create({
      data: { token: hashed, userId, expiresAt },
    });
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
