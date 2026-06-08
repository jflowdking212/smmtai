import { GeneratedPost } from './content-generator.service';
import { ParsedIntent } from './plan-parser.service';

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

  // We have N posts to distribute over M days.
  const startDate = new Date();
  if (startDate.getHours() >= 20) {
    // If it's late, start tomorrow
    startDate.setDate(startDate.getDate() + 1);
  }

  // To distribute evenly, we round-robin across days.
  // Then within a day, we space posts by 2 hours.
  let currentDayOffset = 0;
  
  // Keep track of how many posts are assigned to each day to space them out
  const dayPostCounts: Record<number, number> = {};

  for (const post of posts) {
    if (!dayPostCounts[currentDayOffset]) {
      dayPostCounts[currentDayOffset] = 0;
    }

    const platformKey = post.platform.toLowerCase();
    const timeWindow = PLATFORM_BEST_TIMES[platformKey] || PLATFORM_BEST_TIMES.default;
    
    // Spread posts starting from the optimal start time, spaced by 2 hours
    const postCountForDay = dayPostCounts[currentDayOffset];
    const hour = Math.min(timeWindow.start + (postCountForDay * 2), 22);

    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(startDate.getDate() + currentDayOffset);
    scheduledDate.setHours(hour, 0, 0, 0);

    if (intent.preferredTime === 'morning') {
      scheduledDate.setHours(Math.min(9 + (postCountForDay * 2), 11), 0, 0, 0);
    } else if (intent.preferredTime === 'afternoon') {
      scheduledDate.setHours(Math.min(14 + (postCountForDay * 2), 17), 0, 0, 0);
    } else if (intent.preferredTime === 'evening') {
      scheduledDate.setHours(Math.min(18 + (postCountForDay * 2), 22), 0, 0, 0);
    }

    scheduled.push({
      ...post,
      scheduledAt: scheduledDate
    });

    dayPostCounts[currentDayOffset]++;
    currentDayOffset = (currentDayOffset + 1) % intent.durationDays;
  }

  // Sort by scheduledAt
  scheduled.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return scheduled;
}
