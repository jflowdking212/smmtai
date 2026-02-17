import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError } from './errorHandler.js';
import { AuthRequest } from './auth.js';
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '@ee-postmind/shared';

type UsageMetric = 'posts' | 'ai_generations' | 'social_accounts';

export function checkUsage(metric: UsageMetric) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        throw new AppError('Workspace context required', 400, 'NO_WORKSPACE');
      }

      const subscription = await prisma.subscription.findUnique({
        where: { workspaceId: req.workspaceId },
      });

      if (!subscription) {
        throw new AppError('No subscription found', 403, 'NO_SUBSCRIPTION');
      }

      const tier = subscription.tier as SubscriptionTier;
      const limits = SUBSCRIPTION_LIMITS[tier];
      const limit = limits[metric === 'posts' ? 'postsPerMonth' : metric === 'ai_generations' ? 'aiGenerationsPerMonth' : 'socialAccounts'];

      // Unlimited
      if (limit === Infinity) return next();

      // Get current usage
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const usageRecord = await prisma.usageRecord.findUnique({
        where: {
          subscriptionId_metric_periodStart: {
            subscriptionId: subscription.id,
            metric,
            periodStart,
          },
        },
      });

      const currentUsage = usageRecord?.count || 0;

      if (currentUsage >= limit) {
        throw new AppError(
          `You've reached your ${metric.replace('_', ' ')} limit (${limit}). Upgrade your plan for more.`,
          403,
          'USAGE_LIMIT_REACHED',
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function incrementUsage(workspaceId: string, metric: UsageMetric): Promise<void> {
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!subscription) return;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  await prisma.usageRecord.upsert({
    where: {
      subscriptionId_metric_periodStart: {
        subscriptionId: subscription.id,
        metric,
        periodStart,
      },
    },
    create: {
      subscriptionId: subscription.id,
      metric,
      count: 1,
      periodStart,
      periodEnd,
    },
    update: { count: { increment: 1 } },
  });
}
