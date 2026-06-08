import { chatCompletion } from '../../services/openai.service';
import { ParsedIntent } from './plan-parser.service';

export interface GeneratedPost {
  platform: string;
  contentBody: string;
  hashtags: string[];
  mediaSuggestion: string | null;
  characterCount: number;
}

export async function generateContentForPlatform(
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

export async function generateAllContent(
  intent: ParsedIntent
): Promise<GeneratedPost[]> {
  const posts: GeneratedPost[] = [];
  const platforms = intent.platforms;
  const postsPerPlatform = Math.max(1, Math.floor(intent.totalPosts / platforms.length));

  const promises: Promise<GeneratedPost | null>[] = [];
  let index = 1;
  
  for (const platform of platforms) {
    for (let i = 0; i < postsPerPlatform; i++) {
      promises.push(generateContentForPlatform(intent, platform, index, intent.totalPosts));
      index++;
    }
  }

  const results = await Promise.allSettled(promises);
  for (const res of results) {
    if (res.status === 'fulfilled' && res.value) {
      posts.push(res.value);
    }
  }

  return posts;
}
