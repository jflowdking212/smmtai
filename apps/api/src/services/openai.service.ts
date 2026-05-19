import OpenAI, { toFile } from 'openai';

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

export async function chatWithTools(
  messages: Array<any>,
  tools: any[],
  toolExecutor: (name: string, args: any) => Promise<any>,
  options?: { model?: string; temperature?: number; maxTokens?: number; timeoutMs?: number; apiKey?: string },
): Promise<string> {
  const model = normalizeModel(options?.model || 'gpt-4o-mini');
  const client = getClient(options?.apiKey);
  
  // Create a deep copy of messages to append to
  const msgs = [...messages];
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    try {
      const response = await client.chat.completions.create({
        model,
        messages: msgs,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens || 1000,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : 'none',
      });

      const message = response.choices[0]?.message;
      if (!message) return '';

      msgs.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type === 'function') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await toolExecutor(toolCall.function.name, args);
              msgs.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: typeof result === 'string' ? result : JSON.stringify(result)
              });
            } catch (err: any) {
              msgs.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error executing tool: ${err.message}`
              });
            }
          }
        }
      } else {
        return message.content || '';
      }
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      if (error.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
      if (error.status === 401) throw new Error('Invalid OpenAI API key');
      throw new Error(`AI tool execution failed: ${msg}`);
    }
  }

  return 'I needed too many steps to complete this request. Please try breaking it down into smaller parts.';
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

/**
 * Transcribe audio using OpenAI Whisper.
 * Accepts a Buffer (audio file bytes) and the MIME type/file extension.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  apiKey?: string,
): Promise<string> {
  const client = getClient(apiKey || process.env.OPENAI_API_KEY);
  
  // Use the official toFile helper provided by OpenAI for Node.js
  const file = await toFile(audioBuffer, filename, { type: getMimeType(filename) });

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text',
  });

  return typeof response === 'string' ? response.trim() : (response as any).text?.trim() ?? '';
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    webm: 'audio/webm',
    mp4: 'audio/mp4',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    flac: 'audio/flac',
  };
  return map[ext || ''] || 'audio/webm';
}

export async function generateSpeech(text: string, apiKey?: string): Promise<Buffer> {
  const client = getClient(apiKey || process.env.OPENAI_API_KEY);
  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'alloy',
    input: text,
  });
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
