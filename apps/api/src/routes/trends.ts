import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getEffectiveLimits } from '../services/admin-settings.service.js';
import { TrendCollectorService } from '../services/trends/trend-collector.service.js';
import { prisma } from '../config/database.js';

const PLATFORM_LIMITS: Record<string, number> = {
  facebook: 63000,
  instagram: 2200,
  tiktok: 4000,
  linkedin: 3000,
  twitter: 280,
  youtube: 5000,
  pinterest: 500,
  threads: 500,
  reddit: 40000,
  telegram: 4096,
  slack: 4000,
  discord: 2000,
  wordpress: 100000,
  medium: 100000,
  blogger: 100000,
  google_business: 1500,
  bluesky: 300,
  mastodon: 500,
  tumblr: 100000,
  truth_social: 500,
  lemmy: 10000,
  pleroma: 500,
  entreprenrs: 100000,
  chrxstians: 100000,
  iohah: 100000,
};

export function getPlatformTailoringGuidelines(platform: string): string {
  const plat = platform ? platform.toLowerCase() : 'general';
  switch (plat) {
    case 'chrxstians':
      return 'Target Audience: Christian community. Focus on sharing the Gospel, faith-based reflections, biblically grounded encouragement, and moral/spiritual values. Use an encouraging, uplifting, and faith-centered tone.';
    case 'entreprenrs':
      return 'Target Audience: Startup founders, business owners, and creators. Focus on entrepreneurship stories, innovative ideas, practical business training, startup lessons, productivity hacks, and motivational insights for builders.';
    case 'iohah':
      return 'Target Audience: Natural health practitioners and wellness enthusiasts. Focus on natural health, holistic healing, wellness tips, herbal practices, organic living, and clean, practitioner-supported wellness advice.';
    case 'linkedin':
      return 'Target Audience: Professionals, recruiters, and industry leaders. Focus on career growth, professional training, thought leadership, business strategies, and networking. Use a professional, structured, and insightful tone.';
    case 'twitter':
    case 'x':
      return 'Target Audience: General public. Focus on high-impact, short, and punchy statements, starting with a strong hook. Keep it concise, engaging, and fit within character limits.';
    case 'threads':
      return 'Target Audience: Friends, conversationalists. Focus on conversational, cozy, interactive discussion, inviting the audience to reply with questions and conversational hooks.';
    case 'reddit':
      return 'Target Audience: Niche community subreddits. Focus on authentic, non-corporate, informative text. Avoid marketing buzzwords, and write in a community-oriented, discussion-inviting style.';
    case 'instagram':
      return 'Target Audience: Visual consumers. Focus on lifestyle, visual storytelling, aesthetic copy, engaging first-line hook, emojis, and hashtags. Encourage engagement or bio link clicks.';
    case 'tiktok':
      return 'Target Audience: Gen Z/Millennial short video viewers. Focus on trend-jacking, high-energy hooks, quick summaries of video content, and strong calls to action (like sharing or commenting).';
    case 'pinterest':
      return 'Target Audience: Planners, DIYers, and creators. Focus on inspiring ideas, tutorials, guides, visual descriptions, and search-optimized keywords.';
    case 'youtube':
      return 'Target Audience: Video viewers. Focus on structured video description formatting: video summary, key timestamps/topics covered, and calls to subscribe/like.';
    case 'facebook':
      return 'Target Audience: Broad family and friends network. Focus on personal storytelling, community-building, local engagement, and long-form conversational copy.';
    case 'wordpress':
    case 'medium':
    case 'blogger':
      return 'Target Audience: Blog readers seeking deep-dives. Focus on long-form blog post structure: descriptive headings/subheadings, comprehensive details, and structured paragraphs.';
    case 'slack':
    case 'discord':
      return 'Target Audience: Community chat groups. Focus on informal, highly interactive announcements, pings, bullet points, and friendly chat tone.';
    case 'mastodon':
    case 'bluesky':
    case 'pleroma':
      return 'Target Audience: Decentralized microblog users. Focus on conversational, authentic, tech-savvy discussion, avoiding sales pitches, and using tags cleanly.';
    case 'tumblr':
      return 'Target Audience: Creative artists and fandoms. Focus on expressive, creative, informal, and visual-friendly text.';
    case 'telegram':
      return 'Target Audience: Channel subscribers. Focus on announcement broadcast style: bold headings, neat bullet points, direct communication, and clear links.';
    case 'google_business':
      return 'Target Audience: Local searchers and customers. Focus on local updates, promotions, business hours, services offered, and direct actions (like "Book Now" or "Call").';
    default:
      return 'Target Audience: Social media followers. Focus on engaging, high-quality, and platform-appropriate copy.';
  }
}

// ?????? Location & Local Trend Generation Helpers ????????????????????????????????????????????????
async function detectUserCountry(req: any, userId: string): Promise<string> {
  try {
    // 1. Try DB user profile
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.country && user.country.trim() !== '') {
      return user.country;
    }

    // 2. Try Headers
    const headerCountry = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'];
    if (headerCountry) {
      const code = String(headerCountry).toUpperCase();
      const countries: Record<string, string> = {
        NG: 'Nigeria',
        US: 'United States',
        GB: 'United Kingdom',
        CA: 'Canada',
        AU: 'Australia',
        ZA: 'South Africa',
        DE: 'Germany',
        FR: 'France',
        IN: 'India',
        JP: 'Japan',
        BR: 'Brazil',
        SG: 'Singapore',
        AE: 'United Arab Emirates',
      };
      if (countries[code]) return countries[code];
    }

    // 3. Try Timezone mapping
    const tz = user?.timezone || 'UTC';
    if (tz.includes('Lagos') || tz.includes('Africa/')) {
      if (tz.includes('Lagos')) return 'Nigeria';
    }
    if (tz.includes('London') || tz.includes('Europe/London')) return 'United Kingdom';
    if (tz.includes('America/')) {
      if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) return 'United States';
      if (tz.includes('Toronto')) return 'Canada';
    }

    // 4. Try GeoIP API lookup with short timeout
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress;
    if (clientIp && clientIp !== '127.0.0.1' && !clientIp.startsWith('10.') && !clientIp.startsWith('192.168.')) {
      const res = await Promise.race([
        fetch(`http://ip-api.com/json/${clientIp}`).then(r => r.json()),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);
      if (res && res.country) {
        return res.country;
      }
    }
  } catch (err: any) {
    console.warn(`[detectUserCountry] Error: ${err.message}`);
  }
  return 'Global';
}

async function generateLocalTrends(country: string) {
  try {
    const { chatCompletion } = await import('../services/openai.service.js');
    const prompt = `You are a social media trend researcher. Generate 15 current, realistic trending topics in "${country}" right now across social media platforms (X/Twitter, TikTok, Instagram, YouTube, LinkedIn, Reddit, Facebook).
Include topics in tech, business, lifestyle, entertainment, sports, and news.

Respond ONLY with valid JSON in this exact format:
{
  "trends": [
    {
      "topic": "#TopicName or Phrase",
      "platform": "twitter",
      "score": 85,
      "engagementCount": 250000,
      "growthRate": 120.5,
      "trendStatus": "Hot",
      "sentiment": "positive",
      "competitionLevel": 0.4,
      "viralProbability": 75,
      "lifespanDays": 7,
      "category": "Technology"
    }
  ]
}`;
    const response = await chatCompletion([{ role: 'user', content: prompt }], {
      openrouterDefault: true,
      openrouterModel: 'deepseek/deepseek-v4-flash',
    });
    
    const jsonMatch = response.match(/{[\s\S]+}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    
    if (data && Array.isArray(data.trends)) {
      for (const t of data.trends) {
        const peakTime = new Date();
        peakTime.setHours(peakTime.getHours() + (t.trendStatus === 'Viral' ? 4 : t.trendStatus === 'Hot' ? 12 : 36));
        
        await (prisma as any).trend.upsert({
          where: { topic_platform: { topic: t.topic.slice(0, 200), platform: t.platform } },
          create: {
            topic: t.topic.slice(0, 200),
            normalizedTopic: t.topic.toLowerCase().replace(/[^a-z0-9]/g, ''),
            category: t.category || 'General',
            platform: t.platform,
            score: t.score || 50,
            engagementCount: t.engagementCount || 10000,
            growthRate: t.growthRate || 50.0,
            trendStatus: t.trendStatus || 'Rising',
            sentiment: t.sentiment || 'neutral',
            competitionLevel: t.competitionLevel || 0.5,
            viralProbability: t.viralProbability || 50.0,
            peakTimeEstimate: peakTime,
            lifespanDays: t.lifespanDays || 7,
            country: country,
            isNsfw: false, isBlacklisted: false, isFlagged: false,
          },
          update: {
            score: t.score || 50,
            engagementCount: t.engagementCount || 10000,
            growthRate: t.growthRate || 50.0,
            trendStatus: t.trendStatus || 'Rising',
            viralProbability: t.viralProbability || 50.0,
            country: country,
            updatedAt: new Date(),
          }
        });
      }
      console.log(`[TrendCollector] Successfully generated ${data.trends.length} local trends for ${country}`);
    }
  } catch (err: any) {
    console.error(`[TrendCollector] Failed to generate local trends for ${country}: ${err.message}`);
  }
}


const router = Router();
router.use(authenticate);

// ── Access check middleware ───────────────────────────────────
async function checkTrendAccess(req: any, res: any, next: any) {
  try {
    // authenticate() only sets req.userId + req.workspaceId, NOT req.workspace.
    // We must query the subscription tier directly from the DB.
    const workspaceId = req.workspaceId;
    let tier = 'basic';

    if (workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { subscription: true },
      });
      tier = (workspace?.subscription as any)?.tier?.toLowerCase() || 'basic';
    }

    const limits = await getEffectiveLimits(tier);

    // Paid plans (pro, business, enterprise) always get Trend Engine access.
    // Only gate on 'basic' (free) tier.
    const isPaidPlan = ['pro', 'business', 'enterprise'].includes(tier);
    if (!isPaidPlan && !(limits as any).trendEngineAccess) {
      return res.status(403).json({
        error: 'FEATURE_GATED',
        message: 'Upgrade to Pro to access Trend Intelligence',
        currentPlan: tier,
      });
    }

    (req as any).trendLimits = { ...(limits as any), trendEngineAccess: true };
    (req as any).trendTier = tier;
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

    const baseWhere: any = {
      isNsfw: false, isBlacklisted: false, isFlagged: false,
      createdAt: { gte: cutoff },
    };
    if (platform && platform !== '') baseWhere.platform = platform;
    if (category && category !== '') baseWhere.category = category;
    if (status && status !== '') baseWhere.trendStatus = status;

    // Detect user country or override with scope query parameter
    let userCountry = scope && scope !== 'all' && scope !== 'global' && scope !== 'Global' ? (scope as string) : null;
    if (!userCountry && scope !== 'global' && scope !== 'Global') {
      userCountry = await detectUserCountry(req, req.userId);
    } else if (scope === 'global' || scope === 'Global') {
      userCountry = 'Global';
    }

    // Auto-generate local trends if count is low for this specific country
    if (userCountry && userCountry !== 'Global') {
      const twelveHoursAgo = new Date();
      twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
      
      const localCount = await (prisma as any).trend.count({
        where: {
          country: userCountry,
          createdAt: { gte: twelveHoursAgo },
        },
      });

      if (localCount === 0) {
        // 0 trends: generate inline (await)
        await generateLocalTrends(userCountry);
      } else if (localCount < 8) {
        // 1-7 trends: generate in background
        generateLocalTrends(userCountry).catch((err: any) => {
          console.error(`[Background Trend Generation] Error for ${userCountry}: ${err.message}`);
        });
      }
    }

    let trends: any[] = [];
    let total = 0;

    if (userCountry && userCountry !== 'Global') {
      const localWhere = {
        ...baseWhere,
        country: userCountry,
      };

      const globalWhere = {
        ...baseWhere,
        OR: [
          { country: null },
          { country: { not: userCountry } },
        ],
      };

      // Fetch pools
      const [localPool, globalPool, localCount, globalCount] = await Promise.all([
        (prisma as any).trend.findMany({
          where: localWhere,
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          take: 200,
        }),
        (prisma as any).trend.findMany({
          where: globalWhere,
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          take: 500,
        }),
        (prisma as any).trend.count({ where: localWhere }),
        (prisma as any).trend.count({ where: globalWhere }),
      ]);

      total = localCount + globalCount;

      const localTarget = Math.floor(limitNum * 0.4);
      const globalTarget = limitNum - localTarget;

      const localPage = localPool.slice((pageNum - 1) * localTarget, pageNum * localTarget);
      const globalPage = globalPool.slice((pageNum - 1) * globalTarget, pageNum * globalTarget);

      let combined = [...localPage, ...globalPage];
      const shortfall = localTarget - localPage.length;
      if (shortfall > 0) {
        const fallbackGlobal = globalPool.slice(pageNum * globalTarget, pageNum * globalTarget + shortfall);
        combined = [...combined, ...fallbackGlobal];
      }

      // Sort page items by score descending
      combined.sort((a, b) => (b.score || 0) - (a.score || 0));
      trends = combined;
    } else {
      // User is in global space or detection returned 'Global'
      [trends, total] = await Promise.all([
        (prisma as any).trend.findMany({
          where: baseWhere,
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: limitNum,
        }),
        (prisma as any).trend.count({ where: baseWhere }),
      ]);
    }

    res.json({ trends, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

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

// ── POST /api/trends/generate-post ────────────────────────────
router.post('/generate-post', checkTrendAccess, async (req: any, res) => {
  try {
    const { topic, platform, category, length } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });

    // Determine location if available
    let location = 'Global';
    try {
      let cleanTopic = topic;
      const topicMatch = topic.match(/"([^"]+)"/);
      if (topicMatch && topicMatch[1]) {
        cleanTopic = topicMatch[1];
      }
      const trend = await prisma.trend.findFirst({
        where: {
          OR: [
            { topic: { contains: cleanTopic } },
            { normalizedTopic: cleanTopic.toLowerCase().replace(/[^a-z0-9]/g, '') }
          ]
        }
      });
      if (trend?.country) {
        location = trend.country;
      } else {
        location = await detectUserCountry(req, req.userId!);
      }
    } catch (err: any) {
      console.warn(`[Location Detection in Generate Post] Error: ${err.message}`);
    }

    const locPrompt = location && location !== 'Global' ? `The topic is trending in the location: ${location}. You MUST naturally include a location tag (e.g. 📍 ${location}) at the beginning of the post.` : '';

    const limit = PLATFORM_LIMITS[platform?.toLowerCase()] || 2200;
    let lengthConstraint = '';
    if (length === 'short') {
      lengthConstraint = `The post MUST be short and concise (under 150 characters).`;
    } else if (length === 'medium') {
      lengthConstraint = `The post MUST be of medium length (around 400-500 characters).`;
    } else if (length === 'long') {
      lengthConstraint = `The post MUST be detailed and comprehensive (around 1200-1500 characters).`;
    } else if (length === 'extra_long') {
      lengthConstraint = `The post MUST be exceptionally detailed, long, and comprehensive (around 3000-5000 characters).`;
    }

    const platformStyleGuide = getPlatformTailoringGuidelines(platform);

    const { chatCompletion } = await import('../services/openai.service.js');
    const prompt = `Write a high-engaging social media post about this trending topic: "${topic}".
Category: ${category || 'General'}
Platform: ${platform || 'general'}
${locPrompt}
Make it sound human, insightful, and designed for maximum engagement on ${platform || 'general social media'}.
Include relevant hashtags.

Platform Style Guide & Target Audience instruction:
${platformStyleGuide}
You MUST tailor the style, formatting, tone, and target audience alignment to strictly match these platform requirements.

Length instructions:
${lengthConstraint}
CRITICAL: The entire post text MUST NOT exceed the platform's absolute maximum limit of ${limit} characters.`;

    let content = '';
    try {
      const response = await chatCompletion([{ role: 'user', content: prompt }], {
        openrouterDefault: true,
        openrouterModel: 'deepseek/deepseek-v4-flash',
      });
      content = response || '';
    } catch (err: any) {
      console.warn(`[Generate Post Fallback] API error: ${err.message}. Using mock.`);
      let cleanTopic = topic;
      const topicMatch = topic.match(/"([^"]+)"/);
      if (topicMatch && topicMatch[1]) {
        cleanTopic = topicMatch[1];
      }
      const locTag = location && location !== 'Global' ? `📍 ${location}\n\n` : '';
      const plat = platform ? platform.toLowerCase() : 'general';

      if (plat === 'chrxstians') {
        if (length === 'short') {
          content = `${locTag}🙏 Reflecting on "${cleanTopic}" today. Let's remember to keep our eyes on the Gospel and walk in faith. Blessings! #faith #gospel`;
        } else if (length === 'extra_long') {
          content = `${locTag}🙏 Reflecting on "${cleanTopic}" today. How does this align with our walking in faith?\n\nAs we navigate the trends and shifts of the modern world, it is essential that we ground our perspectives in biblical truth. The timless message of the Gospel provides an anchor. When we see massive shifts in technology or culture, we should view them as new opportunities to share God's love, grace, and truth with a world searching for hope.\n\nScripture reminds us that we are called to be the light of the world. In the digital age, this means our online interactions, comments, and posts should reflect the fruits of the Spirit: love, joy, peace, patience, kindness, goodness, and faithfulness.\n\nHow can we be a positive, Christ-like influence in this trending conversation? Share your thoughts and let's encourage one another in our spiritual walks.\n\n#faith #gospel #blessings`;
        } else {
          content = `${locTag}🙏 Reflecting on "${cleanTopic}" today. How does this align with our walking in faith?\n\nAs we navigate the trends and shifts of the modern world, it is essential that we ground our perspectives in biblical truth. The message of the Gospel provides an anchor. When we see massive shifts in technology or culture, we should view them as new opportunities to share God's love, grace, and truth with a world searching for hope.\n\n#faith #gospel #blessings`;
        }
      } else if (plat === 'entreprenrs') {
        if (length === 'short') {
          content = `${locTag}💼 Quick entrepreneur tip: "${cleanTopic}" is changing the game. Build early, learn fast! #business #entrepreneur`;
        } else if (length === 'extra_long') {
          content = `${locTag}💼 Let's analyze "${cleanTopic}" from an entrepreneurial perspective.\n\nIn business, identifying these market trends early is the key to capturing market share. This topic is more than just temporary hype; it represents a real shift in consumer demand or operational methodology. Founders who build solutions around this movement today are positioning themselves for significant leverage tomorrow.\n\nHere's my training advice for builders:\n1. Speed is your competitive advantage. Build a minimum viable product to test interest.\n2. Collect user feedback immediately. Don't build in a silo.\n3. Pivot quickly based on data, not assumptions.\n\nWhat is your strategy to leverage this? Let's discuss in the comments!\n\n#business #entrepreneur #startup #training`;
        } else {
          content = `${locTag}💼 Let's analyze "${cleanTopic}" from an entrepreneurial perspective.\n\nIn business, identifying these market trends early is the key to capturing market share. This topic is more than just temporary hype; it represents a real shift in consumer demand. Founders who build solutions around this movement today are positioning themselves for significant leverage tomorrow.\n\n#business #entrepreneur #startup #training`;
        }
      } else if (plat === 'iohah') {
        if (length === 'short') {
          content = `${locTag}🌿 Natural health spotlight: "${cleanTopic}". Embrace wellness and holistic living today. #wellness #holistic`;
        } else if (length === 'extra_long') {
          content = `${locTag}🌿 Embracing natural health and wellness during the discussion of "${cleanTopic}".\n\nAs practitioners and health enthusiasts, we look at trends through the lens of holistic wellness and organic living. How does this shift affect our mental, physical, and emotional health? When society moves faster, taking time to ground ourselves, practice mindfulness, and feed our bodies with organic, whole foods becomes a critical necessity rather than a luxury.\n\nKey wellness recommendations:\n- Prioritize sleep hygiene and rest.\n- Incorporate natural herbs and clean nutrition into your daily routine.\n- Practice digital detoxing to maintain mental peace.\n\nTrue health is about harmony between mind, body, and spirit. Let's make choices that nurture our vitality and support our body's natural healing systems.\n\n#wellness #holistichealth #naturalremedies`;
        } else {
          content = `${locTag}🌿 Embracing natural health and wellness during the discussion of "${cleanTopic}".\n\nAs practitioners and health enthusiasts, we look at trends through the lens of holistic wellness and organic living. How does this shift affect our mental, physical, and emotional health? Let's prioritize rest, clean nutrition, and mindfulness to maintain wellness.\n\n#wellness #holistichealth #naturalremedies`;
        }
      } else {
        if (length === 'short') {
          content = `${locTag}🔥 "${cleanTopic}" is taking over right now! What are your thoughts on this? Let's discuss! #trending #viral`;
        } else if (length === 'extra_long') {
          content = `${locTag}🔥 "${cleanTopic}" is taking over right now!\n\nHonestly, the buzz around this is real and the conversation is just getting started. It is fascinating how a single trend can capture the collective attention of the internet overnight. People are posting, commenting, and sharing their takes at an unprecedented rate. It's safe to say this is more than just a passing moment; it's a cultural shift in how we engage online.\n\nLet's analyze why this is happening. The dynamics of modern social algorithms favor high-resonance, high-interaction content. When a topic like this starts gaining traction, it creates a feedback loop: more views lead to more comments, which leads to more algorithmic distribution. This is a classic viral loop in action.\n\nWhat this means for creators and brand builders is that speed-to-market is the ultimate competitive advantage. Those who can identify these shifts early and create relevant content around them will capture the lion's share of attention. Don't wait for the trend to peak; start the conversation now while the momentum is still building.\n\nWhat are your thoughts on this? Drop your hottest take below — let's discuss!\n\n#${cleanTopic.toLowerCase().replace(/[^a-z0-9]/g, '')} #trending #viral`;
        } else if (length === 'long') {
          content = `${locTag}🔥 "${cleanTopic}" is taking over right now!\n\nHonestly, the buzz around this is real and the conversation is just getting started. It is fascinating how a single trend can capture the collective attention of the internet overnight. People are posting, commenting, and sharing their takes at an unprecedented rate. It's safe to say this is more than just a passing moment; it's a cultural shift in how we engage online.\n\nWhat are your thoughts on this? Let's discuss!\n\n#${cleanTopic.toLowerCase().replace(/[^a-z0-9]/g, '')} #trending #viral`;
        } else {
          content = `${locTag}🔥 "${cleanTopic}" is taking over right now!\n\nIf you haven't checked this out yet, you're missing out. The buzz around this is real and the conversation is just getting started.\n\nWhat are your thoughts on this? Let's discuss!\n\n#${cleanTopic.toLowerCase().replace(/[^a-z0-9]/g, '')} #trending #viral`;
        }
      }
    }
    res.json({ content });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export { router as trendsRouter };
export default router;

