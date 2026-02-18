import { Router, Response, NextFunction } from 'express';
import { isPlatformType, type PlatformType } from '@ee-postmind/shared';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import {
  schedulePost,
  scheduleRecurringPost,
  cancelScheduledPost,
  getQueueStats,
  pausePublishingQueue,
  resumePublishingQueue,
} from '../jobs/scheduler.js';

export const scheduleRouter = Router();
const recurrenceValues = new Set(['daily', 'weekly', 'monthly']);
const bulkScheduleLimit = 200;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8016';
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || 'dev-key';
const conflictWindowMinutes = (() => {
  const parsed = Number.parseInt(process.env.SCHEDULE_CONFLICT_WINDOW_MINUTES || '30', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
})();
const conflictWindowMs = conflictWindowMinutes * 60 * 1000;
const weekdayToIndex: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

type BulkScheduleRow = {
  row: number;
  postId: string;
  scheduledAt: string;
};

type BestTimeSuggestion = {
  day?: unknown;
  time?: unknown;
  score?: unknown;
  reason?: unknown;
};

function parseScore(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : 0;
  if (!Number.isFinite(parsed)) return 0;
  if (parsed > 1) return Math.min(parsed / 100, 1);
  if (parsed < 0) return 0;
  return parsed;
}

function parseClockTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function parseWeekday(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  return normalized in weekdayToIndex ? weekdayToIndex[normalized] : null;
}

function parseDatePartsInTimezone(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const weekday = (parts.weekday || 'Sun').slice(0, 3).toLowerCase();
  return {
    year: Number.parseInt(parts.year || '1970', 10),
    month: Number.parseInt(parts.month || '1', 10),
    day: Number.parseInt(parts.day || '1', 10),
    weekday: weekdayToIndex[weekday] ?? 0,
  };
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const asUtc = Date.UTC(
    Number.parseInt(parts.year || '1970', 10),
    Number.parseInt(parts.month || '1', 10) - 1,
    Number.parseInt(parts.day || '1', 10),
    Number.parseInt(parts.hour || '0', 10),
    Number.parseInt(parts.minute || '0', 10),
    Number.parseInt(parts.second || '0', 10),
  );

  return asUtc - date.getTime();
}

function createDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMs = getTimezoneOffsetMs(new Date(utcGuess), timezone);
  return new Date(utcGuess - offsetMs);
}

function getNextSuggestedDate(day: string, time: string, timezone: string): Date | null {
  const weekday = parseWeekday(day);
  const timeParts = parseClockTime(time);
  if (weekday === null || !timeParts) return null;

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  for (let offset = 0; offset < 21; offset += 1) {
    const probe = new Date(now.getTime() + offset * dayMs);
    const parts = parseDatePartsInTimezone(probe, timezone);
    if (parts.weekday !== weekday) continue;

    const candidate = createDateInTimezone(
      parts.year,
      parts.month,
      parts.day,
      timeParts.hour,
      timeParts.minute,
      timezone,
    );
    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  return null;
}

async function findScheduleConflict(
  workspaceId: string,
  scheduledAt: Date,
  excludedPostIds: string[] = [],
) {
  return prisma.post.findFirst({
    where: {
      workspaceId,
      status: 'scheduled',
      scheduledAt: {
        gte: new Date(scheduledAt.getTime() - conflictWindowMs),
        lte: new Date(scheduledAt.getTime() + conflictWindowMs),
      },
      ...(excludedPostIds.length > 0 ? { id: { notIn: excludedPostIds } } : {}),
    },
    select: { id: true, scheduledAt: true },
  });
}

async function fetchBestTimeSuggestions(
  platform: PlatformType,
  industry: string | undefined,
  timezone: string,
): Promise<BestTimeSuggestion[]> {
  const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai/best-times`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_SERVICE_KEY,
    },
    body: JSON.stringify({ platform, industry, timezone }),
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const message = typeof data === 'object' && data && 'detail' in data
      ? String((data as Record<string, unknown>).detail)
      : 'Could not fetch smart scheduling recommendations';
    throw new Error(message);
  }

  if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).times)) {
    return [];
  }
  return (data as Record<string, unknown>).times as BestTimeSuggestion[];
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseBulkScheduleRows(csvContent: string): BulkScheduleRow[] {
  const lines = csvContent
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const firstLine = parseCsvLine(lines[0]);
  const firstHeader = (firstLine[0] || '').toLowerCase().replace(/[_\s]/g, '');
  const secondHeader = (firstLine[1] || '').toLowerCase().replace(/[_\s]/g, '');
  const startsFrom = firstHeader === 'postid' && secondHeader === 'scheduledat' ? 1 : 0;

  const rows: BulkScheduleRow[] = [];
  for (let i = startsFrom; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i]);
    rows.push({
      row: i + 1,
      postId: (fields[0] || '').trim(),
      scheduledAt: (fields[1] || '').trim(),
    });
  }

  return rows;
}

// Get calendar view data (posts grouped by date)
scheduleRouter.get(
  '/calendar',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const { start, end } = req.query;
      const startDate = start ? new Date(start as string) : new Date();
      const endDate = end ? new Date(end as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const posts = await prisma.post.findMany({
        where: {
          workspaceId: req.workspaceId,
          OR: [
            { scheduledAt: { gte: startDate, lte: endDate } },
            { publishedAt: { gte: startDate, lte: endDate } },
          ],
        },
        include: {
          platformPosts: {
            select: { platform: true, status: true },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      res.json({ success: true, data: posts });
    } catch (err) {
      next(err);
    }
  },
);

// Schedule a post
scheduleRouter.post(
  '/bulk',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const { csv, entries } = req.body as {
        csv?: string;
        entries?: Array<{ postId?: string; scheduledAt?: string }>;
      };

      const rows = Array.isArray(entries) && entries.length > 0
        ? entries.map((entry, index) => ({
          row: index + 1,
          postId: (entry.postId || '').trim(),
          scheduledAt: (entry.scheduledAt || '').trim(),
        }))
        : typeof csv === 'string'
          ? parseBulkScheduleRows(csv)
          : [];

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_BULK_INPUT', message: 'Provide CSV content or entries with postId and scheduledAt' },
        });
      }
      if (rows.length > bulkScheduleLimit) {
        return res.status(400).json({
          success: false,
          error: { code: 'BULK_LIMIT_EXCEEDED', message: `Maximum ${bulkScheduleLimit} rows per import` },
        });
      }

      const postIds = Array.from(new Set(rows.map((row) => row.postId).filter(Boolean)));
      const posts = await prisma.post.findMany({
        where: {
          workspaceId: req.workspaceId,
          id: { in: postIds },
        },
        select: { id: true, status: true },
      });
      const workspacePostIds = new Map(posts.map((post) => [post.id, post.status]));

      const now = Date.now();
      const results: Array<{ row: number; postId: string; jobId: string; scheduledAt: string }> = [];
      const errors: Array<{ row: number; postId: string; code: string; message: string }> = [];
      const scheduledInBatch: Array<{ postId: string; scheduledAt: Date }> = [];

      for (const row of rows) {
        if (!row.postId || !row.scheduledAt) {
          errors.push({
            row: row.row,
            postId: row.postId,
            code: 'INVALID_ROW',
            message: 'Each row requires postId and scheduledAt',
          });
          continue;
        }

        const date = new Date(row.scheduledAt);
        if (Number.isNaN(date.getTime())) {
          errors.push({
            row: row.row,
            postId: row.postId,
            code: 'INVALID_DATE',
            message: 'scheduledAt must be a valid datetime',
          });
          continue;
        }
        if (date.getTime() <= now) {
          errors.push({
            row: row.row,
            postId: row.postId,
            code: 'PAST_DATE',
            message: 'Must schedule in the future',
          });
          continue;
        }
        if (!workspacePostIds.has(row.postId)) {
          errors.push({
            row: row.row,
            postId: row.postId,
            code: 'POST_NOT_FOUND',
            message: 'Post not found',
          });
          continue;
        }
        const postStatus = workspacePostIds.get(row.postId);
        if (postStatus === 'pending_approval') {
          errors.push({
            row: row.row,
            postId: row.postId,
            code: 'APPROVAL_REQUIRED',
            message: 'Post must be approved before scheduling',
          });
          continue;
        }
        if (postStatus === 'rejected') {
          errors.push({
            row: row.row,
            postId: row.postId,
            code: 'POST_REJECTED',
            message: 'Rejected posts cannot be scheduled',
          });
          continue;
        }

        const existingConflict = await findScheduleConflict(req.workspaceId, date, [row.postId]);
        const batchConflict = scheduledInBatch.find((scheduledRow) => (
          scheduledRow.postId !== row.postId
          && Math.abs(scheduledRow.scheduledAt.getTime() - date.getTime()) < conflictWindowMs
        ));
        if (existingConflict || batchConflict) {
          const conflictingPostId = existingConflict?.id || batchConflict?.postId || '';
          errors.push({
            row: row.row,
            postId: row.postId,
            code: 'SCHEDULE_CONFLICT',
            message: `Conflicts with ${conflictingPostId} inside ${conflictWindowMinutes}-minute window`,
          });
          continue;
        }

        try {
          const jobId = await schedulePost(row.postId, date);
          scheduledInBatch.push({ postId: row.postId, scheduledAt: date });
          results.push({
            row: row.row,
            postId: row.postId,
            jobId,
            scheduledAt: date.toISOString(),
          });
        } catch (error) {
          errors.push({
            row: row.row,
            postId: row.postId,
            code: 'SCHEDULE_FAILED',
            message: error instanceof Error ? error.message : 'Could not schedule post',
          });
        }
      }

      res.json({
        success: true,
        data: {
          total: rows.length,
          scheduled: results.length,
          failed: errors.length,
          results,
          errors,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

scheduleRouter.post(
  '/recommendations',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const { platform, industry, timezone, limit } = req.body as {
        platform?: string;
        industry?: string;
        timezone?: string;
        limit?: number;
      };
      if (!platform || !isPlatformType(platform)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PLATFORM', message: 'platform is required and must be a valid platform' },
        });
      }

      const requestedLimit = typeof limit === 'number' ? limit : Number.parseInt(String(limit || ''), 10);
      const resolvedLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 14)
        : 7;
      const resolvedTimezone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'UTC';
      try {
        Intl.DateTimeFormat('en-US', { timeZone: resolvedTimezone }).format(new Date());
      } catch {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIMEZONE', message: 'timezone must be a valid IANA timezone' },
        });
      }

      const suggestions = await fetchBestTimeSuggestions(
        platform,
        typeof industry === 'string' && industry.trim() ? industry.trim() : undefined,
        resolvedTimezone,
      );

      const recommendations: Array<{ day: string; time: string; score: number; reason?: string; scheduledAt: string }> = [];
      const conflicts: Array<{
        day: string;
        time: string;
        score: number;
        reason?: string;
        scheduledAt: string;
        conflictPostId: string;
        conflictScheduledAt: string | null;
      }> = [];
      for (const suggestion of suggestions) {
        if (recommendations.length >= resolvedLimit) break;
        if (typeof suggestion.day !== 'string' || typeof suggestion.time !== 'string') continue;

        const scheduledAtDate = getNextSuggestedDate(suggestion.day, suggestion.time, resolvedTimezone);
        if (!scheduledAtDate) continue;

        const recommendation = {
          day: suggestion.day,
          time: suggestion.time,
          score: parseScore(suggestion.score),
          reason: typeof suggestion.reason === 'string' ? suggestion.reason : undefined,
          scheduledAt: scheduledAtDate.toISOString(),
        };
        const conflict = await findScheduleConflict(req.workspaceId, scheduledAtDate);
        if (conflict) {
          conflicts.push({
            ...recommendation,
            conflictPostId: conflict.id,
            conflictScheduledAt: conflict.scheduledAt ? conflict.scheduledAt.toISOString() : null,
          });
          continue;
        }

        recommendations.push(recommendation);
      }

      res.json({
        success: true,
        data: {
          platform,
          timezone: resolvedTimezone,
          limit: resolvedLimit,
          conflictWindowMinutes,
          recommendations,
          conflicts,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

scheduleRouter.post(
  '/:postId/schedule',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const { scheduledAt } = req.body;
      if (!scheduledAt) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_DATE', message: 'scheduledAt required' } });
      }

      const date = new Date(scheduledAt);
      if (date <= new Date()) {
        return res.status(400).json({ success: false, error: { code: 'PAST_DATE', message: 'Must schedule in the future' } });
      }

      const post = await prisma.post.findFirst({
        where: { id: req.params.postId as string, workspaceId: req.workspaceId },
      });
      if (!post) {
        return res.status(404).json({ success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found' } });
      }
      if (post.status === 'pending_approval') {
        return res.status(409).json({
          success: false,
          error: { code: 'APPROVAL_REQUIRED', message: 'Post must be approved before scheduling' },
        });
      }
      if (post.status === 'rejected') {
        return res.status(409).json({
          success: false,
          error: { code: 'POST_REJECTED', message: 'Rejected posts cannot be scheduled' },
        });
      }
      const conflict = await findScheduleConflict(req.workspaceId, date, [post.id]);
      if (conflict) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'SCHEDULE_CONFLICT',
            message: `Conflicts with ${conflict.id} inside ${conflictWindowMinutes}-minute window`,
          },
        });
      }

      const jobId = await schedulePost(req.params.postId as string, date);
      res.json({ success: true, data: { jobId, scheduledAt: date } });
    } catch (err) {
      next(err);
    }
  },
);

// Schedule recurring post
scheduleRouter.post(
  '/:postId/recurring',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const { startsAt, recurrence, timezone } = req.body as {
        startsAt?: string;
        recurrence?: string;
        timezone?: string;
      };
      if (!startsAt || !recurrence) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_RECURRING_INPUT', message: 'startsAt and recurrence are required' },
        });
      }
      if (!recurrenceValues.has(recurrence)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_RECURRENCE', message: 'recurrence must be daily, weekly, or monthly' },
        });
      }

      const startDate = new Date(startsAt);
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE', message: 'startsAt must be a valid datetime' },
        });
      }

      const post = await prisma.post.findFirst({
        where: { id: req.params.postId as string, workspaceId: req.workspaceId },
      });
      if (!post) {
        return res.status(404).json({ success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found' } });
      }

      const resolvedTimezone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'UTC';
      try {
        Intl.DateTimeFormat('en-US', { timeZone: resolvedTimezone }).format(startDate);
      } catch {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIMEZONE', message: 'timezone must be a valid IANA timezone' },
        });
      }

      const result = await scheduleRecurringPost(req.params.postId as string, {
        startsAt: startDate,
        recurrence: recurrence as 'daily' | 'weekly' | 'monthly',
        timezone: resolvedTimezone,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Cancel scheduled post
scheduleRouter.delete(
  '/:postId/schedule',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const post = await prisma.post.findFirst({
        where: { id: req.params.postId as string, workspaceId: req.workspaceId },
      });
      if (!post) {
        return res.status(404).json({ success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found' } });
      }
      await cancelScheduledPost(req.params.postId as string);
      res.json({ success: true, data: { message: 'Schedule cancelled' } });
    } catch (err) {
      next(err);
    }
  },
);

scheduleRouter.post(
  '/queue/pause',
  authenticate,
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await pausePublishingQueue();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

scheduleRouter.post(
  '/queue/resume',
  authenticate,
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await resumePublishingQueue();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// Queue stats (admin)
scheduleRouter.get(
  '/stats',
  authenticate,
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await getQueueStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  },
);
