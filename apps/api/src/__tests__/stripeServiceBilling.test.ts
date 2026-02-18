import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

const {
  mockPrisma,
  sendPaymentFailedEmailMock,
  sendPaymentRecoveredEmailMock,
  sendSubscriptionCanceledEmailMock,
} = vi.hoisted(() => ({
  mockPrisma: {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    usageRecord: {
      upsert: vi.fn(),
    },
  },
  sendPaymentFailedEmailMock: vi.fn(),
  sendPaymentRecoveredEmailMock: vi.fn(),
  sendSubscriptionCanceledEmailMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/email.service.js', () => ({
  emailService: {
    sendPaymentFailedEmail: sendPaymentFailedEmailMock,
    sendPaymentRecoveredEmail: sendPaymentRecoveredEmailMock,
    sendSubscriptionCanceledEmail: sendSubscriptionCanceledEmailMock,
  },
}));

vi.mock('../config/index.js', () => ({
  config: {
    stripe: {
      secretKey: 'sk_test_123',
      webhookSecret: 'whsec_123',
    },
    frontend: {
      url: 'http://localhost:5173',
    },
  },
}));

import { StripeService } from '../services/stripe.service.js';

type StripeServiceInternals = {
  handlePaymentFailed: (invoice: Stripe.Invoice) => Promise<void>;
  handleInvoicePaid: (invoice: Stripe.Invoice) => Promise<void>;
  handleSubscriptionDeleted: (sub: Stripe.Subscription) => Promise<void>;
};

function getInternals(service: StripeService): StripeServiceInternals {
  return service as unknown as StripeServiceInternals;
}

describe('StripeService billing webhooks', () => {
  let service: StripeService;
  let internals: StripeServiceInternals;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripeService();
    internals = getInternals(service);
    mockPrisma.subscription.update.mockResolvedValue(undefined);
    mockPrisma.workspace.findUnique.mockResolvedValue({
      name: 'Acme Workspace',
      owner: {
        email: 'owner@example.com',
        name: 'Owner',
      },
    });
    mockPrisma.usageRecord.upsert.mockResolvedValue(undefined);
  });

  it('downgrades canceled subscriptions and sends cancellation notification email', async () => {
    const sub = {
      metadata: {
        workspaceId: 'workspace_1',
      },
    } as unknown as Stripe.Subscription;

    await internals.handleSubscriptionDeleted(sub);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace_1' },
      data: {
        tier: 'free',
        status: 'canceled',
        stripeSubscriptionId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
      },
    });
    expect(sendSubscriptionCanceledEmailMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      name: 'Owner',
      workspaceName: 'Acme Workspace',
      billingLink: 'http://localhost:5173/billing',
    });
  });

  it('marks subscription past_due and sends payment failed notification', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'subscription_1',
      workspaceId: 'workspace_1',
      workspace: {
        name: 'Acme Workspace',
        owner: {
          email: 'owner@example.com',
          name: 'Owner',
        },
      },
    });

    const invoice = {
      customer: 'customer_1',
      next_payment_attempt: 1700000000,
    } as unknown as Stripe.Invoice;

    await internals.handlePaymentFailed(invoice);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription_1' },
      data: { status: 'past_due' },
    });
    expect(sendPaymentFailedEmailMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      name: 'Owner',
      workspaceName: 'Acme Workspace',
      nextRetryAt: new Date(1700000000 * 1000),
      billingLink: 'http://localhost:5173/billing',
    });
  });

  it('reactivates past_due subscriptions and sends payment recovery notification', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'subscription_2',
      status: 'past_due',
      workspace: {
        name: 'Acme Workspace',
        owner: {
          email: 'owner@example.com',
          name: 'Owner',
        },
      },
    });

    const invoice = {
      customer: 'customer_2',
      status_transitions: {
        paid_at: 1700001000,
      },
    } as unknown as Stripe.Invoice;

    await internals.handleInvoicePaid(invoice);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription_2' },
      data: { status: 'active' },
    });
    expect(sendPaymentRecoveredEmailMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      name: 'Owner',
      workspaceName: 'Acme Workspace',
      paidAt: new Date(1700001000 * 1000),
      billingLink: 'http://localhost:5173/billing',
    });
    expect(mockPrisma.usageRecord.upsert).toHaveBeenCalledTimes(3);
    const metrics = mockPrisma.usageRecord.upsert.mock.calls.map(
      (call) => (call[0] as { create: { metric: string } }).create.metric,
    );
    expect(metrics).toEqual(expect.arrayContaining(['posts', 'ai_generations', 'social_accounts']));
  });

  it('does not send payment recovery notification when subscription was not past_due', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'subscription_3',
      status: 'active',
      workspace: {
        name: 'Acme Workspace',
        owner: {
          email: 'owner@example.com',
          name: 'Owner',
        },
      },
    });

    const invoice = {
      customer: 'customer_3',
      status_transitions: {},
    } as unknown as Stripe.Invoice;

    await internals.handleInvoicePaid(invoice);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription_3' },
      data: { status: 'active' },
    });
    expect(sendPaymentRecoveredEmailMock).not.toHaveBeenCalled();
    expect(mockPrisma.usageRecord.upsert).toHaveBeenCalledTimes(3);
  });
});
