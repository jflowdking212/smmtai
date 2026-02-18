import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queueInstances, workerHandlers, mockPrisma, postServiceMock, analyticsServiceMock, notificationServiceMock, connectionServiceMock } = vi.hoisted(() => ({
  queueInstances: new Map<string, any>(),
  workerHandlers: new Map<string, { on: ReturnType<typeof vi.fn>; processor: (job: any) => Promise<any> }>(),
  mockPrisma: {
    post: {
      update: vi.fn(),
    },
    schedule: {
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
  postServiceMock: {
    publishPost: vi.fn(),
  },
  analyticsServiceMock: {
    collectWorkspaceSnapshots: vi.fn(),
    collectSnapshotsForAllWorkspaces: vi.fn(),
  },
  notificationServiceMock: {
    notifyUpcomingScheduledPost: vi.fn(),
    notifyAnalyticsDigestForAllWorkspaces: vi.fn(),
    notifyWorkspaceAnalyticsDigest: vi.fn(),
  },
  connectionServiceMock: {
    monitorConnectionHealth: vi.fn(),
  },
}));

vi.mock('bullmq', () => {
  class Queue {
    name: string;
    add = vi.fn(async (_name: string, _data?: any, _opts?: any) => ({ id: `${this.name}-job` }));
    getDelayed = vi.fn(async () => []);
    getRepeatableJobs = vi.fn(async () => []);
    removeRepeatableByKey = vi.fn(async () => undefined);
    getWaitingCount = vi.fn(async () => 0);
    getActiveCount = vi.fn(async () => 0);
    getDelayedCount = vi.fn(async () => 0);
    getCompletedCount = vi.fn(async () => 0);
    getFailedCount = vi.fn(async () => 0);
    isPaused = vi.fn(async () => false);
    pause = vi.fn(async () => undefined);
    resume = vi.fn(async () => undefined);
    getJob = vi.fn(async () => null);

    constructor(name: string) {
      this.name = name;
      queueInstances.set(name, this);
    }
  }

  class Worker {
    on = vi.fn();

    constructor(name: string, processor: (job: any) => Promise<any>) {
      workerHandlers.set(name, { on: this.on, processor });
    }
  }

  return {
    Queue,
    Worker,
    Job: class Job {},
  };
});

vi.mock('../config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/post.service.js', () => ({
  postService: postServiceMock,
}));

vi.mock('../services/analytics.service.js', () => ({
  analyticsService: analyticsServiceMock,
}));

vi.mock('../services/notification.service.js', () => ({
  notificationService: notificationServiceMock,
}));

vi.mock('../services/connection.service.js', () => ({
  connectionService: connectionServiceMock,
}));

import {
  cancelScheduledPost,
  schedulePost,
  scheduleRecurringPost,
  scheduleAnalyticsDigestReports,
  scheduleConnectionHealthMonitoring,
} from '../jobs/scheduler.js';

describe('Scheduler notification reminder lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const postQueue = queueInstances.get('post-publishing') as any;
    const upcomingQueue = queueInstances.get('upcoming-reminders') as any;
    const digestQueue = queueInstances.get('analytics-digests') as any;
    const connectionHealthQueue = queueInstances.get('connection-health-monitoring') as any;
    postQueue.getDelayed.mockResolvedValue([]);
    postQueue.getRepeatableJobs.mockResolvedValue([]);
    postQueue.add.mockResolvedValue({ id: 'post-job-1' });
    upcomingQueue.getJob.mockResolvedValue(null);
    upcomingQueue.add.mockResolvedValue({ id: 'reminder-job-1' });
    digestQueue.add.mockResolvedValue({ id: 'digest-job-1' });
    connectionHealthQueue.add.mockResolvedValue({ id: 'connection-health-job-1' });
    mockPrisma.post.update.mockResolvedValue(undefined);
    mockPrisma.schedule.updateMany.mockResolvedValue(undefined);
    mockPrisma.schedule.upsert.mockResolvedValue(undefined);
    notificationServiceMock.notifyUpcomingScheduledPost.mockResolvedValue(undefined);
    notificationServiceMock.notifyAnalyticsDigestForAllWorkspaces.mockResolvedValue({
      period: 'weekly',
      total: 2,
      sent: 1,
      skipped: 1,
      failed: 0,
    });
    notificationServiceMock.notifyWorkspaceAnalyticsDigest.mockResolvedValue({
      workspaceId: 'workspace_1',
      recipients: 2,
    });
    connectionServiceMock.monitorConnectionHealth.mockResolvedValue({
      total: 0,
      healthy: 0,
      unhealthy: 0,
      failures: [],
    });
  });

  it('schedules an upcoming reminder when a post is scheduled in the future', async () => {
    const postQueue = queueInstances.get('post-publishing') as any;
    const upcomingQueue = queueInstances.get('upcoming-reminders') as any;
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await schedulePost('post_1', scheduledAt);

    expect(postQueue.add).toHaveBeenCalledWith('publish', { postId: 'post_1' }, expect.objectContaining({
      delay: expect.any(Number),
    }));
    expect(upcomingQueue.add).toHaveBeenCalledWith(
      'upcoming-reminder',
      { postId: 'post_1' },
      expect.objectContaining({
        jobId: 'upcoming:post_1',
        delay: expect.any(Number),
      }),
    );
  });

  it('removes reminder job when cancelling a scheduled post', async () => {
    const upcomingQueue = queueInstances.get('upcoming-reminders') as any;
    const reminderJob = { remove: vi.fn(async () => undefined) };
    upcomingQueue.getJob.mockResolvedValue(reminderJob);

    await cancelScheduledPost('post_1');

    expect(upcomingQueue.getJob).toHaveBeenCalledWith('upcoming:post_1');
    expect(reminderJob.remove).toHaveBeenCalledTimes(1);
  });

  it('schedules reminder for recurring schedules using next run time', async () => {
    const upcomingQueue = queueInstances.get('upcoming-reminders') as any;
    const startsAt = new Date(Date.now() + 90 * 60 * 1000);

    await scheduleRecurringPost('post_1', {
      startsAt,
      recurrence: 'weekly',
      timezone: 'UTC',
    });

    expect(upcomingQueue.add).toHaveBeenCalledWith(
      'upcoming-reminder',
      { postId: 'post_1' },
      expect.objectContaining({
        jobId: 'upcoming:post_1',
      }),
    );
  });

  it('schedules recurring weekly and monthly analytics digest jobs', async () => {
    const digestQueue = queueInstances.get('analytics-digests') as any;
    digestQueue.add
      .mockResolvedValueOnce({ id: 'analytics-digest-weekly' })
      .mockResolvedValueOnce({ id: 'analytics-digest-monthly' });

    const result = await scheduleAnalyticsDigestReports();

    expect(digestQueue.add).toHaveBeenCalledTimes(2);
    expect(digestQueue.add).toHaveBeenNthCalledWith(
      1,
      'digest-weekly',
      { period: 'weekly' },
      expect.objectContaining({
        jobId: 'analytics-digest-weekly',
        repeat: expect.objectContaining({ pattern: expect.any(String), tz: expect.any(String) }),
      }),
    );
    expect(digestQueue.add).toHaveBeenNthCalledWith(
      2,
      'digest-monthly',
      { period: 'monthly' },
      expect.objectContaining({
        jobId: 'analytics-digest-monthly',
        repeat: expect.objectContaining({ pattern: expect.any(String), tz: expect.any(String) }),
      }),
    );
    expect(result.weeklyJobId).toBe('analytics-digest-weekly');
    expect(result.monthlyJobId).toBe('analytics-digest-monthly');
  });

  it('dispatches analytics digest worker jobs to notification service', async () => {
    const digestWorker = workerHandlers.get('analytics-digests');
    expect(digestWorker).toBeDefined();
    await digestWorker!.processor({ data: { period: 'weekly' } });
    await digestWorker!.processor({ data: { period: 'monthly', workspaceId: 'workspace_1' } });

    expect(notificationServiceMock.notifyAnalyticsDigestForAllWorkspaces).toHaveBeenCalledWith('weekly');
    expect(notificationServiceMock.notifyWorkspaceAnalyticsDigest).toHaveBeenCalledWith('workspace_1', 'monthly');
  });

  it('schedules recurring connection health monitoring jobs', async () => {
    const connectionHealthQueue = queueInstances.get('connection-health-monitoring') as any;
    connectionHealthQueue.add.mockResolvedValue({ id: 'connection-health-monitoring' });

    const result = await scheduleConnectionHealthMonitoring();

    expect(connectionHealthQueue.add).toHaveBeenCalledWith(
      'check-all-connections',
      {},
      expect.objectContaining({
        jobId: 'connection-health-monitoring',
        repeat: expect.objectContaining({ every: expect.any(Number) }),
      }),
    );
    expect(result.jobId).toBe('connection-health-monitoring');
  });

  it('dispatches connection health worker jobs to connection service', async () => {
    const connectionHealthWorker = workerHandlers.get('connection-health-monitoring');
    expect(connectionHealthWorker).toBeDefined();

    await connectionHealthWorker!.processor({ data: {} });
    await connectionHealthWorker!.processor({ data: { workspaceId: 'workspace_1' } });

    expect(connectionServiceMock.monitorConnectionHealth).toHaveBeenNthCalledWith(1, undefined);
    expect(connectionServiceMock.monitorConnectionHealth).toHaveBeenNthCalledWith(2, 'workspace_1');
  });
});
