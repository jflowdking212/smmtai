import { chatCompletion } from '../../services/openai.service.js';
import { ParsedIntent } from './plan-parser.service.js';

export interface GeneratedPost {
  platform: string;
  contentBody: string;
  hashtags: string[];
  mediaSuggestion: string | null;
  characterCount: number;
}

async function generateContentForPlatform(
  intent: ParsedIntent,
  platform: string,
  index: number,
  total: number
): Promise<GeneratedPost | null> {
  const prompt = `You are an expert social media manager creating a post for ${platform}.
This is post ${index} out of ${total} in a campaign.

Campaign Theme: ${intent.theme}
Tone: ${intent.tone}
Special Instructions: ${intent.specialInstructions || 'None'}

Generate the post content optimized specifically for ${platform} (e.g., use emojis if appropriate, respect platform norms and length limits).
Include relevant hashtags (at least 2, max 5).
Provide a brief media suggestion for an image or video that would pair well with this post.

Your response MUST be valid JSON matching this exact schema:
{
  "contentBody": "the post text",
  "hashtags": ["tag1", "tag2"],
  "mediaSuggestion": "description of image/video, or null"
}`;

  try {
    const resultJsonStr = await chatCompletion([
      { role: 'user', content: prompt }
    ]);

    const cleaned = resultJsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);

    return {
      platform,
      contentBody: result.contentBody,
      hashtags: Array.isArray(result.hashtags) ? result.hashtags.map((t: string) => t.replace('#', '')) : [],
      mediaSuggestion: result.mediaSuggestion || null,
      characterCount: result.contentBody.length
    };
  } catch (error) {
    console.error(`[ContentPlanner] Generator error for ${platform}:`, error);
    return null;
  }
}

/** Run promises in batches to avoid OpenAI rate-limit (429) on large plans */
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize = 4
): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn => fn()));
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : null);
    }
    // Small delay between batches to respect rate limits
    if (i + batchSize < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return results;
}

export async function generateAllContent(
  intent: ParsedIntent
): Promise<GeneratedPost[]> {
  const platforms = intent.platforms;
  const base = Math.max(1, Math.floor(intent.totalPosts / platforms.length));
  const remainder = intent.totalPosts % platforms.length;

  const tasks: (() => Promise<GeneratedPost | null>)[] = [];
  let index = 1;

  for (let pIdx = 0; pIdx < platforms.length; pIdx++) {
    const platform = platforms[pIdx];
    const count = base + (pIdx < remainder ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const capturedIndex = index;
      tasks.push(() => generateContentForPlatform(intent, platform, capturedIndex, intent.totalPosts));
      index++;
    }
  }

  const results = await runInBatches(tasks, 4);
  return results.filter((r): r is GeneratedPost => r !== null);
}
