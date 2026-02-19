import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getClient(apiKey?: string): OpenAI {
  if (apiKey) return new OpenAI({ apiKey });
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY || '';
    if (!key) console.warn('OPENAI_API_KEY not configured – AI chat will not work');
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

function normalizeModel(model: string): string {
  const m = (model || '').trim();
  if (m === 'gpt-4-turbo' || m === 'gpt-4-turbo-preview') return 'gpt-4o-mini';
  return m || 'gpt-4o-mini';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number; apiKey?: string },
): Promise<string> {
  const model = normalizeModel(options?.model || 'gpt-4o-mini');
  const client = getClient(options?.apiKey);

  const call = (m: string) =>
    client.chat.completions.create({
      model: m,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 1000,
      stream: false,
    });

  try {
    const response = await call(model);
    return response.choices?.[0]?.message?.content || '';
  } catch (error: any) {
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || error?.error?.code || '').toLowerCase();
    if (error?.status === 404 && model !== 'gpt-4o-mini' && (code === 'model_not_found' || msg.includes('model'))) {
      console.warn(`[OpenAI] Model "${model}" unavailable; falling back to gpt-4o-mini`);
      const fallback = await call('gpt-4o-mini');
      return fallback.choices?.[0]?.message?.content || '';
    }
    if (error.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (error.status === 401) throw new Error('Invalid OpenAI API key');
    throw new Error('AI service temporarily unavailable');
  }
}

export async function chatWithRetry(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number; timeoutMs?: number; apiKey?: string },
): Promise<string> {
  const maxRetries = 3;
  let lastError: Error = new Error('All retry attempts failed');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const timeoutMs = options?.timeoutMs ?? 15000;
      const result = await Promise.race([
        chatCompletion(messages, options),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('AI timeout')), timeoutMs)),
      ]);
      return result || '';
    } catch (error) {
      lastError = error as Error;
      if (lastError.message.includes('Invalid')) throw lastError;
      if (attempt < maxRetries - 1) await delay(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sk-your_openai_api_key' || apiKey.length < 20) {
      return new Array(1536).fill(0).map(() => Math.random());
    }
    const client = getClient();
    const response = await client.embeddings.create({ model: 'text-embedding-3-small', input: text });
    return response.data[0].embedding;
  } catch (error: any) {
    console.error('OpenAI embedding error:', error);
    return new Array(1536).fill(0).map(() => Math.random());
  }
}
