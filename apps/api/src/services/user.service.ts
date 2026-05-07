import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  notificationService,
  type NotificationPreferences,
} from './notification.service.js';

export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        timezone: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return user;
  }

  async updateProfile(userId: string, data: { name?: string; bio?: string; timezone?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        timezone: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: { id: true, avatar: true },
    });
  }

  async listEntrepreneurs() {
    const connections = await prisma.socialConnection.findMany({
      where: {
        platform: 'entreprenrs',
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        accountName: true,
        accountId: true,
        updatedAt: true,
        workspace: {
          select: {
            name: true,
            subscription: {
              select: {
                tier: true,
              },
            },
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                bio: true,
              },
            },
          },
        },
      },
    });

    const seenOwnerIds = new Set<string>();
    const profiles: Array<{
      id: string;
      name: string;
      email: string;
      avatar: string | null;
      bio: string | null;
      workspaceName: string;
      tier: string;
      accountName: string;
      accountId: string;
      connectedAt: string;
    }> = [];

    for (const connection of connections) {
      const owner = connection.workspace.owner;
      if (seenOwnerIds.has(owner.id)) continue;
      seenOwnerIds.add(owner.id);

      profiles.push({
        id: owner.id,
        name: owner.name,
        email: owner.email,
        avatar: owner.avatar,
        bio: owner.bio,
        workspaceName: connection.workspace.name,
        tier: connection.workspace.subscription?.tier || 'basic',
        accountName: connection.accountName,
        accountId: connection.accountId,
        connectedAt: connection.updatedAt.toISOString(),
      });
    }

    return profiles;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return notificationService.getUserPreferences(userId);
  }

  async updateNotificationPreferences(
    userId: string,
    data: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return notificationService.updateUserPreferences(userId, data);
  }
}

export const userService = new UserService();
