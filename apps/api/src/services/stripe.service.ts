import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const stripe = new Stripe(config.stripe.secretKey);

// Price IDs — set these in .env after creating products in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
  business_yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || '',
};

const TIER_FROM_PRICE: Record<string, string> = {};
// Build reverse mapping at startup
Object.entries(PRICE_IDS).forEach(([key, priceId]) => {
  if (priceId) {
    const tier = key.split('_')[0]; // pro, business
    TIER_FROM_PRICE[priceId] = tier;
  }
});

export class StripeService {
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

    const customer = await stripe.customers.create({
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

  // Create checkout session for upgrading
  async createCheckoutSession(
    workspaceId: string,
    priceKey: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    const priceId = PRICE_IDS[priceKey];
    if (!priceId) throw new AppError('Invalid price plan', 400, 'INVALID_PRICE');

    const customerId = await this.getOrCreateCustomer(workspaceId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: 14,
        metadata: { workspaceId },
      },
      metadata: { workspaceId },
      allow_promotion_codes: true,
    });

    return session.url!;
  }

  // Create customer portal session for billing management
  async createPortalSession(workspaceId: string, returnUrl: string): Promise<string> {
    const customerId = await this.getOrCreateCustomer(workspaceId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  // Get current subscription status
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

    return {
      tier: subscription.tier,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      usage,
    };
  }

  // =========================================================
  // Webhook Handlers
  // =========================================================

  async handleWebhookEvent(body: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, config.stripe.webhookSecret);
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
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription) {
    const workspaceId = sub.metadata?.workspaceId;
    if (!workspaceId) return;

    const priceId = sub.items.data[0]?.price?.id;
    const tier = priceId ? (TIER_FROM_PRICE[priceId] || 'free') : 'free';

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

    await prisma.subscription.update({
      where: { workspaceId },
      data: {
        tier: 'free',
        status: 'canceled',
        stripeSubscriptionId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
      },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const subscription = await prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (!subscription) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'past_due' },
    });

    // TODO: Send payment failed notification email
    console.log(`[BILLING] Payment failed for workspace: ${subscription.workspaceId}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const subscription = await prisma.subscription.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (!subscription) return;

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
