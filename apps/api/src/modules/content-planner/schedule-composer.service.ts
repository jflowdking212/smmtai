import { GeneratedPost } from './content-generator.service.js';
import { ParsedIntent } from './plan-parser.service.js';

export interface ScheduledPost extends GeneratedPost {
  scheduledAt: Date;
}

const PLATFORM_BEST_TIMES: Record<string, { start: number; end: number }> = {
  instagram: { start: 9, end: 12 },
  facebook: { start: 13, end: 16 },
  twitter: { start: 12, end: 15 },
  linkedin: { start: 8, end: 11 },
  tiktok: { start: 18, end: 21 },
  youtube: { start: 14, end: 17 },
  default: { start: 9, end: 17 }
};

export function composeSchedule(
  posts: GeneratedPost[],
  intent: ParsedIntent
): ScheduledPost[] {
  const scheduled: ScheduledPost[] = [];
  if (posts.length === 0) return scheduled;

  const startDate = new Date();
  if (startDate.getHours() >= 20) {
    // If it's late, start tomorrow
    startDate.setDate(startDate.getDate() + 1);
  }
  startDate.setHours(0, 0, 0, 0);

  // Track per-day per-platform slot to avoid time collisions
  // Key: `${dayOffset}-${platform}`, Value: next available hour
  const slotTracker: Record<string, number> = {};

  // Distribute posts round-robin across days
  let dayOffset = 0;

  for (const post of posts) {
    const platformKey = post.platform.toLowerCase();
    const timeWindow = PLATFORM_BEST_TIMES[platformKey] || PLATFORM_BEST_TIMES.default;

    // Honour user's preferred time window
    let baseHour = timeWindow.start;
    if (intent.preferredTime === 'morning') baseHour = 8;
    else if (intent.preferredTime === 'afternoon') baseHour = 14;
    else if (intent.preferredTime === 'evening') baseHour = 18;

    const slotKey = `${dayOffset}-${platformKey}`;
    if (!(slotKey in slotTracker)) {
      slotTracker[slotKey] = baseHour;
    }

    // Clamp to 22:00 max
    const hour = Math.min(slotTracker[slotKey], 22);
    // Advance slot by 2h for next post on same platform+day
    slotTracker[slotKey] = hour + 2;

    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(startDate.getDate() + dayOffset);
    scheduledDate.setHours(hour, 0, 0, 0);

    scheduled.push({ ...post, scheduledAt: scheduledDate });

    // Advance to next day, wrapping within durationDays
    dayOffset = (dayOffset + 1) % Math.max(1, intent.durationDays);
  }

  // Sort by scheduledAt
  scheduled.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return scheduled;
}
