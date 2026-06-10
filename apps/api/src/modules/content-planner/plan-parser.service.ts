import { chatCompletion } from '../../services/openai.service.js';

export interface ParsedIntent {
  theme: string;
  tone: string;
  platforms: string[];
  frequency: string;
  preferredTime: string;
  durationDays: number;
  totalPosts: number;
  specialInstructions: string;
}

// Extract the first valid JSON object from a string (handles markdown fences etc.)
function extractJson(raw: string): any {
  // Remove markdown fences
  const stripped = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Try direct parse first
  try {
    return JSON.parse(stripped);
  } catch { /* continue */ }

  // Find first {...} block
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch { /* continue */ }
  }

  return null;
}

// Extract preferred posting time from free-form text
function extractTimeHint(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b(9\s*am|morning|9:00)\b/.test(lower)) return 'morning';
  if (/\b(12\s*(pm|noon)|midday|lunchtime)\b/.test(lower)) return 'midday';
  if (/\b(afternoon|2\s*pm|3\s*pm)\b/.test(lower)) return 'afternoon';
  if (/\b(evening|6\s*pm|7\s*pm|night)\b/.test(lower)) return 'evening';
  return 'optimal';
}

// Extract duration from free-form text
function extractDuration(prompt: string, fallback: number): number {
  const match = prompt.match(/\b(\d+)\s*day/i);
  if (match) return parseInt(match[1], 10);
  if (/\bweek\b/i.test(prompt)) return 7;
  if (/\bmonth\b/i.test(prompt)) return 30;
  return fallback;
}

// Map free-form platform mentions to available platform names
function extractPlatforms(prompt: string, available: string[]): string[] {
  const lower = prompt.toLowerCase();
  if (/\ball\s*(my)?\s*platforms?\b/i.test(lower) || /\beverywhere\b/i.test(lower)) {
    return available;
  }
  const found = available.filter(p => lower.includes(p.toLowerCase()));
  return found.length > 0 ? found : available;
}

export async function parseContentPlanIntent(
  userPrompt: string,
  availablePlatforms: string[],
  wizardTone: string = 'professional',
  wizardPlatforms: string[] = [],
  wizardDuration: number = 7
): Promise<{ success: boolean; data?: ParsedIntent; clarification?: string }> {
  const systemPrompt = `You are an AI assistant that extracts structured parameters for a social media content plan from user requests.
Available platforms: ${availablePlatforms.join(', ')}.

IMPORTANT: Always return success=true if the user has provided a topic or goal — even if some details are missing, use reasonable defaults.
Only return success=false if the prompt is completely empty or totally unrelated to social media content.

Return ONLY a raw JSON object (no markdown, no code fences, no extra text):
{
  "success": true,
  "data": {
    "theme": "string — core topic/campaign theme",
    "tone": "string — professional | casual | hype | educational | inspirational",
    "platforms": ["array of platform names from the available list"],
    "frequency": "string — daily | twice_daily | weekly | 3_times_week",
    "preferredTime": "string — morning | afternoon | evening | optimal",
    "durationDays": number,
    "totalPosts": number,
    "specialInstructions": "string — any extra constraints or notes"
  }
}

Rules:
- If user says \"all my platforms\" or \"all platforms\" or \"everywhere\" use ALL available platforms.
- If no duration is specified, default to ${wizardDuration} days.
- If no tone is specified, default to "${wizardTone}".
- totalPosts = durationDays × platforms.length (roughly).
- Extract posting time from phrases like \"every morning at 9am\" → preferredTime = \"morning\".`;

  try {
    const raw = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    const result = extractJson(raw);

    if (!result) {
      // JSON parsing fully failed — build a sensible fallback from the prompt itself
      console.warn('[ContentPlanner] JSON parse failed, using fallback extraction. Raw:', raw?.slice(0, 200));
      return buildFallback(userPrompt, availablePlatforms, wizardTone, wizardPlatforms, wizardDuration);
    }

    if (!result.success) {
      // AI decided it needs clarification — only honour this if prompt is genuinely empty
      if (userPrompt.trim().split(/\s+/).length < 3) {
        return { success: false, clarification: result.clarification || 'Please describe what kind of content you want to create and for how long.' };
      }
      // Otherwise AI is being over-cautious — use fallback
      console.warn('[ContentPlanner] AI returned success=false for non-empty prompt, using fallback.');
      return buildFallback(userPrompt, availablePlatforms, wizardTone, wizardPlatforms, wizardDuration);
    }

    // Fill in any missing data fields with sensible defaults
    const data = result.data || {};
    const platforms = (data.platforms?.length > 0 ? data.platforms : wizardPlatforms.length > 0 ? wizardPlatforms : availablePlatforms)
      .filter((p: string) => availablePlatforms.map(a => a.toLowerCase()).includes(p.toLowerCase()))
      .map((p: string) => availablePlatforms.find(a => a.toLowerCase() === p.toLowerCase()) || p);

    const finalPlatforms = platforms.length > 0 ? platforms : wizardPlatforms.length > 0 ? wizardPlatforms : availablePlatforms;
    const duration = data.durationDays || wizardDuration;

    return {
      success: true,
      data: {
        theme: data.theme || 'Content Campaign',
        tone: data.tone || wizardTone,
        platforms: finalPlatforms,
        frequency: data.frequency || 'daily',
        preferredTime: data.preferredTime || extractTimeHint(userPrompt),
        durationDays: duration,
        totalPosts: data.totalPosts || duration * finalPlatforms.length,
        specialInstructions: data.specialInstructions || '',
      }
    };
  } catch (error) {
    console.error('[ContentPlanner] Intent parse error:', error);
    return buildFallback(userPrompt, availablePlatforms, wizardTone, wizardPlatforms, wizardDuration);
  }
}

function buildFallback(
  userPrompt: string,
  availablePlatforms: string[],
  wizardTone: string,
  wizardPlatforms: string[],
  wizardDuration: number
): { success: boolean; data?: ParsedIntent; clarification?: string } {
  const platforms = extractPlatforms(userPrompt, wizardPlatforms.length > 0 ? wizardPlatforms : availablePlatforms);
  const duration = extractDuration(userPrompt, wizardDuration);
  const preferredTime = extractTimeHint(userPrompt);

  // Extract a basic theme from the first sentence
  const firstSentence = userPrompt.split(/[.!?]/)[0].trim();
  const theme = firstSentence.length > 5 ? firstSentence.slice(0, 120) : 'Content Campaign';

  const lower = userPrompt.toLowerCase();
  let tone = wizardTone;
  if (/\bprofessional\b/.test(lower)) tone = 'professional';
  else if (/\bcasual\b/.test(lower)) tone = 'casual';
  else if (/\beducation|educational\b/.test(lower)) tone = 'educational';
  else if (/\binspir/.test(lower)) tone = 'inspirational';

  // Pull specialInstructions from negative constraints
  const noPromo = /\bno\s+promo|no\s+promotional|no\s+sales|no\s+selling/i.test(userPrompt);
  const specialInstructions = [
    noPromo ? 'No promotional content.' : '',
    userPrompt.length > 50 ? userPrompt : ''
  ].filter(Boolean).join(' ').trim();

  return {
    success: true,
    data: {
      theme,
      tone,
      platforms,
      frequency: 'daily',
      preferredTime,
      durationDays: duration,
      totalPosts: duration * platforms.length,
      specialInstructions,
    }
  };
}
