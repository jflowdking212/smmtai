import { prisma } from '../config/database.js';
import { chatWithRetry, chatWithTools } from './openai.service.js';
import * as knowledgeBaseService from './knowledge-base.service.js';
import * as conversationService from './conversation.service.js';
import { adminTools, userTools } from './chat-tools.service.js';
import { tryRouteLocally, logSuccessfulRoute, logRoutingOutcome } from './nlp-router.service.js';

// ─── 🧪 TEST MODE ─────────────────────────────────────────────────────────────
// Set to true to disable the OpenAI fallback and test ONLY the local NLP router.
// When a query cannot be matched locally, a diagnostic message is returned instead
// of calling OpenAI. Flip back to false when testing is complete.
const LOCAL_ONLY_MODE = false; // ← Testing complete. OpenAI fallback re-enabled.
// ──────────────────────────────────────────────────────────────────────────────

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

async function getChatConfig(): Promise<{ model: string; apiKey: string; systemPrompt: string; maxTokens: number; isEnabled: boolean }> {
  const cacheKey = 'chatbot_config';
  const cached = getCache<any>(cacheKey);
  if (cached) return cached;

  const defaults = { model: 'gpt-4o-mini', apiKey: '', systemPrompt: '', maxTokens: 250, isEnabled: true };

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

    // RAG: search knowledge base
    const knowledgeResults = await knowledgeBaseService.searchKnowledge(message, 3);

    let contextInfo = '';
    const hasKBMatch = knowledgeResults.length > 0;
    if (hasKBMatch) {
      contextInfo = '\n\n=== KNOWLEDGE BASE ===\n';
      knowledgeResults.forEach((kb: any, i: number) => {
        contextInfo += `${i + 1}. ${kb.title}\n${kb.content}\n\n`;
      });
      contextInfo += '=== END KNOWLEDGE BASE ===\n';
    }

    // If no KB match, check for online support agents
    if (!hasKBMatch) {
      const agentOnline = await isSupportAgentOnline();
      if (agentOnline && sessionId) {
        // Flag conversation for live agent pickup
        try {
          await conversationService.transferToHuman(sessionId);
        } catch {}
        return {
          success: true,
          response: "I'm connecting you with a support agent who can help you directly. Please wait a moment — someone will be with you shortly.",
          usedKnowledgeBase: false,
          sources: [],
          transferredToAgent: true,
        };
      }
    }

    const chatConfig = await getChatConfig();

    if (!chatConfig.isEnabled) {
      return { success: true, response: 'Chatbot is currently disabled by the administrator.', usedKnowledgeBase: false, sources: [] };
    }

    const defaultSystemPrompt = `ROLE: You are a helpful AI assistant for SmmtAI, a social media management platform.

PERSONA:
You help users with questions about social media management, post scheduling, analytics, content creation, and platform connections.

RULES:
- Be concise and helpful (under 80 words)
- Be friendly and conversational
- If you have knowledge base information, use it to answer accurately
- Don't make up features or capabilities
${hasKBMatch
  ? '\nYou HAVE knowledge base information below. ANSWER ONLY USING THAT INFORMATION.'
  : '\nUse your general knowledge about social media management to help.'}
${contextInfo}`;

    const systemPrompt = chatConfig.systemPrompt?.trim() || defaultSystemPrompt;
    const finalPrompt = chatConfig.systemPrompt?.trim() ? systemPrompt + contextInfo + (hasKBMatch ? '\nIMPORTANT: Answer ONLY using the knowledge base above. Do not make up information.' : '') : systemPrompt;

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

    // ── LOCAL ROUTER ────────────────────────────────────────────
    // Runs BEFORE API key check so zero-token queries work even with no OpenAI key.
    // Role is correctly set above, so admin tools can be properly accessed here.
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

    // ── OPENAI FALLBACK ───────────────────────────────────────
    // Only reached when local routing returns null.

    // 🧪 LOCAL_ONLY_MODE: short-circuit before calling OpenAI.
    // Remove or set to false once local router testing is complete.
    if (LOCAL_ONLY_MODE) {
      const testMsg = [
        `⚙️ **[Test Mode — Local Router Only]**`,
        ``,
        `Your message was **not matched** by the local NLP router.`,
        ``,
        `**What you said:** "${message}"`,
        `**Your role:** ${role}`,
        ``,
        `**Try one of these to test local routing:**`,
        `• _"show my dashboard stats"_`,
        `• _"list my draft posts"_`,
        `• _"show my 5 scheduled posts"_`,
        `• _"how many active users are there"_` + (role === 'admin' || role === 'owner' ? `\n• _"show platform analytics"_\n• _"how many users are online now"_` : ''),
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
- You are operating as a full AI agent with real-time access to the SmmtAI database.
- Authenticated user: ${userName || 'Unknown'} (role: ${role}, workspaceId: ${workspaceId})
- You CAN and SHOULD use your tools to answer data-related questions.
- For destructive actions (delete_post, ban_user) you MUST confirm with the user before executing (set confirm=false first to get their consent).
- Do NOT make up data. Always use tools to retrieve live information.
- Format lists and data clearly for the user.`
      : '';

    const agentSystemPrompt = isAgentMode
      ? `ROLE: You are an omniscient AI assistant for SmmtAI. You have real-time access to the platform's data through tools.

PERSONA:
You are highly capable, concise, and action-oriented. You proactively use your tools to answer questions with real data.

RULES:
- CRITICAL: If you have a tool that can answer the user's question, YOU MUST CALL IT. Live tools ALWAYS take precedence over the Knowledge Base!
- Be concise but thorough — do not truncate lists the user asked for.
- For destructive actions, ALWAYS confirm with the user first.
- You can handle multiple steps: look up data then act on it.
${agentRoleContext}
${contextInfo}`
      : null;

    const finalSystemPrompt = agentSystemPrompt || finalPrompt;
    const effectiveMaxTokens = isAgentMode ? 1500 : chatConfig.maxTokens;
    const openaiOptions = {
      model: chatConfig.model,
      temperature: isAgentMode ? 0.4 : 0.7,
      maxTokens: effectiveMaxTokens,
      apiKey: effectiveKey,
      timeoutMs: isAgentMode ? 30000 : 15000
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
      // result — not before. Logging before meant a failed tool execution would
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
