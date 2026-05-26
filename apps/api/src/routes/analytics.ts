import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getEffectiveLimits } from '../services/admin-settings.service.js';
import { prisma } from '../config/database.js';
import { analyticsService } from '../services/analytics.service.js';
import { collectWorkspaceAnalytics } from '../jobs/scheduler.js';
import { cacheResponse } from '../middleware/cache.js';


async function getMaxAnalyticsDays(workspaceId: string): Promise<number> {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  const tier = (sub?.tier || 'basic') as import('@ee-postmind/shared').SubscriptionTier;
  const limits = await getEffectiveLimits(tier);
  return limits.analyticsDays === Infinity ? 36500 : limits.analyticsDays;
}

export const analyticsRouter = Router();

// Enqueue analytics refresh for current workspace
analyticsRouter.post(
  '/refresh',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const jobId = await collectWorkspaceAnalytics(req.workspaceId);
      res.json({ success: true, data: { jobId } });
    } catch (err) {
      next(err);
    }
  },
);

// Overview stats
analyticsRouter.get(
  '/overview',
  authenticate,
  cacheResponse({ ttl: 300, keyPrefix: 'analytics' }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const maxDays = await getMaxAnalyticsDays(req.workspaceId);
      const rawDays = req.query.days ? Number(req.query.days) : 30;
      const days = Math.min(rawDays, maxDays);
      const data = await analyticsService.getOverview(req.workspaceId, days);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// Per-platform analytics
analyticsRouter.get(
  '/platform/:platform',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const maxDays = await getMaxAnalyticsDays(req.workspaceId);
      const rawDays = req.query.days ? Number(req.query.days) : 30;
      const days = Math.min(rawDays, maxDays);
      const data = await analyticsService.getPlatformAnalytics(
        req.workspaceId, req.params.platform as string, days,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// Top posts
analyticsRouter.get(
  '/top-posts',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const data = await analyticsService.getTopPosts(req.workspaceId, limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

analyticsRouter.get(
  '/insights',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const maxDays = await getMaxAnalyticsDays(req.workspaceId);
      const rawDays = req.query.days ? Number(req.query.days) : 30;
      const days = Math.min(rawDays, maxDays);
      const data = await analyticsService.getInsights(req.workspaceId, days);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);
