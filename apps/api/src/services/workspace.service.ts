import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '@ee-postmind/shared';
import { getEffectiveLimits } from './admin-settings.service.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { emailService } from './email.service.js';

interface InvitePayload {
  workspaceId: string;
  email: string;
  role: string;
  invitedBy: string;
}

const INVITE_EXPIRY = '7d';

export class WorkspaceService {
  async getUserWorkspaces(userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            subscription: { select: { tier: true, status: true } },
            _count: { select: { members: true, socialConnections: true, posts: true } },
          },
        },
      },
    });

    return memberships.map((m: any) => ({
      ...m.workspace,
      role: m.role,
    }));
  }

  async createWorkspace(userId: string, name: string) {
    const slug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36);

    const workspace = await prisma.$transaction(async (tx: any) => {
      const ws = await tx.workspace.create({
        data: { name, slug, ownerId: userId },
      });

      await tx.workspaceMember.create({
        data: { userId, workspaceId: ws.id, role: 'owner' },
      });

      await tx.subscription.create({
        data: { workspaceId: ws.id, tier: 'basic', status: 'active' },
      });

      return ws;
    });

    return workspace;
  }

  async inviteMember(workspaceId: string, inviterId: string, email: string, role: string) {
    // Verify inviter has permission
    const inviterMembership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: inviterId, workspaceId } },
    });

    if (!inviterMembership || inviterMembership.role === 'viewer') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [workspace, inviter, invitee] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, subscription: { select: { tier: true } }, _count: { select: { members: true } } } }),
      prisma.user.findUnique({ where: { id: inviterId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
    ]);

    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }
    if (!inviter) {
      throw new AppError('Inviter not found', 404, 'INVITER_NOT_FOUND');
    }

    const currentMembers = workspace._count?.members || 1;
    const tier = workspace.subscription?.tier || 'basic';
    const effectiveLimits = await getEffectiveLimits(tier as SubscriptionTier);
    const limit = effectiveLimits.teamMembers;
    
    // We only enforce limits on new members. If invitee exists and is already a member, we let it fail on ALREADY_MEMBER
    if (currentMembers >= limit) {
      throw new AppError(`Your ${tier} plan is limited to ${limit} team members.`, 403, 'MEMBER_LIMIT_REACHED');
    }

    if (invitee) {
      const existing = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: invitee.id, workspaceId } },
      });
      if (existing) {
        throw new AppError('User is already a member', 409, 'ALREADY_MEMBER');
      }
    }

    const token = this.signInviteToken({
      workspaceId,
      email: normalizedEmail,
      role,
      invitedBy: inviterId,
    });
    // If the invitee already has an account, send them to login page to accept.
    // If they're a new user, send them to register page where they'll also accept on completion.
    const inviteePath = invitee ? '/auth/login' : '/auth/register';
    const acceptLink = `${config.frontend.url}${inviteePath}?invite_token=${encodeURIComponent(token)}&invite_action=accept`;
    const declineLink = `${config.frontend.url}/auth/login?invite_token=${encodeURIComponent(token)}&invite_action=decline`;

    // Create a pending WorkspaceMember record immediately so the invitee appears in the team list
    if (invitee) {
      // User already has an account - create pending record linked to their userId
      await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: invitee.id, workspaceId } },
        create: { userId: invitee.id, workspaceId, role, status: 'pending', inviteEmail: normalizedEmail, invitedBy: inviterId, inviteToken: token },
        update: { role, status: 'pending', inviteEmail: normalizedEmail, inviteToken: token },
      });
    } else {
      // New user - create orphan pending record with just email (no userId yet)
      await prisma.workspaceMember.create({
        data: { workspaceId, role, status: 'pending', inviteEmail: normalizedEmail, invitedBy: inviterId, inviteToken: token },
      });
    }

    let emailSent = false;
    let emailError: string | undefined;
    try {
      await emailService.sendWorkspaceInviteEmail({
        email: normalizedEmail,
        workspaceName: workspace.name,
        inviterName: inviter.name,
        role,
        acceptLink,
        declineLink,
      });
      emailSent = true;
    } catch (err: any) {
      console.error('[INVITE] Email delivery failed:', err.message);
      emailError = err.message;
    }

    return {
      email: normalizedEmail,
      role,
      invitedBy: inviter.id,
      workspaceId: workspace.id,
      invitationSent: emailSent,
      emailError,
      acceptLink,
    };
  }

  async acceptInvite(token: string, userId: string) {
    const payload = this.verifyInviteToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.email.toLowerCase() !== payload.email.toLowerCase()) {
      console.error(`[INVITE ACCEPT] Email mismatch: user="${user.email.toLowerCase()}" vs token="${payload.email.toLowerCase()}"`);
      throw new AppError('Invitation email does not match your account', 403, 'INVITE_EMAIL_MISMATCH');
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: payload.workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    // First try to find the pending record (by email, for new users without userId)
    const pendingByEmail = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, inviteEmail: payload.email, status: 'pending', userId: null },
    });

    let member;
    if (pendingByEmail) {
      // Link the now-registered user to this pending record and activate
      member = await prisma.workspaceMember.update({
        where: { id: pendingByEmail.id },
        data: { userId: user.id, role: payload.role, status: 'active', inviteToken: null },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });
    } else {
      // User already had an account - update existing pending record or create active one
      member = await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
        update: { role: payload.role, status: 'active', inviteToken: null },
        create: { userId: user.id, workspaceId: workspace.id, role: payload.role, status: 'active', inviteEmail: payload.email },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });
    }

    return {
      workspace,
      member,
      accepted: true,
    };
  }

  async declineInvite(token: string, userId?: string) {
    const payload = this.verifyInviteToken(token);

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.email.toLowerCase() !== payload.email) {
        throw new AppError('Invitation email does not match your account', 403, 'INVITE_EMAIL_MISMATCH');
      }
    }

    return {
      declined: true,
      workspaceId: payload.workspaceId,
      email: payload.email,
    };
  }

  async removeMember(workspaceId: string, requesterId: string, targetId: string) {
    const requesterMembership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: requesterId, workspaceId } },
    });

    if (!requesterMembership || requesterMembership.role === 'viewer') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    // Try to find target by member row id first (handles pending members with null userId),
    // then fall back to looking up by userId for backwards compatibility.
    let targetMembership = await prisma.workspaceMember.findFirst({
      where: { id: targetId, workspaceId },
    });

    if (!targetMembership) {
      targetMembership = await prisma.workspaceMember.findFirst({
        where: { userId: targetId, workspaceId },
      });
    }

    if (!targetMembership) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    if (targetMembership.role === 'owner') {
      throw new AppError('Cannot remove workspace owner', 403, 'CANNOT_REMOVE_OWNER');
    }

    await prisma.workspaceMember.delete({
      where: { id: targetMembership.id },
    });
  }

  async getMembers(workspaceId: string) {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: [
        { status: 'asc' }, // active first, then pending
        { id: 'asc' },
      ],
    });
    // Normalize: for pending members without a user account, use inviteEmail as the display email
    return members.map(m => ({
      ...m,
      displayEmail: m.user?.email ?? m.inviteEmail ?? '',
      displayName: m.user?.name ?? m.inviteEmail ?? 'Invited User',
    }));
  }

  private signInviteToken(payload: InvitePayload): string {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: INVITE_EXPIRY });
  }

  private verifyInviteToken(token: string): InvitePayload {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload');
      }

      const typedPayload = payload as Partial<InvitePayload>;
      if (
        !typedPayload.workspaceId ||
        !typedPayload.email ||
        !typedPayload.role ||
        !typedPayload.invitedBy
      ) {
        throw new Error('Missing fields');
      }

      return {
        workspaceId: typedPayload.workspaceId,
        email: typedPayload.email.toLowerCase(),
        role: typedPayload.role,
        invitedBy: typedPayload.invitedBy,
      };
    } catch {
      throw new AppError('Invalid or expired invitation token', 400, 'INVALID_INVITE_TOKEN');
    }
  }
}

export const workspaceService = new WorkspaceService();

