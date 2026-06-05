import { Queue, Worker, Job } from 'bullmq';
import { postService } from '../services/post.service.js';
import { analyticsService } from '../services/analytics.service.js';
import { notificationService } from '../services/notification.service.js';
import { connectionService } from '../services/connection.service.js';
import { purgeExpiredMedia } from '../services/media-retention.service.js';
import { prisma } from '../config/database.js';

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

type RecurrenceType = 'daily' | 'weekly' | 'monthly';
type AnalyticsDigestPeriod = 'weekly' | 'monthly';

const WEEKDAY_TO_CRON: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getRecurringJobId(postId: string): string {
  return `recurring-${postId}`;
}

function getUpcomingReminderJobId(postId: string): string {
  return `upcoming-${postId}`;
}

const upcomingLeadMs = (() => {
  const raw = Number.parseInt(process.env.UPCOMING_NOTIFICATION_LEAD_MINUTES || '60', 10);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 60;
  return minutes * 60 * 1000;
})();

function parseTimePartsInTimezone(date: Date, timezone: string): {
  minute: number;
  hour: number;
  dayOfMonth: number;
  dayOfWeek: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const weekday = (partMap.weekday || 'Sun').slice(0, 3);
  return {
    minute: Number.parseInt(partMap.minute || '0', 10),
    hour: Number.parseInt(partMap.hour || '0', 10),
    dayOfMonth: Number.parseInt(partMap.day || '1', 10),
    dayOfWeek: WEEKDAY_TO_CRON[weekday] ?? 0,
  };
}

function buildCronPattern(recurrence: RecurrenceType, startsAt: Date, timezone: string): string {
  const parts = parseTimePartsInTimezone(startsAt, timezone);
  if (recurrence === 'daily') {
    return `${parts.minute} ${parts.hour} * * *`;
  }
  if (recurrence === 'weekly') {
    return `${parts.minute} ${parts.hour} * * ${parts.dayOfWeek}`;
  }
  return `${parts.minute} ${parts.hour} ${parts.dayOfMonth} * *`;
}

function computeNextRun(startsAt: Date, recurrence: RecurrenceType): Date {
  const now = new Date();
  const nextRun = new Date(startsAt);
  if (nextRun > now) {
    return nextRun;
  }

  while (nextRun <= now) {
    if (recurrence === 'daily') {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
      continue;
    }
    if (recurrence === 'weekly') {
      nextRun.setUTCDate(nextRun.getUTCDate() + 7);
      continue;
    }
    nextRun.setUTCMonth(nextRun.getUTCMonth() + 1);
  }

  return nextRun;
}

async function removeScheduledJobs(postId: string): Promise<void> {
  const delayedJobs = await postQueue.getDelayed();
  for (const job of delayedJobs) {
    if (job.data.postId === postId) {
      await job.remove();
    }
  }

  const recurringJobId = getRecurringJobId(postId);
  const repeatableJobs = await postQueue.getRepeatableJobs();
  for (const repeatableJob of repeatableJobs) {
    if (repeatableJob.id === recurringJobId) {
      await postQueue.removeRepeatableByKey(repeatableJob.key);
    }
  }

  const upcomingReminderJob = await upcomingReminderQueue.getJob(getUpcomingReminderJobId(postId));
  if (upcomingReminderJob) {
    await upcomingReminderJob.remove();
  }
}

async function scheduleUpcomingReminder(postId: string, scheduledAt: Date): Promise<void> {
  if (scheduledAt.getTime() <= Date.now()) {
    return;
  }

  const reminderAt = scheduledAt.getTime() - upcomingLeadMs;
  const delay = Math.max(0, reminderAt - Date.now());
  await upcomingReminderQueue.add(
    'upcoming-reminder',
    { postId },
    {
      jobId: getUpcomingReminderJobId(postId),
      delay,
    },
  );
}

// Queue for scheduled posts
export const postQueue = new Queue('post-publishing', {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const analyticsQueue = new Queue('analytics-ingestion', {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 2000 },
  },
});

export const upcomingReminderQueue = new Queue('upcoming-reminders', {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 2000 },
  },
});

export const analyticsDigestQueue = new Queue('analytics-digests', {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 2000 },
  },
});

export const connectionHealthQueue = new Queue('connection-health-monitoring', {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 2000 },
  },
});

export const mediaRetentionQueue = new Queue('media-retention-cleanup', {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 500 },
  },
});

// Worker processes scheduled posts
export const postWorker = new Worker(
  'post-publishing',
  async (job: Job) => {
    const { postId } = job.data;
    console.log(`[Scheduler] Publishing post ${postId}`);

    await prisma.post.update({
      where: { id: postId },
      data: { status: 'publishing' },
    });

    const results = await postService.publishPost(postId);
    return results;
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 5,
  },
);

export const analyticsWorker = new Worker(
  'analytics-ingestion',
  async (job: Job) => {
    const { workspaceId } = (job.data || {}) as { workspaceId?: string };
    if (workspaceId) {
      return analyticsService.collectWorkspaceSnapshots(workspaceId);
    }
    return analyticsService.collectSnapshotsForAllWorkspaces();
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 2,
  },
);

export const upcomingReminderWorker = new Worker(
  'upcoming-reminders',
  async (job: Job) => {
    const { postId } = (job.data || {}) as { postId?: string };
    if (!postId) return;
    await notificationService.notifyUpcomingScheduledPost(postId);
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 5,
  },
);

export const analyticsDigestWorker = new Worker(
  'analytics-digests',
  async (job: Job) => {
    const { period, workspaceId } = (job.data || {}) as {
      period?: AnalyticsDigestPeriod;
      workspaceId?: string;
    };
    if (period !== 'weekly' && period !== 'monthly') {
      throw new Error('Invalid analytics digest period');
    }
    if (workspaceId) {
      return notificationService.notifyWorkspaceAnalyticsDigest(workspaceId, period);
    }
    return notificationService.notifyAnalyticsDigestForAllWorkspaces(period);
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 2,
  },
);

export const connectionHealthWorker = new Worker(
  'connection-health-monitoring',
  async (job: Job) => {
    const { workspaceId } = (job.data || {}) as { workspaceId?: string };
    return connectionService.monitorConnectionHealth(workspaceId);
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 1,
  },
);

export const mediaRetentionWorker = new Worker(
  'media-retention-cleanup',
  async () => {
    const stats = await purgeExpiredMedia();
    console.log('[Scheduler] Media retention cleanup run completed', stats);
    return stats;
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 1,
  },
);

postWorker.on('completed', (job) => {
  console.log(`[Scheduler] Post ${job.data.postId} published successfully`);
});

postWorker.on('failed', (job, err) => {
  console.error(`[Scheduler] Post ${job?.data?.postId} failed:`, err.message);
});

analyticsWorker.on('completed', (job) => {
  if (job.data?.workspaceId) {
    console.log(`[Scheduler] Analytics collected for workspace ${job.data.workspaceId as string}`);
    return;
  }
  console.log('[Scheduler] Analytics collection run completed');
});

analyticsWorker.on('failed', (job, err) => {
  const suffix = job?.data?.workspaceId ? ` workspace ${job.data.workspaceId as string}` : '';
  console.error(`[Scheduler] Analytics collection failed${suffix}:`, err.message);
});

upcomingReminderWorker.on('completed', (job) => {
  if (job.data?.postId) {
    console.log(`[Scheduler] Upcoming reminder sent for post ${job.data.postId as string}`);
  }
});

upcomingReminderWorker.on('failed', (job, err) => {
  const suffix = job?.data?.postId ? ` post ${job.data.postId as string}` : '';
  console.error(`[Scheduler] Upcoming reminder failed${suffix}:`, err.message);
});

analyticsDigestWorker.on('completed', (job) => {
  if (job.data?.period) {
    console.log(`[Scheduler] Analytics ${job.data.period as string} digest run completed`);
  }
});

analyticsDigestWorker.on('failed', (job, err) => {
  const suffix = job?.data?.period ? ` ${job.data.period as string}` : '';
  console.error(`[Scheduler] Analytics digest run failed${suffix}:`, err.message);
});

connectionHealthWorker.on('completed', (job) => {
  const scope = job.data?.workspaceId ? `workspace ${job.data.workspaceId as string}` : 'all workspaces';
  console.log(`[Scheduler] Connection health check completed for ${scope}`);
});

connectionHealthWorker.on('failed', (job, err) => {
  const suffix = job?.data?.workspaceId ? ` workspace ${job.data.workspaceId as string}` : '';
  console.error(`[Scheduler] Connection health check failed${suffix}:`, err.message);
});

mediaRetentionWorker.on('failed', (_job, err) => {
  console.error('[Scheduler] Media retention cleanup failed:', err.message);
});

// Schedule a post for future publishing
export async function schedulePost(postId: string, scheduledAt: Date): Promise<string> {
  await removeScheduledJobs(postId);
  const delay = scheduledAt.getTime() - Date.now();

  if (delay <= 0) {
    const job = await postQueue.add('publish', { postId });
    await prisma.schedule.updateMany({
      where: { postId },
      data: {
        cronExpr: null,
        isActive: false,
        nextRunAt: null,
      },
    });
    return job.id || '';
  }

  const job = await postQueue.add('publish', { postId }, { delay });

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'scheduled', scheduledAt },
  });
  await prisma.schedule.updateMany({
    where: { postId },
    data: {
      cronExpr: null,
      isActive: false,
      nextRunAt: null,
    },
  });
  await scheduleUpcomingReminder(postId, scheduledAt);

  return job.id || '';
}

export async function scheduleRecurringPost(
  postId: string,
  options: { startsAt: Date; recurrence: RecurrenceType; timezone: string },
) {
  const { startsAt, recurrence, timezone } = options;
  await removeScheduledJobs(postId);

  const cronPattern = buildCronPattern(recurrence, startsAt, timezone);
  const recurringJobId = getRecurringJobId(postId);
  const job = await postQueue.add(
    'publish',
    { postId },
    {
      jobId: recurringJobId,
      repeat: {
        pattern: cronPattern,
        tz: timezone,
        startDate: startsAt,
      },
    },
  );

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: 'scheduled',
      scheduledAt: startsAt,
    },
  });

  const nextRunAt = computeNextRun(startsAt, recurrence);
  await prisma.schedule.upsert({
    where: { postId },
    create: {
      postId,
      cronExpr: cronPattern,
      timezone,
      nextRunAt,
      isActive: true,
    },
    update: {
      cronExpr: cronPattern,
      timezone,
      nextRunAt,
      isActive: true,
    },
  });
  await scheduleUpcomingReminder(postId, nextRunAt);

  return {
    jobId: job.id || recurringJobId,
    cronExpr: cronPattern,
    timezone,
    nextRunAt,
  };
}

// Cancel a scheduled post
export async function cancelScheduledPost(postId: string) {
  await removeScheduledJobs(postId);

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'draft', scheduledAt: null },
  });
  await prisma.schedule.updateMany({
    where: { postId },
    data: {
      isActive: false,
      nextRunAt: null,
    },
  });
}

function getAnalyticsIngestionIntervalMs(): number {
  const raw = Number.parseInt(process.env.ANALYTICS_INGESTION_INTERVAL_MINUTES || '30', 10);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 30;
  return minutes * 60 * 1000;
}

function getConnectionHealthIntervalMs(): number {
  const raw = Number.parseInt(process.env.CONNECTION_HEALTH_CHECK_INTERVAL_MINUTES || '60', 10);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 60;
  return minutes * 60 * 1000;
}

function getMediaRetentionIntervalMs(): number {
  const raw = Number.parseInt(process.env.MEDIA_RETENTION_CLEANUP_INTERVAL_HOURS || '24', 10);
  const hours = Number.isFinite(raw) && raw > 0 ? raw : 24;
  return hours * 60 * 60 * 1000;
}

export async function scheduleAnalyticsIngestion() {
  const intervalMs = getAnalyticsIngestionIntervalMs();
  const job = await analyticsQueue.add(
    'collect-all',
    {},
    {
      repeat: { every: intervalMs },
      jobId: 'analytics-recurring-collection',
    },
  );
  return {
    jobId: job.id || '',
    intervalMs,
  };
}

export async function scheduleConnectionHealthMonitoring() {
  const intervalMs = getConnectionHealthIntervalMs();
  const job = await connectionHealthQueue.add(
    'check-all-connections',
    {},
    {
      repeat: { every: intervalMs },
      jobId: 'connection-health-monitoring',
    },
  );

  return {
    jobId: job.id || '',
    intervalMs,
  };
}

export async function scheduleMediaRetentionCleanup() {
  const intervalMs = getMediaRetentionIntervalMs();
  const job = await mediaRetentionQueue.add(
    'purge-expired-media',
    {},
    {
      repeat: { every: intervalMs },
      jobId: 'media-retention-cleanup',
    },
  );
  return {
    jobId: job.id || '',
    intervalMs,
  };
}

export async function collectWorkspaceAnalytics(workspaceId: string) {
  const job = await analyticsQueue.add('collect-workspace', { workspaceId });
  return job.id || '';
}

export async function scheduleAnalyticsDigestReports() {
  const timezone = process.env.ANALYTICS_REPORT_TIMEZONE || 'UTC';
  const weeklyPattern = process.env.ANALYTICS_WEEKLY_REPORT_CRON || '0 9 * * 1';
  const monthlyPattern = process.env.ANALYTICS_MONTHLY_REPORT_CRON || '0 9 1 * *';

  const [weeklyJob, monthlyJob] = await Promise.all([
    analyticsDigestQueue.add(
      'digest-weekly',
      { period: 'weekly' as AnalyticsDigestPeriod },
      {
        repeat: { pattern: weeklyPattern, tz: timezone },
        jobId: 'analytics-digest-weekly',
      },
    ),
    analyticsDigestQueue.add(
      'digest-monthly',
      { period: 'monthly' as AnalyticsDigestPeriod },
      {
        repeat: { pattern: monthlyPattern, tz: timezone },
        jobId: 'analytics-digest-monthly',
      },
    ),
  ]);

  return {
    weeklyJobId: weeklyJob.id || '',
    monthlyJobId: monthlyJob.id || '',
    timezone,
    weeklyPattern,
    monthlyPattern,
  };
}

export async function pausePublishingQueue() {
  await postQueue.pause();
  return { paused: true };
}

export async function resumePublishingQueue() {
  await postQueue.resume();
  return { paused: false };
}

// Get queue stats
export async function getQueueStats() {
  const [waiting, active, delayed, completed, failed, paused, repeatableJobs] = await Promise.all([
    postQueue.getWaitingCount(),
    postQueue.getActiveCount(),
    postQueue.getDelayedCount(),
    postQueue.getCompletedCount(),
    postQueue.getFailedCount(),
    postQueue.isPaused(),
    postQueue.getRepeatableJobs(),
  ]);

  return {
    waiting,
    active,
    delayed,
    completed,
    failed,
    paused,
    recurring: repeatableJobs.length,
  };
}

// ?????? Daily Trial Reminder & Expiry Job ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
export async function runTrialCheckJob(): Promise<void> {
  try {
    const { prisma } = await import('../config/database.js');
    const { emailService } = await import('../services/email.service.js');
    const now = new Date();
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://smmtai.com';
    const upgradeUrl = `${FRONTEND_URL}/checkout?priceKey=pro_monthly`;

    function dayBoundary(daysFromNow: number): { start: Date; end: Date } {
      const start = new Date(now);
      start.setDate(start.getDate() + daysFromNow);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    // 1. Expire overdue trials
    const expired = await prisma.subscription.findMany({
      where: { status: 'trialing', trialEndsAt: { lt: now } },
    });
    for (const sub of expired) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { tier: 'basic', status: 'active' } });
      const workspace = await prisma.workspace.findUnique({
        where: { id: sub.workspaceId },
        include: { owner: { select: { email: true, name: true } } }
      }).catch(() => null);
      const user = workspace?.owner;
      if (user?.email) await emailService.sendTrialExpired(user.email, user.name || 'there', upgradeUrl).catch(console.error);
      console.log(`[TrialJob] Expired: workspace ${sub.workspaceId}`);
    }

    // 2. Send reminders at 7, 3, 1 days remaining
    for (const daysLeft of [7, 3, 1]) {
      const { start, end } = dayBoundary(daysLeft);
      const reminders = await prisma.subscription.findMany({
        where: { status: 'trialing', trialEndsAt: { gte: start, lte: end } },
      });
      for (const sub of reminders) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: sub.workspaceId },
          include: { owner: { select: { email: true, name: true } } }
        }).catch(() => null);
        const user = workspace?.owner;
        if (user?.email) {
          await emailService.sendTrialReminder(user.email, user.name || 'there', daysLeft, upgradeUrl).catch(console.error);
          console.log(`[TrialJob] Sent ${daysLeft}d reminder to ${user.email}`);
        }
      }
    }

    // 3. Expire overdue subscriptions
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: { 
        status: 'active', 
        tier: { not: 'basic' }, 
        currentPeriodEnd: { lt: now } 
      },
    });
    for (const sub of expiredSubscriptions) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { tier: 'basic', currentPeriodEnd: null } });
      const workspace = await prisma.workspace.findUnique({
        where: { id: sub.workspaceId },
        include: { owner: { select: { email: true, name: true } } }
      }).catch(() => null);
      const user = workspace?.owner;
      // We could add an email notification here if desired
      console.log(`[TrialJob] Expired subscription: workspace ${sub.workspaceId}`);
    }

    console.log(`[TrialJob] Done. Expired trials: ${expired.length}, Expired subscriptions: ${expiredSubscriptions.length}`);
  } catch (err) { console.error('[TrialJob] Error:', err); }
}

export function scheduleTrialChecker(): void {
  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(8, 0, 0, 0);
  if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  const delay = nextRun.getTime() - now.getTime();
  console.log(`[TrialJob] First run in ${Math.round(delay/60000)}min`);
  setTimeout(() => { runTrialCheckJob(); setInterval(runTrialCheckJob, 24*60*60*1000); }, delay);
}
