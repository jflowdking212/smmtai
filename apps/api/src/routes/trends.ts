import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getEffectiveLimits } from '../services/admin-settings.service.js';
import { TrendCollectorService } from '../services/trends/trend-collector.service.js';
import { prisma } from '../config/database.js';

const router = Router();
router.use(authenticate);

// ── Access check middleware ───────────────────────────────────
async function checkTrendAccess(req: any, res: any, next: any) {
  try {
    const subscription = req.workspace?.subscription;
    const tier = subscription?.tier || 'basic';
    const limits = await getEffectiveLimits(tier);
    if (!(limits as any).trendEngineAccess) {
      return res.status(403).json({ error: 'FEATURE_GATED', message: 'Upgrade to Pro to access Trend Intelligence' });
    }
    (req as any).trendLimits = limits;
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ── GET /api/trends — list trends ────────────────────────────
router.get('/', checkTrendAccess, async (req: any, res) => {
  try {
    const { platform, category, status, scope, timeframe, page = '1', limit = '30' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 30, 100);
    const skip = (pageNum - 1) * limitNum;

    const days = timeframe === '1d' ? 1 : timeframe === '3d' ? 3 : timeframe === '7d' ? 7 : 15;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);

    const where: any = {
      isNsfw: false, isBlacklisted: false, isFlagged: false,
      createdAt: { gte: cutoff },
    };
    if (platform && platform !== '') where.platform = platform;
    if (category && category !== '') where.category = category;
    if (status && status !== '') where.trendStatus = status;

    const [trends, total] = await Promise.all([
      (prisma as any).trend.findMany({
        where, orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
        skip, take: limitNum,
      }),
      (prisma as any).trend.count({ where }),
    ]);

    res.json({ trends, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/trends/opportunities ────────────────────────────
router.get('/opportunities', checkTrendAccess, async (req: any, res) => {
  const limits = req.trendLimits;
  if (!limits?.trendOpportunityDetection) {
    return res.status(403).json({ error: 'FEATURE_GATED', message: 'Opportunity Detection requires Business plan' });
  }
  try {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3);
    const trends = await (prisma as any).trend.findMany({
      where: {
        isNsfw: false, isBlacklisted: false, isFlagged: false,
        viralProbability: { gte: 40 },
        competitionLevel: { lte: 0.45 },
        trendStatus: { in: ['Emerging', 'Rising', 'Hot'] },
        createdAt: { gte: cutoff },
      },
      orderBy: [{ viralProbability: 'desc' }, { competitionLevel: 'asc' }],
      take: 10,
    });
    res.json({ trends });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/trends/forecasts ─────────────────────────────────
router.get('/forecasts', checkTrendAccess, async (req: any, res) => {
  const limits = req.trendLimits;
  if (!limits?.trendForecasting) {
    return res.status(403).json({ error: 'FEATURE_GATED', message: 'Trend Forecasting requires Business plan' });
  }
  try {
    const trends = await (prisma as any).trend.findMany({
      where: {
        isNsfw: false, isBlacklisted: false,
        trendStatus: { in: ['Emerging', 'Rising'] },
        peakTimeEstimate: { not: null },
      },
      orderBy: { viralProbability: 'desc' },
      take: 10,
    });
    res.json({ trends });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/trends/:id/save ─────────────────────────────────
router.post('/:id/save', checkTrendAccess, async (req: any, res) => {
  const limits = req.trendLimits;
  if (!limits?.trendSavedTrends) {
    return res.status(403).json({ error: 'FEATURE_GATED', message: 'Saving trends requires Pro plan' });
  }
  try {
    const userId = req.user?.id;
    await (prisma as any).savedTrend.upsert({
      where: { userId_trendId: { userId, trendId: req.params.id } },
      create: { userId, trendId: req.params.id },
      update: {},
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/trends/saved ─────────────────────────────────────
router.get('/saved', checkTrendAccess, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const saved = await (prisma as any).savedTrend.findMany({
      where: { userId },
      include: { trend: true },
      orderBy: { savedAt: 'desc' },
    });
    res.json({ trends: saved.map((s: any) => s.trend) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/trends/:id/generate-campaign ────────────────────
router.post('/:id/generate-campaign', checkTrendAccess, async (req: any, res) => {
  const limits = req.trendLimits;
  if (!limits?.trendCampaignGeneration) {
    return res.status(403).json({ error: 'FEATURE_GATED', message: 'Campaign Generation requires Pro plan' });
  }
  try {
    const trend = await (prisma as any).trend.findUnique({ where: { id: req.params.id } });
    if (!trend) return res.status(404).json({ error: 'Trend not found' });

    const { platform = trend.platform, tone = 'professional', goal = 'engagement' } = req.body;

    // Build campaign using OpenAI service
    const { chatCompletion } = await import('../services/openai.service.js');
    const prompt = `You are a social media expert. Create a complete marketing campaign for this trending topic.

Trend: "${trend.topic}"
Category: ${trend.category || 'General'}
Platform: ${platform}
Tone: ${tone}
Goal: ${goal}
Viral Probability: ${trend.viralProbability}%
Trend Status: ${trend.trendStatus}

Respond ONLY with valid JSON in this exact format:
{
  "caption": "full post caption text here",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "cta": "call to action text",
  "imagePrompt": "detailed image generation prompt",
  "postingStrategy": "detailed posting strategy with timing recommendations",
  "contentCalendar": [
    {"day": "Day 1", "platform": "${platform}", "content": "post content", "time": "9:00 AM"},
    {"day": "Day 3", "platform": "${platform}", "content": "post content", "time": "12:00 PM"},
    {"day": "Day 5", "platform": "${platform}", "content": "post content", "time": "6:00 PM"},
    {"day": "Day 7", "platform": "${platform}", "content": "post content", "time": "8:00 PM"}
  ]
}`;

    const messages = [{ role: 'user' as const, content: prompt }];
    const response = await chatCompletion(messages);
    let campaign;
    try {
      const responseText = response || "";
      const jsonMatch = responseText.match(/{[\s\S]+}/);
      campaign = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      campaign = {
        caption: `🔥 ${trend.topic}\n\nThis is trending right now! Here's what you need to know...\n\n#trending #${trend.category?.toLowerCase() || 'viral'}`,
        hashtags: [`#${trend.normalizedTopic?.split(' ')[0] || 'trending'}`, '#viral', `#${trend.platform}`, '#content', '#marketing'],
        cta: 'Share your thoughts in the comments below! 👇',
        imagePrompt: `Create a visually striking social media graphic about: ${trend.topic}`,
        postingStrategy: `Post on ${platform} during peak hours (9am, 12pm, 6pm). Engage with comments within the first hour.`,
        contentCalendar: [
          { day: 'Day 1', platform, content: `Awareness post about ${trend.topic}`, time: '9:00 AM' },
          { day: 'Day 3', platform, content: `Deep dive into ${trend.topic}`, time: '12:00 PM' },
          { day: 'Day 5', platform, content: `Your take on ${trend.topic}`, time: '6:00 PM' },
          { day: 'Day 7', platform, content: `Results & lessons from ${trend.topic}`, time: '8:00 PM' },
        ],
      };
    }

    res.json({ campaign, trend });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/trends/collect (manual trigger) ─────────────────
router.post('/collect', checkTrendAccess, async (req: any, res) => {
  try {
    const count = await TrendCollectorService.collectAllTrends();
    res.json({ success: true, collected: count });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
