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
// Ordered from specific to general to avoid broad patterns shadowing narrow ones.
const hardcodedPatterns: Pattern[] = [
  // Admin-only
  { intent: 'get_system_analytics', regex: /\b(system|platform)\s*(analytics|stats|status|overview)\b/i },
  { intent: 'get_active_users', regex: /\bactive\s*users\b/i },
  { intent: 'get_subscribed_users', regex: /\b(subscribed|subscriptions|paid)\s*(users|accounts|plans)\b/i },
  { intent: 'get_inactive_users', regex: /\binactive\s*users\b/i },

  // User-level anchors
  { intent: 'get_dashboard_stats', regex: /\b(show|get|view|list|display|my|workspace)\s*(stats|statistics|analytics|performance|engagement|dashboard)\b/i, negative: /\b(how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i },
  { intent: 'get_calendar', regex: /\b(calendar|upcoming)\b/i, negative: /\b(create|write|make|new|add|compose|generate|draft\s+a|write\s+a|new\s+post|new\s+draft|how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i },
  { intent: 'get_user_posts', regex: /\b(posts|drafts|scheduled|published)\b/i, negative: /\b(create|write|make|new|add|compose|generate|draft\s+a|write\s+a|new\s+post|new\s+draft|how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i },
  { intent: 'connect_social_platform', regex: /\b(connect|link|add|auth|setup|integrate)\s*(facebook|instagram|twitter|linkedin|youtube|pinterest|tiktok|telegram|bluesky|mastodon)\b/i },
  { intent: 'publish_post', regex: /\b(publish|send|post\s+now|go\s+live)\b/i },
  { intent: 'schedule_post', regex: /\bschedule\b/i, negative: /\b(how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i },
  { intent: 'create_designed_ad_draft', regex: /\b(design|create|generate|make)\s+.*(ad|banner|square|designed|story|luxurious|premium|landscape|classic|theme|palette|font)\b/i, negative: /\b(how|where|what|why|who|when|can|could|should|are|explain|tell|do)\b/i },

  // DASHBOARD STATS
  { intent: 'get_dashboard_stats', regex: /^(stats|analytics|numbers|metrics|insights|overview|summary|performance|dashboard)$/i },
  { intent: 'get_dashboard_stats', regex: /whats?\s+(the\s+)?analytics/i },
  { intent: 'get_dashboard_stats', regex: /whats?\s+my\s+stats/i },
  { intent: 'get_dashboard_stats', regex: /show\s+me\s+(analytics|stats|metrics|numbers|overview|summary|performance|insights)/i },
  { intent: 'get_dashboard_stats', regex: /my\s+(analytics|stats|metrics|numbers|overview|summary|performance|insights)/i },
  { intent: 'get_dashboard_stats', regex: /how\s+(am\s+i|are\s+we|is\s+my\s+account|is\s+my\s+workspace)\s+(doing|performing)/i },
  { intent: 'get_dashboard_stats', regex: /how\s+is\s+(the\s+)?account\s+performing/i },
  { intent: 'get_dashboard_stats', regex: /give\s+me\s+(my\s+)?(stats|analytics|metrics|overview|numbers|summary)/i },
  { intent: 'get_dashboard_stats', regex: /workspace\s+(stats|analytics|metrics|overview|performance|numbers)/i },
  { intent: 'get_dashboard_stats', regex: /total\s+(posts|likes|impressions|comments|shares|clicks|engagements)/i },
  { intent: 'get_dashboard_stats', regex: /how\s+many\s+(posts|likes|impressions|comments|shares|clicks)\s+do\s+i\s+have/i },
  { intent: 'get_dashboard_stats', regex: /engagement\s+(stats|data|metrics|numbers|overview)/i },
  { intent: 'get_dashboard_stats', regex: /impressions\s+(stats|data|metrics|numbers|total)/i },
  { intent: 'get_dashboard_stats', regex: /post\s+(performance|stats|analytics|metrics|overview)/i },
  { intent: 'get_dashboard_stats', regex: /account\s+(stats|analytics|metrics|overview|performance|summary)/i },
  { intent: 'get_dashboard_stats', regex: /see\s+(my\s+)?(stats|analytics|metrics|overview|performance|numbers|dashboard)/i },
  { intent: 'get_dashboard_stats', regex: /pull\s+(up\s+)?(my\s+)?(stats|analytics|metrics|dashboard|overview)/i },
  { intent: 'get_dashboard_stats', regex: /open\s+(my\s+)?(dashboard|stats|analytics|overview)/i },
  { intent: 'get_dashboard_stats', regex: /quick\s+(stats|overview|summary|numbers|snapshot)/i },
  { intent: 'get_dashboard_stats', regex: /snapshot\s+of\s+(my\s+)?(account|workspace|performance)/i },
  { intent: 'get_dashboard_stats', regex: /(clicks|shares|comments|likes|impressions)\s+(count|total|number|data)/i },
  { intent: 'get_dashboard_stats', regex: /what\s+(has\s+been\s+)?my\s+(overall\s+)?(performance|reach|engagement)/i },
  { intent: 'get_dashboard_stats', regex: /overall\s+(performance|reach|engagement|stats|numbers)/i },
  { intent: 'get_dashboard_stats', regex: /check\s+(my\s+)?(stats|analytics|performance|numbers|metrics|overview)/i },
  { intent: 'get_dashboard_stats', regex: /(this\s+week|this\s+month|today|yesterday|last\s+week|last\s+month)\s+(stats|analytics|numbers|performance|overview)/i },
  { intent: 'get_dashboard_stats', regex: /report\s+(for\s+)?(my\s+)?(workspace|account|social\s+media)/i },
  { intent: 'get_dashboard_stats', regex: /social\s+media\s+(stats|analytics|metrics|performance|numbers)/i },
  { intent: 'get_dashboard_stats', regex: /content\s+(performance|stats|analytics|overview|summary)/i },
  { intent: 'get_dashboard_stats', regex: /how\s+is\s+(everything|it|the\s+account|my\s+page)\s+(going|doing|looking)/i },
  { intent: 'get_dashboard_stats', regex: /numbers?\s+(for\s+)?(this\s+week|this\s+month|today|the\s+account)/i },
  { intent: 'get_dashboard_stats', regex: /my\s+reach\s+(this\s+(week|month)|so\s+far|today)/i },
  { intent: 'get_dashboard_stats', regex: /reach\s+(data|stats|numbers|metrics|total)/i },
  { intent: 'get_dashboard_stats', regex: /how\s+is\s+my\s+(social\s+media\s+)?(performance|engagement|reach)/i },
  { intent: 'get_dashboard_stats', regex: /growth\s+(metrics|stats|numbers|report|overview)/i },

  // POSTS
  { intent: 'get_user_posts', regex: /post\s+history/i },
  { intent: 'get_user_posts', regex: /show\s+(my\s+)?posts/i },
  { intent: 'get_user_posts', regex: /list\s+(my\s+)?posts/i },
  { intent: 'get_user_posts', regex: /do\s+i\s+have\s+(any\s+)?(posts?|drafts?|content)/i },
  { intent: 'get_user_posts', regex: /my\s+recent\s+posts/i },
  { intent: 'get_user_posts', regex: /recent\s+(posts|content|updates)/i },
  { intent: 'get_user_posts', regex: /latest\s+(posts|content|updates|drafts)/i },
  { intent: 'get_user_posts', regex: /all\s+(my\s+)?(posts|drafts|content)/i },
  { intent: 'get_user_posts', regex: /see\s+(my\s+)?(posts|drafts|content)/i },
  { intent: 'get_user_posts', regex: /view\s+(my\s+)?(posts|drafts|content)/i },
  { intent: 'get_user_posts', regex: /fetch\s+(my\s+)?(posts|drafts|content)/i },
  { intent: 'get_user_posts', regex: /get\s+(my\s+)?(posts|drafts|content)/i },
  { intent: 'get_user_posts', regex: /what\s+(posts|drafts|content)\s+do\s+i\s+have/i },
  { intent: 'get_user_posts', regex: /any\s+(posts?|drafts?|content)\s+(saved|ready|pending|waiting)/i },
  { intent: 'get_user_posts', regex: /draft\s+posts?/i, negative: /\b(create|write|make|new|add|compose|generate)\b/i },
  { intent: 'get_user_posts', regex: /show\s+(my\s+)?drafts/i },
  { intent: 'get_user_posts', regex: /list\s+(my\s+)?drafts/i },
  { intent: 'get_user_posts', regex: /any\s+drafts?\s+saved/i },
  { intent: 'get_user_posts', regex: /drafts?\s+(i\s+have|available|saved|pending)/i },
  { intent: 'get_user_posts', regex: /show\s+(my\s+)?scheduled\s+posts?/i },
  { intent: 'get_user_posts', regex: /list\s+(my\s+)?scheduled\s+posts?/i },
  { intent: 'get_user_posts', regex: /what\s+(is|are)\s+(my\s+)?scheduled\s+posts?/i },
  { intent: 'get_user_posts', regex: /show\s+(my\s+)?published\s+posts?/i },
  { intent: 'get_user_posts', regex: /list\s+(my\s+)?published\s+posts?/i },
  { intent: 'get_user_posts', regex: /published\s+(posts?|content|updates)\s+(list|history|log)/i },
  { intent: 'get_user_posts', regex: /failed\s+posts?/i },
  { intent: 'get_user_posts', regex: /posts?\s+that\s+failed/i },
  { intent: 'get_user_posts', regex: /posts?\s+(with\s+)?errors?/i },
  { intent: 'get_user_posts', regex: /content\s+(queue|backlog|list|feed|log|history)/i },
  { intent: 'get_user_posts', regex: /(last|recent|latest)\s+\d+\s+posts/i },
  { intent: 'get_user_posts', regex: /show\s+(me\s+)?\d+\s+posts/i },
  { intent: 'get_user_posts', regex: /\d+\s+(recent|latest|last|scheduled|published|draft)\s+posts?/i },
  { intent: 'get_user_posts', regex: /anything\s+(in\s+)?(draft|queue|pending|scheduled)/i },
  { intent: 'get_user_posts', regex: /pending\s+(posts?|content)/i },
  { intent: 'get_user_posts', regex: /what\s+did\s+i\s+(post|publish|write)\s+(recently|today|this\s+week|last)/i },
  { intent: 'get_user_posts', regex: /my\s+(post|content|draft)\s+list/i },
  { intent: 'get_user_posts', regex: /any\s+(content|posts?)\s+(ready|in\s+progress|waiting)/i },

  // CALENDAR
  { intent: 'get_calendar', regex: /any\s+(scheduled\s+)?posts?\s+(coming|this\s+week|this\s+month|today|upcoming)/i },
  { intent: 'get_calendar', regex: /^(calendar|schedule|cal|upcoming\s+posts?)$/i },
  { intent: 'get_calendar', regex: /do\s+i\s+have\s+(any\s+)?(scheduled|upcoming|planned)\s+posts?/i },
  { intent: 'get_calendar', regex: /check\s+(the\s+)?calendar/i },
  { intent: 'get_calendar', regex: /whats?\s+(on\s+)?(my\s+)?(calendar|schedule)/i },
  { intent: 'get_calendar', regex: /content\s+calendar/i },
  { intent: 'get_calendar', regex: /posting\s+schedule/i },
  { intent: 'get_calendar', regex: /publication\s+schedule/i },
  { intent: 'get_calendar', regex: /upcoming\s+(posts?|content|publications)/i },
  { intent: 'get_calendar', regex: /planned\s+(posts?|content|publications)/i },
  { intent: 'get_calendar', regex: /queued\s+(posts?|content)/i },
  { intent: 'get_calendar', regex: /what\s+is\s+(coming\s+up|next)\s+(on\s+(my\s+)?(schedule|calendar))?/i },
  { intent: 'get_calendar', regex: /when\s+(is|are)\s+(my\s+)?(next\s+)?posts?\s+(going\s+)?live/i },
  { intent: 'get_calendar', regex: /next\s+(scheduled\s+)?post/i },
  { intent: 'get_calendar', regex: /posts?\s+scheduled\s+(for\s+)?(today|this\s+week|this\s+month)/i },
  { intent: 'get_calendar', regex: /schedule\s+(for\s+)?(today|this\s+week|this\s+month|tomorrow)/i },
  { intent: 'get_calendar', regex: /what\s+(am\s+i|are\s+we)\s+posting\s+(today|this\s+week|soon)/i },
  { intent: 'get_calendar', regex: /anything\s+(scheduled|planned|queued|coming\s+up)/i },
  { intent: 'get_calendar', regex: /show\s+(me\s+)?(my\s+)?(schedule|calendar|upcoming)/i },
  { intent: 'get_calendar', regex: /view\s+(my\s+)?(schedule|calendar|upcoming)/i },
  { intent: 'get_calendar', regex: /do\s+i\s+have\s+any\s+schedule/i },
  { intent: 'get_calendar', regex: /any\s+schedule/i },
  { intent: 'get_calendar', regex: /whats?\s+scheduled\s+(for\s+)?(next\s+(week|month)|tomorrow|today)/i },
  { intent: 'get_calendar', regex: /my\s+content\s+(plan|lineup|schedule|queue)/i },
  { intent: 'get_calendar', regex: /when\s+is\s+(my\s+)?next\s+(post|publication|content)/i },

  // CONNECTED PLATFORMS
  { intent: 'get_connected_platforms', regex: /show\s+(my\s+)?connections/i },
  { intent: 'get_connected_platforms', regex: /how\s+many\s+platform.*am\s+i/i },
  { intent: 'get_connected_platforms', regex: /how\s+many.*connected/i },
  { intent: 'get_connected_platforms', regex: /show\s+(my\s+)?(connected|linked|active)\s+(platforms?|accounts?|channels?|socials?)/i },
  { intent: 'get_connected_platforms', regex: /list\s+(my\s+)?(connected|linked)\s+(platforms?|accounts?|channels?)/i },
  { intent: 'get_connected_platforms', regex: /what\s+(platforms?|accounts?|channels?|socials?)\s+(am\s+i|are)\s+connected/i },
  { intent: 'get_connected_platforms', regex: /which\s+(platforms?|accounts?|channels?|socials?)\s+(am\s+i|are)\s+(connected|linked|active)/i },
  { intent: 'get_connected_platforms', regex: /my\s+(connected|linked|active)\s+(platforms?|accounts?|channels?|socials?)/i },
  { intent: 'get_connected_platforms', regex: /social\s+(accounts?|platforms?|media\s+accounts?)\s+(connected|linked|active)/i },
  { intent: 'get_connected_platforms', regex: /my\s+social\s+(media\s+)?(accounts?|platforms?|connections?)/i },
  { intent: 'get_connected_platforms', regex: /connections?\s+(page|list|overview|status)/i },
  { intent: 'get_connected_platforms', regex: /^(connections?|connected\s+accounts?|my\s+accounts?)$/i },
  { intent: 'get_connected_platforms', regex: /what\s+(social\s+)?(accounts?|platforms?)\s+do\s+i\s+have/i },
  { intent: 'get_connected_platforms', regex: /are\s+my\s+(accounts?|platforms?)\s+(connected|active|linked)/i },
  { intent: 'get_connected_platforms', regex: /view\s+(my\s+)?(connected\s+)?(platforms?|accounts?|channels?)/i },
  { intent: 'get_connected_platforms', regex: /see\s+(my\s+)?(connected\s+)?(platforms?|accounts?|channels?)/i },
  { intent: 'get_connected_platforms', regex: /check\s+(my\s+)?(connected\s+)?(platforms?|accounts?|channels?)/i },
  { intent: 'get_connected_platforms', regex: /which\s+platforms?\s+(have\s+i|did\s+i)\s+(connected|linked|added)/i },
  { intent: 'get_connected_platforms', regex: /is\s+(facebook|instagram|twitter|tiktok|linkedin|youtube|pinterest)\s+connected/i },
  { intent: 'get_connected_platforms', regex: /linked\s+(accounts?|platforms?|channels?)/i },
  { intent: 'get_connected_platforms', regex: /active\s+(accounts?|platforms?|channels?|connections?)/i },
  { intent: 'get_connected_platforms', regex: /(facebook|instagram|twitter|tiktok|linkedin|youtube|pinterest|bluesky|mastodon|telegram)\s+(connected|active|linked|status)/i },
  { intent: 'get_connected_platforms', regex: /my\s+(facebook|instagram|twitter|tiktok|linkedin|youtube)\s+(account|page|profile|channel)/i },
  { intent: 'get_connected_platforms', regex: /how\s+many\s+social\s+(media\s+)?(accounts?|platforms?)\s+(do\s+i\s+have|are\s+connected)/i },
  { intent: 'get_connected_platforms', regex: /what\s+social\s+media\s+(am\s+i|are\s+we)\s+(on|connected\s+to|using)/i },

  // PER-PLATFORM ANALYTICS
  { intent: 'get_platform_analytics', regex: /platform\s+(analytics|stats|breakdown|performance|metrics)/i },
  { intent: 'get_platform_analytics', regex: /analytics\s+(by\s+platform|per\s+platform|breakdown)/i },
  { intent: 'get_platform_analytics', regex: /breakdown\s+(by\s+platform|per\s+platform)/i },
  { intent: 'get_platform_analytics', regex: /per.platform\s+(analytics|stats|breakdown|metrics)/i },
  { intent: 'get_platform_analytics', regex: /each\s+platform\s+(analytics|stats|performance|metrics)/i },
  { intent: 'get_platform_analytics', regex: /(facebook|instagram|twitter|tiktok|linkedin|youtube|pinterest)\s+(analytics|stats|performance|metrics|impressions|likes)/i },
  { intent: 'get_platform_analytics', regex: /how\s+(is|are)\s+(facebook|instagram|twitter|tiktok|linkedin|youtube)\s+(performing|doing)/i },
  { intent: 'get_platform_analytics', regex: /best\s+performing\s+platform/i },
  { intent: 'get_platform_analytics', regex: /which\s+platform\s+(is\s+)?(performing\s+)?(best|worst|better|highest)/i },
  { intent: 'get_platform_analytics', regex: /platform\s+wise\s+(stats|analytics|breakdown|performance)/i },
  { intent: 'get_platform_analytics', regex: /compare\s+(my\s+)?platforms?/i },
  { intent: 'get_platform_analytics', regex: /social\s+media\s+(breakdown|performance\s+by|analytics\s+by)/i },
  { intent: 'get_platform_analytics', regex: /impressions\s+(by\s+|per\s+|on\s+each\s+)?platform/i },
  { intent: 'get_platform_analytics', regex: /likes\s+(by\s+|per\s+|on\s+each\s+)?platform/i },
  { intent: 'get_platform_analytics', regex: /(reach|engagement)\s+(by\s+|per\s+|on\s+each\s+)?platform/i },
  { intent: 'get_platform_analytics', regex: /show\s+(me\s+)?platform\s+(stats|analytics|breakdown)/i },
  { intent: 'get_platform_analytics', regex: /analytics\s+for\s+(facebook|instagram|twitter|tiktok|linkedin|youtube)/i },

  // AI USAGE
  { intent: 'get_ai_usage', regex: /^(ai\s+usage|ai\s+credits?|ai\s+limit|ai\s+quota|ai\s+generations?)$/i },
  { intent: 'get_ai_usage', regex: /ai\s+(usage|credits?|generations?|allowance|limit|quota)/i },
  { intent: 'get_ai_usage', regex: /how\s+many\s+ai\s+(credits?|generations?|uses?)\s+(do\s+i|have\s+i|left|remaining)/i },
  { intent: 'get_ai_usage', regex: /ai\s+(credits?|generations?)\s+(left|remaining|used|available)/i },
  { intent: 'get_ai_usage', regex: /how\s+many\s+(more\s+)?ai\s+(generations?|uses?|credits?)\s+(can\s+i|do\s+i\s+have)/i },
  { intent: 'get_ai_usage', regex: /remaining\s+ai\s+(credits?|generations?|limit|quota|uses?)/i },
  { intent: 'get_ai_usage', regex: /(ai|content)\s+generation\s+(usage|limit|quota|count|stats)/i },
  { intent: 'get_ai_usage', regex: /how\s+much\s+ai\s+(have\s+i\s+)?(used|consumed|left|remaining)/i },
  { intent: 'get_ai_usage', regex: /ai\s+limit\s+(remaining|left|status|used)/i },
  { intent: 'get_ai_usage', regex: /content\s+generation\s+(limit|quota|remaining|used)/i },
  { intent: 'get_ai_usage', regex: /how\s+many\s+(posts?|content)\s+can\s+ai\s+(still\s+)?(generate|create|write)/i },
  { intent: 'get_ai_usage', regex: /ai\s+(is|has)\s+(running\s+out|low|almost\s+used)/i },
  { intent: 'get_ai_usage', regex: /check\s+(my\s+)?ai\s+(usage|credits?|limit|quota)/i },
  { intent: 'get_ai_usage', regex: /used\s+(up\s+)?(my\s+)?ai\s+(credits?|generations?|limit)/i },
  { intent: 'get_ai_usage', regex: /ai\s+(post|caption|content)\s+(allowance|limit|quota|left|remaining)/i },
  { intent: 'get_ai_usage', regex: /how\s+many\s+(more\s+)?(posts?|captions?)\s+can\s+(the\s+)?ai\s+(write|generate|create)/i },

  // TEMPLATES
  { intent: 'get_templates', regex: /^(templates?|my\s+templates?)$/i },
  { intent: 'get_templates', regex: /show\s+(my\s+)?templates?/i },
  { intent: 'get_templates', regex: /list\s+(my\s+)?templates?/i },
  { intent: 'get_templates', regex: /what\s+templates?\s+do\s+i\s+have/i },
  { intent: 'get_templates', regex: /any\s+(saved\s+)?templates?\s+(available|saved|i\s+have)/i },
  { intent: 'get_templates', regex: /view\s+(my\s+)?templates?/i },
  { intent: 'get_templates', regex: /see\s+(my\s+)?templates?/i },
  { intent: 'get_templates', regex: /get\s+(my\s+)?templates?/i },
  { intent: 'get_templates', regex: /template\s+(library|collection|list|gallery|saved)/i },
  { intent: 'get_templates', regex: /saved\s+(post\s+)?templates?/i },
  { intent: 'get_templates', regex: /post\s+templates?\s+(list|saved|i\s+have)/i },
  { intent: 'get_templates', regex: /do\s+i\s+have\s+(any\s+)?templates?/i },
  { intent: 'get_templates', regex: /how\s+many\s+templates?\s+do\s+i\s+have/i },
  { intent: 'get_templates', regex: /my\s+content\s+templates?/i },
  { intent: 'get_templates', regex: /available\s+templates?/i },
  { intent: 'get_templates', regex: /templates?\s+(available|i\s+can\s+use|created|ready)/i },

  // BILLING / SUBSCRIPTION / PLAN
  { intent: 'get_billing_info', regex: /^(billing|plan|subscription|my\s+plan|my\s+subscription|account\s+plan)$/i },
  { intent: 'get_billing_info', regex: /billing\s+(info|information|details|status|overview|summary)/i },
  { intent: 'get_billing_info', regex: /what\s+(plan|subscription|tier)\s+(am\s+i|are\s+we)\s+on/i },
  { intent: 'get_billing_info', regex: /my\s+(current\s+)?(plan|subscription|tier|package)/i },
  { intent: 'get_billing_info', regex: /subscription\s+(info|details|status|plan|overview|type)/i },
  { intent: 'get_billing_info', regex: /what\s+(is\s+)?my\s+(plan|subscription|tier|package)/i },
  { intent: 'get_billing_info', regex: /current\s+(plan|subscription|tier|package|billing)/i },
  { intent: 'get_billing_info', regex: /(plan|subscription)\s+(status|active|details|info)/i },
  { intent: 'get_billing_info', regex: /am\s+i\s+(subscribed|on\s+a\s+paid\s+plan|on\s+pro|on\s+business|on\s+enterprise)/i },
  { intent: 'get_billing_info', regex: /how\s+much\s+(am\s+i|are\s+we)\s+paying/i },
  { intent: 'get_billing_info', regex: /(account|workspace)\s+(limits?|allowance|capacity|tier)/i },
  { intent: 'get_billing_info', regex: /what\s+(are\s+)?my\s+(limits?|allowance|capacity|quota|restrictions)/i },
  { intent: 'get_billing_info', regex: /plan\s+(limits?|features?|allowance|details|info)/i },
  { intent: 'get_billing_info', regex: /how\s+many\s+(posts?|connections?|seats?)\s+(can\s+i|are\s+)?(have|use|allowed|included)/i },
  { intent: 'get_billing_info', regex: /what\s+(do\s+i\s+get|is\s+included)\s+(with|in)\s+my\s+(plan|subscription)/i },
  { intent: 'get_billing_info', regex: /check\s+(my\s+)?(plan|subscription|billing|account\s+type)/i },
  { intent: 'get_billing_info', regex: /see\s+(my\s+)?(plan|subscription|billing|account\s+type)/i },
  { intent: 'get_billing_info', regex: /is\s+my\s+(account|subscription|plan)\s+(active|paid|valid|current)/i },
  { intent: 'get_billing_info', regex: /renewal\s+(date|status|info)/i },
  { intent: 'get_billing_info', regex: /when\s+does\s+my\s+(subscription|plan|billing)\s+(renew|expire|end)/i },
  { intent: 'get_billing_info', regex: /what\s+tier\s+(am\s+i|are\s+we)\s+(on|in)/i },
  { intent: 'get_billing_info', regex: /my\s+(account\s+)?(type|level|tier)/i },
  { intent: 'get_billing_info', regex: /trial\s+(status|period|days?\s+left|remaining)/i },
  { intent: 'get_billing_info', regex: /how\s+long\s+(is\s+)?my\s+trial/i },

  // WORKSPACE / TEAM MEMBERS
  { intent: 'get_workspace_members', regex: /any\s+(team\s+)?members?/i },
  { intent: 'get_workspace_members', regex: /member\s+on\s+my\s+team/i },
  { intent: 'get_workspace_members', regex: /^(team|members?|teammates?|colleagues?)$/i },
  { intent: 'get_workspace_members', regex: /show\s+(my\s+)?(team|workspace\s+members?|teammates?)/i },
  { intent: 'get_workspace_members', regex: /list\s+(my\s+)?(team|workspace\s+members?|teammates?)/i },
  { intent: 'get_workspace_members', regex: /who\s+is\s+(on\s+)?(my\s+)?(team|workspace|in\s+my\s+workspace)/i },
  { intent: 'get_workspace_members', regex: /who\s+(are\s+)?(my\s+)?(team\s+members?|teammates?|colleagues?)/i },
  { intent: 'get_workspace_members', regex: /workspace\s+(members?|team|users?|people)/i },
  { intent: 'get_workspace_members', regex: /team\s+(members?|users?|list|roster|people)/i },
  { intent: 'get_workspace_members', regex: /how\s+many\s+(people|members?|users?|teammates?)\s+(are\s+in|on)\s+(my\s+)?(team|workspace)/i },
  { intent: 'get_workspace_members', regex: /(members?|users?)\s+(in\s+)?my\s+workspace/i },
  { intent: 'get_workspace_members', regex: /what\s+(are\s+the\s+)?roles?\s+(of\s+)?(my\s+)?(team\s+members?|teammates?)/i },
  { intent: 'get_workspace_members', regex: /get\s+(my\s+)?(team|workspace\s+members?|teammates?)/i },
  { intent: 'get_workspace_members', regex: /collaborators?\s+(list|in\s+my\s+workspace|on\s+my\s+team)/i },
  { intent: 'get_workspace_members', regex: /team\s+(roles?|structure|setup|overview)/i },
  { intent: 'get_workspace_members', regex: /who\s+(else\s+)?has\s+access\s+to\s+(my\s+)?workspace/i },
  { intent: 'get_workspace_members', regex: /who\s+can\s+(access|use|edit|see)\s+my\s+workspace/i },
  { intent: 'get_workspace_members', regex: /team\s+members?\s+(and\s+)?roles?/i },

  // PUBLISH POST
  { intent: 'publish_post', regex: /publish\s+(post|draft|content|this|it)/i },
  { intent: 'publish_post', regex: /post\s+(this|it|now|immediately|right\s+now)/i },
  { intent: 'publish_post', regex: /send\s+(this|it)\s+(out|live|now)/i },
  { intent: 'publish_post', regex: /go\s+live\s+(with|now)/i },
  { intent: 'publish_post', regex: /push\s+(the|this|my)\s+(post|draft|content)\s+(live|now|out)/i },
  { intent: 'publish_post', regex: /make\s+(it|this|the\s+post)\s+(live|public|go\s+live)/i },
  { intent: 'publish_post', regex: /release\s+(the|this|my)\s+(post|draft|content)/i },
  { intent: 'publish_post', regex: /yes\s+(publish|post|confirm|go\s+ahead|do\s+it)/i },
  { intent: 'publish_post', regex: /confirm\s+(publish|posting|the\s+post)/i },
  { intent: 'publish_post', regex: /post\s+(this\s+)?(content|draft)\s+(now|immediately|live)/i },

  // SCHEDULE POST
  { intent: 'schedule_post', regex: /schedule\s+(this|the|my|a)\s+(post|draft|content)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'schedule_post', regex: /post\s+(this|it)\s+(later|at|on|for|tomorrow|next)/i },
  { intent: 'schedule_post', regex: /set\s+(a\s+)?schedule\s+for\s+(this|the)\s+(post|draft)/i },
  { intent: 'schedule_post', regex: /queue\s+(this|the|my|a)\s+(post|draft|content)/i },
  { intent: 'schedule_post', regex: /plan\s+(this|the|my|a)\s+(post|draft|content)\s+(for|to\s+go\s+live)/i },
  { intent: 'schedule_post', regex: /yes\s+schedule/i },
  { intent: 'schedule_post', regex: /confirm\s+(schedule|scheduling|the\s+schedule)/i },
  { intent: 'schedule_post', regex: /set\s+(it|this)\s+to\s+(post|go\s+live|publish)\s+(at|on|for)/i },

  // CREATE DESIGNED AD
  { intent: 'create_designed_ad_draft', regex: /create\s+(a\s+)?(designed|premium|beautiful|visual|branded|professional)\s+(post|ad|banner|content)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /design\s+(a\s+)?(post|ad|banner|visual|graphic|flyer|creative)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /generate\s+(a\s+)?(designed|premium|beautiful|visual|branded)\s+(post|ad|banner|content)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /make\s+(a\s+)?(designed|premium|beautiful|visual|graphic|branded)\s+(post|ad|banner|content|creative)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /visual\s+(ad|post|content|banner|creative|design)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /branded\s+(post|content|ad|banner|visual|creative)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /social\s+media\s+(graphic|visual|creative|banner|ad)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /(story|square|landscape|banner)\s+(ad|post|design|graphic|template|creative)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /instagram\s+(story|ad|creative|graphic|visual|banner)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /facebook\s+(ad|banner|creative|graphic|visual|post)/i, negative: /\b(how|what|when|can|should|explain)\b/i },
  { intent: 'create_designed_ad_draft', regex: /(make|create|build)\s+(me\s+)?a\s+(flyer|graphic|visual|ad|banner)/i, negative: /\b(how|what|when|can|should|explain)\b/i },

  // CONNECT SOCIAL PLATFORM (extra)
  { intent: 'connect_social_platform', regex: /how\s+do\s+i\s+(connect|link|add|integrate)\s+(facebook|instagram|twitter|linkedin|youtube|tiktok|pinterest|telegram|bluesky|mastodon)/i },
  { intent: 'connect_social_platform', regex: /connect\s+my\s+(facebook|instagram|twitter|linkedin|youtube|tiktok|pinterest|telegram|bluesky|mastodon)\s+(account|page|profile|channel)/i },
  { intent: 'connect_social_platform', regex: /add\s+(facebook|instagram|twitter|linkedin|youtube|tiktok|pinterest|telegram|bluesky|mastodon)\s+(account|page|profile|channel)/i },
  { intent: 'connect_social_platform', regex: /link\s+(my\s+)?(facebook|instagram|twitter|linkedin|youtube|tiktok|pinterest|telegram|bluesky|mastodon)/i },
  { intent: 'connect_social_platform', regex: /integrate\s+(facebook|instagram|twitter|linkedin|youtube|tiktok|pinterest|telegram|bluesky|mastodon)/i },
  { intent: 'connect_social_platform', regex: /setup\s+(my\s+)?(facebook|instagram|twitter|linkedin|youtube|tiktok|pinterest)\s+(account|page|profile)/i },

  // ADMIN: ACTIVE USERS (extra)
  { intent: 'get_active_users', regex: /how\s+many\s+(users|people|accounts)\s+are\s+(active|online|using)/i },
  { intent: 'get_active_users', regex: /users?\s+(online|active|logged\s+in)\s+(now|today|currently|right\s+now)/i },
  { intent: 'get_active_users', regex: /who\s+is\s+(online|active|logged\s+in)\s+(now|currently)/i },
  { intent: 'get_active_users', regex: /current\s+active\s+users?/i },
  { intent: 'get_active_users', regex: /users?\s+currently\s+(online|active|using\s+the\s+platform)/i },
  { intent: 'get_active_users', regex: /daily\s+active\s+users?/i },
  { intent: 'get_active_users', regex: /monthly\s+active\s+users?/i },

  // ADMIN: SYSTEM ANALYTICS (extra)
  { intent: 'get_system_analytics', regex: /total\s+(platform\s+)?(users?|workspaces?|accounts?|subscribers?)/i },
  { intent: 'get_system_analytics', regex: /how\s+many\s+(users?|workspaces?|accounts?|subscribers?)\s+(do\s+we\s+have|are\s+there|signed\s+up)/i },
  { intent: 'get_system_analytics', regex: /platform\s+(overview|health|status|numbers?|growth)/i },
  { intent: 'get_system_analytics', regex: /site\s+(stats|analytics|numbers?|overview|summary)/i },
  { intent: 'get_system_analytics', regex: /admin\s+(stats|analytics|overview|dashboard)/i },
  { intent: 'get_system_analytics', regex: /growth\s+(stats|analytics|numbers?|overview|metrics)/i },
  { intent: 'get_system_analytics', regex: /new\s+(users?|signups?|registrations?)\s+(this\s+month|this\s+week|today|recently)/i },
  { intent: 'get_system_analytics', regex: /platform\s+wide\s+(stats|analytics|data|metrics)/i },
  { intent: 'get_system_analytics', regex: /all\s+users?\s+(stats|count|overview|total)/i },

  // ADMIN: SUBSCRIBED USERS (extra)
  { intent: 'get_subscribed_users', regex: /how\s+many\s+(users?|people|accounts?)\s+(are\s+)?(subscribed|paying|on\s+paid\s+plan)/i },
  { intent: 'get_subscribed_users', regex: /paying\s+(users?|customers?|subscribers?)/i },
  { intent: 'get_subscribed_users', regex: /paid\s+(users?|customers?|subscribers?|accounts?)/i },
  { intent: 'get_subscribed_users', regex: /revenue|mrr|monthly\s+recurring/i },
  { intent: 'get_subscribed_users', regex: /subscription\s+(breakdown|count|total|stats|numbers?)/i },
  { intent: 'get_subscribed_users', regex: /how\s+many\s+(pro|business|enterprise)\s+(users?|subscribers?|accounts?)/i },

  // ADMIN: INACTIVE USERS (extra)
  { intent: 'get_inactive_users', regex: /users?\s+(who\s+(are|have\s+been)\s+)?inactive/i },
  { intent: 'get_inactive_users', regex: /how\s+many\s+users?\s+(have\s+)?(not\s+)?(logged\s+in|been\s+active|used\s+the\s+platform)/i },
  { intent: 'get_inactive_users', regex: /churned?\s+(users?|customers?|accounts?)/i },
  { intent: 'get_inactive_users', regex: /dormant\s+(users?|accounts?)/i },
  { intent: 'get_inactive_users', regex: /users?\s+not\s+(logging|using|active\s+in)\s+(30|the\s+last)/i },
  { intent: 'get_inactive_users', regex: /lapsed\s+(users?|accounts?|customers?)/i },
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

  // Guard: if the message is empty after trimming, bail out early.
  // Single-word queries like "billing", "calendar", "analytics" are intentional
  // and will be caught by the hardcoded regex patterns below.
  const meaningfulTokens = tokenize(cleanMessage);
  if (meaningfulTokens.length < 1) {
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
