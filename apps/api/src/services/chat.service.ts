import { prisma } from '../config/database.js';
import { chatWithRetry, chatWithTools } from './openai.service.js';
import * as knowledgeBaseService from './knowledge-base.service.js';
import * as conversationService from './conversation.service.js';
import { adminTools, userTools } from './chat-tools.service.js';
import { tryRouteLocally, tryStaticRoute, logSuccessfulRoute, logRoutingOutcome, calculateSimilarity } from './nlp-router.service.js';
import { buildUserContextBlock, formatContextForPrompt } from './context-injector.service.js';

interface QaCacheRecord {
  phrase: string;
  response: string;
  count: number;
  lastUsedAt?: string;
}

async function loadQaCache(): Promise<QaCacheRecord[]> {
  try {
    const record = await prisma.systemConfig.findUnique({
      where: { key: 'nlp_qa_cache' }
    });
    if (record?.value) {
      const parsed = JSON.parse(record.value);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('[Chat Service] Failed to load Q&A cache:', err);
  }
  return [];
}

async function saveQaCache(data: QaCacheRecord[]) {
  try {
    const sorted = [...data].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 300);
    await prisma.systemConfig.upsert({
      where: { key: 'nlp_qa_cache' },
      update: { value: JSON.stringify(sorted) },
      create: { key: 'nlp_qa_cache', value: JSON.stringify(sorted), encrypted: false }
    });
  } catch (err) {
    console.error('[Chat Service] Failed to save Q&A cache:', err);
  }
}

async function logSuccessfulQa(phrase: string, response: string) {
  try {
    const data = await loadQaCache();
    const cleanPhrase = phrase.toLowerCase().trim();
    const existing = data.find(d => d.phrase === cleanPhrase);
    if (existing) {
      existing.count += 1;
      existing.lastUsedAt = new Date().toISOString();
      existing.response = response;
    } else {
      data.push({ phrase: cleanPhrase, response, count: 1, lastUsedAt: new Date().toISOString() });
    }
    await saveQaCache(data);
    console.log(`[Chat Service] Logged Q&A Cache: "${cleanPhrase}"`);
  } catch (err) {
    console.error('[Chat Service] Error logging Q&A cache:', err);
  }
}

function isCacheableQuery(phrase: string): boolean {
  const lower = phrase.toLowerCase().trim();
  const creativeWords = [
    'write', 'create', 'generate', 'rewrite', 'compose', 'make', 'translate',
    'post a', 'caption for', 'new post', 'draft a', 'translate to', 'rewrite this'
  ];
  return !creativeWords.some(w => lower.startsWith(w) || lower.includes(' ' + w));
}

// ????????? ???? TEST MODE ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
// Set to true to disable the OpenAI fallback and test ONLY the local NLP router.
// When a query cannot be matched locally, a diagnostic message is returned instead
// of calling OpenAI. Flip back to false when testing is complete.
const LOCAL_ONLY_MODE = false; // ??? OpenAI enabled. Set to true only for local router testing.
// ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

// In-memory cache
const cache = new Map<string, { value: any; expires: number }>();
function setCache(key: string, value: any, ttlMs = 30 * 60 * 1000) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}
function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.value as T;
}

async function getChatConfig(): Promise<{ model: string; apiKey: string; systemPrompt: string; maxTokens: number; isEnabled: boolean; openrouterApiKey?: string; openrouterDefault?: boolean; openrouterModel?: string }> {
  const cacheKey = 'chatbot_config';
  const cached = getCache<any>(cacheKey);
  if (cached) return cached;

  const defaults = { model: 'gpt-4o-mini', apiKey: '', systemPrompt: '', maxTokens: 250, isEnabled: true, openrouterApiKey: '', openrouterDefault: false, openrouterModel: 'google/gemini-2.5-flash' };

  try {
    const record = await prisma.systemConfig.findUnique({ where: { key: 'chatbot_config' } });
    if (record?.value) {
      const parsed = JSON.parse(record.value);
      const merged = { ...defaults, ...parsed };
      setCache(cacheKey, merged, 5000);
      return merged;
    }
  } catch {}

  setCache(cacheKey, defaults, 5000);
  return defaults;
}

function getEffectiveApiKey(chatConfig: { apiKey: string }): string | undefined {
  const candidates = [chatConfig.apiKey, process.env.OPENAI_API_KEY];
  const key = candidates.find((k) => typeof k === 'string' && k.trim().length >= 20);
  return key?.trim();
}

/** Check if any support agent is online (marked online in SystemConfig within last 5 minutes) */
async function isSupportAgentOnline(): Promise<boolean> {
  try {
    const record = await prisma.systemConfig.findUnique({ where: { key: 'support_agents_online' } });
    if (!record?.value) return false;
    const data = JSON.parse(record.value);
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return Array.isArray(data) && data.some((a: any) => a.lastSeen > fiveMinAgo);
  } catch {
    return false;
  }
}

export async function chatWithCustomer(message: string, context = 'general', sessionId?: string, userId?: string, workspaceId?: string) {
  try {
    if (sessionId) {
      await conversationService.addMessage(sessionId, { role: 'user', content: message, timestamp: new Date() });
    }

    // ?????? LAYER 0: STATIC ROUTE ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    // Answers factual questions about the platform (platforms list, features,
    // pricing, site overview, bot capabilities) with VERIFIED hardcoded text.
    // Zero OpenAI cost, zero hallucination risk. Works for ALL users (guests too).
    const staticResponse = tryStaticRoute(message);
    if (staticResponse) {
      if (sessionId) {
        await conversationService.addMessage(sessionId, { role: 'bot', content: staticResponse, timestamp: new Date() });
      }
      return { success: true, response: staticResponse, usedKnowledgeBase: false, sources: [], routedLocally: true };
    }

    const chatConfig = await getChatConfig();

    if (!chatConfig.isEnabled) {
      return { success: true, response: 'Chatbot is currently disabled by the administrator.', usedKnowledgeBase: false, sources: [] };
    }

    // Prepare tools based on authentication and role.
    // This MUST run before the local router so `role` is correctly set.
    const tools: any[] = [];
    let role = 'guest';
    let userName = '';

    if (userId && workspaceId) {
      const [membership, user] = await Promise.all([
        prisma.workspaceMember.findUnique({
          where: { userId_workspaceId: { userId, workspaceId } }
        }),
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      ]);
      if (membership) {
        role = membership.role;
        userName = user?.name || '';
        Object.values(userTools).forEach(t => tools.push(t.definition));
        if (role === 'admin' || role === 'owner') {
          Object.values(adminTools).forEach(t => tools.push(t.definition));
        }
      }
    }

    // ?????? LAYER 1: LOCAL NLP ROUTER ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    // Regex + active-learning DB routing. Handles dashboard data queries
    // (posts, analytics, billing, calendar, etc.) with live DB tool calls.
    // Runs before KB search and before OpenAI to save tokens.
    if (userId && workspaceId && role !== 'guest') {
      const startLocal = Date.now();
      const localResponse = await tryRouteLocally(message, { userId, workspaceId, role });
      if (localResponse) {
        if (sessionId) {
          await conversationService.addMessage(sessionId, { role: 'bot', content: localResponse, timestamp: new Date() });
        }
        return {
          success: true,
          response: localResponse,
          usedKnowledgeBase: false,
          sources: [],
          routedLocally: true,
        };
      } else {
        const latency = Date.now() - startLocal;
        logRoutingOutcome('openai_fallback', latency).catch(console.error);
      }
    }

    // ?????? LAYER 1.5: GENERAL Q&A CACHE ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    // Check if there is an identical or extremely similar general question
    // that has been answered before to avoid invoking LLM.
    const qaCache = await loadQaCache();
    let bestQaMatch: QaCacheRecord | null = null;
    let highestQaScore = 0;

    for (const record of qaCache) {
      const score = calculateSimilarity(message, record.phrase);
      if (score >= 0.85 && score > highestQaScore) {
        highestQaScore = score;
        bestQaMatch = record;
      }
    }

    if (bestQaMatch) {
      const cachedRes = bestQaMatch.response;
      logSuccessfulQa(bestQaMatch.phrase, cachedRes).catch(console.error);
      
      if (sessionId) {
        await conversationService.addMessage(sessionId, { role: 'bot', content: cachedRes, timestamp: new Date() });
      }
      return {
        success: true,
        response: cachedRes,
        usedKnowledgeBase: false,
        sources: [],
        routedLocally: true,
      };
    }

    // ?????? LAYER 2: KNOWLEDGE BASE SEARCH ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    // Only runs when layers 0, 1 and 1.5 didn't match. Searches KB.
    // If similarity >= 0.75, return directly to save LLM tokens.
    const knowledgeResults = await knowledgeBaseService.searchKnowledge(message, 3);

    if (knowledgeResults.length > 0 && knowledgeResults[0].similarity >= 0.75) {
      const topMatch = knowledgeResults[0];
      if (sessionId) {
        await conversationService.addMessage(sessionId, { role: 'bot', content: topMatch.content, timestamp: new Date() });
      }
      logSuccessfulQa(message, topMatch.content).catch(console.error);

      return {
        success: true,
        response: topMatch.content,
        usedKnowledgeBase: true,
        sources: [{ title: topMatch.title, category: topMatch.category }],
        routedLocally: true,
      };
    }

    let contextInfo = '';
    const hasKBMatch = knowledgeResults.length > 0;
    if (hasKBMatch) {
      contextInfo = '\n\n=== KNOWLEDGE BASE ===\n';
      knowledgeResults.forEach((kb: any, i: number) => {
        contextInfo += (i + 1) + '. ' + kb.title + '\n' + kb.content + '\n\n';
      });
      contextInfo += '=== END KNOWLEDGE BASE ===\n';
    }

    // If no KB match, check for online support agents
    if (!hasKBMatch) {
      const agentOnline = await isSupportAgentOnline();
      if (agentOnline && sessionId) {
        try {
          await conversationService.transferToHuman(sessionId);
        } catch {}
        return {
          success: true,
          response: "I'm connecting you with a support agent who can help you directly. Please wait a moment ??? someone will be with you shortly.",
          usedKnowledgeBase: false,
          sources: [],
          transferredToAgent: true,
        };
      }
    }

    // ?????? OPENAI FALLBACK ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    // Only reached when local routing returns null.

    // ???? LOCAL_ONLY_MODE: short-circuit before calling OpenAI.
    // Remove or set to false once local router testing is complete.
    if (LOCAL_ONLY_MODE) {
      const testMsg = [
        `?????? **[Test Mode ??? Local Router Only]**`,
        ``,
        `Your message was **not matched** by the local NLP router.`,
        ``,
        `**What you said:** "${message}"`,
        `**Your role:** ${role}`,
        ``,
        `**Try one of these to test local routing:**`,
        `??? _"show my dashboard stats"_`,
        `??? _"list my draft posts"_`,
        `??? _"show my 5 scheduled posts"_`,
        `??? _"how many active users are there"_` + (role === 'admin' || role === 'owner' ? `\n??? _"show platform analytics"_\n??? _"how many users are online now"_` : ''),
        ``,
        `_OpenAI fallback is temporarily disabled for testing._`,
      ].join('\n');

      if (sessionId) {
        await conversationService.addMessage(sessionId, { role: 'bot', content: testMsg, timestamp: new Date() });
      }
      return { success: true, response: testMsg, usedKnowledgeBase: false, sources: [], routedLocally: false };
    }

    const effectiveKey = getEffectiveApiKey(chatConfig);
    if (!effectiveKey) {
      return {
        success: true,
        response: 'Chatbot is not configured yet. Please add a valid OpenAI API key in Admin settings or set OPENAI_API_KEY environment variable.',
        usedKnowledgeBase: knowledgeResults.length > 0,
        sources: knowledgeResults.map((kb: any) => ({ title: kb.title, category: kb.category })),
      };
    }

    // ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    // SYSTEM PROMPT ??? Hardened Anti-Hallucination Version
    // VERIFIED FACTS are injected directly so the model NEVER needs to guess.
    // ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    const VERIFIED_FACTS = `
=== VERIFIED PLATFORM FACTS (source of truth ??? never contradict these) ===
SmmtAI supports EXACTLY 25 social media platforms:

OAuth Connect (7): Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Pinterest
Community Platforms (3): Entreprenrs, Chrxstians, Iohah
Fediverse & Alternative (6): Bluesky, Mastodon, Telegram, Truth Social, Lemmy, Pleroma
Social & Discussion (3): Threads, Reddit, Tumblr
Publishing & Business (4): WordPress, Medium, Blogger, Google Business Profile
Collaboration (2): Discord, Slack

Total = 25. NEVER say 13, NEVER add platforms that are not in this list.
=== END VERIFIED FACTS ===`;

    // ⚡ AI INTELLIGENCE CONTEXT INJECTION
    let intelligenceContext = '';
    if (userId && workspaceId) {
      try {
        const userCtx = await buildUserContextBlock(userId, workspaceId);
        if (userCtx.profile || userCtx.voice) {
          intelligenceContext = '\n\n' + formatContextForPrompt(userCtx);
        }
      } catch (err) {
        console.error('[Chat Service] Failed to build intelligence context:', err);
      }
    }

    const defaultSystemPrompt = `ROLE: You are a helpful AI assistant for SmmtAI, a social media management platform.

CRITICAL ANTI-HALLUCINATION RULES (MUST FOLLOW):
1. NEVER fabricate platform names. The ONLY platforms SmmtAI supports are in the VERIFIED FACTS below.
2. NEVER state a number of platforms unless it is exactly 25.
3. NEVER add platforms from your training data (e.g. Snapchat, WhatsApp, Vimeo, Patreon, Foursquare, Behance, Dribbble, Quora). These are NOT supported.
4. If you are unsure about any fact ??? say "I don't have that information" or direct the user to the dashboard. NEVER guess.
5. If the user says the platform count is wrong, trust this system prompt, NOT your training data.
${VERIFIED_FACTS}

PERSONA:
You help users with questions about SmmtAI: social media management, post scheduling, analytics, content creation, and platform connections.

RULES:
- Be concise and helpful (under 80 words)
- Be friendly and conversational
- If you have knowledge base information below, use it ??? it takes priority over your training data
- NEVER make up features or platform names
${hasKBMatch
  ? '\nYou HAVE knowledge base information below. ANSWER ONLY USING THAT INFORMATION.'
  : '\nOnly answer from your verified facts and general social media knowledge. If uncertain, say so.'}
${intelligenceContext}
${contextInfo}`;

    const systemPrompt = chatConfig.systemPrompt?.trim() || defaultSystemPrompt;
    const finalPrompt = chatConfig.systemPrompt?.trim()
      ? systemPrompt + VERIFIED_FACTS + intelligenceContext + contextInfo + (hasKBMatch ? '\nIMPORTANT: Answer ONLY using the knowledge base above. Do not make up information.' : '')
      : systemPrompt;

    const toolExecutor = async (name: string, args: any) => {
      if (!userId || !workspaceId) return 'User not authenticated.';
      
      let handler;
      if (userTools[name]) handler = userTools[name].handler;
      if ((role === 'admin' || role === 'owner') && adminTools[name]) handler = adminTools[name].handler;
      
      if (!handler) return `Tool ${name} not found or you don't have permission to use it.`;
      return handler(args, { userId, workspaceId, role });
    };

    // Use larger token budget and role-aware prompt when agent tools are active
    const isAgentMode = tools.length > 0;
    const agentRoleContext = isAgentMode
      ? `\n\nAGENT CONTEXT:
- Today's date and time: ${new Date().toUTCString()}
- You are operating as a full AI agent with real-time access to the SmmtAI database.
- Authenticated user: ${userName || 'Unknown'} (role: ${role}, workspaceId: ${workspaceId})
- You CAN and SHOULD use your tools to answer data-related questions. Use multiple tools in sequence if needed.
- Tools available: get_dashboard_stats, get_user_posts, get_connected_platforms, get_platform_analytics, get_ai_usage, get_templates, get_calendar, get_billing_info, get_workspace_members, create_post_draft, publish_post, schedule_post, delete_post, connect_social_platform, create_designed_ad_draft${role === 'admin' || role === 'owner' ? ', get_active_users, get_subscribed_users, get_inactive_users, get_system_analytics, ban_user' : ''}.
- For destructive actions (delete_post, ban_user) you MUST confirm with the user before executing (set confirm=false first to get their consent).
- Do NOT make up data. Always use tools to retrieve live information.
- Format lists and data clearly for the user. Use bullet points, bold, and emojis for readability.`
      : '';

    const agentSystemPrompt = isAgentMode
      ? `ROLE: You are an omniscient AI assistant for SmmtAI. You have real-time access to the platform's data through tools.

CRITICAL ANTI-HALLUCINATION RULES (NON-NEGOTIABLE):
1. NEVER state platform names, user counts, post data, billing amounts, or any metric without calling a tool first.
2. The ONLY social platforms SmmtAI supports are these exact 25: Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Pinterest, Entreprenrs, Chrxstians, Iohah, Bluesky, Mastodon, Telegram, Truth Social, Lemmy, Pleroma, Threads, Reddit, Tumblr, WordPress, Medium, Blogger, Google Business Profile, Discord, Slack. NO others exist in this system.
3. If a user asks what platforms they have connected: call get_connected_platforms. NEVER guess.
4. If you cannot answer something with a tool or the verified facts: say "I don't have access to that information" — NEVER fabricate.
5. Do NOT add platforms from your training data (Snapchat, WhatsApp, Vimeo, etc.) — they are NOT in SmmtAI.

PERSONA:
You are highly capable, concise, and action-oriented. You proactively use your tools to answer questions with real data.

RULES:
- CRITICAL: If you have a tool that can answer the user's question, YOU MUST CALL IT. Live tools ALWAYS take precedence over the Knowledge Base!
- Be concise but thorough — do not truncate lists the user asked for.
- For destructive actions, ALWAYS confirm with the user first.
- You can handle multiple steps: look up data then act on it.
${agentRoleContext}
${intelligenceContext}
${contextInfo}`
      : null;

    const finalSystemPrompt = agentSystemPrompt || finalPrompt;
    const effectiveMaxTokens = isAgentMode ? 1500 : chatConfig.maxTokens;

    // Adaptive LLM Model Routing based on context (dashboard activities vs general chat)
    const hasOpenRouter = typeof chatConfig.openrouterApiKey === 'string' && chatConfig.openrouterApiKey.trim().length > 10;
    let resolvedModel = chatConfig.model || 'gpt-4o-mini';
    let openrouterDefault = chatConfig.openrouterDefault === true;
    let openrouterModel = chatConfig.openrouterModel || 'google/gemini-2.5-flash';
    
    if (hasOpenRouter) {
      if (isAgentMode) {
        // Dashboard activities / Agent mode: Use DeepSeek Pro (deepseek-chat) for function calling
        resolvedModel = 'deepseek/deepseek-chat';
        openrouterDefault = true;
        openrouterModel = 'deepseek/deepseek-chat';
      } else {
        // General Chat & Content: Use Gemini 2.5 Flash (highly capable, extremely low cost)
        openrouterDefault = true;
        openrouterModel = 'google/gemini-2.5-flash';
      }
    }

    const openaiOptions = {
      model: resolvedModel,
      temperature: isAgentMode ? 0.4 : 0.7,
      maxTokens: effectiveMaxTokens,
      apiKey: effectiveKey,
      timeoutMs: isAgentMode ? 30000 : 15000,
      openrouterApiKey: chatConfig.openrouterApiKey,
      openrouterDefault: openrouterDefault,
      openrouterModel: openrouterModel
    };
    const conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: finalSystemPrompt },
    ];

    if (sessionId) {
      try {
        const conversation = await conversationService.getConversation(sessionId);
        if (conversation?.messages && Array.isArray(conversation.messages)) {
          // Load up to the last 12 messages of conversation history to keep prompt compact but highly contextual
          const history = conversation.messages.slice(-12) as Array<{ role: 'user' | 'bot'; content: string }>;
          history.forEach((msg) => {
            const role = msg.role === 'bot' ? 'assistant' : 'user';
            conversationMessages.push({ role, content: msg.content });
          });
        }
      } catch (err) {
        console.error('Failed to load conversation history for OpenAI fallback:', err);
      }
    }

    // Fallback: if sessionId was not provided or history was empty, manually push the user's latest query
    if (conversationMessages.length === 1) {
      conversationMessages.push({ role: 'user', content: message });
    }

    let response: string = "";

    if (tools.length > 0) {
      // BUG FIX: Log the successful route AFTER the tool executes and returns a
      // result ??? not before. Logging before meant a failed tool execution would
      // be saved as a 'successful' training example, poisoning future routing.
      const interceptingExecutor = async (name: string, args: any) => {
        const result = await toolExecutor(name, args);
        // Only log after we know the tool succeeded (did not throw)
        await logSuccessfulRoute(message, name);
        return result;
      };
      response = await chatWithTools(conversationMessages, tools, interceptingExecutor, openaiOptions);
    } else {
      response = await chatWithRetry(conversationMessages as any, openaiOptions);
    }
    
    if (!response) response = "I couldn't process that request.";
    const finalResponse: string = response;

    if (sessionId && finalResponse) {
      await conversationService.addMessage(sessionId, { role: 'bot', content: finalResponse, timestamp: new Date() });
    }

    // Cache the response locally if it is informational Q&A to continuously learn
    if (finalResponse && !finalResponse.includes('cannot connect') && !finalResponse.includes('timed out') && isCacheableQuery(message)) {
      logSuccessfulQa(message, finalResponse).catch(console.error);
    }

    if (finalResponse) {
      return {
        success: true,
        response: finalResponse,
        usedKnowledgeBase: knowledgeResults.length > 0,
        sources: knowledgeResults.map((kb: any) => ({ title: kb.title, category: kb.category })),
      };
    }

    return { success: false, error: 'Failed to generate response' };
  } catch (error: any) {
    console.error('Chat error:', error);
    const msg = String(error?.message || '').toLowerCase();

    if (msg.includes('invalid openai api key') || msg.includes('401')) {
      return { success: true, response: 'Chatbot cannot connect because the configured OpenAI API key is invalid.', usedKnowledgeBase: false, sources: [] };
    }
    if (msg.includes('timeout')) {
      return { success: true, response: 'Chatbot timed out. Please try again in a moment.', usedKnowledgeBase: false, sources: [] };
    }
    return { success: true, response: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.", usedKnowledgeBase: false, sources: [] };
  }
}

const TRANSFER_KEYWORDS = [
  'speak to agent', 'talk to human', 'human support', 'real person',
  'representative', 'escalate', 'urgent', 'complaint',
];

export function shouldTransferToAgent(message: string): boolean {
  const lower = message.toLowerCase();
  return TRANSFER_KEYWORDS.some((kw) => lower.includes(kw));
}

