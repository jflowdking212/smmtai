import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './helpers/testApp.js';

const { userServiceMock } = vi.hoisted(() => ({
  userServiceMock: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'user_test';
    req.workspaceId = 'workspace_test';
    next();
  },
}));

vi.mock('../services/user.service.js', () => ({
  userService: userServiceMock,
}));

import { userRouter } from '../routes/user.js';

const userApp = createTestApp('/users', userRouter);

describe('User notification preferences route integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userServiceMock.getNotificationPreferences.mockResolvedValue({
      postPublished: true,
      postFailed: true,
      upcomingScheduled: false,
      weeklyAnalyticsDigest: true,
      monthlyAnalyticsDigest: false,
    });
    userServiceMock.updateNotificationPreferences.mockResolvedValue({
      postPublished: false,
      postFailed: true,
      upcomingScheduled: true,
      weeklyAnalyticsDigest: false,
      monthlyAnalyticsDigest: true,
    });
  });

  it('gets notification preferences for authenticated user', async () => {
    const res = await request(userApp).get('/users/notifications/preferences');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        postPublished: true,
        postFailed: true,
        upcomingScheduled: false,
        weeklyAnalyticsDigest: true,
        monthlyAnalyticsDigest: false,
      },
    });
    expect(userServiceMock.getNotificationPreferences).toHaveBeenCalledWith('user_test');
  });

  it('updates notification preferences for authenticated user', async () => {
    const res = await request(userApp)
      .patch('/users/notifications/preferences')
      .send({ postPublished: false });

    expect(res.status).toBe(200);
    expect(userServiceMock.updateNotificationPreferences).toHaveBeenCalledWith('user_test', { postPublished: false });
    expect(res.body.success).toBe(true);
    expect(res.body.data.postPublished).toBe(false);
    expect(res.body.data.weeklyAnalyticsDigest).toBe(false);
  });

  it('rejects empty update payloads', async () => {
    const res = await request(userApp)
      .patch('/users/notifications/preferences')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(userServiceMock.updateNotificationPreferences).not.toHaveBeenCalled();
  });
});
