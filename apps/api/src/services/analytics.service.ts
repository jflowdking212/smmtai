import { prisma } from '../config/database.js';
import type { PlatformType } from '@ee-postmind/shared';

export class AnalyticsService {
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

    // Aggregate analytics snapshots
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: {
        platformPost: {
          post: { workspaceId },
        },
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
    });

    // Sum engagement metrics
    const totals = {
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      saves: 0,
    };

    snapshots.forEach((s: any) => {
      totals.impressions += s.impressions || 0;
      totals.reach += s.reach || 0;
      totals.likes += s.likes || 0;
      totals.comments += s.comments || 0;
      totals.shares += s.shares || 0;
      totals.clicks += s.clicks || 0;
      totals.saves += s.saves || 0;
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
    recentPosts.forEach((p: any) => {
      p.platformPosts.forEach((pp: any) => {
        platformBreakdown[pp.platform] = (platformBreakdown[pp.platform] || 0) + 1;
      });
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
      },
      include: {
        post: { select: { content: true, publishedAt: true } },
        analytics: { orderBy: { recordedAt: 'desc' }, take: 1 },
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

  // Get top-performing posts
  async getTopPosts(workspaceId: string, limit = 10) {
    const posts = await prisma.platformPost.findMany({
      where: {
        post: { workspaceId },
        status: 'published',
      },
      include: {
        post: { select: { content: true, publishedAt: true } },
        analytics: { orderBy: { recordedAt: 'desc' }, take: 1 },
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
