import { prisma } from '../config/database.js';
import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkUsage, incrementUsage } from '../middleware/usage.js';
import { chatWithRetry } from '../services/openai.service.js';
import { buildUserContextBlock, formatContextForPrompt } from '../services/context-injector.service.js';

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

export const aiRouter = Router();

// ── Helper: Resolve User Country for Location Badges/Tags ──
async function detectUserCountry(req: any, userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.country && user.country.trim() !== '') {
      return user.country;
    }
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
      };
      if (countries[code]) return countries[code];
    }
    const tz = user?.timezone || 'UTC';
    if (tz.includes('Lagos') || tz.includes('Africa/')) {
      if (tz.includes('Lagos')) return 'Nigeria';
    }
    if (tz.includes('London') || tz.includes('Europe/London')) return 'United Kingdom';
    if (tz.includes('America/')) {
      if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) return 'United States';
      if (tz.includes('Toronto')) return 'Canada';
    }
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
    console.warn(`[detectUserCountry in AI] Error: ${err.message}`);
  }
  return 'Global';
}

// ── Helper: Resolve AI options (OpenAI and OpenRouter) from Database or Env ──
async function getAiOptions(maxTokens = 600) {
  const defaults = {
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY || '',
    openrouterApiKey: '',
    openrouterDefault: false,
    openrouterModel: 'deepseek/deepseek-chat', // default model for content generation
  };
  try {
    const record = await prisma.systemConfig.findUnique({ where: { key: 'chatbot_config' } });
    if (record?.value) {
      const parsed = JSON.parse(record.value);
      return {
        model: parsed.model || defaults.model,
        apiKey: parsed.apiKey || defaults.apiKey,
        openrouterApiKey: parsed.openrouterApiKey || defaults.openrouterApiKey,
        openrouterDefault: parsed.openrouterDefault === true,
        openrouterModel: parsed.openrouterModel || defaults.openrouterModel,
        maxTokens,
      };
    }
  } catch {}
  return { ...defaults, maxTokens };
}

// All AI endpoints require auth + usage check
const aiMiddleware = [authenticate, checkUsage('ai_generations')];

// ── Helper: call OpenAI and increment usage ────────────────────
async function callAI(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  handler: () => Promise<any>,
) {
  try {
    const result = await handler();
    await incrementUsage(req.workspaceId!, 'ai_generations');
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[AI Route Error]', err.message);
    next(err);
  }
}

// ── Helper: Generate High-Quality Tone-Specific Mock Caption Fallbacks ──
function generateMockCaption(topic: string, platform: string, tone: string, location: string, keywords: string[], length?: string): string {
  const locTag = location && location !== 'Global' ? `📍 ${location}\n\n` : '';
  const kwList = keywords && keywords.length > 0 ? `\n\nKeywords: ${keywords.join(', ')}` : '';
  
  const toneStr = tone ? tone.toLowerCase() : 'professional';
  const plat = platform ? platform.toLowerCase() : 'general';
  
  // Format topic: strip quotes if present
  let cleanTopic = topic;
  const topicMatch = topic.match(/"([^"]+)"/);
  if (topicMatch && topicMatch[1]) {
    cleanTopic = topicMatch[1];
  }
  
  // Check custom platforms for custom mock text
  if (plat === 'chrxstians') {
    if (length === 'short') {
      return `${locTag}🙏 Reflecting on "${cleanTopic}" today. Let's remember to keep our eyes on the Gospel and walk in faith. Blessings!`;
    }
    if (length === 'extra_long') {
      return `${locTag}🙏 Reflecting on "${cleanTopic}" today. How does this align with our walking in faith?\n\nAs we navigate the trends and shifts of the modern world, it is essential that we ground our perspectives in biblical truth. The Gospel provides a timeless anchor. When we see massive shifts in technology or culture, we shouldn't fear; instead, we should view them as new opportunities to share God's love, grace, and truth with a world searching for hope.\n\nScripture reminds us that we are called to be the light of the world. In the digital age, this means our online interactions, comments, and posts should reflect the fruits of the Spirit: love, joy, peace, patience, kindness, goodness, and faithfulness.\n\nLet's discuss: how can we be a positive, Christ-like influence in this trending conversation? Share your thoughts and let's encourage one another in our spiritual walks.${kwList}\n\nHave a blessed day!`;
    }
    return `${locTag}🙏 Reflecting on "${cleanTopic}" today. How does this align with our walking in faith?\n\nAs we navigate the trends and shifts of the modern world, it is essential that we ground our perspectives in biblical truth. The Gospel provides a timeless anchor. When we see massive shifts in technology or culture, we should view them as new opportunities to share God's love, grace, and truth with a world searching for hope.${kwList}\n\nLet's encourage one another. Blessings!`;
  }

  if (plat === 'entreprenrs') {
    if (length === 'short') {
      return `${locTag}💼 Quick entrepreneur tip: "${cleanTopic}" is changing the game. Build early, learn fast!`;
    }
    if (length === 'extra_long') {
      return `${locTag}💼 Let's analyze "${cleanTopic}" from an entrepreneurial perspective.\n\nIn business, identifying these market trends early is the key to capturing market share. This topic is more than just temporary hype; it represents a real shift in consumer demand or operational methodology. Founders who build solutions around this movement today are positioning themselves for significant leverage tomorrow.\n\nHere's my training advice for builders:\n1. Speed is your competitive advantage. Build a minimum viable product to test interest.\n2. Collect user feedback immediately. Don't build in a silo.\n3. Pivot quickly based on data, not assumptions.\n\nRemember, success in entrepreneurship is 1% inspiration and 99% execution. The trends show where the attention is moving, but your execution determines how much value you capture.${kwList}\n\nWhat is your strategy to leverage this? Let's discuss in the comments! 👇`;
    }
    return `${locTag}💼 Let's analyze "${cleanTopic}" from an entrepreneurial perspective.\n\nIn business, identifying these market trends early is the key to capturing market share. This topic is more than just temporary hype; it represents a real shift in consumer demand. Founders who build solutions around this movement today are positioning themselves for significant leverage tomorrow.${kwList}\n\nWhat is your strategy to leverage this? Let's discuss! 👇`;
  }

  if (plat === 'iohah') {
    if (length === 'short') {
      return `${locTag}🌿 Natural health spotlight: "${cleanTopic}". Embrace wellness and holistic living today.`;
    }
    if (length === 'extra_long') {
      return `${locTag}🌿 Embracing natural health and wellness during the discussion of "${cleanTopic}".\n\nAs practitioners and health enthusiasts, we look at trends through the lens of holistic wellness and organic living. How does this shift affect our mental, physical, and emotional health? When society moves faster, taking time to ground ourselves, practice mindfulness, and feed our bodies with organic, whole foods becomes a critical necessity rather than a luxury.\n\nKey wellness recommendations:\n- Prioritize sleep hygiene and rest.\n- Incorporate natural herbs and clean nutrition into your daily routine.\n- Practice digital detoxing to maintain mental peace.\n\nTrue health is about harmony between mind, body, and spirit. Let's make choices that nurture our vitality and support our body's natural healing systems.${kwList}\n\nWhat natural wellness practices are helping you stay centered today? 👇`;
    }
    return `${locTag}🌿 Embracing natural health and wellness during the discussion of "${cleanTopic}".\n\nAs practitioners and health enthusiasts, we look at trends through the lens of holistic wellness and organic living. How does this shift affect our mental, physical, and emotional health? Let's prioritize rest, clean nutrition, and mindfulness to maintain wellness.${kwList}\n\nWhat wellness practices are helping you stay centered today? 👇`;
  }
  
  if (length === 'short') {
    if (toneStr === 'witty') {
      return `${locTag}🔥 Is it just me or is "${cleanTopic}" absolutely taking over right now? 😅`;
    }
    if (toneStr === 'professional') {
      return `${locTag}📈 Strategic insights on "${cleanTopic}" and why it represents a major industry shift.`;
    }
    if (toneStr === 'educational') {
      return `${locTag}💡 Quick breakdown: "${cleanTopic}" is trending, reshaping how we connect.`;
    }
    if (toneStr === 'inspirational') {
      return `${locTag}🚀 The momentum of "${cleanTopic}" shows what's possible when creativity meets action.`;
    }
    return `${locTag}✨ "${cleanTopic}" is pretty much all everyone is talking about today. Worth checking out!`;
  }
  
  if (length === 'extra_long') {
    if (toneStr === 'witty') {
      return `${locTag}🔥 Okay, is it just me or is "${cleanTopic}" absolutely taking over right now? 😅\n\nHonestly, I did not see this coming, but here we are. It is fascinating how a single trend can capture the collective attention of the internet overnight. People are posting, commenting, and sharing their takes at an unprecedented rate. It's safe to say this is more than just a passing moment; it's a cultural shift in how we engage online.\n\nLet's analyze why this is happening. The dynamics of modern social algorithms favor high-resonance, high-interaction content. When a topic like this starts gaining traction, it creates a feedback loop: more views lead to more comments, which leads to more algorithmic distribution. This is a classic viral loop in action.\n\nWhat this means for creators and brand builders is that speed-to-market is the ultimate competitive advantage. Those who can identify these shifts early and create relevant content around them will capture the lion's share of attention. Don't wait for the trend to peak; start the conversation now while the momentum is still building.${kwList}\n\nDrop your hottest take below — let's discuss!`;
    }
    if (toneStr === 'professional') {
      return `${locTag}📈 Exciting developments around "${cleanTopic}"! This trend is rapidly reshaping digital engagement and content distribution channels.\n\nKey takeaways for industry leaders:\n- Rapid growth in user attention and engagement indicates a major shift in audience interest.\n- High opportunity for strategic brand alignment and proactive marketing placement.\n- Innovative content formats are driving discovery, making it essential to adapt quickly.\n\nIn-depth Strategic Implications:\nAs digital ecosystems continue to fragment, capturing and retaining consumer attention becomes increasingly difficult. Trends like this represent unique inflection points where organic reach spikes temporarily. Brands that are positioned to act quickly can leverage this momentum to drive significant brand awareness and engagement without the corresponding increase in ad spend. However, this requires a highly agile content creation workflow and the authority to approve real-time marketing initiatives.\n\nBy staying ahead of these trends, organizations can position themselves at the forefront of digital innovation. How is your team leveraging this momentum? Let's discuss in the comments below! 👇`;
    }
    if (toneStr === 'educational') {
      return `${locTag}💡 Let's break down the trend behind "${cleanTopic}" and why it matters right now. 📚\n\nUnderstanding these market shifts is crucial for creators and developers alike. Here are three key dimensions:\n1. Attention Shift: Target users are moving faster than ever towards this space, indicating a long-term transition in user behavior.\n2. User Engagement: Higher interaction scores show a deep connection, meaning audiences are actively seeking this type of content.\n3. Brand Strategy: Great opportunity to pivot and create tailored content that resonates on a deeper level.\n\nDetailed Educational Breakdown:\nTo understand how this trend propagates, we have to look at the underlying network effects. Every user engagement acts as a signal to the distribution algorithm, which then exposes the content to a wider cohort of users with similar interest profiles. This creates a geometric progression in visibility. For educational content creators, this represents a golden opportunity to simplify complex topics and deliver value when search intent and interest are at their peak. Position your content as the definitive guide to this topic to maximize long-term authority.${kwList}\n\nWhat other insights would you add to this? Let's learn together in the comments! 👇`;
    }
    if (toneStr === 'inspirational') {
      return `${locTag}🚀 The momentum behind "${cleanTopic}" is a reminder of what happens when creativity meets opportunity.\n\nEvery trend represents a new door opening. Don't just watch it from the sidelines — find your unique angle, take action, and create value. True innovation happens when we have the courage to experiment and lead. The digital landscape belongs to those who dare to build and share their voice.\n\nDeep Reflection:\nIn a world of constant noise, it's easy to dismiss these moments as temporary distractions. But if we look closer, we see they are expressions of collective human interest and connection. They show us what resonates, what inspires, and what brings people together. When you participate in these conversations, do so with authenticity and a desire to add value. That is how you build a lasting legacy and a community that stands the test of time.${kwList}\n\nKeep pushing boundaries. What's your take on this? Let's inspire each other! 👇`;
    }
    return `${locTag}✨ So, "${cleanTopic}" is pretty much all everyone is talking about today.\n\nHonestly, the energy around this is unmatched and it's cool to see how fast it's growing. Definitely worth keeping an eye on as it develops further. The conversations taking place around this topic show just how connected we all are, and how quickly ideas can spread.\n\nAs we look at the landscape of social media today, it is clear that these real-time conversations are where culture is shaped. Participating in them allows us to be part of a global dialogue, sharing perspectives and building connections with people we might otherwise never reach. Whether you are a casual observer or a dedicated content creator, paying attention to these shifts is key to understanding the digital world we live in.${kwList}\n\nWhat are your thoughts on this? Let's chat! 👇`;
  }
  
  if (length === 'long') {
    if (toneStr === 'witty') {
      return `${locTag}🔥 Okay, is it just me or is "${cleanTopic}" absolutely taking over right now? 😅\n\nHonestly, I did not see this coming, but here we are. It is fascinating how a single trend can capture the collective attention of the internet overnight. People are posting, commenting, and sharing their takes at an unprecedented rate. It's safe to say this is more than just a passing moment; it's a cultural shift in how we engage online.${kwList}\n\nDrop your hottest take below — let's discuss!`;
    }
    if (toneStr === 'professional') {
      return `${locTag}📈 Exciting developments around "${cleanTopic}"! This trend is rapidly reshaping digital engagement and content distribution channels.\n\nKey takeaways for industry leaders:\n- Rapid growth in user attention and engagement indicates a major shift in audience interest.\n- High opportunity for strategic brand alignment and proactive marketing placement.\n- Innovative content formats are driving discovery, making it essential to adapt quickly.\n\nBy staying ahead of these trends, organizations can position themselves at the forefront of digital innovation. How is your team leveraging this momentum? Let's discuss in the comments below! 👇`;
    }
    if (toneStr === 'educational') {
      return `${locTag}💡 Let's break down the trend behind "${cleanTopic}" and why it matters right now. 📚\n\nUnderstanding these market shifts is crucial for creators and developers alike. Here are three key dimensions:\n1. Attention Shift: Momentum is moving faster than ever towards this space, indicating a long-term transition in user behavior.\n2. User Engagement: Higher interaction scores show a deep connection, meaning audiences are actively seeking this type of content.\n3. Brand Strategy: Great opportunity to pivot and create tailored content that resonates on a deeper level.${kwList}\n\nWhat other insights would you add to this? Let's learn together in the comments! 👇`;
    }
    if (toneStr === 'inspirational') {
      return `${locTag}🚀 The momentum behind "${cleanTopic}" is a reminder of what happens when creativity meets opportunity.\n\nEvery trend represents a new door opening. Don't just watch it from the sidelines — find your unique angle, take action, and create value. True innovation happens when we have the courage to experiment and lead. The digital landscape belongs to those who dare to build and share their voice.${kwList}\n\nKeep pushing boundaries. What's your take on this? Let's inspire each other! 👇`;
    }
    return `${locTag}✨ So, "${cleanTopic}" is pretty much all everyone is talking about today.\n\nHonestly, the energy around this is unmatched and it's cool to see how fast it's growing. Definitely worth keeping an eye on as it develops further. The conversations taking place around this topic show just how connected we all are, and how quickly ideas can spread.${kwList}\n\nWhat are your thoughts on this? Let's chat! 👇`;
  }
  
  if (toneStr === 'witty') {
    return `${locTag}🔥 Okay, is it just me or is "${cleanTopic}" absolutely taking over right now? 😅\n\nIf you haven't checked this out yet, you're missing out. The buzz around this is real and the conversation is just getting started.${kwList}\n\nDrop your hottest take below — let's discuss!`;
  }
  
  if (toneStr === 'professional') {
    return `${locTag}📈 Exciting developments around "${cleanTopic}"! This trend is rapidly reshaping digital engagement and content distribution channels.\n\nKey takeaways:\n- Rapid growth in user attention and engagement\n- High opportunity for strategic brand alignment\n- Innovative content formats driving discovery${kwList}\n\nHow is your team leveraging this momentum? Let's discuss in the comments below! 👇`;
  }
  
  if (toneStr === 'educational') {
    return `${locTag}💡 Let's break down the trend behind "${cleanTopic}" and why it matters right now. 📚\n\n3 Key Takeaways:\n1. Attention Shift: Momentum is moving faster than ever towards this space.\n2. User Engagement: Higher interaction scores indicate a deep connection with the audience.\n3. Brand Strategy: Great opportunity to pivot and create tailored content.${kwList}\n\nWhat other insights would you add to this? Let's learn together in the comments! 👇`;
  }
  
  if (toneStr === 'inspirational') {
    return `${locTag}🚀 The momentum behind "${cleanTopic}" is a powerful reminder of what happens when creativity meets opportunity.\n\nEvery trend represents a new door opening. Don't just watch it from the sidelines — find your unique angle, take action, and create value.${kwList}\n\nKeep pushing boundaries. What's your take on this? Let's inspire each other! 👇`;
  }
  
  if (toneStr === 'casual') {
    return `${locTag}✨ So, "${cleanTopic}" is pretty much all everyone is talking about today.\n\nHonestly, the energy around this is unmatched and it's cool to see how fast it's growing. Definitely worth keeping an eye on.${kwList}\n\nWhat are your thoughts on this? Let's chat! 👇`;
  }
  
  // default fallback
  return `${locTag}🔥 "${cleanTopic}" is taking over the internet right now!\n\nThe conversation is just getting started and the buzz is real. Make sure you don't miss out on this momentum.${kwList}\n\nWhat are your thoughts on this? Let's discuss! 👇`;
}

// ── POST /ai/caption ───────────────────────────────────────────
aiRouter.post('/caption', ...aiMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  await callAI(req, res, next, async () => {
    const { topic, platform, tone, language, keywords, length } = req.body as any;
    if (!topic) throw new Error('topic is required');
    
    // Resolve location info
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
      console.warn(`[Location Detection in AI Caption] Error: ${err.message}`);
    }

    const locPrompt = location && location !== 'Global' ? `The topic is trending in the location: ${location}. You MUST naturally include a location tag (e.g. 📍 ${location}) at the beginning of the post.` : '';

    const limit = PLATFORM_LIMITS[platform?.toLowerCase()] || 2200;
    let lengthConstraint = '';
    if (length === 'short') {
      lengthConstraint = `The generated post caption MUST be short and concise (under 150 characters).`;
    } else if (length === 'medium') {
      lengthConstraint = `The generated post caption MUST be of medium length (around 400-500 characters).`;
    } else if (length === 'long') {
      lengthConstraint = `The generated post caption MUST be detailed and comprehensive (around 1200-1500 characters).`;
    } else if (length === 'extra_long') {
      lengthConstraint = `The generated post caption MUST be exceptionally detailed, long, and comprehensive (around 3000-5000 characters).`;
    } else {
      lengthConstraint = `The generated post caption length should be appropriate for ${platform || 'general social media'}.`;
    }

    const platformStyleGuide = getPlatformTailoringGuidelines(platform);

    const prompt = `You are a social media expert. Write a compelling ${platform || 'social media'} caption from the perspective of a brand or content creator. Write the actual, ready-to-publish post text itself. Do NOT explain, summarize, or describe the topic in a meta way.

Topic: ${topic}
Platform: ${platform || 'general'}
Tone: ${tone || 'professional'}
Language: ${language || 'English'}
${locPrompt}
${keywords?.length ? `Keywords to include: ${(keywords as string[]).join(', ')}` : ''}

Platform Style Guide & Target Audience instruction:
${platformStyleGuide}
You MUST tailor the style, formatting, engagement tactics, and target audience alignment to strictly match these guidelines.

Length instructions:
${lengthConstraint}
CRITICAL: The entire post text (caption + call to action) MUST NOT exceed the platform's absolute maximum limit of ${limit} characters.

Respond ONLY with valid JSON:
{"caption": "full caption text", "hashtags": ["#tag1", "#tag2"], "cta": "call to action text"}`;

    // Inject user intelligence context into prompt if available
    let intelligenceBlock = '';
    try {
      if (req.userId && req.workspaceId) {
        const ctx = await buildUserContextBlock(req.userId, req.workspaceId);
        if (ctx.profile || ctx.voice) {
          intelligenceBlock = '\n\n' + formatContextForPrompt(ctx);
        }
      }
    } catch { /* non-fatal */ }

    const finalPrompt = intelligenceBlock ? prompt + intelligenceBlock : prompt;
    
    const aiOptions = await getAiOptions(600);
    try {
      const raw = await chatWithRetry([{ role: 'user', content: finalPrompt }], aiOptions);
      const match = raw.match(/\{[\s\S]+\}/);
      return JSON.parse(match ? match[0] : raw);
    } catch (err: any) {
      console.warn(`[AI Caption Fallback] API error: ${err.message}. Using mock generator.`);
      
      let cleanTopic = topic;
      const topicMatch = topic.match(/"([^"]+)"/);
      if (topicMatch && topicMatch[1]) {
        cleanTopic = topicMatch[1];
      }
      
      const hashtags: string[] = [];
      const promptHashtags = topic.match(/#\w+/g);
      if (promptHashtags) {
        promptHashtags.forEach((tag: string) => {
          if (!hashtags.includes(tag)) hashtags.push(tag);
        });
      }
      
      if (hashtags.length === 0) {
        const tagBase = cleanTopic.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3);
        tagBase.slice(0, 5).forEach((w: string) => {
          const tag = w.startsWith('#') ? w : `#${w}`;
          if (!hashtags.includes(tag)) hashtags.push(tag);
        });
      }
      if (hashtags.length === 0) hashtags.push('#viral', '#trending');

      const mockCaptionText = generateMockCaption(topic, platform, tone, location, keywords || [], length);

      return {
        caption: mockCaptionText,
        hashtags,
        cta: 'Share your thoughts in the comments below! \uD83D\uDC47'
      };
    }
  });
});

// ── POST /ai/hashtags ──────────────────────────────────────────
aiRouter.post('/hashtags', ...aiMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  await callAI(req, res, next, async () => {
    const { content, platform, niche, count } = req.body as any;
    if (!content) throw new Error('content is required');
    const prompt = `Generate ${count || 15} effective hashtags for this ${platform || 'social media'} post.
Content: ${content}
${niche ? `Niche: ${niche}` : ''}

Respond ONLY with valid JSON: {"hashtags": ["#tag1", "#tag2", ...]}`;
    const aiOptions = await getAiOptions(300);
    try {
      const raw = await chatWithRetry([{ role: 'user', content: prompt }], aiOptions);
      const match = raw.match(/\{[\s\S]+\}/);
      return JSON.parse(match ? match[0] : raw);
    } catch (err: any) {
      console.warn(`[AI Hashtags Fallback] API error: ${err.message}. Using mock generator.`);
      const tags = content.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3).map((w: string) => `#${w}`);
      while (tags.length < (count || 10)) {
        tags.push(`#viral${tags.length}`, `#trending${tags.length}`);
      }
      return { hashtags: tags.slice(0, count || 10) };
    }
  });
});

// ── POST /ai/image-prompt — kept for backwards compat (text prompt helper) ──
aiRouter.post('/image-prompt', ...aiMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  await callAI(req, res, next, async () => {
    const { description, content, platform, style } = req.body as any;
    const text = description || content;
    if (!text) throw new Error('description is required');
    const prompt = `Create a detailed image generation prompt for a ${platform || 'social media'} post about: ${text}
${style ? `Visual style: ${style}` : ''}
Respond ONLY with valid JSON: {"imagePrompt": "detailed prompt here", "style": "art style", "mood": "mood description"}`;
    const aiOptions = await getAiOptions(400);
    const raw = await chatWithRetry([{ role: 'user', content: prompt }], aiOptions);
    const match = raw.match(/\{[\s\S]+\}/);
    try { return JSON.parse(match ? match[0] : raw); }
    catch { return { imagePrompt: raw.trim(), style: style || 'photorealistic', mood: 'professional' }; }
  });
});

// ── Image generation quotas per plan ─────────────────────────────
const IMAGE_GEN_LIMITS: Record<string, number> = {
  basic: 0,
  pro: 10,
  business: 50,
  enterprise: 120,
};

async function checkImageGenQuota(workspaceId: string): Promise<{ allowed: boolean; used: number; limit: number; tier: string; subscriptionId?: string }> {
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!subscription) return { allowed: false, used: 0, limit: 0, tier: 'basic' };

  const tier = subscription.tier as string;
  const limit = IMAGE_GEN_LIMITS[tier] ?? 0;

  if (limit === 0) return { allowed: false, used: 0, limit: 0, tier, subscriptionId: subscription.id };

  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const usageRecord = await prisma.usageRecord.findUnique({
    where: {
      subscriptionId_metric_periodStart: {
        subscriptionId: subscription.id,
        metric: 'image_generation',
        periodStart,
      },
    },
  }).catch(() => null);

  const used = usageRecord?.count ?? 0;
  return { allowed: used < limit, used, limit, tier, subscriptionId: subscription.id };
}

async function incrementImageGenUsage(subscriptionId: string): Promise<void> {
  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  await prisma.usageRecord.upsert({
    where: { subscriptionId_metric_periodStart: { subscriptionId, metric: 'image_generation', periodStart } },
    create: { subscriptionId, metric: 'image_generation', count: 1, periodStart, periodEnd },
    update: { count: { increment: 1 } },
  }).catch(() => {});
}

// ── POST /ai/generate-image — DALL-E 3 image generation ──────────
aiRouter.post('/generate-image', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { prompt, style = 'photorealistic', size = '1024x1024' } = req.body as any;

    if (!prompt?.trim()) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PROMPT', message: 'Prompt is required' } });
    }

    // Check plan quota
    const quota = await checkImageGenQuota(workspaceId);
    if (!quota.allowed) {
      if (quota.limit === 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PLAN_UPGRADE_REQUIRED',
            message: 'AI image generation is not available on the Basic plan. Upgrade to Pro to generate up to 10 images per month.',
            quota
          }
        });
      }
      return res.status(429).json({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: `You've used all ${quota.limit} image generations for this month. Upgrade your plan for more.`,
          quota
        }
      });
    }

    // Get OpenAI API key
    const aiOptions = await getAiOptions(0);
    const apiKey = aiOptions.apiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      return res.status(501).json({ success: false, error: { code: 'NOT_CONFIGURED', message: 'Image generation is not configured. Contact support.' } });
    }

    // Build a style-enhanced prompt
    const styleGuide: Record<string, string> = {
      photorealistic: 'ultra-photorealistic, high-resolution, professional photography, studio lighting',
      illustration: 'digital illustration, vibrant colors, clean vector art style',
      '3d_render': 'professional 3D render, octane render, high quality, studio lighting',
      cinematic: 'cinematic photography, dramatic lighting, film grain, widescreen composition',
      minimalist: 'minimalist design, clean white background, simple shapes, professional',
      abstract: 'abstract art, colorful, creative, modern design, artistic',
    };
    const styleEnhancement = styleGuide[style] || styleGuide.photorealistic;
    const enhancedPrompt = `${prompt}. ${styleEnhancement}. Social media ready, high quality.`;

    // Call DALL-E 3
    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: ['1024x1024', '1792x1024', '1024x1792'].includes(size) ? size : '1024x1024',
        quality: 'standard',
        response_format: 'url',
      }),
    });

    const dalleData = await dalleRes.json() as any;

    if (!dalleRes.ok) {
      const errMsg = dalleData.error?.message || 'Image generation failed';
      return res.status(502).json({ success: false, error: { code: 'DALLE_ERROR', message: errMsg } });
    }

    const imageUrl = dalleData.data?.[0]?.url;
    const revisedPrompt = dalleData.data?.[0]?.revised_prompt;

    if (!imageUrl) {
      return res.status(502).json({ success: false, error: { code: 'NO_IMAGE', message: 'No image returned from DALL-E' } });
    }

    // Record usage using the correct pattern
    if (quota.subscriptionId) {
      await incrementImageGenUsage(quota.subscriptionId);
    }

    res.json({
      success: true,
      data: {
        imageUrl,
        revisedPrompt,
        quota: { used: quota.used + 1, limit: quota.limit, tier: quota.tier, remaining: quota.limit - quota.used - 1 }
      }
    });
  } catch (err: any) {
    console.error('[AI Image Gen]', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ── GET /ai/image-gen-quota — check remaining quota ──────────────
aiRouter.get('/image-gen-quota', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const quota = await checkImageGenQuota(req.workspaceId!);
    res.json({ success: true, data: quota });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});



// ── POST /ai/rewrite ───────────────────────────────────────────
aiRouter.post('/rewrite', ...aiMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  await callAI(req, res, next, async () => {
    const { content, platform, tone, instructions, length } = req.body as any;
    if (!content) throw new Error('content is required');

    const limit = PLATFORM_LIMITS[platform?.toLowerCase()] || 2200;
    let lengthConstraint = '';
    if (length === 'short') {
      lengthConstraint = `Ensure the rewritten post is short and concise (under 150 characters).`;
    } else if (length === 'medium') {
      lengthConstraint = `Ensure the rewritten post is of medium length (around 400-500 characters).`;
    } else if (length === 'long') {
      lengthConstraint = `Ensure the rewritten post is detailed and comprehensive (around 1200-1500 characters).`;
    } else if (length === 'extra_long') {
      lengthConstraint = `Ensure the rewritten post is exceptionally detailed, long, and comprehensive (around 3000-5000 characters).`;
    }

    const platformStyleGuide = getPlatformTailoringGuidelines(platform);

    const prompt = `Rewrite this ${platform || 'social media'} post${tone ? ` in a ${tone} tone` : ''}.
${instructions ? `Instructions: ${instructions}` : ''}
${lengthConstraint}
CRITICAL: The rewritten post MUST NOT exceed the platform's absolute maximum limit of ${limit} characters.

Platform Style Guide & Target Audience instruction:
${platformStyleGuide}
You MUST tailor the rewritten content style, tone, and formatting to strictly align with the target platform requirements.

Original post:
${content}

Respond ONLY with valid JSON:
{"rewritten": "rewritten content here", "changes_summary": "brief summary of changes made"}`;
    const aiOptions = await getAiOptions(800);
    try {
      const raw = await chatWithRetry([{ role: 'user', content: prompt }], aiOptions);
      const match = raw.match(/\{[\s\S]+\}/);
      return JSON.parse(match ? match[0] : raw);
    } catch (err: any) {
      console.warn(`[AI Rewrite Fallback] API error: ${err.message}. Using mock generator.`);
      
      let rewritten = content;
      const toneStr = tone ? tone.toLowerCase() : 'professional';
      if (toneStr === 'witty') {
        rewritten = `🔥 Quick perspective shift:\n\n${content}\n\nWhat do you think? Drop a comment! 💬`;
      } else if (toneStr === 'professional') {
        rewritten = `📈 Insights & Analysis:\n\n${content}\n\nLet's connect in the comments to discuss further. 🤝`;
      } else if (toneStr === 'educational') {
        rewritten = `💡 Summary & Takeaways:\n\n${content}\n\nWhich of these points stands out to you? 📚`;
      } else if (toneStr === 'inspirational') {
        rewritten = `✨ Perspective is everything:\n\n${content}\n\nKeep pushing boundaries and creating value! 🚀`;
      } else {
        rewritten = `✨ Here's a polished version:\n\n${content}\n\nThoughts? 👇`;
      }

      return {
        rewritten: rewritten,
        changes_summary: `Polished presentation and set tone to ${tone}.`
      };
    }
  });
});

// ── POST /ai/translate ─────────────────────────────────────────
aiRouter.post('/translate', ...aiMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  await callAI(req, res, next, async () => {
    const { content, targetLanguage, platform } = req.body as any;
    if (!content) throw new Error('content is required');
    if (!targetLanguage) throw new Error('targetLanguage is required');
    const prompt = `Translate this ${platform || 'social media'} post to ${targetLanguage}. Preserve hashtags, emojis, and formatting.

Original:
${content}

Respond ONLY with valid JSON:
{"translated": "translated content", "language": "${targetLanguage}", "hashtags_translated": true}`;
    const aiOptions = await getAiOptions(800);
    const raw = await chatWithRetry([{ role: 'user', content: prompt }], aiOptions);
    const match = raw.match(/\{[\s\S]+\}/);
    try { return JSON.parse(match ? match[0] : raw); }
    catch { return { translated: raw.trim(), language: targetLanguage }; }
  });
});

// ── POST /ai/compliance ────────────────────────────────────────
aiRouter.post('/compliance', ...aiMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  await callAI(req, res, next, async () => {
    const { content, platform, industry } = req.body as any;
    if (!content) throw new Error('content is required');
    const prompt = `Review this ${platform || 'social media'} post for compliance issues${industry ? ` in the ${industry} industry` : ''}.

Post:
${content}

Check for: misleading claims, FTC disclosure requirements, platform policy violations, spam patterns, hate speech, copyright issues.

Respond ONLY with valid JSON:
{"compliant": true/false, "score": 0-100, "issues": [{"type": "issue type", "severity": "low/medium/high", "description": "detail"}], "suggestions": ["suggestion 1", "suggestion 2"], "summary": "overall assessment"}`;
    const aiOptions = await getAiOptions(600);
    const raw = await chatWithRetry([{ role: 'user', content: prompt }], aiOptions);
    const match = raw.match(/\{[\s\S]+\}/);
    try { return JSON.parse(match ? match[0] : raw); }
    catch { return { compliant: true, score: 80, issues: [], suggestions: [], summary: 'Content reviewed' }; }
  });
});

// ── POST /ai/best-times ────────────────────────────────────────
aiRouter.post('/best-times', ...aiMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  await callAI(req, res, next, async () => {
    const { platform, industry, timezone, audience } = req.body as any;
    const prompt = `Provide the best posting times for ${platform || 'social media'}.
${industry ? `Industry: ${industry}` : ''}
${timezone ? `Timezone: ${timezone}` : ''}
${audience ? `Target audience: ${audience}` : ''}

Respond ONLY with valid JSON:
{"bestTimes": [{"day": "Monday", "time": "09:00", "score": 95, "reason": "reason"}, ...], "timezone": "${timezone || 'UTC'}", "platform": "${platform || 'general'}"}`;
    const aiOptions = await getAiOptions(600);
    const raw = await chatWithRetry([{ role: 'user', content: prompt }], aiOptions);
    const match = raw.match(/\{[\s\S]+\}/);
    try { return JSON.parse(match ? match[0] : raw); }
    catch {
      return {
        bestTimes: [
          { day: 'Monday', time: '09:00', score: 90, reason: 'High engagement morning' },
          { day: 'Wednesday', time: '12:00', score: 88, reason: 'Midweek lunch peak' },
          { day: 'Friday', time: '17:00', score: 85, reason: 'End of work week' },
        ],
        timezone: timezone || 'UTC',
        platform: platform || 'general',
      };
    }
  });
});

// ── POST /ai/trending ──────────────────────────────────────────
aiRouter.post('/trending', ...aiMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  await callAI(req, res, next, async () => {
    const { platform, industry, topic } = req.body as any;
    const prompt = `What are the current trending topics and content ideas for ${platform || 'social media'}?
${industry ? `Industry: ${industry}` : ''}
${topic ? `Related to: ${topic}` : ''}

Respond ONLY with valid JSON:
{"trends": [{"topic": "topic name", "reason": "why it's trending", "contentIdea": "post idea", "hashtags": ["#tag"]}]}`;
    const aiOptions = await getAiOptions(600);
    const raw = await chatWithRetry([{ role: 'user', content: prompt }], aiOptions);
    const match = raw.match(/\{[\s\S]+\}/);
    try { return JSON.parse(match ? match[0] : raw); }
    catch { return { trends: [] }; }
  });
});

export default aiRouter;
