import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError } from './errorHandler.js';
import { AuthRequest } from './auth.js';
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '@ee-postmind/shared';

type UsageMetric = 'posts' | 'ai_generations' | 'social_accounts';
type UsageAccessInput = {
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd: Date | null;
};

type UsageAccessDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

function parseGracePeriodDays(value: string | undefined): number {
  const parsed = Number.parseInt(value || '7', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 7;
}

const billingGracePeriodDays = parseGracePeriodDays(process.env.BILLING_GRACE_PERIOD_DAYS);

export function resolveUsageAccess(
  input: UsageAccessInput,
  now: Date = new Date(),
  gracePeriodDays: number = billingGracePeriodDays,
): UsageAccessDecision {
  if (input.tier === 'free') {
    return { allowed: true };
  }

  const status = input.status.trim().toLowerCase();
  if (status === 'active' || status === 'trialing') {
    return { allowed: true };
  }

  if (status === 'past_due') {
    if (!input.currentPeriodEnd) {
      return {
        allowed: false,
        code: 'BILLING_ACTION_REQUIRED',
        message: 'Your subscription payment is overdue. Update your billing method to continue.',
      };
    }

    const graceEndsAt = new Date(input.currentPeriodEnd);
    graceEndsAt.setDate(graceEndsAt.getDate() + Math.max(0, gracePeriodDays));
    if (now <= graceEndsAt) {
      return { allowed: true };
    }

    return {
      allowed: false,
      code: 'BILLING_GRACE_EXPIRED',
      message: 'Your billing grace period has ended. Update your payment method to continue.',
    };
  }

  return {
    allowed: false,
    code: 'SUBSCRIPTION_INACTIVE',
    message: 'Your subscription is inactive. Update billing to continue using paid features.',
  };
}

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
      const access = resolveUsageAccess({
        tier,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      });
      if (!access.allowed) {
        throw new AppError(access.message, 402, access.code);
      }

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
