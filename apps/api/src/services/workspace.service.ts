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
        data: { workspaceId: ws.id, tier: 'free', status: 'active' },
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

    if (!inviterMembership || !['owner', 'admin'].includes(inviterMembership.role)) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [workspace, inviter, invitee] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: inviterId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
    ]);

    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }
    if (!inviter) {
      throw new AppError('Inviter not found', 404, 'INVITER_NOT_FOUND');
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
    const acceptLink = `${config.frontend.url}/auth/register?invite_token=${encodeURIComponent(token)}&invite_action=accept`;
    const declineLink = `${config.frontend.url}/auth/login?invite_token=${encodeURIComponent(token)}&invite_action=decline`;

    await emailService.sendWorkspaceInviteEmail({
      email: normalizedEmail,
      workspaceName: workspace.name,
      inviterName: inviter.name,
      role,
      acceptLink,
      declineLink,
    });

    return {
      email: normalizedEmail,
      role,
      invitedBy: inviter.id,
      workspaceId: workspace.id,
      invitationSent: true,
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

    if (user.email.toLowerCase() !== payload.email) {
      throw new AppError('Invitation email does not match your account', 403, 'INVITE_EMAIL_MISMATCH');
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: payload.workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    const member = await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: workspace.id,
        },
      },
      update: { role: payload.role },
      create: {
        userId: user.id,
        workspaceId: workspace.id,
        role: payload.role,
      },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

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

  async removeMember(workspaceId: string, requesterId: string, targetUserId: string) {
    const requesterMembership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: requesterId, workspaceId } },
    });

    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    const targetMembership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });

    if (!targetMembership) {
      throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    if (targetMembership.role === 'owner') {
      throw new AppError('Cannot remove workspace owner', 403, 'CANNOT_REMOVE_OWNER');
    }

    await prisma.workspaceMember.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
  }

  async getMembers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });
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
