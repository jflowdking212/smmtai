import { prisma } from '../config/database.js';

// ============================================================
// Recommendations Service
// ============================================================
// Generates proactive UserStrategyRecommendation records using 
// template-based insights. Covers:
// - Timing recommendations
// - Content type insights
// - Topic performance insights
// - Profile completeness nudges
// - A/B test outcomes
// - Growth correlation insights
// - Competitor benchmarking insights (Enhancement 1)
// - Content idea generation (Enhancement 2)

interface RecommendationTemplate {
  type: string;
  title: string;
  body: string;
  priority: number;
  metadata?: Record<string, unknown>;
}

/**
 * Generate all recommendations for a single user.
 */
export async function generateRecommendations(userId: string) {
  const recommendations: RecommendationTemplate[] = [];

  // ----- 1. Profile Completeness Nudges -----
  const profile = await prisma.userIntelligenceProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    recommendations.push({
      type: 'profile_nudge',
      title: 'Set up your AI Intelligence Profile',
      body: 'Complete your intelligence profile to unlock smarter, personalized content generation. Tell the AI about your niche, audience, and goals — it takes less than 2 minutes and dramatically improves every piece of content the AI creates for you.',
      priority: 2,
    });
  } else if (profile.completenessScore < 50) {
    const missing: string[] = [];
    if (!profile.niche) missing.push('niche/industry');
    if (!profile.targetAudience) missing.push('target audience');
    if (profile.contentPillars.length === 0) missing.push('content pillars');
    if (!profile.goals) missing.push('goals');
    if (!profile.tonePreference) missing.push('preferred tone');

    recommendations.push({
      type: 'profile_nudge',
      title: `Your AI profile is ${profile.completenessScore}% complete — add ${missing[0]} to boost it`,
      body: `Your AI Intelligence Profile is missing: ${missing.join(', ')}. Adding these helps the AI generate content that truly sounds like you and targets your specific audience. Complete profiles get 40% better content match.`,
      priority: 1,
      metadata: { completenessScore: profile.completenessScore, missingFields: missing },
    });
  }

  // ----- 2. Content Type Insights -----
  const typeMetrics = await prisma.userEngagementHistory.groupBy({
    by: ['contentType'],
    where: {
      userId,
      snapshotType: '7d',
      contentType: { not: null },
      reach: { gt: 0 },
    },
    _avg: { engagementRate: true },
    _count: true,
  });

  if (typeMetrics.length >= 2) {
    const sorted = typeMetrics
      .filter((t) => t._count >= 2)
      .sort((a, b) => (b._avg.engagementRate || 0) - (a._avg.engagementRate || 0));

    if (sorted.length >= 2) {
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const multiplier = ((best._avg.engagementRate || 0) / (worst._avg.engagementRate || 1)).toFixed(1);

      recommendations.push({
        type: 'content_type',
        title: `Your ${best.contentType} posts get ${multiplier}x more engagement`,
        body: `Based on your last ${sorted.reduce((s, t) => s + t._count, 0)} posts, ${best.contentType} content consistently outperforms other formats with an average engagement rate of ${(best._avg.engagementRate || 0).toFixed(1)}%. Consider creating more ${best.contentType} content and fewer ${worst.contentType} posts.`,
        priority: 1,
        metadata: {
          metric: 'engagement_rate',
          bestType: best.contentType,
          bestRate: best._avg.engagementRate,
          worstType: worst.contentType,
          worstRate: worst._avg.engagementRate,
        },
      });
    }
  }

  // ----- 3. Timing Recommendations -----
  const timeMetrics = await prisma.userEngagementHistory.groupBy({
    by: ['postingDay', 'postingHour'],
    where: {
      userId,
      snapshotType: '7d',
      postingDay: { not: null },
      postingHour: { not: null },
      reach: { gt: 0 },
    },
    _avg: { engagementRate: true },
    _count: true,
  });

  if (timeMetrics.length >= 3) {
    const sorted = timeMetrics
      .filter((t) => t._count >= 2)
      .sort((a, b) => (b._avg.engagementRate || 0) - (a._avg.engagementRate || 0));

    if (sorted.length > 0) {
      const best = sorted[0];
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[best.postingDay || 0];
      const hour = best.postingHour || 0;
      const timeStr = hour >= 12 ? `${hour === 12 ? 12 : hour - 12}pm` : `${hour === 0 ? 12 : hour}am`;

      recommendations.push({
        type: 'timing',
        title: `Post at ${timeStr} on ${dayName}s for best engagement`,
        body: `Your audience is most active and engaged when you post at ${timeStr} on ${dayName}s, with an average engagement rate of ${(best._avg.engagementRate || 0).toFixed(1)}%. Try scheduling your most important content for this time slot.`,
        priority: 0,
        metadata: { day: best.postingDay, hour: best.postingHour, avgEngRate: best._avg.engagementRate },
      });
    }
  }

  // ----- 4. Topic Performance -----
  const topicMetrics = await prisma.userEngagementHistory.groupBy({
    by: ['topic'],
    where: {
      userId,
      snapshotType: '7d',
      topic: { not: null },
      reach: { gt: 0 },
    },
    _avg: { engagementRate: true },
    _count: true,
  });

  if (topicMetrics.length >= 2) {
    const sorted = topicMetrics
      .filter((t) => t._count >= 2)
      .sort((a, b) => (b._avg.engagementRate || 0) - (a._avg.engagementRate || 0));

    if (sorted.length > 0) {
      const best = sorted[0];
      recommendations.push({
        type: 'topic',
        title: `Content about "${best.topic}" gets ${(best._avg.engagementRate || 0).toFixed(1)}% engagement`,
        body: `Your audience responds best to content about "${best.topic}". This topic consistently outperforms your other content pillars. Consider making it a regular part of your content mix.`,
        priority: 0,
        metadata: { topic: best.topic, avgEngRate: best._avg.engagementRate, count: best._count },
      });
    }

    // Check for underused but high-performing topics
    if (profile?.contentPillars) {
      for (const pillar of profile.contentPillars) {
        const pillarData = sorted.find((t) => t.topic?.toLowerCase() === pillar.toLowerCase());
        if (!pillarData || pillarData._count < 3) {
          // Count recent posts about this pillar
          const recentCount = await prisma.userEngagementHistory.count({
            where: {
              userId,
              topic: pillar,
              createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
            },
          });

          if (recentCount === 0) {
            recommendations.push({
              type: 'topic',
              title: `You haven't posted about "${pillar}" in 2 weeks`,
              body: `"${pillar}" is one of your content pillars but you haven't covered it recently. Your audience expects consistent variety — consider creating a post about it this week.`,
              priority: 0,
              metadata: { topic: pillar, lastPostedDaysAgo: '14+' },
            });
          }
        }
      }
    }
  }

  // ----- 5. Competitor Benchmark Insights (Enhancement 1) -----
  const competitors = await prisma.competitorAccount.findMany({
    where: { userId },
    select: { handle: true, avgEngRate: true, platform: true },
  });

  if (competitors.length > 0) {
    const competitorAvg = competitors.reduce((sum, c) => sum + (c.avgEngRate || 0), 0) / competitors.length;

    // Get user's recent avg engagement
    const userSnapshots = await prisma.userEngagementSnapshot.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      take: 4,
      select: { avgEngRate: true },
    });

    if (userSnapshots.length > 0) {
      const userAvg = userSnapshots.reduce((sum, s) => sum + s.avgEngRate, 0) / userSnapshots.length;

      if (userAvg > competitorAvg * 1.2) {
        recommendations.push({
          type: 'growth',
          title: `Your engagement is ${((userAvg / competitorAvg) * 100 - 100).toFixed(0)}% above competitors`,
          body: `Great news! Your average engagement rate (${userAvg.toFixed(1)}%) is significantly higher than your tracked competitors (${competitorAvg.toFixed(1)}%). Keep up the momentum with your current content strategy.`,
          priority: 0,
          metadata: { userAvg, competitorAvg },
        });
      } else if (userAvg < competitorAvg * 0.8) {
        recommendations.push({
          type: 'growth',
          title: `Competitors are outperforming you — here's how to catch up`,
          body: `Your average engagement rate (${userAvg.toFixed(1)}%) is below your tracked competitors (${competitorAvg.toFixed(1)}%). Consider experimenting with different content formats, posting times, and topics. Your best performing content type might be a good starting point.`,
          priority: 1,
          metadata: { userAvg, competitorAvg },
        });
      }
    }
  }

  // ----- 6. Content Ideas from Intelligence (Enhancement 2) -----
  if (profile && profile.contentPillars.length > 0 && topicMetrics.length > 0) {
    const bestTopic = topicMetrics
      .filter((t) => t._count >= 2)
      .sort((a, b) => (b._avg.engagementRate || 0) - (a._avg.engagementRate || 0))[0];

    const bestType = typeMetrics
      .filter((t) => t._count >= 2)
      .sort((a, b) => (b._avg.engagementRate || 0) - (a._avg.engagementRate || 0))[0];

    if (bestTopic && bestType) {
      recommendations.push({
        type: 'content_type',
        title: `💡 Content Idea: Create a ${bestType.contentType} about "${bestTopic.topic}"`,
        body: `Based on your data, combining your best-performing format (${bestType.contentType}) with your highest-engagement topic ("${bestTopic.topic}") could maximize your reach. Your ${bestType.contentType} posts average ${(bestType._avg.engagementRate || 0).toFixed(1)}% engagement and "${bestTopic.topic}" content gets ${(bestTopic._avg.engagementRate || 0).toFixed(1)}%.`,
        priority: 1,
        metadata: { suggestedFormat: bestType.contentType, suggestedTopic: bestTopic.topic },
      });
    }
  }

  // ----- Store recommendations -----
  let created = 0;
  for (const rec of recommendations) {
    // Check if a similar recommendation already exists and is still pending
    const existing = await prisma.userStrategyRecommendation.findFirst({
      where: {
        userId,
        type: rec.type,
        status: 'pending',
        title: rec.title,
      },
    });

    if (!existing) {
      await prisma.userStrategyRecommendation.create({
        data: {
          userId,
          type: rec.type,
          title: rec.title,
          body: rec.body,
          priority: rec.priority,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 day expiry
          metadata: (rec.metadata as any) || null,
        },
      });
      created++;
    }
  }

  return { generated: recommendations.length, created };
}

/**
 * Update recommendation status (act or dismiss).
 */
export async function updateRecommendationStatus(
  id: string,
  userId: string,
  status: 'acted' | 'dismissed',
) {
  return prisma.userStrategyRecommendation.updateMany({
    where: { id, userId },
    data: {
      status,
      actionedAt: new Date(),
    },
  });
}

/**
 * Get pending recommendations for a user.
 */
export async function getPendingRecommendations(userId: string) {
  return prisma.userStrategyRecommendation.findMany({
    where: {
      userId,
      status: 'pending',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 10,
  });
}

/**
 * Expire old recommendations.
 */
export async function expireStaleRecommendations() {
  const result = await prisma.userStrategyRecommendation.updateMany({
    where: {
      status: 'pending',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'dismissed' },
  });

  if (result.count > 0) {
    console.log(`[Recommendations] Expired ${result.count} stale recommendations.`);
  }

  return result;
}

/**
 * Run recommendation generation for all eligible users.
 * Scheduled weekly job.
 */
export async function generateRecommendationsForAll() {
  // First, expire stale recommendations
  await expireStaleRecommendations();

  // Get all users who have intelligence profiles or engagement data
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { intelligenceProfile: { isNot: null } },
        { engagementHistory: { some: {} } },
      ],
    },
    select: { id: true },
  });

  console.log(`[Recommendations] Generating for ${users.length} users...`);

  let totalCreated = 0;
  for (const user of users) {
    try {
      const result = await generateRecommendations(user.id);
      totalCreated += result.created;
    } catch (err) {
      console.error(`[Recommendations] Failed for user ${user.id}:`, err);
    }
  }

  console.log(`[Recommendations] Complete: ${totalCreated} new recommendations created.`);
  return { users: users.length, created: totalCreated };
}
