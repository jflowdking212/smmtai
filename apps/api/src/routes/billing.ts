import { Router, Response, NextFunction, Request } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { stripeService } from '../services/stripe.service.js';
import { authService } from '../services/auth.service.js';
import { config } from '../config/index.js';
import { changePlanSchema, publicCheckoutSchema } from '../utils/validators.js';
import { getEffectiveLimits } from '../services/admin-settings.service.js';
import { couponService } from '../services/coupon.service.js';
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '@ee-postmind/shared';

export const billingRouter = Router();

// Public coupon preview (for link-based checkout UX)
billingRouter.get(
  '/coupons/:code',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawCode = req.params.code;
      const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode || '').trim();
      const priceKey = typeof req.query.priceKey === 'string' ? req.query.priceKey : undefined;
      const data = await couponService.previewCoupon(code, priceKey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// Public checkout (new user purchase flow)
billingRouter.post(
  '/checkout/public',
  validate(publicCheckoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, priceKey, couponCode } = req.body as {
        name: string;
        email: string;
        priceKey: string;
        couponCode?: string;
      };
      const provisioned = await authService.provisionCheckoutAccount({ name, email });
      const cancelParams = new URLSearchParams({
        canceled: '1',
        priceKey,
      });
      if (couponCode?.trim()) {
        cancelParams.set('coupon', couponCode.trim());
      }
      const url = await stripeService.createCheckoutSession(
        provisioned.workspaceId,
        priceKey,
        `${config.frontend.url}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${config.frontend.url}/checkout?${cancelParams.toString()}`,
        {
          userId: provisioned.user.id,
          couponCode: couponCode?.trim() || undefined,
        },
      );
      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  },
);

// Get checkout session details (amount and currency for tracking/analytics)
billingRouter.get(
  '/checkout/session/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawSessionId = req.params.sessionId;
      const sessionId = (Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId || '').trim();
      const data = await stripeService.getCheckoutSession(sessionId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// Get subscription status
billingRouter.get(
  '/status',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_WORKSPACE', message: 'Workspace context required' },
        });
      }
      const status = await stripeService.getSubscriptionStatus(req.workspaceId);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  },
);

// Get effective plan limits (admin-configurable)
billingRouter.get(
  '/limits',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.json({ success: true, data: SUBSCRIPTION_LIMITS.basic });
      }
      const { prisma } = await import('../config/database.js');
      const sub = await prisma.subscription.findUnique({ where: { workspaceId: req.workspaceId } });
      const tier = (sub?.tier || 'basic') as SubscriptionTier;
      const limits = await getEffectiveLimits(tier);
      res.json({ success: true, data: limits });
    } catch (err) {
      next(err);
    }
  },
);

// Change subscription plan (upgrade/downgrade)
billingRouter.post(
  '/change-plan',
  authenticate,
  validate(changePlanSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_WORKSPACE', message: 'Workspace context required' },
        });
      }

      const { tier, priceKey, couponCode } = req.body as { tier?: string; priceKey?: string; couponCode?: string };
      const result = await stripeService.changePlan(
        req.workspaceId,
        { tier, priceKey, couponCode: couponCode?.trim() || undefined },
        {
          checkoutSuccessUrl: `${config.frontend.url}/billing?success=true`,
          checkoutCancelUrl: `${config.frontend.url}/billing?canceled=true`,
        },
        req.userId,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Create checkout session (upgrade)
billingRouter.post(
  '/checkout',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_WORKSPACE', message: 'Workspace context required' },
        });
      }

      const { priceKey, couponCode } = req.body as { priceKey?: string; couponCode?: string };
      if (!priceKey) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PRICE', message: 'Price key is required' },
        });
      }

      const url = await stripeService.createCheckoutSession(
        req.workspaceId,
        priceKey,
        `${config.frontend.url}/billing?success=true`,
        `${config.frontend.url}/billing?canceled=true`,
        {
          userId: req.userId,
          couponCode: couponCode?.trim() || undefined,
        },
      );

      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  },
);

// Create customer portal session
billingRouter.post(
  '/portal',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_WORKSPACE', message: 'Workspace context required' },
        });
      }

      const url = await stripeService.createPortalSession(
        req.workspaceId,
        `${config.frontend.url}/billing`,
      );

      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  },
);


// Activate free trial (no credit card, no Stripe)
billingRouter.post(
  '/trial/activate',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const { prisma } = await import('../config/database.js');
      const sub = await prisma.subscription.findUnique({
        where: { workspaceId: req.workspaceId },
        include: {
          workspace: {
            include: {
              owner: { select: { email: true, name: true } }
            }
          }
        }
      });
      if (!sub) return res.status(404).json({ success: false, error: { code: 'NO_SUBSCRIPTION', message: 'Subscription not found' } });
      if (sub.trialEndsAt) return res.status(409).json({ success: false, error: { code: 'TRIAL_ALREADY_USED', message: 'A free trial has already been used on this account' } });
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
      await prisma.subscription.update({ where: { workspaceId: req.workspaceId }, data: { tier: 'pro', status: 'trialing', trialEndsAt } });
      try {
        const user = sub.workspace?.owner;
        if (user?.email) {
          const { emailService } = await import('../services/email.service.js');
          await emailService.sendTrialActivated(user.email, user.name || 'there', trialEndsAt);
        }
      } catch (e) { console.error('[trial/activate] Email failed:', e); }
      return res.json({ success: true, data: { trialEndsAt, daysLeft: 14 } });
    } catch (err) { return next(err); }
  },
);

// Check if trial is available for this account
billingRouter.get(
  '/trial/status',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) return res.json({ success: true, data: { available: false } });
      const { prisma } = await import('../config/database.js');
      const sub = await prisma.subscription.findUnique({ where: { workspaceId: req.workspaceId } });
      const available = !sub?.trialEndsAt;
      const isTrialing = sub?.status === 'trialing';
      const trialEndsAt = sub?.trialEndsAt || null;
      const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)) : 0;
      return res.json({ success: true, data: { available, isTrialing, trialEndsAt, daysLeft } });
    } catch (err) { return next(err); }
  },
);

// Stripe webhook (raw body required)
billingRouter.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      // Express raw body via middleware configured in index.ts
      await stripeService.handleWebhookEvent(req.body, signature);
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
);
