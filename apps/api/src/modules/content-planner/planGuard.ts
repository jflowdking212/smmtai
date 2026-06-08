import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { AuthRequest } from '../../middleware/auth.js';

export interface ContentPlannerContext {
  stepLevel: number;
  maxStep: number;
  upgradeRequired: boolean;
  tier: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    contentPlanner?: ContentPlannerContext;
  }
}

/**
 * Middleware to gate access to the Content Planning Engine based on the user's subscription tier.
 * @param requiredStep The step required to access the route (1, 2, or 3)
 */
export function checkContentPlannerAccess(requiredStep: number) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Derive allowed step from subscription tier
      const subscription = await prisma.subscription.findUnique({
        where: { workspaceId },
        select: { tier: true }
      });
      const tier = subscription?.tier || 'basic';

      let allowedStep = 1;
      if (tier === 'enterprise') allowedStep = 3;
      else if (tier === 'business' || tier === 'pro') allowedStep = 2;
      else allowedStep = 1;

      const context: ContentPlannerContext = {
        stepLevel: requiredStep,
        maxStep: allowedStep,
        upgradeRequired: requiredStep > allowedStep,
        tier
      };

      req.contentPlanner = context;

      if (context.upgradeRequired) {
        return res.status(403).json({
          error: 'Upgrade required',
          context
        });
      }

      next();
    } catch (error) {
      console.error('[ContentPlanner] Guard error:', error);
      res.status(500).json({ error: 'Failed to verify content planner access' });
    }
  };
}
