import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import { schedulePost, cancelScheduledPost, getQueueStats } from '../jobs/scheduler.js';

export const scheduleRouter = Router();

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
  '/:postId/schedule',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { scheduledAt } = req.body;
      if (!scheduledAt) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_DATE', message: 'scheduledAt required' } });
      }

      const date = new Date(scheduledAt);
      if (date <= new Date()) {
        return res.status(400).json({ success: false, error: { code: 'PAST_DATE', message: 'Must schedule in the future' } });
      }

      await prisma.post.update({
        where: { id: req.params.postId as string },
        data: { scheduledAt: date },
      });

      const jobId = await schedulePost(req.params.postId as string, date);
      res.json({ success: true, data: { jobId, scheduledAt: date } });
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
      await cancelScheduledPost(req.params.postId as string);
      res.json({ success: true, data: { message: 'Schedule cancelled' } });
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
