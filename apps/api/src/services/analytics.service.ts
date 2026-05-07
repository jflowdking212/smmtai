import { prisma } from '../config/database.js';
import type { PlatformType } from '@ee-postmind/shared';
import { connectionService } from './connection.service.js';
import { getPlatformAdapter } from './platforms/index.js';

type SnapshotMetrics = {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
};

type WorkspaceSnapshotCollection = {
  workspaceId: string;
  processed: number;
  collected: number;
  skipped: number;
  failed: number;
  failures: Array<{ platformPostId: string; platform: string; message: string }>;
};

type InsightSeverity = 'success' | 'warning' | 'info';

type AnalyticsInsight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  metric?: {
    label: string;
    value: string;
  };
};

function emptyMetrics(): SnapshotMetrics {
  return {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    saves: 0,
  };
}

export class AnalyticsService {
  async collectWorkspaceSnapshots(workspaceId: string) {
    const publishedPlatformPosts = await prisma.platformPost.findMany({
      where: {
        post: { workspaceId, status: { in: ['published', 'partial'] } },
        status: 'published',
        platformPostId: { not: null },
      },
      select: {
        id: true,
        platform: true,
        platformPostId: true,
        socialConnectionId: true,
      },
    });

    const summary: WorkspaceSnapshotCollection = {
      workspaceId,
      processed: 0,
      collected: 0,
      skipped: 0,
      failed: 0,
      failures: [] as Array<{ platformPostId: string; platform: string; message: string }>,
    };

    for (const platformPost of publishedPlatformPosts) {
      summary.processed += 1;

      const adapter = getPlatformAdapter(platformPost.platform as PlatformType);
      if (!adapter.getPostAnalytics || !platformPost.platformPostId) {
        summary.skipped += 1;
        continue;
      }

      try {
        const accessToken = await connectionService.getAccessToken(platformPost.socialConnectionId);
        const metrics = await adapter.getPostAnalytics(accessToken, platformPost.platformPostId);
        const impressions = metrics.impressions || 0;
        const likes = metrics.likes || 0;
        const comments = metrics.comments || 0;
        const shares = metrics.shares || 0;
        const engagementRate = impressions > 0 ? ((likes + comments + shares) / impressions) * 100 : 0;

        await prisma.analyticsSnapshot.create({
          data: {
            platformPostId: platformPost.id,
            impressions,
            reach: metrics.reach || 0,
            likes,
            comments,
            shares,
            clicks: metrics.clicks || 0,
            saves: metrics.saves || 0,
            engagementRate,
            metadata: metrics.metadata as any,
          },
        });
        summary.collected += 1;
      } catch (error) {
        summary.failed += 1;
        summary.failures.push({
          platformPostId: platformPost.id,
          platform: platformPost.platform,
          message: error instanceof Error ? error.message : 'Analytics collection failed',
        });
      }
    }

    return summary;
  }

  async collectSnapshotsForAllWorkspaces() {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true },
    });

    const results: WorkspaceSnapshotCollection[] = [];
    for (const workspace of workspaces) {
      results.push(await this.collectWorkspaceSnapshots(workspace.id));
    }

    return {
      workspaces: results.length,
      processed: results.reduce((sum, item) => sum + item.processed, 0),
      collected: results.reduce((sum, item) => sum + item.collected, 0),
      skipped: results.reduce((sum, item) => sum + item.skipped, 0),
      failed: results.reduce((sum, item) => sum + item.failed, 0),
      results,
    };
  }

  // Get overview stats for a workspace
  async getOverview(workspaceId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalPosts,
      publishedPosts,
      connections,
      recentPosts,
    ] = await Promise.all([
      prisma.post.count({ where: { workspaceId } }),
      prisma.post.count({ where: { workspaceId, status: 'published' } }),
      prisma.socialConnection.count({ where: { workspaceId, isActive: true } }),
      prisma.post.findMany({
        where: { workspaceId, publishedAt: { gte: since } },
        include: {
          platformPosts: {
            select: { platform: true, status: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: 50,
      }),
    ]);

    const platformPosts = await prisma.platformPost.findMany({
      where: {
        post: { workspaceId, publishedAt: { gte: since } },
        status: 'published',
      },
      include: {
        analytics: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
      },
    });

    const totals = emptyMetrics();
    platformPosts.forEach((platformPost: any) => {
      const latest = platformPost.analytics[0];
      if (!latest) return;
      totals.impressions += latest.impressions || 0;
      totals.reach += latest.reach || 0;
      totals.likes += latest.likes || 0;
      totals.comments += latest.comments || 0;
      totals.shares += latest.shares || 0;
      totals.clicks += latest.clicks || 0;
      totals.saves += latest.saves || 0;
    });

    const engagementRate = totals.impressions > 0
      ? ((totals.likes + totals.comments + totals.shares) / totals.impressions * 100).toFixed(2)
      : '0.00';

    // Posts per day for trend chart
    const postsPerDay: Record<string, number> = {};
    recentPosts.forEach((p: any) => {
      if (p.publishedAt) {
        const key = new Date(p.publishedAt).toISOString().slice(0, 10);
        postsPerDay[key] = (postsPerDay[key] || 0) + 1;
      }
    });

    // Platform breakdown
    const platformBreakdown: Record<string, number> = {};
    platformPosts.forEach((platformPost: any) => {
      platformBreakdown[platformPost.platform] = (platformBreakdown[platformPost.platform] || 0) + 1;
    });

    return {
      totalPosts,
      publishedPosts,
      connectedAccounts: connections,
      metrics: totals,
      engagementRate: parseFloat(engagementRate),
      postsPerDay,
      platformBreakdown,
      recentPosts: recentPosts.slice(0, 10),
    };
  }

  // Get per-platform analytics
  async getPlatformAnalytics(workspaceId: string, platform: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const platformPosts = await prisma.platformPost.findMany({
      where: {
        platform,
        post: { workspaceId, publishedAt: { gte: since } },
        status: 'published',
      },
      include: {
        post: { select: { content: true, publishedAt: true } },
        analytics: { orderBy: { capturedAt: 'desc' }, take: 1 },
      },
      orderBy: { publishedAt: 'desc' },
    });

    const posts = platformPosts.map((pp: any) => ({
      id: pp.id,
      content: pp.post.content?.slice(0, 100),
      publishedAt: pp.publishedAt,
      status: pp.status,
      metrics: pp.analytics[0] || null,
    }));

    // Aggregate
    let totalImpressions = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
    platformPosts.forEach((pp: any) => {
      const a = pp.analytics[0];
      if (a) {
        totalImpressions += a.impressions || 0;
        totalLikes += a.likes || 0;
        totalComments += a.comments || 0;
        totalShares += a.shares || 0;
      }
    });

    return {
      platform,
      totalPosts: platformPosts.length,
      metrics: { impressions: totalImpressions, likes: totalLikes, comments: totalComments, shares: totalShares },
      posts,
    };
  }

  async getInsights(workspaceId: string, days = 30) {
    const [overview, topPosts] = await Promise.all([
      this.getOverview(workspaceId, days),
      this.getTopPosts(workspaceId, 10),
    ]);

    const insights: AnalyticsInsight[] = [];
    const weeks = Math.max(days / 7, 1);
    const postsPerWeek = overview.publishedPosts / weeks;

    if (overview.publishedPosts === 0) {
      insights.push({
        id: 'publish-more',
        severity: 'warning',
        title: 'No published posts in this period',
        description: `Publish at least 3 times per week to build baseline engagement signals over ${days} days.`,
      });
    } else if (postsPerWeek < 3) {
      insights.push({
        id: 'posting-frequency',
        severity: 'info',
        title: 'Increase posting cadence',
        description: `You are publishing about ${postsPerWeek.toFixed(1)} posts/week. Aim for 3+ posts/week for steadier growth.`,
        metric: {
          label: 'Posts/week',
          value: postsPerWeek.toFixed(1),
        },
      });
    } else {
      insights.push({
        id: 'posting-frequency',
        severity: 'success',
        title: 'Healthy posting cadence',
        description: `You are averaging ${postsPerWeek.toFixed(1)} posts/week across the selected period.`,
        metric: {
          label: 'Posts/week',
          value: postsPerWeek.toFixed(1),
        },
      });
    }

    if (overview.engagementRate >= 5) {
      insights.push({
        id: 'engagement-rate',
        severity: 'success',
        title: 'Strong engagement rate',
        description: 'Your engagement rate is outperforming typical baseline social performance.',
        metric: {
          label: 'Engagement rate',
          value: `${overview.engagementRate.toFixed(2)}%`,
        },
      });
    } else if (overview.engagementRate > 0 && overview.engagementRate < 1) {
      insights.push({
        id: 'engagement-rate',
        severity: 'warning',
        title: 'Low engagement rate',
        description: 'Try question-led hooks, clear CTAs, and tighter post copy to increase interactions.',
        metric: {
          label: 'Engagement rate',
          value: `${overview.engagementRate.toFixed(2)}%`,
        },
      });
    } else {
      insights.push({
        id: 'engagement-rate',
        severity: 'info',
        title: 'Engagement rate is building',
        description: 'Keep iterating post formats and posting windows to improve response rate.',
        metric: {
          label: 'Engagement rate',
          value: `${overview.engagementRate.toFixed(2)}%`,
        },
      });
    }

    if (overview.metrics.impressions > 0) {
      const clickThroughRate = (overview.metrics.clicks / overview.metrics.impressions) * 100;
      insights.push({
        id: 'click-through-rate',
        severity: clickThroughRate >= 1 ? 'success' : 'info',
        title: clickThroughRate >= 1 ? 'Solid click-through rate' : 'Click-through opportunity',
        description: clickThroughRate >= 1
          ? 'Your posts are converting impressions into clicks effectively.'
          : 'Add stronger calls to action and clearer link context to improve click-through.',
        metric: {
          label: 'CTR',
          value: `${clickThroughRate.toFixed(2)}%`,
        },
      });
    }

    const topPost = Array.isArray(topPosts) && topPosts.length > 0 ? topPosts[0] : null;
    if (topPost) {
      const platformLabel = (topPost.platform || 'unknown').toString();
      const score = Math.round(topPost.engagementScore || 0);
      const topContent = typeof topPost.post?.content === 'string' ? topPost.post.content : '';
      const contentPattern = topContent.includes('?')
        ? 'Question-based content appears to resonate well with your audience.'
        : 'Replicating this tone and structure can help lift future post performance.';
      insights.push({
        id: 'top-post-pattern',
        severity: 'success',
        title: `Top performer on ${platformLabel}`,
        description: `${contentPattern}`,
        metric: {
          label: 'Engagement score',
          value: `${score}`,
        },
      });
    }

    const byWeekday = new Map<string, number>();
    topPosts.forEach((post: any) => {
      const publishedAt = post?.post?.publishedAt ? new Date(post.post.publishedAt) : null;
      if (!publishedAt || Number.isNaN(publishedAt.getTime())) return;
      const weekday = publishedAt.toLocaleDateString('en-US', { weekday: 'long' });
      const current = byWeekday.get(weekday) || 0;
      byWeekday.set(weekday, current + (post.engagementScore || 0));
    });
    const bestDay = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bestDay) {
      insights.push({
        id: 'best-day',
        severity: 'info',
        title: 'Best-performing weekday',
        description: `${bestDay[0]} currently drives your highest weighted engagement from recent top posts.`,
        metric: {
          label: 'Weighted score',
          value: `${Math.round(bestDay[1])}`,
        },
      });
    }

    return {
      periodDays: days,
      generatedAt: new Date().toISOString(),
      insights,
    };
  }

  // Fetch live analytics for a single post across all its platforms
  async getPostAnalytics(postId: string, workspaceId: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: {
        platformPosts: {
          include: { analytics: { orderBy: { capturedAt: 'desc' }, take: 1 } },
        },
      },
    });
    if (!post) throw new Error('Post not found');

    const results: Array<{
      platformPostId: string;
      platform: string;
      status: string;
      metrics: SnapshotMetrics | null;
      error: string | null;
      fetchedLive: boolean;
    }> = [];

    for (const pp of post.platformPosts) {
      if (pp.status !== 'published' || !pp.platformPostId) {
        const cached = pp.analytics[0] || null;
        results.push({
          platformPostId: pp.id,
          platform: pp.platform,
          status: pp.status,
          metrics: cached ? {
            impressions: cached.impressions, reach: cached.reach,
            likes: cached.likes, comments: cached.comments,
            shares: cached.shares, clicks: cached.clicks, saves: cached.saves,
          } : null,
          error: null,
          fetchedLive: false,
        });
        continue;
      }

      try {
        const adapter = getPlatformAdapter(pp.platform as PlatformType);
        if (!adapter.getPostAnalytics) throw new Error('Analytics not supported');
        const accessToken = await connectionService.getAccessToken(pp.socialConnectionId);
        const live = await adapter.getPostAnalytics(accessToken, pp.platformPostId);

        const metrics: SnapshotMetrics = {
          impressions: live.impressions || 0,
          reach: live.reach || 0,
          likes: live.likes || 0,
          comments: live.comments || 0,
          shares: live.shares || 0,
          clicks: live.clicks || 0,
          saves: live.saves || 0,
        };

        // Store snapshot
        const engagementRate = metrics.impressions > 0
          ? ((metrics.likes + metrics.comments + metrics.shares) / metrics.impressions) * 100 : 0;
        await prisma.analyticsSnapshot.create({
          data: { platformPostId: pp.id, ...metrics, engagementRate },
        });

        results.push({ platformPostId: pp.id, platform: pp.platform, status: pp.status, metrics, error: null, fetchedLive: true });
      } catch (err) {
        // Fall back to cached snapshot
        const cached = pp.analytics[0] || null;
        results.push({
          platformPostId: pp.id,
          platform: pp.platform,
          status: pp.status,
          metrics: cached ? {
            impressions: cached.impressions, reach: cached.reach,
            likes: cached.likes, comments: cached.comments,
            shares: cached.shares, clicks: cached.clicks, saves: cached.saves,
          } : null,
          error: err instanceof Error ? err.message : 'Failed to fetch analytics',
          fetchedLive: false,
        });
      }
    }

    return { postId, platforms: results };
  }

  // Get top-performing posts
  async getTopPosts(workspaceId: string, limit = 10) {
    const posts = await prisma.platformPost.findMany({
      where: {
        post: { workspaceId },
        status: 'published',
      },
      include: {
        post: { select: { content: true, publishedAt: true } },
        analytics: { orderBy: { capturedAt: 'desc' }, take: 1 },
      },
      take: 100,
    });

    // Sort by engagement (likes + comments + shares)
    const scored = posts
      .filter((p: any) => p.analytics.length > 0)
      .map((p: any) => {
        const a = p.analytics[0];
        return {
          ...p,
          engagementScore: (a.likes || 0) + (a.comments || 0) + (a.shares || 0),
        };
      })
      .sort((a: any, b: any) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    return scored;
  }
}

export const analyticsService = new AnalyticsService();
