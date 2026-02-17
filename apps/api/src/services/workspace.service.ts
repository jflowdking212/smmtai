import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

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

    // Find or validate user
    const invitee = await prisma.user.findUnique({ where: { email } });
    if (!invitee) {
      // TODO: Send invitation email to unregistered user (Milestone 2.4)
      throw new AppError('User not found. Invitation emails coming soon.', 404, 'USER_NOT_FOUND');
    }

    // Check if already a member
    const existing = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: invitee.id, workspaceId } },
    });
    if (existing) {
      throw new AppError('User is already a member', 409, 'ALREADY_MEMBER');
    }

    const member = await prisma.workspaceMember.create({
      data: { userId: invitee.id, workspaceId, role },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    return member;
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
}

export const workspaceService = new WorkspaceService();
