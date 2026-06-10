import { prisma } from '../config/database.js';

// ============================================================
// Pattern Analyzer Service
// ============================================================
// Scheduled weekly job that processes engagement data to identify:
// - Best posting times (day × hour heatmap)
// - Best content types (carousel vs reel vs image vs text)
// - Best topics (which content pillars perform highest)
// - Platform-specific trends
// - Week-over-week performance trends
// - A/B test detection (Enhancement 4)
// - Audience growth correlation (Enhancement 5)

export interface PatternAnalysis {
  userId: string;
  bestPostingTimes: { day: number; hour: number; avgEngRate: number }[];
  bestContentTypes: { type: string; avgEngRate: number; count: number }[];
  bestTopics: { topic: string; avgEngRate: number; count: number }[];
  platformTrends: { platform: string; avgEngRate: number; trend: 'improving' | 'declining' | 'stable' }[];
  weeklyTrend: { week: string; avgEngRate: number }[];
  heatmap: number[][];  // 7 (days) × 24 (hours) engagement rate matrix
  abTestResults: ABTestResult[];
}

export interface ABTestResult {
  variableType: 'time' | 'format' | 'topic';
  variationA: string;
  variationB: string;
  engRateA: number;
  engRateB: number;
  winner: 'A' | 'B';
  confidence: number;
}

/**
 * Run full pattern analysis for a single user.
 */
export async function analyzePatterns(userId: string): Promise<PatternAnalysis | null> {
  // Get all 7d engagement records (final snapshots)
  const records = await prisma.userEngagementHistory.findMany({
    where: {
      userId,
      snapshotType: '7d',
    },
    orderBy: { createdAt: 'desc' },
    take: 500, // last 500 records for analysis
  });

  if (records.length < 5) return null; // Not enough data

  // ----- Best Posting Times -----
  const timeMap: Record<string, { totalEng: number; count: number }> = {};
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const heatmapCounts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const r of records) {
    if (r.postingDay !== null && r.postingHour !== null) {
      const key = `${r.postingDay}-${r.postingHour}`;
      if (!timeMap[key]) timeMap[key] = { totalEng: 0, count: 0 };
      timeMap[key].totalEng += r.engagementRate;
      timeMap[key].count++;

      heatmap[r.postingDay][r.postingHour] += r.engagementRate;
      heatmapCounts[r.postingDay][r.postingHour]++;
    }
  }

  // Normalize heatmap to averages
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (heatmapCounts[d][h] > 0) {
        heatmap[d][h] = heatmap[d][h] / heatmapCounts[d][h];
      }
    }
  }

  const bestPostingTimes = Object.entries(timeMap)
    .map(([key, val]) => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour, avgEngRate: val.totalEng / val.count };
    })
    .sort((a, b) => b.avgEngRate - a.avgEngRate)
    .slice(0, 10);

  // ----- Best Content Types -----
  const typeMap: Record<string, { totalEng: number; count: number }> = {};
  for (const r of records) {
    const ct = r.contentType || 'unknown';
    if (!typeMap[ct]) typeMap[ct] = { totalEng: 0, count: 0 };
    typeMap[ct].totalEng += r.engagementRate;
    typeMap[ct].count++;
  }
  const bestContentTypes = Object.entries(typeMap)
    .map(([type, val]) => ({ type, avgEngRate: val.totalEng / val.count, count: val.count }))
    .sort((a, b) => b.avgEngRate - a.avgEngRate);

  // ----- Best Topics -----
  const topicMap: Record<string, { totalEng: number; count: number }> = {};
  for (const r of records) {
    const tp = r.topic || 'general';
    if (!topicMap[tp]) topicMap[tp] = { totalEng: 0, count: 0 };
    topicMap[tp].totalEng += r.engagementRate;
    topicMap[tp].count++;
  }
  const bestTopics = Object.entries(topicMap)
    .map(([topic, val]) => ({ topic, avgEngRate: val.totalEng / val.count, count: val.count }))
    .sort((a, b) => b.avgEngRate - a.avgEngRate);

  // ----- Platform Trends -----
  const platformSnapshots = await prisma.userEngagementSnapshot.findMany({
    where: { userId },
    orderBy: { weekStart: 'desc' },
    take: 20,
  });

  const platformMap: Record<string, { weeks: { weekStart: Date; avgEngRate: number }[] }> = {};
  for (const snap of platformSnapshots) {
    if (!platformMap[snap.platform]) platformMap[snap.platform] = { weeks: [] };
    platformMap[snap.platform].weeks.push({ weekStart: snap.weekStart, avgEngRate: snap.avgEngRate });
  }

  const platformTrends = Object.entries(platformMap).map(([platform, data]) => {
    const weeks = data.weeks.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
    const avgEngRate = weeks.reduce((sum, w) => sum + w.avgEngRate, 0) / weeks.length;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (weeks.length >= 2) {
      const recentHalf = weeks.slice(Math.floor(weeks.length / 2));
      const olderHalf = weeks.slice(0, Math.floor(weeks.length / 2));
      const recentAvg = recentHalf.reduce((sum, w) => sum + w.avgEngRate, 0) / recentHalf.length;
      const olderAvg = olderHalf.reduce((sum, w) => sum + w.avgEngRate, 0) / olderHalf.length;
      if (recentAvg > olderAvg * 1.1) trend = 'improving';
      else if (recentAvg < olderAvg * 0.9) trend = 'declining';
    }

    return { platform, avgEngRate, trend };
  });

  // ----- Weekly Trend -----
  const weeklyData = await prisma.userEngagementSnapshot.findMany({
    where: { userId },
    orderBy: { weekStart: 'asc' },
    take: 12,
  });

  const weeklyAgg: Record<string, { total: number; count: number }> = {};
  for (const snap of weeklyData) {
    const key = snap.weekStart.toISOString().split('T')[0];
    if (!weeklyAgg[key]) weeklyAgg[key] = { total: 0, count: 0 };
    weeklyAgg[key].total += snap.avgEngRate;
    weeklyAgg[key].count++;
  }

  const weeklyTrend = Object.entries(weeklyAgg)
    .map(([week, val]) => ({ week, avgEngRate: val.total / val.count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // ----- A/B Test Detection (Enhancement 4) -----
  const abTestResults = detectABTests(records);

  return {
    userId,
    bestPostingTimes,
    bestContentTypes,
    bestTopics,
    platformTrends,
    weeklyTrend,
    heatmap,
    abTestResults,
  };
}

/**
 * Enhancement 4: Detect natural A/B tests.
 * Find cases where similar content was posted at different times or in different formats.
 */
function detectABTests(records: {
  contentType: string | null;
  topic: string | null;
  postingHour: number | null;
  engagementRate: number;
}[]): ABTestResult[] {
  const results: ABTestResult[] = [];

  // A/B test by content type for same topic
  const topicGroups: Record<string, Record<string, number[]>> = {};
  for (const r of records) {
    const topic = r.topic || 'general';
    const type = r.contentType || 'text';
    if (!topicGroups[topic]) topicGroups[topic] = {};
    if (!topicGroups[topic][type]) topicGroups[topic][type] = [];
    topicGroups[topic][type].push(r.engagementRate);
  }

  for (const [_topic, types] of Object.entries(topicGroups)) {
    const typeEntries = Object.entries(types).filter(([, rates]) => rates.length >= 2);
    if (typeEntries.length >= 2) {
      // Compare top 2 formats
      const sorted = typeEntries
        .map(([type, rates]) => ({
          type,
          avgRate: rates.reduce((a, b) => a + b, 0) / rates.length,
          count: rates.length,
        }))
        .sort((a, b) => b.avgRate - a.avgRate);

      if (sorted.length >= 2) {
        const diff = Math.abs(sorted[0].avgRate - sorted[1].avgRate);
        if (diff > 0.5) { // Significant difference threshold
          results.push({
            variableType: 'format',
            variationA: sorted[0].type,
            variationB: sorted[1].type,
            engRateA: sorted[0].avgRate,
            engRateB: sorted[1].avgRate,
            winner: 'A',
            confidence: Math.min(0.95, 0.5 + (Math.min(sorted[0].count, sorted[1].count) / 20)),
          });
        }
      }
    }
  }

  // A/B test by posting time (morning vs afternoon vs evening)
  const timeGroups: Record<string, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };

  for (const r of records) {
    if (r.postingHour === null) continue;
    if (r.postingHour >= 6 && r.postingHour < 12) timeGroups.morning.push(r.engagementRate);
    else if (r.postingHour >= 12 && r.postingHour < 17) timeGroups.afternoon.push(r.engagementRate);
    else if (r.postingHour >= 17 && r.postingHour < 21) timeGroups.evening.push(r.engagementRate);
    else timeGroups.night.push(r.engagementRate);
  }

  const timeSorted = Object.entries(timeGroups)
    .filter(([, rates]) => rates.length >= 3)
    .map(([period, rates]) => ({
      period,
      avgRate: rates.reduce((a, b) => a + b, 0) / rates.length,
      count: rates.length,
    }))
    .sort((a, b) => b.avgRate - a.avgRate);

  if (timeSorted.length >= 2) {
    const diff = Math.abs(timeSorted[0].avgRate - timeSorted[1].avgRate);
    if (diff > 0.5) {
      results.push({
        variableType: 'time',
        variationA: timeSorted[0].period,
        variationB: timeSorted[1].period,
        engRateA: timeSorted[0].avgRate,
        engRateB: timeSorted[1].avgRate,
        winner: 'A',
        confidence: Math.min(0.95, 0.5 + (Math.min(timeSorted[0].count, timeSorted[1].count) / 20)),
      });
    }
  }

  return results;
}

/**
 * Run pattern analysis for all eligible users.
 * Scheduled weekly job.
 */
export async function runPatternAnalysisForAll() {
  // Get all users who have engagement data
  const users = await prisma.userEngagementHistory.findMany({
    select: { userId: true },
    distinct: ['userId'],
  });

  console.log(`[Pattern Analyzer] Analyzing patterns for ${users.length} users...`);

  let analyzed = 0;
  for (const { userId } of users) {
    try {
      const analysis = await analyzePatterns(userId);
      if (analysis) {
        // Store analysis summary in the latest snapshot's metadata
        const latestSnapshot = await prisma.userEngagementSnapshot.findFirst({
          where: { userId },
          orderBy: { weekStart: 'desc' },
        });

        if (latestSnapshot) {
          await prisma.userEngagementSnapshot.update({
            where: { id: latestSnapshot.id },
            data: {
              metadata: {
                ...(latestSnapshot.metadata as Record<string, unknown> || {}),
                patternAnalysis: {
                  bestPostingTimes: analysis.bestPostingTimes.slice(0, 3),
                  bestContentType: analysis.bestContentTypes[0] || null,
                  bestTopic: analysis.bestTopics[0] || null,
                  abTests: analysis.abTestResults.length,
                  analyzedAt: new Date().toISOString(),
                },
              },
            },
          });
        }

        analyzed++;
      }
    } catch (err) {
      console.error(`[Pattern Analyzer] Failed for user ${userId}:`, err);
    }
  }

  console.log(`[Pattern Analyzer] Analysis complete: ${analyzed}/${users.length} users analyzed.`);
  return { total: users.length, analyzed };
}

/**
 * Get the full pattern analysis for a specific user.
 * Used by the frontend Performance Intelligence dashboard.
 */
export async function getUserPatternAnalysis(userId: string) {
  return analyzePatterns(userId);
}
