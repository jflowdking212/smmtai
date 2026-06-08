import { Request, Response, NextFunction } from 'express';
import { prisma } from '@ee-postmind/db';
import { getEffectiveLimits } from '../../services/admin-settings.service';

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
 * Middleware to gate access to the Content Planning Engine based on the user's plan.
 * @param requiredStep The step required to access the route (1, 2, or 3)
 */
export function checkContentPlannerAccess(requiredStep: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.user?.workspaceId;
      if (!workspaceId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limits = await getEffectiveLimits(workspaceId);
      
      // Determine what step they have access to based on feature flags
      let allowedStep = 0;
      if (limits.features?.contentPlannerStep3) allowedStep = 3;
      else if (limits.features?.contentPlannerStep2) allowedStep = 2;
      else if (limits.features?.contentPlannerStep1) allowedStep = 1;

      // Ensure base subscription details are passed
      const subscription = await prisma.subscription.findUnique({
        where: { workspaceId },
        select: { tier: true }
      });
      const tier = subscription?.tier || 'basic';

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
