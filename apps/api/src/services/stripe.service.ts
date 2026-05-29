import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { emailService } from './email.service.js';
import { couponService } from './coupon.service.js';
import { getPlanConfig } from './admin-settings.service.js';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!config.stripe.secretKey) {
      throw new AppError('Stripe is not configured. Set STRIPE_SECRET_KEY in .env', 503, 'STRIPE_NOT_CONFIGURED');
    }
    _stripe = new Stripe(config.stripe.secretKey);
  }
  return _stripe;
}

// Price IDs — set these in .env after creating products in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  basic_monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
  basic_quarterly: process.env.STRIPE_PRICE_BASIC_QUARTERLY || '',
  basic_6month: process.env.STRIPE_PRICE_BASIC_6MONTH || '',
  basic_yearly: process.env.STRIPE_PRICE_BASIC_YEARLY || '',
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  pro_quarterly: process.env.STRIPE_PRICE_PRO_QUARTERLY || '',
  pro_6month: process.env.STRIPE_PRICE_PRO_6MONTH || '',
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
  business_quarterly: process.env.STRIPE_PRICE_BUSINESS_QUARTERLY || '',
  business_6month: process.env.STRIPE_PRICE_BUSINESS_6MONTH || '',
  business_yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || '',
  enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
  enterprise_quarterly: process.env.STRIPE_PRICE_ENTERPRISE_QUARTERLY || '',
  enterprise_6month: process.env.STRIPE_PRICE_ENTERPRISE_6MONTH || '',
  enterprise_yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '',
};

// Billing period config for dynamic pricing fallback
const PERIOD_CONFIG: Record<string, { months: number; discount: number; interval: 'month' | 'year'; intervalCount: number }> = {
  monthly:   { months: 1,  discount: 0,  interval: 'month', intervalCount: 1 },
  quarterly: { months: 3,  discount: 5,  interval: 'month', intervalCount: 3 },
  '6month':  { months: 6,  discount: 15, interval: 'month', intervalCount: 6 },
  yearly:    { months: 12, discount: 30, interval: 'year',  intervalCount: 1 },
};

const TIER_FROM_PRICE: Record<string, string> = {};
// Build reverse mapping at startup
Object.entries(PRICE_IDS).forEach(([key, priceId]) => {
  if (priceId) {
    const tier = key.split('_')[0]; // pro, business, enterprise
    TIER_FROM_PRICE[priceId] = tier;
  }
});

export class StripeService {
  // Build Stripe line item: uses pre-created price IDs if configured,
  // otherwise falls back to price_data using plan_config pricing.
  private async buildLineItem(priceKey: string): Promise<import('stripe').Stripe.Checkout.SessionCreateParams.LineItem> {
    const staticPriceId = PRICE_IDS[priceKey];
    if (staticPriceId) return { price: staticPriceId, quantity: 1 };

    // Dynamic fallback: parse {tier}_{period}
    const parts = priceKey.split('_');
    const period = parts.length >= 2 ? parts[parts.length - 1] : 'monthly';
    const tier = parts.slice(0, parts.length >= 2 ? -1 : undefined).join('_');

    const periodCfg = PERIOD_CONFIG[period];
    if (!periodCfg) throw new AppError(`Invalid billing period: ${period}`, 400, 'INVALID_PRICE');

    const planConfig = await getPlanConfig();
    const monthlyPrice: number = planConfig?.[tier]?.monthlyPrice ?? planConfig?.pricing?.[tier]?.monthlyPrice ?? 0;
    if (!monthlyPrice || monthlyPrice <= 0) {
      throw new AppError(`No pricing configured for plan: ${tier}`, 400, 'INVALID_PRICE');
    }

    const discountedMonthly = monthlyPrice * (1 - periodCfg.discount / 100);
    const totalCents = Math.round(discountedMonthly * periodCfg.months * 100);
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const periodLabel = period === '6month' ? '6-Month' : period.charAt(0).toUpperCase() + period.slice(1);

    return {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: totalCents,
        recurring: { interval: periodCfg.interval, interval_count: periodCfg.intervalCount },
        product_data: {
          name: `SmmtAI ${tierLabel} Plan — ${periodLabel} Billing`,
          description: `${tierLabel} plan with ${periodCfg.discount > 0 ? `${periodCfg.discount}% discount` : 'no discount'} on ${periodLabel.toLowerCase()} billing`,
        },
      },
    };
  }


  // Create or retrieve Stripe customer for a workspace
  async getOrCreateCustomer(workspaceId: string): Promise<string> {
    const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
    if (!subscription) throw new AppError('Subscription not found', 404, 'SUB_NOT_FOUND');

    if (subscription.stripeCustomerId) return subscription.stripeCustomerId;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { owner: { select: { email: true, name: true } } },
    });

    if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');

    const customer = await getStripe().customers.create({
      email: workspace.owner.email,
      name: workspace.name,
      metadata: { workspaceId, ownerId: workspace.ownerId },
    });

    await prisma.subscription.update({
      where: { workspaceId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  // Create checkout session for new (unauthenticated) users.
  // Does NOT create any DB records. Account is provisioned in the webhook.
  async createPublicCheckoutSession(options: {
    name: string;
    email: string;
    priceKey: string;
    couponCode?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const { name, email, priceKey, couponCode, successUrl, cancelUrl } = options;
    const derivedTier = priceKey.split('_')[0] || 'basic';
    // Trial only applies when no discount coupon is used — can't stack 60% off + free trial
    let trialPeriodDays = 0; // Free trials are DB-based, not handled in Stripe checkout

    // Create a transient Stripe customer (no DB workspace yet)
    const customer = await getStripe().customers.create({
      email,
      name,
      metadata: { pendingCheckout: 'true' },
    });

    let stripeCouponId: string | undefined;
    let discountPercent: number | null = null;
    let discountDurationMonths: number | null = null;
    let requireCardForFreeCheckout = true;

    // Validate coupon code (no DB reservation yet — will be finalized in webhook)
    if (couponCode) {
      try {
        const couponRow = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
        if (couponRow && couponRow.isActive) {
          discountPercent = couponRow.discountPercent;
          discountDurationMonths = couponRow.discountDurationMonths;
          requireCardForFreeCheckout = couponRow.requireCardForFreeCheckout;
          if (couponRow.freeDurationDays) trialPeriodDays = couponRow.freeDurationDays;
          else trialPeriodDays = 0; // coupon present but no explicit free days — no trial
        }
      } catch { /* ignore coupon errors — proceed without discount */ }
    }

    if (discountPercent && discountPercent > 0) {
      const stripeCoupon = await getStripe().coupons.create({
        duration: discountDurationMonths && discountDurationMonths > 0 ? 'repeating' : 'forever',
        duration_in_months: discountDurationMonths && discountDurationMonths > 0 ? discountDurationMonths : undefined,
        percent_off: discountPercent,
        name: couponCode ? `SmmtAI ${couponCode}` : 'SmmtAI Discount',
        metadata: { pendingEmail: email, couponCode: couponCode || '' },
      });
      stripeCouponId = stripeCoupon.id;
    }

    const lineItem = await this.buildLineItem(priceKey);
    const freeAtCheckout = (trialPeriodDays > 0) || ((discountPercent ?? 0) >= 100);
    const paymentMethodCollection: 'always' | 'if_required' =
      (!requireCardForFreeCheckout && freeAtCheckout) ? 'if_required' : 'always';

    const session = await getStripe().checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_collection: paymentMethodCollection,
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: successUrl,
      cancel_url: cancelUrl,
      discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
      subscription_data: {
        trial_period_days: trialPeriodDays > 0 ? trialPeriodDays : undefined,
        metadata: {
          pendingName: name,
          pendingEmail: email,
          tier: derivedTier,
          priceKey,
          ...(couponCode ? { couponCode } : {}),
        },
      },
      metadata: {
        pendingName: name,
        pendingEmail: email,
        tier: derivedTier,
        priceKey,
        ...(couponCode ? { couponCode } : {}),
      },
      allow_promotion_codes: stripeCouponId ? undefined : true,
    });

    return session.url!;
  }

  // Create checkout session for upgrading
  async createCheckoutSession(
    workspaceId: string,
    priceKey: string,
    successUrl: string,
    cancelUrl: string,
    options?: {
      userId?: string;
      couponCode?: string;
    },
  ): Promise<string> {
    const customerId = await this.getOrCreateCustomer(workspaceId);
    const lineItem = await this.buildLineItem(priceKey);
    // Derive tier from priceKey for metadata (e.g. 'pro_monthly' -> 'pro')
    const derivedTier = priceKey.split('_')[0] || 'basic';
    let couponRedemptionId: string | undefined;
    let couponCode: string | undefined;
    let discountPercent: number | null = null;
    let discountDurationMonths: number | null = null;
    let requireCardForFreeCheckout = true;
    // Trial only when no discount coupon is applied
    let trialPeriodDays = 0; // Free trials are DB-based, not handled in Stripe checkout

    if (options?.couponCode) {
      if (!options.userId) {
        throw new AppError('Authenticated user context is required for coupon redemption', 400, 'COUPON_USER_REQUIRED');
      }
      const reservation = await couponService.reserveForCheckout({
        code: options.couponCode,
        userId: options.userId,
        workspaceId,
        priceKey,
      });
      couponRedemptionId = reservation.redemptionId;
      couponCode = reservation.code;
      discountPercent = reservation.discountPercent;
      discountDurationMonths = reservation.discountDurationMonths;
      requireCardForFreeCheckout = reservation.requireCardForFreeCheckout;
      trialPeriodDays = reservation.freeDurationDays ?? 0; // coupon = no trial unless explicitly configured
    }

    try {
      let stripeCouponId: string | undefined;
      if (discountPercent && discountPercent > 0) {
        const stripeCoupon = await getStripe().coupons.create({
          duration: discountDurationMonths && discountDurationMonths > 0 ? 'repeating' : 'forever',
          duration_in_months: discountDurationMonths && discountDurationMonths > 0 ? discountDurationMonths : undefined,
          percent_off: discountPercent,
          name: couponCode ? `SmmtAI ${couponCode}` : 'SmmtAI Discount',
          metadata: {
            workspaceId,
            couponRedemptionId: couponRedemptionId || '',
            couponCode: couponCode || '',
          },
        });
        stripeCouponId = stripeCoupon.id;
      }

      const freeAtCheckout = (trialPeriodDays > 0) || ((discountPercent ?? 0) >= 100);
      const paymentMethodCollection: 'always' | 'if_required' = (!requireCardForFreeCheckout && freeAtCheckout)
        ? 'if_required'
        : 'always';

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_collection: paymentMethodCollection,
        payment_method_types: ['card'],
        line_items: [lineItem],
        success_url: successUrl,
        cancel_url: cancelUrl,
        discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
        subscription_data: {
          trial_period_days: trialPeriodDays > 0 ? trialPeriodDays : undefined,
          metadata: {
            workspaceId,
            tier: derivedTier,
            priceKey,
            ...(couponRedemptionId ? { couponRedemptionId } : {}),
            ...(couponCode ? { couponCode } : {}),
          },
        },
        metadata: {
          workspaceId,
          tier: derivedTier,
          priceKey,
          ...(couponRedemptionId ? { couponRedemptionId } : {}),
          ...(couponCode ? { couponCode } : {}),
        },
        allow_promotion_codes: stripeCouponId ? undefined : true,
      });

      if (couponRedemptionId) {
        await couponService.bindCheckoutSession(couponRedemptionId, session.id);
      }

      return session.url!;
    } catch (error) {
      if (couponRedemptionId) {
        await couponService.releaseReservation(couponRedemptionId);
      }
      throw error;
    }
  }

  async changePlan(
    workspaceId: string,
    input: { tier?: string; priceKey?: string; couponCode?: string },
    urls: { checkoutSuccessUrl: string; checkoutCancelUrl: string },
    userId?: string,
  ): Promise<{ action: 'redirect'; url: string } | ({ action: 'updated' } & Awaited<ReturnType<StripeService['getSubscriptionStatus']>>)> {
    const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
    if (!subscription) throw new AppError('Subscription not found', 404, 'SUB_NOT_FOUND');

    const priceKey = (input.priceKey || '').trim();
    if (!priceKey) {
      throw new AppError('priceKey is required for plan changes', 400, 'MISSING_PRICE');
    }

    // If workspace has no active Stripe subscription yet, start checkout
    if (!subscription.stripeSubscriptionId) {
      const url = await this.createCheckoutSession(
        workspaceId,
        priceKey,
        urls.checkoutSuccessUrl,
        urls.checkoutCancelUrl,
        {
          userId,
          couponCode: input.couponCode,
        },
      );
      return { action: 'redirect', url };
    }

    if (input.couponCode) {
      throw new AppError(
        'Coupons are only supported when starting a new paid checkout. This workspace already has an active paid subscription.',
        400,
        'COUPON_NOT_SUPPORTED_FOR_ACTIVE_SUBSCRIPTION',
      );
    }

    const lineItem = await this.buildLineItem(priceKey);

    const currentTier = (subscription.tier || 'basic').toLowerCase();
    const nextTier = priceKey.split('_')[0]?.toLowerCase() || currentTier;
    const tierOrder: Record<string, number> = { basic: 0, pro: 1, business: 2, enterprise: 3 };
    const isUpgrade = (tierOrder[nextTier] ?? 0) > (tierOrder[currentTier] ?? 0);

    const currentSub = await getStripe().subscriptions.retrieve(subscription.stripeSubscriptionId);
    const itemId = currentSub.items.data[0]?.id;
    if (!itemId) throw new AppError('Stripe subscription has no items to update', 400, 'SUBSCRIPTION_INVALID');

    const updated = await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
      items: [
        lineItem.price_data
          ? { id: itemId, price_data: lineItem.price_data as any }
          : { id: itemId, price: lineItem.price as string }
      ],
      proration_behavior: isUpgrade ? 'always_invoice' : 'create_prorations',
      cancel_at_period_end: false,
      metadata: { ...(currentSub.metadata || {}), workspaceId, tier: nextTier, priceKey },
    });

    await this.handleSubscriptionUpdated(updated);
    return { action: 'updated', ...(await this.getSubscriptionStatus(workspaceId)) };
  }

  // Retrieve checkout session details for frontend conversion tracking
  async getCheckoutSession(sessionId: string) {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return {
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: (session.currency || 'usd').toUpperCase(),
      status: session.payment_status,
    };
  }

  // Create customer portal session for billing management
  async createPortalSession(workspaceId: string, returnUrl: string): Promise<string> {
    const customerId = await this.getOrCreateCustomer(workspaceId);

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  // Cancel subscription directly (stops auto-renewal)
  async cancelSubscription(workspaceId: string): Promise<Awaited<ReturnType<StripeService['getSubscriptionStatus']>>> {
    const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
    if (!subscription) throw new AppError('Subscription not found', 404, 'SUB_NOT_FOUND');
    if (!subscription.stripeSubscriptionId) {
      throw new AppError('No active subscription found to cancel', 400, 'NO_ACTIVE_SUB');
    }

    const updated = await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await this.handleSubscriptionUpdated(updated);
    return this.getSubscriptionStatus(workspaceId);
  }

  // Get current subscription status (includes on-site card info and invoices history)
  async getSubscriptionStatus(workspaceId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
      include: {
        usageRecords: {
          where: {
            periodStart: { lte: new Date() },
            periodEnd: { gte: new Date() },
          },
        },
      },
    });

    if (!subscription) throw new AppError('Subscription not found', 404, 'SUB_NOT_FOUND');

    const usage: Record<string, number> = {};
    for (const record of subscription.usageRecords) {
      usage[record.metric] = record.count;
    }

    // Fetch active card details
    let cardDetails = null;
    if (subscription.stripeCustomerId) {
      try {
        const customer = await getStripe().customers.retrieve(subscription.stripeCustomerId) as Stripe.Customer;
        const defaultPmId = customer.invoice_settings?.default_payment_method as string;
        if (defaultPmId) {
          const pm = await getStripe().paymentMethods.retrieve(defaultPmId);
          if (pm.type === 'card') {
            cardDetails = {
              brand: pm.card?.brand,
              last4: pm.card?.last4,
              expMonth: pm.card?.exp_month,
              expYear: pm.card?.exp_year,
            };
          }
        }
      } catch (err) {
        console.error("Error fetching payment method for workspace status:", err);
      }
    }

    // Fetch recent invoices
    let invoices: any[] = [];
    if (subscription.stripeCustomerId) {
      try {
        const invs = await getStripe().invoices.list({ customer: subscription.stripeCustomerId, limit: 5 });
        invoices = invs.data.map(inv => ({
          id: inv.id,
          number: inv.number,
          amountPaid: inv.amount_paid / 100,
          currency: inv.currency.toUpperCase(),
          status: inv.status,
          date: new Date(inv.created * 1000).toISOString(),
          pdfUrl: inv.invoice_pdf,
        }));
      } catch (err) {
        console.error("Error fetching invoices for workspace status:", err);
      }
    }

    return {
      tier: subscription.tier,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      usage,
      cardDetails,
      invoices,
    };
  }

  // Get system-wide billing and payments stats for admin dashboard
  async getAdminBillingStats() {
    // Only count subscriptions backed by a real Stripe subscription ID (excludes seed/test data)
    const realSubFilter = { stripeSubscriptionId: { not: null } };

    const [totalSubs, activeCount, trialingCount, canceledCount, localSubs] = await Promise.all([
      prisma.subscription.count({ where: realSubFilter }),
      prisma.subscription.count({ where: { status: 'active', ...realSubFilter } }),
      prisma.subscription.count({ where: { status: 'trialing', ...realSubFilter } }),
      prisma.subscription.count({ where: { status: 'canceled', ...realSubFilter } }),
      prisma.subscription.findMany({
        take: 50,
        orderBy: { updatedAt: 'desc' },
        include: { workspace: { include: { owner: { select: { name: true, email: true } } } } }
      })
    ]);

    let stripeInvoices: any[] = [];
    let mrr = 0;

    try {
      const invoices = await getStripe().invoices.list({ limit: 50, status: 'paid' });
      stripeInvoices = invoices.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        customerEmail: inv.customer_email,
        amountPaid: inv.amount_paid / 100,
        currency: inv.currency.toUpperCase(),
        status: inv.status,
        date: new Date(inv.created * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf,
      }));
    } catch (err) {
      console.error("Stripe invoice fetch error for admin stats:", err);
    }

    // Calculate real MRR from Stripe active subscriptions directly
    try {
      const stripeSubs = await getStripe().subscriptions.list({
        status: 'active',
        limit: 100,
        expand: ['data.items.data.price'],
      });
      mrr = stripeSubs.data.reduce((sum, sub) => {
        const monthlyAmount = sub.items.data.reduce((itemSum, item) => {
          const price = item.price;
          const unitAmount = (price.unit_amount || 0) / 100;
          if (price.recurring?.interval === 'year') {
            return itemSum + (unitAmount / 12);
          }
          return itemSum + unitAmount;
        }, 0);
        return sum + monthlyAmount;
      }, 0);
    } catch (err) {
      console.error("Stripe MRR fetch error:", err);
      mrr = 0;
    }

    return {
      mrr: Math.round(mrr * 100) / 100,
      totalSubs,
      activeCount,
      trialingCount,
      canceledCount,
      invoices: stripeInvoices,
      subscriptions: localSubs.map(s => ({
        id: s.id,
        workspaceId: s.workspaceId,
        workspaceName: s.workspace.name,
        ownerName: s.workspace.owner.name,
        ownerEmail: s.workspace.owner.email,
        tier: s.tier,
        status: s.status,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        currentPeriodEnd: s.currentPeriodEnd,
        stripeSubscriptionId: s.stripeSubscriptionId,
      }))
    };
  }

  // Admin manually cancel a subscription
  async adminCancelSubscription(stripeSubscriptionId: string) {
    const updated = await getStripe().subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await this.handleSubscriptionUpdated(updated);
    return updated;
  }

  // =========================================================
  // Webhook Handlers
  // =========================================================

  async handleWebhookEvent(body: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(body, signature, config.stripe.webhookSecret);
    } catch {
      throw new AppError('Invalid webhook signature', 400, 'INVALID_SIGNATURE');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const workspaceId = session.metadata?.workspaceId;
    const pendingEmail = session.metadata?.pendingEmail;
    const pendingName = session.metadata?.pendingName;

    // New public checkout flow: provision account on payment success
    if (!workspaceId && pendingEmail && pendingName) {
      try {
        // Import authService lazily to avoid circular deps
        const { authService } = await import('./auth.service.js');
        const provisioned = await authService.provisionCheckoutAccount({
          name: pendingName,
          email: pendingEmail,
        });

        // Update the Stripe customer with the real workspace info
        if (session.customer) {
          await getStripe().customers.update(session.customer as string, {
            metadata: { workspaceId: provisioned.workspaceId, pendingCheckout: '' },
          });
        }

        // Link subscription to the new workspace
        if (session.subscription) {
          const priceKey = session.metadata?.priceKey;
          const tier = session.metadata?.tier || (priceKey ? priceKey.split('_')[0] : 'basic');
          await prisma.subscription.update({
            where: { workspaceId: provisioned.workspaceId },
            data: {
              stripeCustomerId: session.customer as string || null,
              stripeSubscriptionId: session.subscription as string,
              tier,
              status: 'active',
            },
          });
        }

        // Finalize coupon if present
        const couponCode = session.metadata?.couponCode;
        if (couponCode) {
          await couponService.finalizeReservationFromCheckoutSession({
            id: session.id,
            metadata: { ...session.metadata, workspaceId: provisioned.workspaceId } as Record<string, string> | null,
            subscription: session.subscription as string | null,
          });
        }
      } catch (err: any) {
        // If account already exists (e.g. duplicate webhook), just link subscription
        console.error('handleCheckoutCompleted pendingEmail error:', err?.message);
      }
      return;
    }

    // Existing flow: workspaceId already set (upgrade for logged-in user)
    if (!workspaceId) return;

    if (session.subscription) {
      await prisma.subscription.update({
        where: { workspaceId },
        data: {
          stripeSubscriptionId: session.subscription as string,
          status: 'active',
        },
      });
    }

    await couponService.finalizeReservationFromCheckoutSession({
      id: session.id,
      metadata: session.metadata as Record<string, string> | null,
      subscription: session.subscription as string | null,
    });
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription) {
    const workspaceId = sub.metadata?.workspaceId;
    if (!workspaceId) return;

    const priceId = sub.items.data[0]?.price?.id;
    const tier = priceId ? (TIER_FROM_PRICE[priceId] || 'basic') : 'basic';

    const statusMap: Record<string, string> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'past_due',
    };

    await prisma.subscription.update({
      where: { workspaceId },
      data: {
        tier,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId || null,
        status: statusMap[sub.status] || 'active',
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        currentPeriodStart: new Date((sub as any).current_period_start * 1000),
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const workspaceId = sub.metadata?.workspaceId;
    if (!workspaceId) return;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    await prisma.subscription.update({
      where: { workspaceId },
      data: {
        tier: 'basic',
        status: 'canceled',
        stripeSubscriptionId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
      },
    });

    if (workspace) {
      await emailService.sendSubscriptionCanceledEmail({
        email: workspace.owner.email,
        name: workspace.owner.name,
        workspaceName: workspace.name,
        billingLink: `${config.frontend.url}/billing`,
      });
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const subscription = await prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
      select: {
        id: true,
        workspaceId: true,
        workspace: {
          select: {
            name: true,
            owner: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });
    if (!subscription) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'past_due' },
    });

    const nextRetryAt = typeof invoice.next_payment_attempt === 'number'
      ? new Date(invoice.next_payment_attempt * 1000)
      : null;
    await emailService.sendPaymentFailedEmail({
      email: subscription.workspace.owner.email,
      name: subscription.workspace.owner.name,
      workspaceName: subscription.workspace.name,
      nextRetryAt,
      billingLink: `${config.frontend.url}/billing`,
    });
    console.log(`[BILLING] Payment failed for workspace: ${subscription.workspaceId}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const subscription = await prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
      select: {
        id: true,
        status: true,
        workspace: {
          select: {
            name: true,
            owner: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });
    if (!subscription) return;

    const shouldSendRecoveryEmail = subscription.status === 'past_due';
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'active' },
    });

    if (shouldSendRecoveryEmail) {
      const paidAt = typeof invoice.status_transitions?.paid_at === 'number'
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null;
      await emailService.sendPaymentRecoveredEmail({
        email: subscription.workspace.owner.email,
        name: subscription.workspace.owner.name,
        workspaceName: subscription.workspace.name,
        paidAt,
        billingLink: `${config.frontend.url}/billing`,
      });
    }

    // Reset usage counters for new billing period
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const metrics = ['posts', 'ai_generations', 'social_accounts'];
    for (const metric of metrics) {
      await prisma.usageRecord.upsert({
        where: {
          subscriptionId_metric_periodStart: {
            subscriptionId: subscription.id,
            metric,
            periodStart: now,
          },
        },
        create: {
          subscriptionId: subscription.id,
          metric,
          count: 0,
          periodStart: now,
          periodEnd,
        },
        update: { count: 0 },
      });
    }
  }
}

export const stripeService = new StripeService();
