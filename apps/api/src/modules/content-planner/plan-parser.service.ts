import { chatCompletion } from '../../services/openai.service';

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

export async function parseContentPlanIntent(
  userPrompt: string, 
  availablePlatforms: string[]
): Promise<{ success: boolean; data?: ParsedIntent; clarification?: string }> {
  const systemPrompt = `You are an AI assistant that extracts structured parameters for a social media content plan from user requests.
Available platforms: ${availablePlatforms.join(', ')}.

Your response MUST be valid JSON matching this schema:
{
  "success": boolean, // true if intent is clear, false if missing core parameters
  "clarification": string, // if success=false, ask a clarifying question
  "data": { // if success=true
    "theme": string, // core topic/theme
    "tone": string, // e.g., professional, casual, hype
    "platforms": string[], // map user words to available platforms
    "frequency": string, // e.g., daily, twice_daily, weekly, 3_times_week
    "preferredTime": string, // e.g., morning, afternoon, evening, optimal
    "durationDays": number, // number of days to schedule (default 7 if unspecified)
    "totalPosts": number, // estimated total posts across all platforms
    "specialInstructions": string // any specific requirements
  }
}
If the user says "all my platforms" or similar, include all available platforms.`;

  try {
    const resultJsonStr = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // Remove markdown formatting
    const cleaned = resultJsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);

    if (!result.success) {
      return { success: false, clarification: result.clarification || 'Could you provide more details about what you want to post?' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('[ContentPlanner] Intent parse error:', error);
    return { success: false, clarification: 'I had trouble understanding that. Could you describe your plan again?' };
  }
}
