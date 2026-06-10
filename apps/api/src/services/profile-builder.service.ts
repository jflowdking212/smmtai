import { prisma } from '../config/database.js';

// ============================================================
// Profile Builder Service
// ============================================================
// Handles User Intelligence Profile creation, progressive enrichment,
// completeness scoring, and backfill migrations.

const PROFILE_FIELDS: { field: string; weight: number }[] = [
  { field: 'niche', weight: 20 },
  { field: 'targetAudience', weight: 15 },
  { field: 'contentPillars', weight: 15 },
  { field: 'tonePreference', weight: 10 },
  { field: 'goals', weight: 15 },
  { field: 'postingPreferences', weight: 10 },
  { field: 'brandKeywords', weight: 10 },
  { field: 'avoidedTopics', weight: 5 },
];

/**
 * Calculate completeness score (0–100) based on which fields are filled.
 */
function calculateCompleteness(profile: Record<string, unknown>): number {
  let score = 0;
  for (const { field, weight } of PROFILE_FIELDS) {
    const value = profile[field];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) continue;
    score += weight;
  }
  return Math.min(100, score);
}

/**
 * Get or create a user's intelligence profile.
 */
export async function getOrCreateProfile(userId: string) {
  let profile = await prisma.userIntelligenceProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.userIntelligenceProfile.create({
      data: {
        userId,
        completenessScore: 0,
        sourceData: { onboarding: false, progressive: false },
      },
    });
  }

  return profile;
}

/**
 * Get a user's profile (returns null if not found).
 */
export async function getProfile(userId: string) {
  return prisma.userIntelligenceProfile.findUnique({
    where: { userId },
  });
}

/**
 * Update a user's intelligence profile and recalculate completeness.
 */
export async function updateProfile(
  userId: string,
  data: {
    niche?: string;
    targetAudience?: Record<string, unknown>;
    contentPillars?: string[];
    tonePreference?: string;
    avoidedTopics?: string[];
    goals?: Record<string, unknown>;
    postingPreferences?: Record<string, unknown>;
    brandKeywords?: string[];
  },
) {
  // Ensure profile exists
  const profile = await getOrCreateProfile(userId);

  // Build the merged profile for completeness calculation
  const merged = { ...profile, ...data };
  const completenessScore = calculateCompleteness(merged as unknown as Record<string, unknown>);

  // Track source of data
  const existingSource = (profile.sourceData as Record<string, unknown>) || {};

  return prisma.userIntelligenceProfile.update({
    where: { userId },
    data: {
      ...(data as any),
      completenessScore,
      sourceData: {
        ...existingSource,
        lastUpdateSource: 'manual',
        lastUpdatedAt: new Date().toISOString(),
      },
    },
  });
}

/**
 * Build profile from onboarding answers.
 * Called after user completes the onboarding questionnaire.
 */
export async function buildFromOnboarding(
  userId: string,
  answers: {
    niche?: string;
    audience?: string;
    goals?: string;
    tone?: string;
    pillars?: string[];
    brandKeywords?: string[];
  },
) {
  const data: Record<string, unknown> = {};

  if (answers.niche) data.niche = answers.niche;
  if (answers.audience) {
    data.targetAudience = { demographics: answers.audience };
  }
  if (answers.goals) {
    data.goals = { primary: answers.goals };
  }
  if (answers.tone) data.tonePreference = answers.tone;
  if (answers.pillars?.length) data.contentPillars = answers.pillars;
  if (answers.brandKeywords?.length) data.brandKeywords = answers.brandKeywords;

  const profile = await getOrCreateProfile(userId);
  const merged = { ...profile, ...data };
  const completenessScore = calculateCompleteness(merged as unknown as Record<string, unknown>);

  return prisma.userIntelligenceProfile.update({
    where: { userId },
    data: {
      ...(data as any),
      completenessScore,
      sourceData: {
        onboarding: true,
        onboardingCompletedAt: new Date().toISOString(),
      },
    },
  });
}

/**
 * Progressively enrich profile from user's posting behavior.
 * Analyzes recent posts to extract topic patterns and update content pillars.
 */
export async function enrichFromPostingHistory(userId: string) {
  const profile = await getOrCreateProfile(userId);

  // Get user's recent published posts to extract patterns
  const recentPosts = await prisma.post.findMany({
    where: {
      authorId: userId,
      status: 'published',
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: { content: true, platforms: true, publishedAt: true },
  });

  if (recentPosts.length === 0) return profile;

  // Extract posting time preferences
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<number, number> = {};
  for (const post of recentPosts) {
    if (post.publishedAt) {
      const hour = post.publishedAt.getHours();
      const day = post.publishedAt.getDay();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
  }

  // Find top 3 preferred hours and days
  const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const postingPreferences = {
    ...(profile.postingPreferences as Record<string, unknown> || {}),
    preferredTimes: sortedHours.map(([h]) => `${h}:00`),
    preferredDays: sortedDays.map(([d]) => parseInt(d)),
    frequency: recentPosts.length >= 30 ? 'daily' : recentPosts.length >= 14 ? 'several_weekly' : 'weekly',
  };

  // Extract common hashtags as brand keywords
  const hashtagRegex = /#[\w]+/g;
  const hashtagCounts: Record<string, number> = {};
  for (const post of recentPosts) {
    const matches = post.content.match(hashtagRegex) || [];
    for (const tag of matches) {
      hashtagCounts[tag.toLowerCase()] = (hashtagCounts[tag.toLowerCase()] || 0) + 1;
    }
  }
  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const updates: Record<string, unknown> = { postingPreferences };
  if (topHashtags.length > 0 && (!profile.brandKeywords || profile.brandKeywords.length === 0)) {
    updates.brandKeywords = topHashtags;
  }

  const merged = { ...profile, ...updates };
  const completenessScore = calculateCompleteness(merged as unknown as Record<string, unknown>);

  const existingSource = (profile.sourceData as Record<string, unknown>) || {};

  return prisma.userIntelligenceProfile.update({
    where: { userId },
    data: {
      ...(updates as any),
      completenessScore,
      sourceData: {
        ...existingSource,
        progressive: true,
        lastEnrichmentAt: new Date().toISOString(),
        postsAnalyzed: recentPosts.length,
      },
    },
  });
}

/**
 * Backfill profiles for all existing users who don't have one yet.
 * Called during migration/deployment.
 */
export async function backfillAllProfiles() {
  const usersWithoutProfiles = await prisma.user.findMany({
    where: {
      intelligenceProfile: null,
    },
    select: { id: true },
  });

  console.log(`[Profile Builder] Backfilling ${usersWithoutProfiles.length} user profiles...`);

  let count = 0;
  for (const user of usersWithoutProfiles) {
    try {
      await getOrCreateProfile(user.id);
      await enrichFromPostingHistory(user.id);
      count++;
    } catch (err) {
      console.error(`[Profile Builder] Failed to backfill user ${user.id}:`, err);
    }
  }

  console.log(`[Profile Builder] Backfill complete: ${count}/${usersWithoutProfiles.length} profiles created.`);
  return { total: usersWithoutProfiles.length, completed: count };
}
