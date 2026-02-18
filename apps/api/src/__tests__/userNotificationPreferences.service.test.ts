import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, notificationServiceMock } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
  notificationServiceMock: {
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
  },
}));

vi.mock('../config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/notification.service.js', () => ({
  notificationService: notificationServiceMock,
}));

import { userService } from '../services/user.service.js';
import { AppError } from '../middleware/errorHandler.js';

describe('UserService notification preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1' });
    notificationServiceMock.getUserPreferences.mockResolvedValue({
      postPublished: true,
      postFailed: true,
      upcomingScheduled: false,
      weeklyAnalyticsDigest: true,
      monthlyAnalyticsDigest: false,
    });
    notificationServiceMock.updateUserPreferences.mockResolvedValue({
      postPublished: false,
      postFailed: true,
      upcomingScheduled: true,
      weeklyAnalyticsDigest: false,
      monthlyAnalyticsDigest: true,
    });
  });

  it('returns preferences for existing user', async () => {
    const result = await userService.getNotificationPreferences('user_1');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      select: { id: true },
    });
    expect(notificationServiceMock.getUserPreferences).toHaveBeenCalledWith('user_1');
    expect(result.upcomingScheduled).toBe(false);
    expect(result.weeklyAnalyticsDigest).toBe(true);
  });

  it('updates preferences for existing user', async () => {
    const result = await userService.updateNotificationPreferences('user_1', {
      postPublished: false,
    });

    expect(notificationServiceMock.updateUserPreferences).toHaveBeenCalledWith('user_1', {
      postPublished: false,
    });
    expect(result.postPublished).toBe(false);
  });

  it('throws when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(userService.getNotificationPreferences('missing_user')).rejects.toBeInstanceOf(AppError);
    expect(notificationServiceMock.getUserPreferences).not.toHaveBeenCalled();
  });
});
