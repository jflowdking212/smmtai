import { describe, expect, it } from 'vitest';
import { resolveUsageAccess } from '../middleware/usage.js';

describe('resolveUsageAccess', () => {
  const now = new Date('2026-02-01T12:00:00.000Z');

  it('allows free tier workspaces regardless of subscription status', () => {
    const decision = resolveUsageAccess(
      { tier: 'free', status: 'canceled', currentPeriodEnd: null },
      now,
      7,
    );

    expect(decision).toEqual({ allowed: true });
  });

  it('allows paid subscriptions when active', () => {
    const decision = resolveUsageAccess(
      { tier: 'pro', status: 'active', currentPeriodEnd: new Date('2026-01-31T00:00:00.000Z') },
      now,
      7,
    );

    expect(decision).toEqual({ allowed: true });
  });

  it('allows past_due subscriptions while still in grace period', () => {
    const decision = resolveUsageAccess(
      { tier: 'business', status: 'past_due', currentPeriodEnd: new Date('2026-01-28T00:00:00.000Z') },
      now,
      7,
    );

    expect(decision).toEqual({ allowed: true });
  });

  it('blocks past_due subscriptions after grace period expires', () => {
    const decision = resolveUsageAccess(
      { tier: 'enterprise', status: 'past_due', currentPeriodEnd: new Date('2026-01-20T00:00:00.000Z') },
      now,
      7,
    );

    expect(decision).toEqual({
      allowed: false,
      code: 'BILLING_GRACE_EXPIRED',
      message: 'Your billing grace period has ended. Update your payment method to continue.',
    });
  });

  it('requires billing action when past_due has no billing period end', () => {
    const decision = resolveUsageAccess(
      { tier: 'pro', status: 'past_due', currentPeriodEnd: null },
      now,
      7,
    );

    expect(decision).toEqual({
      allowed: false,
      code: 'BILLING_ACTION_REQUIRED',
      message: 'Your subscription payment is overdue. Update your billing method to continue.',
    });
  });
});
