import { prisma } from '../config/database.js';
import { emailService } from './email.service.js';
import { analyticsService } from './analytics.service.js';

export interface NotificationPreferences {
  postPublished: boolean;
  postFailed: boolean;
  upcomingScheduled: boolean;
  weeklyAnalyticsDigest: boolean;
  monthlyAnalyticsDigest: boolean;
}

type NotificationEvent = keyof NotificationPreferences;
type NotificationDigestPeriod = 'weekly' | 'monthly';

type NotificationRecipient = {
  id: string;
  email: string;
  name: string;
};

const defaultPreferences: NotificationPreferences = {
  postPublished: true,
  postFailed: true,
  upcomingScheduled: true,
  weeklyAnalyticsDigest: true,
  monthlyAnalyticsDigest: true,
};

const upcomingLeadMinutes = (() => {
  const parsed = Number.parseInt(process.env.UPCOMING_NOTIFICATION_LEAD_MINUTES || '60', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
})();

let ensurePreferencesTablePromise: Promise<void> | null = null;

function normalizePreferenceInput(
  input: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  return {
    postPublished: typeof input?.postPublished === 'boolean'
      ? input.postPublished
      : defaultPreferences.postPublished,
    postFailed: typeof input?.postFailed === 'boolean'
      ? input.postFailed
      : defaultPreferences.postFailed,
    upcomingScheduled: typeof input?.upcomingScheduled === 'boolean'
      ? input.upcomingScheduled
      : defaultPreferences.upcomingScheduled,
    weeklyAnalyticsDigest: typeof input?.weeklyAnalyticsDigest === 'boolean'
      ? input.weeklyAnalyticsDigest
      : defaultPreferences.weeklyAnalyticsDigest,
    monthlyAnalyticsDigest: typeof input?.monthlyAnalyticsDigest === 'boolean'
      ? input.monthlyAnalyticsDigest
      : defaultPreferences.monthlyAnalyticsDigest,
  };
}

async function ensurePreferencesTable() {
  if (!ensurePreferencesTablePromise) {
    ensurePreferencesTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "notification_preferences" (
          "user_id" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
          "post_published" BOOLEAN NOT NULL DEFAULT TRUE,
          "post_failed" BOOLEAN NOT NULL DEFAULT TRUE,
          "upcoming_scheduled" BOOLEAN NOT NULL DEFAULT TRUE,
          "weekly_analytics_digest" BOOLEAN NOT NULL DEFAULT TRUE,
          "monthly_analytics_digest" BOOLEAN NOT NULL DEFAULT TRUE,
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "notification_preferences"
        ADD COLUMN IF NOT EXISTS "weekly_analytics_digest" BOOLEAN NOT NULL DEFAULT TRUE;
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "notification_preferences"
        ADD COLUMN IF NOT EXISTS "monthly_analytics_digest" BOOLEAN NOT NULL DEFAULT TRUE;
      `);
    })().then(() => undefined);
  }

  await ensurePreferencesTablePromise;
}

function contentPreview(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
}

function digestEventFromPeriod(period: NotificationDigestPeriod): NotificationEvent {
  return period === 'weekly' ? 'weeklyAnalyticsDigest' : 'monthlyAnalyticsDigest';
}

function summarizeTopPlatforms(platformBreakdown: Record<string, number> | undefined): string {
  const entries = Object.entries(platformBreakdown || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (entries.length === 0) return 'No platform activity yet';
  return entries.map(([platform, count]) => `${platform} (${count})`).join(', ');
}

export class NotificationService {
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    await ensurePreferencesTable();
    const rows = await prisma.$queryRaw<Array<{
      post_published: boolean;
      post_failed: boolean;
      upcoming_scheduled: boolean;
      weekly_analytics_digest: boolean;
      monthly_analytics_digest: boolean;
    }>>`
      SELECT "post_published", "post_failed", "upcoming_scheduled", "weekly_analytics_digest", "monthly_analytics_digest"
      FROM "notification_preferences"
      WHERE "user_id" = ${userId}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return defaultPreferences;

    return normalizePreferenceInput({
      postPublished: row.post_published,
      postFailed: row.post_failed,
      upcomingScheduled: row.upcoming_scheduled,
      weeklyAnalyticsDigest: row.weekly_analytics_digest,
      monthlyAnalyticsDigest: row.monthly_analytics_digest,
    });
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    await ensurePreferencesTable();
    const merged = normalizePreferenceInput({
      ...(await this.getUserPreferences(userId)),
      ...preferences,
    });

    await prisma.$executeRaw`
      INSERT INTO "notification_preferences" (
        "user_id",
        "post_published",
        "post_failed",
        "upcoming_scheduled",
        "weekly_analytics_digest",
        "monthly_analytics_digest",
        "updated_at"
      )
      VALUES (
        ${userId},
        ${merged.postPublished},
        ${merged.postFailed},
        ${merged.upcomingScheduled},
        ${merged.weeklyAnalyticsDigest},
        ${merged.monthlyAnalyticsDigest},
        NOW()
      )
      ON CONFLICT ("user_id")
      DO UPDATE SET
        "post_published" = EXCLUDED."post_published",
        "post_failed" = EXCLUDED."post_failed",
        "upcoming_scheduled" = EXCLUDED."upcoming_scheduled",
        "weekly_analytics_digest" = EXCLUDED."weekly_analytics_digest",
        "monthly_analytics_digest" = EXCLUDED."monthly_analytics_digest",
        "updated_at" = NOW()
    `;

    return merged;
  }

  private async getWorkspaceRecipients(
    workspaceId: string,
    event: NotificationEvent,
  ): Promise<NotificationRecipient[]> {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailVerified: true,
          },
        },
      },
    });

    const recipients: NotificationRecipient[] = [];
    for (const member of members) {
      if (!member.user.emailVerified) continue;
      const preferences = await this.getUserPreferences(member.user.id);
      if (!preferences[event]) continue;

      recipients.push({
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
      });
    }

    return recipients;
  }

  async notifyPostPublished(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        workspaceId: true,
        content: true,
        publishedAt: true,
        author: { select: { name: true } },
      },
    });
    if (!post) return;

    const recipients = await this.getWorkspaceRecipients(post.workspaceId, 'postPublished');
    if (recipients.length === 0) return;

    const publishedAt = post.publishedAt || new Date();
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/analytics`;
    await Promise.allSettled(
      recipients.map((recipient) =>
        emailService.sendPostPublishedEmail({
          email: recipient.email,
          name: recipient.name,
          authorName: post.author.name,
          contentPreview: contentPreview(post.content),
          publishedAt,
          link,
        })),
    );
  }

  async notifyPostFailed(postId: string, reason: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        workspaceId: true,
        content: true,
        author: { select: { name: true } },
      },
    });
    if (!post) return;

    const recipients = await this.getWorkspaceRecipients(post.workspaceId, 'postFailed');
    if (recipients.length === 0) return;

    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/compose`;
    await Promise.allSettled(
      recipients.map((recipient) =>
        emailService.sendPostFailedEmail({
          email: recipient.email,
          name: recipient.name,
          authorName: post.author.name,
          contentPreview: contentPreview(post.content),
          reason,
          link,
        })),
    );
  }

  async notifyUpcomingScheduledPost(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        workspaceId: true,
        content: true,
        scheduledAt: true,
        author: { select: { name: true } },
      },
    });
    if (!post || !post.scheduledAt) return;
    const scheduledAt = post.scheduledAt;
    if (scheduledAt.getTime() <= Date.now()) return;

    const recipients = await this.getWorkspaceRecipients(post.workspaceId, 'upcomingScheduled');
    if (recipients.length === 0) return;

    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/calendar`;
    await Promise.allSettled(
      recipients.map((recipient) =>
        emailService.sendUpcomingScheduledPostEmail({
          email: recipient.email,
          name: recipient.name,
          authorName: post.author.name,
          contentPreview: contentPreview(post.content),
          scheduledAt,
          minutesUntil: Math.max(1, Math.round((scheduledAt.getTime() - Date.now()) / 60000)),
          leadMinutes: upcomingLeadMinutes,
          link,
        })),
    );
  }

  async notifyWorkspaceAnalyticsDigest(workspaceId: string, period: NotificationDigestPeriod) {
    const [workspace, overview, topPosts] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true },
      }),
      analyticsService.getOverview(workspaceId, period === 'weekly' ? 7 : 30),
      analyticsService.getTopPosts(workspaceId, 5),
    ]);
    if (!workspace) {
      return { workspaceId, recipients: 0 };
    }

    const recipients = await this.getWorkspaceRecipients(workspaceId, digestEventFromPeriod(period));
    if (recipients.length === 0) {
      return { workspaceId, recipients: 0 };
    }

    const days = period === 'weekly' ? 7 : 30;
    const topPostsSummary = topPosts
      .slice(0, 3)
      .map((post: any, index: number) => {
        const content = typeof post.post?.content === 'string'
          ? contentPreview(post.post.content)
          : 'Untitled post';
        const score = Math.round(post.engagementScore || 0);
        return `${index + 1}. ${content} — score ${score}`;
      });

    const topPlatforms = summarizeTopPlatforms(overview.platformBreakdown);
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/analytics`;
    await Promise.allSettled(
      recipients.map((recipient) =>
        emailService.sendAnalyticsDigestEmail({
          email: recipient.email,
          name: recipient.name,
          workspaceName: workspace.name,
          period,
          days,
          totalPosts: overview.totalPosts,
          publishedPosts: overview.publishedPosts,
          engagementRate: overview.engagementRate,
          impressions: overview.metrics.impressions,
          clicks: overview.metrics.clicks,
          topPlatforms,
          topPosts: topPostsSummary,
          link,
        })),
    );

    return { workspaceId, recipients: recipients.length };
  }

  async notifyAnalyticsDigestForAllWorkspaces(period: NotificationDigestPeriod) {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true },
    });
    const results = await Promise.allSettled(
      workspaces.map((workspace) => this.notifyWorkspaceAnalyticsDigest(workspace.id, period)),
    );

    return {
      period,
      total: workspaces.length,
      sent: results.filter((result) => result.status === 'fulfilled' && result.value.recipients > 0).length,
      skipped: results.filter((result) => result.status === 'fulfilled' && result.value.recipients === 0).length,
      failed: results.filter((result) => result.status === 'rejected').length,
    };
  }
}

export const notificationService = new NotificationService();
