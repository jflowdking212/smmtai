import { Router, Response, NextFunction, Request } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { stripeService } from '../services/stripe.service.js';
import { authService } from '../services/auth.service.js';
import { config } from '../config/index.js';
import { changePlanSchema, publicCheckoutSchema } from '../utils/validators.js';
import { getEffectiveLimits } from '../services/admin-settings.service.js';
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '@ee-postmind/shared';

export const billingRouter = Router();

// Public checkout (new user purchase flow)
billingRouter.post(
  '/checkout/public',
  validate(publicCheckoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, priceKey } = req.body as { name: string; email: string; priceKey: string };
      const provisioned = await authService.provisionCheckoutAccount({ name, email });
      const url = await stripeService.createCheckoutSession(
        provisioned.workspaceId,
        priceKey,
        `${config.frontend.url}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${config.frontend.url}/checkout?canceled=1&priceKey=${encodeURIComponent(priceKey)}`,
      );
      res.json({ success: true, data: { url } });
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

      const { tier, priceKey } = req.body as { tier?: string; priceKey?: string };
      const result = await stripeService.changePlan(
        req.workspaceId,
        { tier, priceKey },
        {
          checkoutSuccessUrl: `${config.frontend.url}/billing?success=true`,
          checkoutCancelUrl: `${config.frontend.url}/billing?canceled=true`,
        },
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

      const { priceKey } = req.body;
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
