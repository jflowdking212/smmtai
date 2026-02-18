import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { analyticsService } from '../services/analytics.service.js';
import { collectWorkspaceAnalytics } from '../jobs/scheduler.js';

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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const days = req.query.days ? Number(req.query.days) : 30;
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
      const days = req.query.days ? Number(req.query.days) : 30;
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
      const days = req.query.days ? Number(req.query.days) : 30;
      const data = await analyticsService.getInsights(req.workspaceId, days);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);
