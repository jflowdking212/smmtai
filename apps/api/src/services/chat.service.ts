import { prisma } from '../config/database.js';
import { chatWithRetry } from './openai.service.js';
import * as knowledgeBaseService from './knowledge-base.service.js';
import * as conversationService from './conversation.service.js';

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

export async function chatWithCustomer(message: string, context = 'general', sessionId?: string) {
  try {
    if (sessionId) {
      await conversationService.addMessage(sessionId, { role: 'user', content: message, timestamp: new Date() });
    }

    // RAG: search knowledge base
    const knowledgeResults = await knowledgeBaseService.searchKnowledge(message, 3);

    let contextInfo = '';
    const hasKBMatch = knowledgeResults.length > 0;
    if (hasKBMatch) {
      contextInfo = '\n\n=== KNOWLEDGE BASE (USE THIS TO ANSWER) ===\n';
      knowledgeResults.forEach((kb: any, i: number) => {
        contextInfo += `${i + 1}. ${kb.title}\n${kb.content}\n\n`;
      });
      contextInfo += '=== END KNOWLEDGE BASE ===\n\nIMPORTANT: Answer ONLY using the knowledge base above. Do not make up information.';
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

    const defaultSystemPrompt = `ROLE: You are a helpful AI assistant for Postmind, a social media management platform.

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
    const finalPrompt = chatConfig.systemPrompt?.trim() ? systemPrompt + contextInfo : systemPrompt;

    const effectiveKey = getEffectiveApiKey(chatConfig);
    if (!effectiveKey) {
      return {
        success: true,
        response: 'Chatbot is not configured yet. Please add a valid OpenAI API key in Admin settings or set OPENAI_API_KEY environment variable.',
        usedKnowledgeBase: knowledgeResults.length > 0,
        sources: knowledgeResults.map((kb: any) => ({ title: kb.title, category: kb.category })),
      };
    }

    const response = await chatWithRetry(
      [
        { role: 'system', content: finalPrompt },
        { role: 'user', content: message },
      ],
      { model: chatConfig.model, temperature: 0.7, maxTokens: chatConfig.maxTokens, apiKey: effectiveKey, timeoutMs: 15000 },
    );

    if (sessionId && response) {
      await conversationService.addMessage(sessionId, { role: 'bot', content: response, timestamp: new Date() });
    }

    if (response) {
      return {
        success: true,
        response,
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
