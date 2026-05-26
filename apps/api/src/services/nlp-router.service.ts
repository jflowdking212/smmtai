import { prisma } from '../config/database.js';
import { adminTools, userTools } from './chat-tools.service.js';

// Maximum number of training records to store. When exceeded, low-count records
// are pruned to prevent the DB value from growing unbounded.
const MAX_TRAINING_RECORDS = 500;

// Minimum Jaccard similarity to match against active learning DB
// For new/unproven phrases (count < 5), we demand higher confidence.
const BASE_THRESHOLD = 0.80;

interface TrainingRecord {
  phrase: string;
  intent: string;
  count: number;
  lastUsedAt?: string; // ISO string format
}

interface TelemetryData {
  totalRequests: number;
  localActiveLearningCount: number;
  localRegexPatternCount: number;
  openaiFallbackCount: number;
  executionFailureCount: number;
  totalLatencyMs: number;
}

// ─── Persistence (DB-backed, thread-safe) ────────────────────────────────────

async function loadTrainingData(): Promise<TrainingRecord[]> {
  try {
    const record = await prisma.systemConfig.findUnique({
      where: { key: 'nlp_training_data' }
    });
    if (record?.value) {
      const parsed = JSON.parse(record.value);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('[NLP Router] Failed to load training data:', err);
  }
  return [];
}

function calculateRecordScore(record: TrainingRecord): number {
  const lastUsed = new Date(record.lastUsedAt || new Date());
  const diffTime = Math.abs(Date.now() - lastUsed.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  // Generational decay score: 0.1 count penalty per day of inactivity
  const penalty = (diffDays - 1) * 0.1;
  return Math.max(0.1, record.count - penalty);
}

async function saveTrainingData(data: TrainingRecord[]) {
  try {
    // Prune: keep only the top MAX_TRAINING_RECORDS records sorted by decayed generational score.
    // This implements generational decay/LRU-like frequency scaling instead of a simple slice prune.
    const pruned = data.length > MAX_TRAINING_RECORDS
      ? [...data].sort((a, b) => calculateRecordScore(b) - calculateRecordScore(a)).slice(0, MAX_TRAINING_RECORDS)
      : data;

    await prisma.systemConfig.upsert({
      where: { key: 'nlp_training_data' },
      update: { value: JSON.stringify(pruned) },
      create: { key: 'nlp_training_data', value: JSON.stringify(pruned), encrypted: false }
    });
  } catch (err) {
    console.error('[NLP Router] Failed to save training data:', err);
  }
}

// ─── Telemetry Outcome Logging ───────────────────────────────────────────────

export async function logRoutingOutcome(
  outcome: 'local_active_learning' | 'local_regex_pattern' | 'openai_fallback' | 'execution_failure',
  latencyMs: number
) {
  try {
    const record = await prisma.systemConfig.findUnique({
      where: { key: 'chatbot_telemetry' }
    });
    let data: TelemetryData = {
      totalRequests: 0,
      localActiveLearningCount: 0,
      localRegexPatternCount: 0,
      openaiFallbackCount: 0,
      executionFailureCount: 0,
      totalLatencyMs: 0
    };
    if (record?.value) {
      try {
        data = JSON.parse(record.value);
      } catch {}
    }

    data.totalRequests = (data.totalRequests || 0) + 1;
    data.totalLatencyMs = (data.totalLatencyMs || 0) + latencyMs;

    if (outcome === 'local_active_learning') data.localActiveLearningCount = (data.localActiveLearningCount || 0) + 1;
    else if (outcome === 'local_regex_pattern') data.localRegexPatternCount = (data.localRegexPatternCount || 0) + 1;
    else if (outcome === 'openai_fallback') data.openaiFallbackCount = (data.openaiFallbackCount || 0) + 1;
    else if (outcome === 'execution_failure') data.executionFailureCount = (data.executionFailureCount || 0) + 1;

    await prisma.systemConfig.upsert({
      where: { key: 'chatbot_telemetry' },
      update: { value: JSON.stringify(data) },
      create: { key: 'chatbot_telemetry', value: JSON.stringify(data), encrypted: false }
    });
  } catch (err) {
    console.error('[NLP Router] Failed to log telemetry:', err);
  }
}

// ─── Similarity (Stop-Word Filtered Jaccard) ─────────────────────────────────

// Filler/stop words that add no intent signal — strip before comparing
const STOP_WORDS = new Set([
  'please', 'me', 'my', 'the', 'a', 'an', 'to', 'for', 'i', 'want', 'can',
  'you', 'help', 'do', 'would', 'like', 'how', 'any', 'show', 'get', 'view',
  'list', 'display', 'fetch', 'check', 'give', 'hey', 'hi', 'ok', 'okay',
  'just', 'some', 'all', 'is', 'are', 'there', 'what', 'tell', 'about', 'with'
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(token => token.length > 0 && !STOP_WORDS.has(token));
}

function calculateSimilarity(str1: string, str2: string): number {
  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  if (tokens1.length === 0 && tokens2.length === 0) return 1;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return intersection / union;
}

// Derive a similarity threshold from a phrase's historical success count.
// High-count phrases (well-proven) get a lower threshold — we trust them sooner.
// Low-count phrases (new/unproven) demand tighter similarity before we route.
function getThresholdForRecord(record: TrainingRecord): number {
  if (record.count >= 20) return 0.65;
  if (record.count >= 10) return 0.70;
  if (record.count >= 5)  return 0.75;
  return BASE_THRESHOLD;      // new phrase needs 80% similarity
}

// ─── Hardcoded Pattern Fallbacks ─────────────────────────────────────────────

interface Pattern {
  intent: string;
  regex: RegExp;
  // If this regex matches, the intent is BLOCKED (prevents false positives)
  negative?: RegExp;
}

// Ordered from specific → general to avoid broad patterns shadowing narrow ones.
const hardcodedPatterns: Pattern[] = [
  // Admin-only
  {
    intent: 'get_system_analytics',
    regex: /\b(system|platform)\s*(analytics|stats|status|overview)\b/i
  },
  {
    intent: 'get_active_users',
    regex: /\bactive\s*users\b/i
  },
  {
    intent: 'get_subscribed_users',
    regex: /\b(subscribed|subscriptions|paid)\s*(users|accounts|plans)\b/i
  },
  {
    intent: 'get_inactive_users',
    regex: /\binactive\s*users\b/i
  },
  // User-level
  {
    intent: 'get_dashboard_stats',
    regex: /\b(show|get|view|list|display|my|workspace)\s*(stats|statistics|analytics|performance|engagement|dashboard)\b/i,
    negative: /\b(how|where|what|why|who|when|can|could|should|are|explain|tell|do|sure)\b/i
  },
  {
    intent: 'get_calendar',
    regex: /\b(calendar|upcoming)\b/i,
    negative: /\b(create|write|make|new|add|compose|generate|draft\s+a|write\s+a|new\s+post|new\s+draft|how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i
  },
  {
    intent: 'get_user_posts',
    regex: /\b(posts|drafts|scheduled|published)\b/i,
    negative: /\b(create|write|make|new|add|compose|generate|draft\s+a|write\s+a|new\s+post|new\s+draft|how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i,
  },
  {
    intent: 'connect_social_platform',
    regex: /\b(connect|link|add|auth|setup|integrate)\s*(facebook|instagram|twitter|linkedin|youtube|pinterest|tiktok|telegram|bluesky|mastodon)\b/i,
  },
  {
    intent: 'publish_post',
    regex: /\b(publish|send|post\s+now|go\s+live)\b/i,
  },
  {
    intent: 'schedule_post',
    regex: /\bschedule\b/i,
    negative: /\b(how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i
  },
  {
    intent: 'create_designed_ad_draft',
    regex: /\b(design|create|generate|make)\s+.*(ad|banner|square|designed|story|luxurious|premium|landscape|classic|theme|palette|font)\b/i,
    negative: /\b(how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i
  },
];

// ─── Argument Extraction (Token-Free) ────────────────────────────────────────

function extractArgs(message: string, intent: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const msgLower = message.toLowerCase();

  if (intent === 'get_user_posts') {
    // Extract post status filter
    if      (msgLower.includes('draft'))    args.status = 'draft';
    else if (msgLower.includes('schedul'))  args.status = 'scheduled';
    else if (msgLower.includes('publish'))  args.status = 'published';
    else if (msgLower.includes('fail'))     args.status = 'failed';

    // Extract numeric limit (digits first, then written-out words)
    const digitMatch = msgLower.match(/\b(\d+)\b/);
    if (digitMatch) {
      const n = parseInt(digitMatch[1], 10);
      if (!isNaN(n) && n > 0 && n <= 20) args.limit = n;
    } else {
      const wordMap: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
        fifteen: 15, twenty: 20
      };
      for (const [word, val] of Object.entries(wordMap)) {
        if (new RegExp(`\\b${word}\\b`).test(msgLower)) {
          args.limit = val;
          break;
        }
      }
    }
  }

  if (intent === 'get_dashboard_stats' || intent === 'get_calendar') {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (msgLower.includes('today')) {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (msgLower.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (msgLower.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      startDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      endDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);
    } else if (msgLower.includes('last 7 days') || msgLower.includes('last 7d') || msgLower.includes('past 7 days') || msgLower.includes('past 7d') || msgLower.includes('7 days ago')) {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else if (msgLower.includes('last 30 days') || msgLower.includes('last 30d') || msgLower.includes('past 30 days') || msgLower.includes('past 30d') || msgLower.includes('30 days ago')) {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else if (msgLower.includes('this week')) {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      endDate = new Date();
    } else if (msgLower.includes('last week')) {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const day = lastWeek.getDay();
      const diff = lastWeek.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(lastWeek.getFullYear(), lastWeek.getMonth(), diff, 0, 0, 0, 0);
      endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
    } else if (msgLower.includes('this month')) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date();
    } else if (msgLower.includes('last month')) {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    if (startDate) args.startDate = startDate.toISOString();
    if (endDate) args.endDate = endDate.toISOString();
  }

  if (intent === 'connect_social_platform') {
    const platforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok', 'telegram', 'bluesky', 'mastodon'];
    for (const p of platforms) {
      if (msgLower.includes(p)) {
        args.platform = p;
        break;
      }
    }
  }

  if (intent === 'get_active_users') {
    if (msgLower.includes('online') || msgLower.includes('now') || msgLower.includes('current')) {
      args.onlineOnly = true;
    }
  }

  if (intent === 'publish_post') {
    const idMatch = msgLower.match(/\b(cmp[a-z0-9]{20,}|c[a-z0-9]{20,})\b/i);
    if (idMatch) {
      args.postId = idMatch[1];
    }
    const isConfirm = /\b(yes|confirm|approve|authorize|go\s+ahead|do\s+it)\b/i.test(msgLower);
    args.confirm = isConfirm;
  }

  if (intent === 'schedule_post') {
    const idMatch = msgLower.match(/\b(cmp[a-z0-9]{20,}|c[a-z0-9]{20,})\b/i);
    if (idMatch) {
      args.postId = idMatch[1];
    }
    const isConfirm = /\b(yes|confirm|approve|authorize|go\s+ahead|do\s+it)\b/i.test(msgLower);
    args.confirm = isConfirm;

    // Look for date/time (simple regex)
    const timeMatch = message.match(/\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\b/);
    if (timeMatch) {
      args.scheduledAt = timeMatch[1];
    } else {
      args.scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
  }

  if (intent === 'create_designed_ad_draft') {
    // 1. Extract brand name
    let brandName = '';
    const brandRegexes = [
      /called\s+['"“‘]([^'"”’]+)['"”’]/i,
      /named\s+['"“‘]([^'"”’]+)['"”’]/i,
      /for\s+['"“‘]([^'"”’]+)['"”’]/i,
      /brand(?:ed)?\s+['"“‘]([^'"”’]+)['"”’]/i,
      /company\s+['"“‘]([^'"”’]+)['"”’]/i,
      /agency\s+['"“‘]([^'"”’]+)['"”’]/i,
    ];
    for (const regex of brandRegexes) {
      const match = message.match(regex);
      if (match) {
        brandName = match[1];
        break;
      }
    }
    if (!brandName) {
      const brandFallbackRegexes = [
        /called\s+([A-Za-z0-9\.\-_]+(?:\s+[A-Za-z0-9\.\-_]+)?)/i,
        /named\s+([A-Za-z0-9\.\-_]+(?:\s+[A-Za-z0-9\.\-_]+)?)/i,
        /for\s+([A-Za-z0-9\.\-_]+(?:\s+[A-Za-z0-9\.\-_]+)?)/i,
      ];
      for (const regex of brandFallbackRegexes) {
        const match = message.match(regex);
        if (match) {
          brandName = match[1];
          break;
        }
      }
    }
    args.brandName = brandName || 'SMMTAI';

    // 2. Extract headline
    let headline = '';
    const headlineRegexes = [
      /headline\s+['"“‘]([^'"”’]+)['"”’]/i,
      /saying\s+['"“‘]([^'"”’]+)['"”’]/i,
      /says\s+['"“‘]([^'"”’]+)['"”’]/i,
      /with\s+['"“‘]([^'"”’]+)['"”’]/i,
      /title\s+['"“‘]([^'"”’]+)['"”’]/i,
    ];
    for (const regex of headlineRegexes) {
      const match = message.match(regex);
      if (match) {
        headline = match[1];
        break;
      }
    }

    // 3. Fallback to generic quoted strings if one is not matched
    const quotes = [];
    const quoteRegex = /['"“‘]([^'"”’]+)['"”’]/g;
    let quoteMatch;
    while ((quoteMatch = quoteRegex.exec(message)) !== null) {
      quotes.push(quoteMatch[1]);
    }
    if (quotes.length >= 1 && !headline) {
      if (quotes[0] !== brandName) {
        headline = quotes[0];
      } else if (quotes.length >= 2) {
        headline = quotes[1];
      }
    }
    args.headline = headline || 'Unlock Your Potential';

    // 4. Extract body description or set industry-specific beautiful body copy!
    let body = '';
    const bodyRegexes = [
      /body\s+['"“‘]([^'"”’]+)['"”’]/i,
      /description\s+['"“‘]([^'"”’]+)['"”’]/i,
      /subheadline\s+['"“‘]([^'"”’]+)['"”’]/i,
    ];
    for (const regex of bodyRegexes) {
      const match = message.match(regex);
      if (match) {
        body = match[1];
        break;
      }
    }
    if (!body) {
      if (msgLower.includes('fitness') || msgLower.includes('health') || msgLower.includes('gym')) {
        body = 'Achieve your health goals and transform your life today.';
      } else if (msgLower.includes('realestate') || msgLower.includes('estate') || msgLower.includes('home') || msgLower.includes('house')) {
        body = 'Discover luxury living and premium spaces designed for you.';
      } else if (msgLower.includes('saas') || msgLower.includes('automate') || msgLower.includes('software') || msgLower.includes('smmt')) {
        body = 'Automate your social media workflow with AI-driven content generation.';
      } else {
        body = 'Start growing your brand today with SmmtAI.';
      }
    }
    args.body = body;

    // 5. Extract CTA text
    let ctaText = 'LEARN MORE';
    const ctaWords = ['learn more', 'shop now', 'sign up', 'get started', 'book now', 'apply now', 'register', 'contact us', 'order now'];
    for (const word of ctaWords) {
      if (msgLower.includes(word)) {
        ctaText = word.toUpperCase();
        break;
      }
    }
    args.ctaText = ctaText;

    // 6. Extract size preset
    let size = 'landscape';
    if (msgLower.includes('square')) size = 'square';
    else if (msgLower.includes('story') || msgLower.includes('portrait')) size = 'story';
    else if (msgLower.includes('banner')) size = 'banner';
    args.size = size;

    // 7. Extract layout preset
    let layout = 'classic';
    const layouts = ['classic', 'centered', 'split', 'card', 'hero', 'minimal'];
    for (const l of layouts) {
      if (msgLower.includes(l)) {
        layout = l;
        break;
      }
    }
    args.layout = layout;

    // 8. Extract palette preset
    let palette = 'saas';
    const palettes = ['saas', 'lux_dark', 'lux_light', 'realestate', 'beauty', 'fitness', 'organic', 'medical', 'agency', 'retro', 'cyberpunk', 'nordic', 'minimalist', 'autumn', 'royal'];
    for (const p of palettes) {
      if (msgLower.includes(p.toLowerCase()) || msgLower.includes(p.replace('_', ' '))) {
        palette = p;
        break;
      }
    }
    if (msgLower.includes('dark blue and gold') || msgLower.includes('blue and gold') || msgLower.includes('gold')) {
      palette = msgLower.includes('blue') ? 'royal' : 'lux_dark';
    } else if (msgLower.includes('fitness') || msgLower.includes('health')) {
      palette = 'fitness';
    } else if (msgLower.includes('real estate') || msgLower.includes('realestate')) {
      palette = 'realestate';
    }
    args.palette = palette;

    // 9. Extract font pairing
    let fontPairing = 'outfit_inter';
    const fonts = ['outfit_inter', 'playfair_lora', 'oswald_montserrat', 'syne_inter', 'space_jakarta', 'merriweather_opensans', 'anton_roboto', 'lato_lato', 'cabin_cabin', 'archivo_archivo'];
    for (const f of fonts) {
      if (msgLower.includes(f.toLowerCase()) || msgLower.includes(f.replace('_', ' '))) {
        fontPairing = f;
        break;
      }
    }
    args.fontPairing = fontPairing;

    // 10. Extract stock photo category
    let imageCategory = 'none';
    const categories = ['tech', 'marketing', 'realestate', 'beauty', 'fitness', 'food', 'coffee', 'fashion', 'travel', 'education', 'medical', 'none'];
    for (const c of categories) {
      if (msgLower.includes(c)) {
        imageCategory = c;
        break;
      }
    }
    if (imageCategory === 'none') {
      if (msgLower.includes('real estate') || msgLower.includes('home') || msgLower.includes('house')) {
        imageCategory = 'realestate';
      } else if (msgLower.includes('health') || msgLower.includes('workout') || msgLower.includes('gym')) {
        imageCategory = 'fitness';
      } else if (msgLower.includes('software') || msgLower.includes('saas') || msgLower.includes('app')) {
        imageCategory = 'tech';
      } else if (msgLower.includes('ads') || msgLower.includes('social') || msgLower.includes('brand')) {
        imageCategory = 'marketing';
      }
    }
    args.imageCategory = imageCategory;

    // 11. Extract target platforms
    const targetPlatforms = [];
    const platformsList = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok', 'telegram', 'bluesky', 'mastodon'];
    for (const p of platformsList) {
      if (msgLower.includes(p)) {
        targetPlatforms.push(p);
      }
    }
    args.platforms = targetPlatforms.length > 0 ? targetPlatforms : ['facebook'];
  }

  return args;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called after a successful OpenAI tool call. Persists the phrase → intent
 * mapping for future local routing. Only non-destructive intents are logged.
 *
 * NOTE: This must be called AFTER the tool has successfully executed, not before,
 * so that failed executions are not logged as training successes.
 */
export async function logSuccessfulRoute(phrase: string, intent: string) {
  const skipIntents = new Set(['create_post_draft', 'delete_post', 'ban_user']);
  if (skipIntents.has(intent)) return;

  try {
    const data = await loadTrainingData();
    const cleanPhrase = phrase.toLowerCase().trim();

    const existing = data.find(d => d.phrase === cleanPhrase && d.intent === intent);
    if (existing) {
      existing.count += 1;
      existing.lastUsedAt = new Date().toISOString();
    } else {
      data.push({ phrase: cleanPhrase, intent, count: 1, lastUsedAt: new Date().toISOString() });
    }

    await saveTrainingData(data);
    console.log(`[NLP Router] Logged: "${cleanPhrase}" -> "${intent}"`);
  } catch (err) {
    console.error('[NLP Router] Error logging route:', err);
  }
}

/**
 * Attempts to route the user message locally without calling OpenAI.
 * Returns a response string on success, or null to fall through to OpenAI.
 */
export async function tryRouteLocally(
  message: string,
  context: { userId: string; workspaceId: string; role: string }
): Promise<string | null> {

  const startTime = Date.now();
  const allTools = {
    ...userTools,
    ...(context.role === 'admin' || context.role === 'owner' ? adminTools : {})
  };

  const cleanMessage = message.trim();

  // Guard: if the message has fewer than 2 meaningful tokens after stop-word
  // stripping, it's too ambiguous to route locally (e.g., "hi", "ok thanks").
  const meaningfulTokens = tokenize(cleanMessage);
  if (meaningfulTokens.length < 2) {
    return null;
  }

  // ── Layer 1: Active Learning DB ─────────────────────────────────────────
  const trainingData = await loadTrainingData();
  let bestMatch: TrainingRecord | null = null;
  let highestScore = 0;

  for (const record of trainingData) {
    if (!allTools[record.intent]) continue; // role doesn't have access to this tool

    const threshold = getThresholdForRecord(record);
    const score = calculateSimilarity(cleanMessage, record.phrase);

    if (score >= threshold && score > highestScore) {
      highestScore = score;
      bestMatch = record;
    }
  }

  let finalIntent: string | null = null;
  let matchType: 'local_active_learning' | 'local_regex_pattern' | null = null;

  if (bestMatch) {
    finalIntent = bestMatch.intent;
    matchType = 'local_active_learning';
    console.log(`[NLP Router] Active-learning match: score=${highestScore.toFixed(2)}, threshold=${getThresholdForRecord(bestMatch).toFixed(2)} -> ${finalIntent}`);
  } else {
    // ── Layer 2: Hardcoded Pattern Matching ──────────────────────────────
    for (const p of hardcodedPatterns) {
      if (!allTools[p.intent]) continue; // role guard

      const positiveMatch = p.regex.test(cleanMessage);
      const negativeMatch = p.negative ? p.negative.test(cleanMessage) : false;

      if (positiveMatch && !negativeMatch) {
        finalIntent = p.intent;
        matchType = 'local_regex_pattern';
        console.log(`[NLP Router] Pattern match -> ${finalIntent}`);
        break;
      }
    }
  }

  // ── Execute Locally ──────────────────────────────────────────────────────
  if (finalIntent && matchType) {
    const handler = allTools[finalIntent].handler;
    const args = extractArgs(cleanMessage, finalIntent);
    console.log(`[NLP Router] Executing ${finalIntent} with args:`, JSON.stringify(args));
    try {
      const result = await handler(args, context);
      const latency = Date.now() - startTime;
      // Log telemetry asynchronously
      logRoutingOutcome(matchType, latency).catch(console.error);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err) {
      console.error('[NLP Router] Tool execution failed:', err);
      const latency = Date.now() - startTime;
      logRoutingOutcome('execution_failure', latency).catch(console.error);
      return null; // gracefully fall through to OpenAI
    }
  }

  return null; // no local match — fall through to OpenAI
}
