import { prisma } from '../config/database.js';
import type { AIUserContextBlock } from '@ee-postmind/shared';
import { getEffectiveLimits } from './admin-settings.service.js';

// ============================================================
// Context Injector Service
// ============================================================
// Builds the User Context Block — a structured prompt segment injected
// into every AI call (NLP router, CPE, post creator, humanizer, ad designer).
// Respects plan gating: only injects data the user's tier allows.

/**
 * Build the full AI context block for a given user.
 * Respects tier-based feature gating.
 */
export async function buildUserContextBlock(
  userId: string,
  workspaceId: string,
): Promise<AIUserContextBlock> {
  // Get the user's subscription tier
  const subscription = await prisma.subscription.findUnique({
    where: { workspaceId },
    select: { tier: true },
  });
  const tier = subscription?.tier || 'basic';
  const limits = await getEffectiveLimits(tier);

  const result: AIUserContextBlock = {
    profile: null,
    voice: null,
  };

  // ----- Intelligence Profile (all plans with ai_intelligence_basic) -----
  if ((limits as any).aiIntelligenceBasic !== false) {
    const profile = await prisma.userIntelligenceProfile.findUnique({
      where: { userId },
    });
    if (profile) {
      result.profile = {
        id: profile.id,
        userId: profile.userId,
        niche: profile.niche,
        targetAudience: profile.targetAudience as AIUserContextBlock['profile'] extends { targetAudience: infer T } ? T : null,
        contentPillars: profile.contentPillars,
        tonePreference: profile.tonePreference,
        avoidedTopics: profile.avoidedTopics,
        goals: profile.goals as any,
        postingPreferences: profile.postingPreferences as any,
        brandKeywords: profile.brandKeywords,
        completenessScore: profile.completenessScore,
      };
    }
  }

  // ----- Voice Model (business+ with ai_voice_model) -----
  if ((limits as any).aiVoiceModel !== false) {
    const voice = await prisma.userVoiceModel.findUnique({
      where: { userId },
    });
    if (voice) {
      result.voice = {
        id: voice.id,
        userId: voice.userId,
        formalityScore: voice.formalityScore,
        energyScore: voice.energyScore,
        avgSentenceLength: voice.avgSentenceLength,
        vocabularySamples: voice.vocabularySamples as any,
        emojiUsageRate: voice.emojiUsageRate,
        ctaStyle: voice.ctaStyle,
        hashtagPatterns: voice.hashtagPatterns as any,
        confidenceScore: voice.confidenceScore,
        samplesAnalyzed: voice.samplesAnalyzed,
      };
    }
  }

  // ----- Top Performing Content (business+ with ai_engagement_monitor) -----
  if ((limits as any).aiEngagementMonitor !== false) {
    const topContent = await prisma.userEngagementHistory.findMany({
      where: {
        userId,
        snapshotType: '7d',
        reach: { gt: 0 },
      },
      orderBy: { engagementRate: 'desc' },
      take: 5,
      select: { contentType: true, topic: true, engagementRate: true },
    });

    if (topContent.length > 0) {
      result.topPerformingContent = topContent.map((c) => ({
        contentType: c.contentType || 'unknown',
        topic: c.topic || 'general',
        engagementRate: c.engagementRate,
      }));
    }
  }

  // ----- Recommendations (enterprise with ai_strategy_recommendations) -----
  if ((limits as any).aiStrategyRecommendations !== false) {
    const recs = await prisma.userStrategyRecommendation.findMany({
      where: {
        userId,
        status: 'pending',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { priority: 'desc' },
      take: 3,
      select: { title: true },
    });
    if (recs.length > 0) {
      result.recommendations = recs.map((r) => r.title);
    }
  }

  // ----- Competitor Benchmark (enterprise with ai_pattern_analysis) -----
  if ((limits as any).aiPatternAnalysis !== false) {
    const competitors = await prisma.competitorAccount.findMany({
      where: { userId },
      select: { avgEngRate: true },
    });

    if (competitors.length > 0) {
      const competitorAvg = competitors.reduce((sum, c) => sum + (c.avgEngRate || 0), 0) / competitors.length;

      // Get user's avg engagement rate
      const userSnapshots = await prisma.userEngagementSnapshot.findMany({
        where: { userId },
        orderBy: { weekStart: 'desc' },
        take: 4,
        select: { avgEngRate: true },
      });
      const userAvg = userSnapshots.length > 0
        ? userSnapshots.reduce((sum, s) => sum + s.avgEngRate, 0) / userSnapshots.length
        : 0;

      result.competitorBenchmark = {
        avgEngRate: competitorAvg,
        userEngRate: userAvg,
      };
    }
  }

  return result;
}

/**
 * Format the context block as a prompt string for injection into LLM calls.
 */
export function formatContextForPrompt(ctx: AIUserContextBlock): string {
  const sections: string[] = [];

  sections.push('=== USER INTELLIGENCE CONTEXT ===');

  if (ctx.profile) {
    const p = ctx.profile;
    sections.push('\n📋 USER PROFILE:');
    if (p.niche) sections.push(`• Niche/Industry: ${p.niche}`);
    if (p.targetAudience) {
      const ta = p.targetAudience;
      if (ta.demographics) sections.push(`• Target Audience: ${ta.demographics}`);
      if (ta.painPoints?.length) sections.push(`• Audience Pain Points: ${ta.painPoints.join(', ')}`);
      if (ta.aspirations?.length) sections.push(`• Audience Aspirations: ${ta.aspirations.join(', ')}`);
    }
    if (p.contentPillars.length > 0) sections.push(`• Content Pillars: ${p.contentPillars.join(', ')}`);
    if (p.tonePreference) sections.push(`• Preferred Tone: ${p.tonePreference}`);
    if (p.goals) {
      const g = p.goals;
      if (g.primary) sections.push(`• Primary Goal: ${g.primary}`);
      if (g.secondary) sections.push(`• Secondary Goal: ${g.secondary}`);
    }
    if (p.avoidedTopics.length > 0) sections.push(`• ⚠️ AVOID these topics: ${p.avoidedTopics.join(', ')}`);
    if (p.brandKeywords.length > 0) sections.push(`• Brand Keywords/Hashtags: ${p.brandKeywords.join(', ')}`);
    if (p.postingPreferences) {
      const pp = p.postingPreferences;
      if (pp.frequency) sections.push(`• Posting Frequency: ${pp.frequency}`);
    }
  }

  if (ctx.voice && ctx.voice.confidenceScore > 0.2) {
    const v = ctx.voice;
    sections.push('\n🎙️ BRAND VOICE (match this style):');
    sections.push(`• Formality: ${v.formalityScore < 0.3 ? 'Very Casual' : v.formalityScore < 0.5 ? 'Casual' : v.formalityScore < 0.7 ? 'Professional' : 'Formal'}`);
    sections.push(`• Energy: ${v.energyScore < 0.3 ? 'Calm & Measured' : v.energyScore < 0.5 ? 'Moderate' : v.energyScore < 0.7 ? 'Energetic' : 'High Energy'}`);
    if (v.avgSentenceLength) sections.push(`• Avg Sentence Length: ~${Math.round(v.avgSentenceLength)} words`);
    if (v.emojiUsageRate > 0) sections.push(`• Emoji Usage: ~${v.emojiUsageRate.toFixed(1)} per 100 words`);
    if (v.ctaStyle) sections.push(`• CTA Style: ${v.ctaStyle}`);
    if (v.hashtagPatterns) {
      const hp = v.hashtagPatterns;
      if (hp.avgCount) sections.push(`• Hashtag Usage: ~${hp.avgCount} per post`);
      if (hp.preferred?.length) sections.push(`• Preferred Hashtags: ${hp.preferred.slice(0, 5).join(', ')}`);
    }
    if (v.vocabularySamples) {
      const vs = v.vocabularySamples;
      if (vs.preferredWords?.length) sections.push(`• Vocabulary Preferences: tends to use "${vs.preferredWords.slice(0, 5).join('", "')}"`);
    }
  }

  if (ctx.topPerformingContent?.length) {
    sections.push('\n📊 TOP PERFORMING CONTENT:');
    for (const tc of ctx.topPerformingContent) {
      sections.push(`• ${tc.contentType} about "${tc.topic}" → ${tc.engagementRate.toFixed(1)}% engagement rate`);
    }
  }

  if (ctx.competitorBenchmark) {
    const cb = ctx.competitorBenchmark;
    const comparison = cb.userEngRate > cb.avgEngRate ? 'above' : 'below';
    sections.push(`\n🏆 COMPETITOR BENCHMARK: User engagement (${cb.userEngRate.toFixed(1)}%) is ${comparison} competitor avg (${cb.avgEngRate.toFixed(1)}%)`);
  }

  if (ctx.recommendations?.length) {
    sections.push('\n💡 CURRENT STRATEGY RECOMMENDATIONS:');
    for (const rec of ctx.recommendations) {
      sections.push(`• ${rec}`);
    }
  }

  sections.push('\n=== END USER CONTEXT ===');
  sections.push('Use this intelligence to personalize ALL content for this specific user. Match their voice, target their audience, align with their goals, and avoid their avoided topics.\n');

  return sections.join('\n');
}
