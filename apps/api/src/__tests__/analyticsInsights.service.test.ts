import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsService } from '../services/analytics.service.js';

describe('AnalyticsService getInsights', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds actionable insights from overview and top posts', async () => {
    vi.spyOn(analyticsService, 'getOverview').mockResolvedValue({
      totalPosts: 42,
      publishedPosts: 20,
      connectedAccounts: 4,
      engagementRate: 2.4,
      metrics: {
        impressions: 1500,
        reach: 1200,
        likes: 120,
        comments: 28,
        shares: 18,
        clicks: 14,
        saves: 10,
      },
      postsPerDay: {},
      platformBreakdown: {},
      recentPosts: [],
    });
    vi.spyOn(analyticsService, 'getTopPosts').mockResolvedValue([
      {
        id: 'platform_post_1',
        platform: 'instagram',
        engagementScore: 92,
        post: {
          content: 'What is your biggest challenge this week?',
          publishedAt: '2030-01-06T13:00:00.000Z',
        },
      },
      {
        id: 'platform_post_2',
        platform: 'linkedin',
        engagementScore: 70,
        post: {
          content: 'Three growth lessons from this quarter.',
          publishedAt: '2030-01-06T10:30:00.000Z',
        },
      },
    ] as any);

    const result = await analyticsService.getInsights('workspace_1', 30);

    expect(result.periodDays).toBe(30);
    expect(result.insights.some((insight) => insight.id === 'posting-frequency')).toBe(true);
    expect(result.insights.some((insight) => insight.id === 'engagement-rate')).toBe(true);
    expect(result.insights.some((insight) => insight.id === 'top-post-pattern')).toBe(true);
    expect(result.insights.some((insight) => insight.id === 'best-day')).toBe(true);
    expect(result.insights.find((insight) => insight.id === 'top-post-pattern')?.description)
      .toContain('Question-based content');
  });

  it('returns publish warning when no posts are published', async () => {
    vi.spyOn(analyticsService, 'getOverview').mockResolvedValue({
      totalPosts: 4,
      publishedPosts: 0,
      connectedAccounts: 1,
      engagementRate: 0,
      metrics: {
        impressions: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        saves: 0,
      },
      postsPerDay: {},
      platformBreakdown: {},
      recentPosts: [],
    });
    vi.spyOn(analyticsService, 'getTopPosts').mockResolvedValue([] as any);

    const result = await analyticsService.getInsights('workspace_1', 30);
    const publishInsight = result.insights.find((insight) => insight.id === 'publish-more');

    expect(publishInsight).toBeDefined();
    expect(publishInsight?.severity).toBe('warning');
    expect(result.insights.some((insight) => insight.id === 'top-post-pattern')).toBe(false);
  });
});
