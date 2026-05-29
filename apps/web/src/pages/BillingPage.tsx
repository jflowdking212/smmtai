import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { SUBSCRIPTION_LIMITS, TIER_PLATFORMS, PLATFORMS, type SubscriptionTier } from '@ee-postmind/shared';
import { useToast } from '@/components/Toast';
import {
  Check,
  CreditCard,
  Zap,
  Building2,
  Crown,
  ExternalLink,
  Loader2,
  ShieldAlert,
  X,
  FileText,
} from 'lucide-react';

const DEFAULT_PRICES: Record<SubscriptionTier, number> = { basic: 5, pro: 25, business: 50, enterprise: 0 };
type BillingPeriodKey = 'monthly' | 'quarterly' | '6month' | 'yearly';
const BILLING_PERIODS: { key: BillingPeriodKey; label: string; months: number; discount: number }[] = [
  { key: 'monthly', label: 'Monthly', months: 1, discount: 0 },
  { key: 'quarterly', label: 'Quarterly', months: 3, discount: 5 },
  { key: '6month', label: '6 Months', months: 6, discount: 15 },
  { key: 'yearly', label: 'Yearly', months: 12, discount: 30 },
];

const plans: {
  tier: SubscriptionTier;
  name: string;
  description: string;
  icon: typeof Zap;
  popular?: boolean;
  custom?: boolean;
}[] = [
  {
    tier: 'basic',
    name: 'Basic',
    description: 'Get started with the basics',
    icon: Zap,
  },
  {
    tier: 'pro',
    name: 'Pro',
    description: 'For growing creators & teams',
    icon: CreditCard,
    popular: true,
  },
  {
    tier: 'business',
    name: 'Business',
    description: 'For agencies & larger teams',
    icon: Building2,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Dedicated support & custom limits',
    icon: Crown,
    custom: true,
  },
];

const featureLabels: { key: keyof (typeof SUBSCRIPTION_LIMITS)['basic']; label: string }[] = [
  { key: 'socialAccounts', label: 'Social accounts' },
  { key: 'postsPerMonth', label: 'Posts per month' },
  { key: 'aiGenerationsPerMonth', label: 'AI generations per month' },
  { key: 'templatesPerMonth', label: 'Templates per month' },
  { key: 'teamMembers', label: 'Team members' },
  { key: 'analyticsDays', label: 'Analytics history' },
];

function formatLimit(value: number, isDays = false): string {
  if (value === Infinity) return 'Unlimited';
  if (isDays) return `${value} days`;
  return value.toLocaleString();
}

function computePrice(monthlyPrice: number, period: BillingPeriodKey): { display: string; period: string; badge?: string } {
  if (monthlyPrice === 0) return { display: 'Custom', period: '' };
  const p = BILLING_PERIODS.find((b) => b.key === period)!;
  const discountedMonthly = +(monthlyPrice * (1 - p.discount / 100)).toFixed(2);
  const total = +(discountedMonthly * p.months).toFixed(2);
  const dm = Number.isInteger(discountedMonthly) ? discountedMonthly : +discountedMonthly.toFixed(2);
  const totalStr = Number.isInteger(total) ? `$${total}` : `$${total.toFixed(2)}`;
  if (period === 'monthly') return { display: `$${dm}`, period: '/month' };
  return {
    display: `$${dm}`,
    period: '/month',
    badge: `${totalStr} billed ${p.label.toLowerCase()} · Save ${p.discount}%`,
  };
}

export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const couponFromQuery = searchParams.get('coupon') || '';
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriodKey>('monthly');
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [couponCode, setCouponCode] = useState(couponFromQuery);
  const [actionError, setActionError] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<{ tier: SubscriptionTier; priceKey?: string; couponCode?: string } | null>(null);
  const autoUpgradeRef = useRef(false);
  const { tier: storeTier, role } = useSubscription();
  const setSubscription = useAuthStore((s) => s.setSubscription);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    api.site.getPublicPlans()
      .then((res) => { if (active) setPlanConfig(res.data); })
      .catch(() => { /* use defaults */ });
    return () => { active = false; };
  }, []);

  async function refreshStatus() {
    try {
      const res = await api.billing.status();
      setBillingStatus(res.data);
      setSubscription(res.data.tier || 'basic', role, res.data.usage || {});
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    setCouponCode(couponFromQuery);
  }, [couponFromQuery]);

  function getMonthlyPrice(tier: SubscriptionTier): number {
    return planConfig?.[tier]?.monthlyPrice ?? planConfig?.pricing?.[tier]?.monthlyPrice ?? DEFAULT_PRICES[tier];
  }

  const currentTier = (billingStatus?.tier || storeTier || 'basic') as SubscriptionTier;
  const tierOrder: Record<SubscriptionTier, number> = useMemo(
    () => ({ basic: 0, pro: 1, business: 2, enterprise: 3 }),
    [],
  );

  async function handlePlanChange(target: { tier: SubscriptionTier; priceKey?: string; couponCode?: string }) {
    const isDowngrade = (tierOrder[target.tier] ?? 0) < (tierOrder[currentTier] ?? 0);
    if (isDowngrade && !downgradeTarget) {
      setDowngradeTarget(target);
      return;
    }

    setActionError('');
    const loadingKey = target.tier === 'basic' ? 'basic' : (target.priceKey || target.tier);
    setLoading(loadingKey);
    try {
      const res = await api.billing.changePlan({
        tier: target.tier === 'basic' ? 'basic' : undefined,
        priceKey: target.tier === 'basic' ? undefined : target.priceKey,
        couponCode: target.couponCode,
      });
      if (res.data?.action === 'redirect' && res.data?.url) {
        window.location.href = res.data.url as string;
        return;
      }
      setBillingStatus(res.data);
      setSubscription(res.data.tier || currentTier, role, res.data.usage || {});
      setDowngradeTarget(null);
      toast.success('Success', `Plan successfully changed to ${target.tier}!`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Plan change failed');
      toast.error('Error', err instanceof Error ? err.message : 'Plan change failed');
    } finally {
      setLoading(null);
    }
  }

  async function handleCancelSubscription() {
    setLoading('cancel');
    try {
      const res = await api.billing.cancel();
      setBillingStatus(res.data);
      setSubscription(res.data.tier || currentTier, role, res.data.usage || {});
      setActionError('');
      setCancelModalOpen(false);
      toast.success('Subscription Updated', 'Auto-renewal has been successfully turned off.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancellation failed');
      toast.error('Error', err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    const upgradeKey = searchParams.get('upgrade');
    const coupon = searchParams.get('coupon') || undefined;
    if (!upgradeKey || autoUpgradeRef.current) return;
    autoUpgradeRef.current = true;
    void handlePlanChange({ tier: upgradeKey.split('_')[0] as SubscriptionTier, priceKey: upgradeKey, couponCode: coupon });

    const next = new URLSearchParams(searchParams);
    next.delete('upgrade');
    next.delete('coupon');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, currentTier]);

  async function handleManageBilling() {
    setLoading('portal');
    try {
      const res = await api.billing.portal();
      window.location.href = res.data.url;
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Billing & Plans</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleManageBilling}>
          <ExternalLink className="w-4 h-4" />
          {loading === 'portal' ? 'Opening...' : 'Manage Billing'}
        </Button>
      </div>

      {/* Active Subscription Details Banner */}
      {billingStatus && currentTier !== 'basic' && (
        <Card className="p-6 border-neutral-200 bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Current Subscription
              </span>
              <Badge variant="brand" className="capitalize px-2 py-0.5 text-xs font-semibold">
                {currentTier} Plan
              </Badge>
              <Badge 
                variant={
                  billingStatus.status === 'active' 
                    ? 'success' 
                    : billingStatus.status === 'trialing' 
                      ? 'warning' 
                      : 'danger'
                }
                className="capitalize text-xs"
              >
                {billingStatus.status}
              </Badge>
            </div>
            <p className="text-sm text-neutral-600">
              {billingStatus.status === 'trialing' && billingStatus.trialEndsAt && (
                <>
                  Your free trial is active and ends on{' '}
                  <strong className="text-neutral-900">
                    {new Date(billingStatus.trialEndsAt).toLocaleDateString()}
                  </strong>.
                </>
              )}
              {billingStatus.status !== 'trialing' && billingStatus.currentPeriodEnd && (
                <>
                  {billingStatus.cancelAtPeriodEnd ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                      ⚠️ Auto-renewal is OFF. Your plan will expire on{' '}
                      <strong>
                        {new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}
                      </strong>.
                    </span>
                  ) : (
                    <>
                      Your subscription will automatically renew on{' '}
                      <strong className="text-neutral-900">
                        {new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}
                      </strong>.
                    </>
                  )}
                </>
              )}
            </p>

            {/* Default Credit Card Details on-site */}
            {billingStatus.cardDetails && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                <CreditCard className="w-4 h-4 text-neutral-400" />
                <span className="font-semibold text-neutral-700 capitalize">
                  {billingStatus.cardDetails.brand}
                </span>{' '}
                ending in <span className="font-bold text-neutral-800">{billingStatus.cardDetails.last4}</span>{' '}
                (Expires {billingStatus.cardDetails.expMonth}/{billingStatus.cardDetails.expYear})
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {billingStatus.status !== 'canceled' && !billingStatus.cancelAtPeriodEnd && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200"
              >
                Cancel Auto-Renewal
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleManageBilling}>
              <ExternalLink className="w-4 h-4" />
              Manage Billing
            </Button>
          </div>
        </Card>
      )}

      {/* Billing Period Slider */}
      <div className="flex flex-col items-center gap-2 w-full max-w-lg mx-auto px-4">
        <div className="relative w-full">
          <input
            type="range"
            min={0}
            max={BILLING_PERIODS.length - 1}
            step={1}
            value={BILLING_PERIODS.findIndex((p) => p.key === billingPeriod)}
            onChange={(e) => setBillingPeriod(BILLING_PERIODS[Number(e.target.value)].key)}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: 'var(--color-brand-500, #6366f1)' }}
          />
          <div className="flex justify-between mt-3">
            {BILLING_PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setBillingPeriod(p.key)}
                className={`flex flex-col items-center gap-1 text-center transition-all ${billingPeriod === p.key ? 'text-brand-600' : 'text-neutral-400 hover:text-neutral-600'}`}
              >
                <span className={`text-sm font-semibold ${billingPeriod === p.key ? 'text-neutral-900' : ''}`}>{p.label}</span>
                {p.discount > 0 ? (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${billingPeriod === p.key ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-400'}`}>
                    Save {p.discount}%
                  </span>
                ) : (
                  <span className="text-xs text-neutral-300">—</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {couponCode && (
        <Card className="p-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            Coupon active: <span className="font-semibold">{couponCode}</span>. Choose a plan to apply it.
          </p>
        </Card>
      )}

      {actionError && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{actionError}</p>
        </Card>
      )}

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const limits = SUBSCRIPTION_LIMITS[plan.tier];
          const platforms = TIER_PLATFORMS[plan.tier];
          const priceKey = plan.custom ? '' : `${plan.tier}_${billingPeriod}`;
          const monthlyPrice = getMonthlyPrice(plan.tier);

          const isCurrent = plan.tier === currentTier;
          const isDowngrade = (tierOrder[plan.tier] ?? 0) < (tierOrder[currentTier] ?? 0);

          return (
            <Card
              key={plan.tier}
              className={`p-6 relative bg-white border border-neutral-200 ${plan.popular ? 'ring-2 ring-brand-500 shadow-md' : ''}`}
            >
              {plan.popular && (
                <Badge variant="brand" className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    plan.popular ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  <plan.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-neutral-900">{plan.name}</h3>
                  <p className="text-xs text-neutral-400">{plan.description}</p>
                </div>
              </div>

              <div className="mb-4">
                {plan.custom ? (
                  <span className="text-3xl font-bold text-neutral-900">Custom</span>
                ) : (() => {
                  const price = computePrice(monthlyPrice, billingPeriod);
                  return (
                    <>
                      <span className="text-3xl font-bold text-neutral-900">{price.display}</span>
                      {price.period && <span className="text-sm text-neutral-400">{price.period}</span>}
                      {price.badge && (
                        <span className="block text-xs text-success-600 font-medium mt-1">
                          {price.badge}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Platforms */}
              <div className="mb-4">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Platforms</p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.tier === 'enterprise' ? (
                    <span className="text-xs text-neutral-600 font-medium">All 25 platforms</span>
                  ) : (
                    platforms.map((pid) => (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200"
                        style={{ borderLeft: `3px solid ${PLATFORMS[pid].color}` }}
                      >
                        {PLATFORMS[pid].name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {featureLabels.map((feature) => (
                  <li key={feature.key} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success-500 flex-shrink-0" />
                    <span className="text-neutral-600">
                      <strong className="text-neutral-800">
                        {formatLimit(limits[feature.key], feature.key === 'analyticsDays')}
                      </strong>{' '}
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.custom ? (
                <Button variant="secondary" className="w-full">
                  Contact Sales
                </Button>
              ) : isCurrent ? (
                <Button variant="secondary" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button
                  variant={isDowngrade ? 'secondary' : plan.popular ? 'primary' : 'secondary'}
                  className="w-full"
                  loading={loading === priceKey}
                  onClick={() => void handlePlanChange({ tier: plan.tier, priceKey, couponCode: couponCode || undefined })}
                >
                  {isDowngrade ? 'Downgrade' : plan.popular ? 'Get Pro' : 'Select Plan'}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Invoices / Payment History Section (100% on-site) */}
      {billingStatus?.invoices && billingStatus.invoices.length > 0 && (
        <Card className="p-6 bg-white border border-neutral-200">
          <h2 className="text-lg font-heading font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-neutral-400" />
            Invoices & Payment History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider bg-neutral-50">
                  <th className="px-4 py-2.5">Invoice No.</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Billing Date</th>
                  <th className="px-4 py-2.5 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm">
                {billingStatus.invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-neutral-800">{inv.number}</td>
                    <td className="px-4 py-3 text-neutral-600 font-bold">${inv.amountPaid.toLocaleString()} {inv.currency}</td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === 'paid' ? 'success' : 'danger'} className="text-[10px]">
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-semibold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Styled React Confirmation Modal for direct cancellation */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                Cancel Auto-Renewal
              </h3>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-600 mb-2 leading-relaxed">
              Are you sure you want to disable auto-renewal for your SmmtAI subscription?
            </p>
            <p className="text-xs text-neutral-500 bg-neutral-50 p-3 rounded-lg border border-neutral-200 mb-5 leading-relaxed">
              You will continue to have full access to your paid features and limits until the end of your billing period on{' '}
              <strong>{new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}</strong>. After this date, you will not be billed again, and your workspace will automatically revert to the free <strong>Basic</strong> plan limits.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1 text-neutral-600 border-neutral-300"
                onClick={() => setCancelModalOpen(false)}
              >
                Keep Active
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={handleCancelSubscription}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Styled React Confirmation Modal for Plan Downgrades */}
      {downgradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Confirm Downgrade
              </h3>
              <button
                onClick={() => setDowngradeTarget(null)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-600 mb-2 leading-relaxed">
              Are you sure you want to downgrade your SmmtAI plan to the{' '}
              <strong className="capitalize text-neutral-900">"{downgradeTarget.tier}"</strong> plan?
            </p>
            <p className="text-xs text-neutral-500 bg-neutral-50 p-3 rounded-lg border border-neutral-200 mb-5 leading-relaxed">
              Your existing scheduled posts, templates, and connected channels will remain perfectly safe and intact. However, starting next period, your workspace will be capped under the tighter limits and platforms included in the <strong>{downgradeTarget.tier.toUpperCase()}</strong> plan.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1 text-neutral-600 border-neutral-300"
                onClick={() => setDowngradeTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold"
                onClick={() => handlePlanChange(downgradeTarget)}
              >
                Downgrade Plan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
