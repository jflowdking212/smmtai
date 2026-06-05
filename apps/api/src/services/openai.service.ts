import OpenAI, { toFile } from 'openai';
import { prisma } from '../config/database.js';

let openaiClient: OpenAI | null = null;
let openRouterClient: OpenAI | null = null;

let cachedConfig: any = null;
let cacheExpiry = 0;

async function getChatConfig() {
  if (cachedConfig && Date.now() < cacheExpiry) {
    return cachedConfig;
  }
  const defaults = {
    model: 'gpt-4o-mini',
    apiKey: '',
    systemPrompt: '',
    maxTokens: 250,
    isEnabled: true,
    openrouterApiKey: '',
    openrouterDefault: false,
    openrouterModel: 'google/gemini-2.5-flash',
  };
  try {
    const record = await prisma.systemConfig.findUnique({ where: { key: 'chatbot_config' } });
    if (record?.value) {
      cachedConfig = { ...defaults, ...JSON.parse(record.value) };
    } else {
      cachedConfig = defaults;
    }
  } catch {
    cachedConfig = defaults;
  }
  cacheExpiry = Date.now() + 5000; // 5 seconds cache
  return cachedConfig;
}

function getClient(apiKey?: string): OpenAI {
  if (apiKey) return new OpenAI({ apiKey });
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY || '';
    if (!key) console.warn('OPENAI_API_KEY not configured – AI chat will not work');
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

function getOpenRouterClient(apiKey: string): OpenAI {
  if (!openRouterClient || openRouterClient.apiKey !== apiKey) {
    openRouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://smmtai.com',
        'X-Title': 'SmmtAI',
      }
    });
  }
  return openRouterClient;
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
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    apiKey?: string;
    openrouterApiKey?: string;
    openrouterDefault?: boolean;
    openrouterModel?: string;
  },
): Promise<string> {
  const chatConfig = await getChatConfig();
  const openrouterApiKey = options?.openrouterApiKey || chatConfig.openrouterApiKey;
  const openrouterDefault = options?.openrouterDefault !== undefined ? options.openrouterDefault : chatConfig.openrouterDefault;
  const openrouterModel = options?.openrouterModel || chatConfig.openrouterModel || 'google/gemini-2.5-flash';
  const apiKey = options?.apiKey || chatConfig.apiKey || process.env.OPENAI_API_KEY;

  const hasOpenRouter = typeof openrouterApiKey === 'string' && openrouterApiKey.trim().length > 10;
  const hasOpenAI = typeof apiKey === 'string' && apiKey.trim().length > 10;

  const callOpenAI = async (m: string) => {
    const client = getClient(apiKey);
    const response = await client.chat.completions.create({
      model: m,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 1000,
      stream: false,
    });
    return response.choices?.[0]?.message?.content || '';
  };

  const callOpenRouter = async (modelToUse = openrouterModel) => {
    const client = getOpenRouterClient(openrouterApiKey!);
    try {
      const response = await client.chat.completions.create({
        model: modelToUse,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens || 1000,
        stream: false,
      });
      return response.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      // Internal OpenRouter fallback
      const isDeepSeek = modelToUse.includes('deepseek');
      const isGemini = modelToUse.includes('gemini');
      let fallbackModel = '';
      if (isDeepSeek) {
        fallbackModel = 'google/gemini-2.5-flash';
      } else if (isGemini) {
        fallbackModel = 'meta-llama/llama-3.3-70b-instruct';
      } else {
        fallbackModel = 'google/gemini-2.5-flash';
      }
      
      if (fallbackModel && fallbackModel !== modelToUse) {
        console.warn(`[OpenRouter] Model ${modelToUse} failed: ${err.message}. Falling back to OpenRouter ${fallbackModel}`);
        try {
          const response = await client.chat.completions.create({
            model: fallbackModel,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens || 1000,
            stream: false,
          });
          return response.choices?.[0]?.message?.content || '';
        } catch (fallbackErr: any) {
          console.error(`[OpenRouter Fallback] Internal fallback to ${fallbackModel} failed: ${fallbackErr.message}`);
          throw err;
        }
      }
      throw err;
    }
  };

  const normalizedOpenAIModel = normalizeModel(options?.model || chatConfig.model || 'gpt-4o-mini');

  if (openrouterDefault && hasOpenRouter) {
    try {
      console.log(`[OpenRouter] Routing to primary model: ${openrouterModel}`);
      return await callOpenRouter();
    } catch (err: any) {
      console.warn(`[OpenRouter] Error: ${err.message}. Falling back to OpenAI if available.`);
      if (hasOpenAI) {
        try {
          return await callOpenAI(normalizedOpenAIModel);
        } catch (openaiErr: any) {
          console.error(`[OpenAI Fallback] Failed: ${openaiErr.message}`);
          throw err;
        }
      }
      throw err;
    }
  } else {
    try {
      return await callOpenAI(normalizedOpenAIModel);
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      const status = err?.status;
      const isApiIssue = status === 401 || status === 402 || status === 429 || msg.includes('credit') || msg.includes('revoked') || msg.includes('invalid api key') || msg.includes('quotalimit');

      if (isApiIssue && hasOpenRouter) {
        console.warn(`[OpenAI] Primary API issue (${status || msg}). Falling back to OpenRouter: ${openrouterModel}`);
        try {
          return await callOpenRouter();
        } catch (orErr: any) {
          console.error(`[OpenRouter Fallback] Failed: ${orErr.message}`);
          throw err;
        }
      }

      if (err.status === 404 && normalizedOpenAIModel !== 'gpt-4o-mini' && (err.code === 'model_not_found' || msg.includes('model'))) {
        console.warn(`[OpenAI] Model "${normalizedOpenAIModel}" unavailable; falling back to gpt-4o-mini`);
        try {
          return await callOpenAI('gpt-4o-mini');
        } catch (fallbackErr) {
          throw err;
        }
      }
      if (err.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
      if (err.status === 401) throw new Error('Invalid OpenAI API key');
      throw err;
    }
  }
}

export async function chatWithRetry(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    apiKey?: string;
    openrouterApiKey?: string;
    openrouterDefault?: boolean;
    openrouterModel?: string;
  },
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
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    apiKey?: string;
    openrouterApiKey?: string;
    openrouterDefault?: boolean;
    openrouterModel?: string;
  },
): Promise<string> {
  const chatConfig = await getChatConfig();
  const openrouterApiKey = options?.openrouterApiKey || chatConfig.openrouterApiKey;
  const openrouterDefault = options?.openrouterDefault !== undefined ? options.openrouterDefault : chatConfig.openrouterDefault;
  const openrouterModel = options?.openrouterModel || chatConfig.openrouterModel || 'google/gemini-2.5-flash';
  const apiKey = options?.apiKey || chatConfig.apiKey || process.env.OPENAI_API_KEY;

  const hasOpenRouter = typeof openrouterApiKey === 'string' && openrouterApiKey.trim().length > 10;
  const hasOpenAI = typeof apiKey === 'string' && apiKey.trim().length > 10;

  let useOpenRouter = openrouterDefault && hasOpenRouter;
  let openrouterFallbackActive = false;

  const getClientAndModel = () => {
    if (useOpenRouter) {
      let model = openrouterModel;
      if (openrouterFallbackActive) {
        const isDeepSeek = openrouterModel.includes('deepseek');
        const isGemini = openrouterModel.includes('gemini');
        if (isDeepSeek) {
          model = 'google/gemini-2.5-flash';
        } else if (isGemini) {
          model = 'meta-llama/llama-3.3-70b-instruct';
        } else {
          model = 'google/gemini-2.5-flash';
        }
      }
      return {
        client: getOpenRouterClient(openrouterApiKey!),
        model,
        isOR: true,
      };
    } else {
      return {
        client: getClient(apiKey),
        model: normalizeModel(options?.model || chatConfig.model || 'gpt-4o-mini'),
        isOR: false,
      };
    }
  };

  const msgs = [...messages];
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    try {
      const { client, model } = getClientAndModel();
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
      const status = error.status;
      const isApiIssue = status === 401 || status === 402 || status === 429 || msg.includes('credit') || msg.includes('revoked') || msg.includes('invalid api key') || msg.includes('quotalimit');

      if (useOpenRouter && !openrouterFallbackActive) {
        const isDeepSeek = openrouterModel.includes('deepseek');
        const isGemini = openrouterModel.includes('gemini');
        let fallbackModel = '';
        if (isDeepSeek) {
          fallbackModel = 'google/gemini-2.5-flash';
        } else if (isGemini) {
          fallbackModel = 'meta-llama/llama-3.3-70b-instruct';
        } else {
          fallbackModel = 'google/gemini-2.5-flash';
        }

        if (fallbackModel && fallbackModel !== openrouterModel) {
          console.warn(`[OpenRouter Tools] Primary model ${openrouterModel} failed (${status || msg}). Falling back to ${fallbackModel}`);
          openrouterFallbackActive = true;
          iterations--;
          continue;
        }
      }

      if (!useOpenRouter && isApiIssue && hasOpenRouter) {
        console.warn(`[OpenAI Tools] API issue (${status || msg}). Falling back to OpenRouter: ${openrouterModel}`);
        useOpenRouter = true;
        iterations--; // retry current iteration with OpenRouter
        continue;
      }

      if (useOpenRouter && !openrouterDefault && hasOpenAI) {
        console.warn(`[OpenRouter Tools] Fallback failed. Reverting to OpenAI.`);
        useOpenRouter = false;
        iterations--;
        continue;
      }

      if (error.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
      if (error.status === 401) throw new Error('Invalid API key');
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
