import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './helpers/testApp.js';

const { mockPrisma, schedulerMocks, analyticsServiceMock } = vi.hoisted(() => ({
  mockPrisma: {
    post: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  schedulerMocks: {
    schedulePost: vi.fn(),
    scheduleRecurringPost: vi.fn(),
    cancelScheduledPost: vi.fn(),
    getQueueStats: vi.fn(),
    pausePublishingQueue: vi.fn(),
    resumePublishingQueue: vi.fn(),
    collectWorkspaceAnalytics: vi.fn(),
  },
  analyticsServiceMock: {
    getOverview: vi.fn(),
    getPlatformAnalytics: vi.fn(),
    getTopPosts: vi.fn(),
    getInsights: vi.fn(),
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'user_test';
    req.workspaceId = 'workspace_test';
    next();
  },
}));

vi.mock('../config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../jobs/scheduler.js', () => schedulerMocks);

vi.mock('../services/analytics.service.js', () => ({
  analyticsService: analyticsServiceMock,
}));

import { scheduleRouter } from '../routes/schedule.js';
import { analyticsRouter } from '../routes/analytics.js';

const scheduleApp = createTestApp('/schedule', scheduleRouter);
const analyticsApp = createTestApp('/analytics', analyticsRouter);

describe('Schedule and analytics route integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.post.findFirst.mockImplementation(async (args?: any) => {
      const where = args?.where || {};
      if (where.status === 'scheduled' && where.scheduledAt) {
        return null;
      }
      if (typeof where.id === 'string') {
        return { id: where.id, workspaceId: 'workspace_test' };
      }
      return { id: 'post_1', workspaceId: 'workspace_test' };
    });
    mockPrisma.post.findMany.mockResolvedValue([{ id: 'post_1' }, { id: 'post_2' }]);
    schedulerMocks.schedulePost.mockResolvedValue('job_schedule_1');
    schedulerMocks.scheduleRecurringPost.mockResolvedValue({
      jobId: 'job_recurring_1',
      cronExpr: '0 9 * * 1',
      timezone: 'UTC',
      nextRunAt: new Date('2030-01-01T09:00:00.000Z'),
    });
    schedulerMocks.cancelScheduledPost.mockResolvedValue(undefined);
    schedulerMocks.getQueueStats.mockResolvedValue({
      waiting: 1,
      active: 0,
      delayed: 2,
      completed: 10,
      failed: 1,
      paused: false,
      recurring: 1,
    });
    schedulerMocks.pausePublishingQueue.mockResolvedValue({ paused: true });
    schedulerMocks.resumePublishingQueue.mockResolvedValue({ paused: false });
    schedulerMocks.collectWorkspaceAnalytics.mockResolvedValue('analytics_job_1');
    analyticsServiceMock.getInsights.mockResolvedValue({
      periodDays: 30,
      generatedAt: '2030-01-01T00:00:00.000Z',
      insights: [
        {
          id: 'engagement-rate',
          severity: 'info',
          title: 'Engagement rate is building',
          description: 'Keep iterating post formats and posting windows to improve response rate.',
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedules recurring post with timezone-aware payload', async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(scheduleApp)
      .post('/schedule/post_1/recurring')
      .send({
        startsAt,
        recurrence: 'weekly',
        timezone: 'UTC',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(schedulerMocks.scheduleRecurringPost).toHaveBeenCalledWith(
      'post_1',
      expect.objectContaining({
        recurrence: 'weekly',
        timezone: 'UTC',
      }),
    );
  });

  it('rejects recurring schedule with invalid timezone', async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(scheduleApp)
      .post('/schedule/post_1/recurring')
      .send({
        startsAt,
        recurrence: 'daily',
        timezone: 'Not/A_Real_Timezone',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIMEZONE');
    expect(schedulerMocks.scheduleRecurringPost).not.toHaveBeenCalled();
  });

  it('pauses and resumes publishing queue', async () => {
    const pauseRes = await request(scheduleApp).post('/schedule/queue/pause').send({});
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.paused).toBe(true);
    expect(schedulerMocks.pausePublishingQueue).toHaveBeenCalledTimes(1);

    const resumeRes = await request(scheduleApp).post('/schedule/queue/resume').send({});
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.paused).toBe(false);
    expect(schedulerMocks.resumePublishingQueue).toHaveBeenCalledTimes(1);
  });

  it('rejects schedule when conflicting post exists in nearby window', async () => {
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    mockPrisma.post.findFirst
      .mockImplementationOnce(async () => ({ id: 'post_1', workspaceId: 'workspace_test' }))
      .mockImplementationOnce(async () => ({ id: 'post_conflict', scheduledAt: new Date(scheduledAt) }));

    const res = await request(scheduleApp).post('/schedule/post_1/schedule').send({ scheduledAt });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SCHEDULE_CONFLICT');
    expect(schedulerMocks.schedulePost).not.toHaveBeenCalled();
  });

  it('rejects scheduling when post is pending approval', async () => {
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    mockPrisma.post.findFirst.mockResolvedValueOnce({
      id: 'post_1',
      workspaceId: 'workspace_test',
      status: 'pending_approval',
    });

    const res = await request(scheduleApp).post('/schedule/post_1/schedule').send({ scheduledAt });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPROVAL_REQUIRED');
    expect(schedulerMocks.schedulePost).not.toHaveBeenCalled();
  });

  it('bulk schedules CSV rows and returns partial failures', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    schedulerMocks.schedulePost.mockImplementation(async (postId: string) => `job_${postId}`);

    const res = await request(scheduleApp).post('/schedule/bulk').send({
      csv: `postId,scheduledAt\npost_1,${future}\npost_missing,${future}\npost_2,${past}`,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        total: 3,
        scheduled: 1,
        failed: 2,
      }),
    );
    expect(res.body.data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ postId: 'post_missing', code: 'POST_NOT_FOUND' }),
        expect.objectContaining({ postId: 'post_2', code: 'PAST_DATE' }),
      ]),
    );
    expect(schedulerMocks.schedulePost).toHaveBeenCalledTimes(1);
    expect(schedulerMocks.schedulePost).toHaveBeenCalledWith('post_1', expect.any(Date));
  });

  it('returns queue stats including paused and recurring counts', async () => {
    const res = await request(scheduleApp).get('/schedule/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        paused: false,
        recurring: 1,
      }),
    );
  });

  it('returns smart recommendations and conflict metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          platform: 'instagram',
          timezone: 'UTC',
          times: [
            { day: 'Monday', time: '09:00', score: 0.95, reason: 'High engagement' },
            { day: 'Tuesday', time: '10:30', score: 0.87, reason: 'Strong click-through' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(scheduleApp).post('/schedule/recommendations').send({
      platform: 'instagram',
      timezone: 'UTC',
      limit: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recommendations).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancels scheduled post for workspace-owned post', async () => {
    const res = await request(scheduleApp).delete('/schedule/post_1/schedule');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(schedulerMocks.cancelScheduledPost).toHaveBeenCalledWith('post_1');
  });

  it('queues analytics refresh for authenticated workspace', async () => {
    const res = await request(analyticsApp).post('/analytics/refresh').send({});
    expect(res.status).toBe(200);
    expect(res.body.data.jobId).toBe('analytics_job_1');
    expect(schedulerMocks.collectWorkspaceAnalytics).toHaveBeenCalledWith('workspace_test');
  });

  it('returns analytics insights for authenticated workspace', async () => {
    const res = await request(analyticsApp).get('/analytics/insights?days=30');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.insights).toHaveLength(1);
    expect(analyticsServiceMock.getInsights).toHaveBeenCalledWith('workspace_test', 30);
  });
});
