import { prisma } from '../config/database.js';

// ============================================================
// Engagement Monitor Service
// ============================================================
// Background scheduler that polls connected social platform APIs at
// 2h, 24h, and 7d intervals after a post is published. Normalizes
// metrics across platforms and calculates engagement rates.
// Also generates weekly rollup snapshots for trend analysis.

/**
 * Collect engagement for a single platform post.
 * In a real implementation, this calls the platform API using stored tokens.
 * For now, it reads from the existing AnalyticsSnapshot table.
 */
export async function collectEngagementForPost(
  userId: string,
  postId: string,
  platform: string,
  snapshotType: '2h' | '24h' | '7d',
) {
  // Get the platform post to find the latest analytics
  const platformPost = await prisma.platformPost.findFirst({
    where: {
      postId,
      platform,
      status: 'published',
    },
    include: {
      analytics: {
        orderBy: { capturedAt: 'desc' },
        take: 1,
      },
      post: {
        select: {
          content: true,
          publishedAt: true,
          media: { select: { type: true } },
        },
      },
    },
  });

  if (!platformPost || !platformPost.analytics[0]) return null;

  const analytics = platformPost.analytics[0];
  const post = platformPost.post;

  // Determine content type
  const contentType = detectContentType(post.content, post.media);

  // Extract topic from content (simple keyword extraction)
  const topic = extractTopic(post.content);

  // Get posting time info
  const publishedAt = post.publishedAt || new Date();
  const postingHour = publishedAt.getHours();
  const postingDay = publishedAt.getDay();

  // Calculate engagement rate
  const totalEngagement = analytics.likes + analytics.comments + analytics.shares + analytics.saves;
  const engagementRate = analytics.reach > 0
    ? (totalEngagement / analytics.reach) * 100
    : 0;

  // Store engagement record
  return prisma.userEngagementHistory.create({
    data: {
      userId,
      postId,
      platform,
      contentType,
      topic,
      postingHour,
      postingDay,
      likes: analytics.likes,
      comments: analytics.comments,
      shares: analytics.shares,
      saves: analytics.saves,
      reach: analytics.reach,
      impressions: analytics.impressions,
      clickThroughs: analytics.clicks,
      engagementRate,
      snapshotType,
    },
  });
}

/**
 * Detect content type from post content and media.
 */
function detectContentType(
  content: string,
  media: { type: string }[],
): string {
  if (media.length === 0) return 'text';
  if (media.length > 1) return 'carousel';
  const firstMedia = media[0];
  if (firstMedia.type === 'video') return 'video';
  if (firstMedia.type === 'gif') return 'gif';
  return 'image';
}

/**
 * Simple topic extraction from content.
 * Uses hashtags and common keyword patterns.
 */
function extractTopic(content: string): string {
  // Try hashtags first
  const hashtags = content.match(/#[\w]+/g);
  if (hashtags && hashtags.length > 0) {
    return hashtags[0].replace('#', '').toLowerCase();
  }

  // Simple topic keyword detection
  const topicKeywords: Record<string, string[]> = {
    motivation: ['motivat', 'inspir', 'mindset', 'hustle', 'grind', 'believe', 'dream'],
    tips: ['tip', 'hack', 'trick', 'how to', 'guide', 'step', 'tutorial'],
    behind_the_scenes: ['behind', 'bts', 'process', 'making of', 'journey'],
    product: ['product', 'launch', 'new', 'introducing', 'available', 'buy', 'shop'],
    educational: ['learn', 'understand', 'explain', 'what is', 'why', 'science'],
    personal: ['story', 'personal', 'experience', 'share', 'honest', 'real talk'],
    announcement: ['announce', 'excited', 'big news', 'update', 'reveal'],
  };

  const lowerContent = content.toLowerCase();
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((kw) => lowerContent.includes(kw))) {
      return topic;
    }
  }

  return 'general';
}

/**
 * Scan all recently published posts and collect engagement data.
 * This is the main scheduled job function.
 */
export async function runEngagementCollection() {
  const now = new Date();

  // Find posts that need 2h collection (published 2-3 hours ago)
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  // Find posts that need 24h collection (published 24-25 hours ago)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);

  // Find posts that need 7d collection (published 7 days ago ± 1 hour)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysOneHourAgo = new Date(now.getTime() - (7 * 24 + 1) * 60 * 60 * 1000);

  const collectForWindow = async (
    startTime: Date,
    endTime: Date,
    snapshotType: '2h' | '24h' | '7d',
  ) => {
    const posts = await prisma.post.findMany({
      where: {
        status: 'published',
        publishedAt: {
          gte: endTime,
          lte: startTime,
        },
      },
      include: {
        platformPosts: {
          where: { status: 'published' },
          select: { platform: true },
        },
      },
    });

    let collected = 0;
    for (const post of posts) {
      for (const pp of post.platformPosts) {
        // Check if we already have this snapshot
        const existing = await prisma.userEngagementHistory.findFirst({
          where: {
            postId: post.id,
            platform: pp.platform,
            snapshotType,
          },
        });

        if (!existing) {
          try {
            await collectEngagementForPost(post.authorId, post.id, pp.platform, snapshotType);
            collected++;
          } catch (err) {
            console.error(`[Engagement Monitor] Failed to collect ${snapshotType} for post ${post.id}:`, err);
          }
        }
      }
    }
    return collected;
  };

  const results = {
    '2h': await collectForWindow(twoHoursAgo, threeHoursAgo, '2h'),
    '24h': await collectForWindow(twentyFourHoursAgo, twentyFiveHoursAgo, '24h'),
    '7d': await collectForWindow(sevenDaysAgo, sevenDaysOneHourAgo, '7d'),
  };

  console.log(`[Engagement Monitor] Collection complete: 2h=${results['2h']}, 24h=${results['24h']}, 7d=${results['7d']}`);
  return results;
}

/**
 * Generate weekly engagement snapshots for all users.
 * Rolls up per-post engagement into weekly summaries per platform.
 */
export async function generateWeeklySnapshots() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week (Sunday)
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get all users who have engagement data
  const usersWithData = await prisma.userEngagementHistory.findMany({
    where: {
      snapshotType: '7d',
      createdAt: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
    select: { userId: true, platform: true },
    distinct: ['userId', 'platform'],
  });

  let created = 0;
  for (const { userId, platform } of usersWithData) {
    try {
      // Get all 7d snapshots for this user/platform/week
      const records = await prisma.userEngagementHistory.findMany({
        where: {
          userId,
          platform,
          snapshotType: '7d',
          createdAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
      });

      if (records.length === 0) continue;

      // Calculate aggregates
      const totalReach = records.reduce((sum, r) => sum + r.reach, 0);
      const avgEngRate = records.reduce((sum, r) => sum + r.engagementRate, 0) / records.length;

      // Find best content type and topic
      const typeMap: Record<string, { count: number; engRate: number }> = {};
      const topicMap: Record<string, { count: number; engRate: number }> = {};
      const hourMap: Record<number, { count: number; engRate: number }> = {};

      for (const r of records) {
        const ct = r.contentType || 'unknown';
        if (!typeMap[ct]) typeMap[ct] = { count: 0, engRate: 0 };
        typeMap[ct].count++;
        typeMap[ct].engRate += r.engagementRate;

        const tp = r.topic || 'general';
        if (!topicMap[tp]) topicMap[tp] = { count: 0, engRate: 0 };
        topicMap[tp].count++;
        topicMap[tp].engRate += r.engagementRate;

        if (r.postingHour !== null) {
          if (!hourMap[r.postingHour]) hourMap[r.postingHour] = { count: 0, engRate: 0 };
          hourMap[r.postingHour].count++;
          hourMap[r.postingHour].engRate += r.engagementRate;
        }
      }

      const topContentType = Object.entries(typeMap)
        .sort((a, b) => (b[1].engRate / b[1].count) - (a[1].engRate / a[1].count))[0]?.[0] || null;

      const topTopic = Object.entries(topicMap)
        .sort((a, b) => (b[1].engRate / b[1].count) - (a[1].engRate / a[1].count))[0]?.[0] || null;

      const topPostingHour = Object.entries(hourMap)
        .sort((a, b) => (b[1].engRate / b[1].count) - (a[1].engRate / a[1].count))[0]?.[0];

      await prisma.userEngagementSnapshot.upsert({
        where: {
          userId_weekStart_platform: {
            userId,
            weekStart,
            platform,
          },
        },
        create: {
          userId,
          weekStart,
          platform,
          avgEngRate,
          totalReach,
          totalPosts: records.length,
          topContentType,
          topTopic,
          topPostingHour: topPostingHour ? parseInt(topPostingHour) : null,
          metadata: { typeMap, topicMap, hourMap },
        },
        update: {
          avgEngRate,
          totalReach,
          totalPosts: records.length,
          topContentType,
          topTopic,
          topPostingHour: topPostingHour ? parseInt(topPostingHour) : null,
          metadata: { typeMap, topicMap, hourMap },
        },
      });
      created++;
    } catch (err) {
      console.error(`[Engagement Monitor] Failed to create snapshot for user ${userId}, platform ${platform}:`, err);
    }
  }

  console.log(`[Engagement Monitor] Weekly snapshots created: ${created}`);
  return { created };
}
