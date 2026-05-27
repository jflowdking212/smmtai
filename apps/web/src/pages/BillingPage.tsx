import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { SUBSCRIPTION_LIMITS, TIER_PLATFORMS, PLATFORMS, type SubscriptionTier } from '@ee-postmind/shared';
import {
  Check,
  CreditCard,
  Zap,
  Building2,
  Crown,
  ExternalLink,
  Loader2,
  Clock,
  AlertTriangle,
} from 'lucide-react';

const DEFAULT_PRICES: Record<SubscriptionTier, number> = { basic: 5, pro: 25, business: 50, enterprise: 0 };
type BillingPeriodKey = 'monthly' | 'quarterly' | '6month' | 'yearly';
// Base billing periods — discounts overridden dynamically from admin planConfig
const BASE_BILLING_PERIODS: { key: BillingPeriodKey; label: string; months: number; baseDiscount: number }[] = [
  { key: 'monthly',   label: 'Monthly',   months: 1,  baseDiscount: 0  },
  { key: 'quarterly', label: 'Quarterly', months: 3,  baseDiscount: 5  },
  { key: '6month',    label: '6 Months',  months: 6,  baseDiscount: 15 },
  { key: 'yearly',    label: 'Yearly',    months: 12, baseDiscount: 30 },
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

function formatLimit(value: number | string | null | undefined, isDays = false): string {
  if (value === Infinity || value === '__INFINITY__' || value === null || value === undefined || (typeof value === 'number' && value < 0)) return 'Unlimited';
  if (isDays) return `${value} days`;
  return typeof value === 'number' ? value.toLocaleString() : String(value);
}

function computePrice(
  monthlyPrice: number,
  p: { key: string; months: number; discount: number; label: string },
): { display: string; period: string; badge?: string } {
  if (monthlyPrice === 0) return { display: 'Custom', period: '' };
  const discountedMonthly = +(monthlyPrice * (1 - p.discount / 100)).toFixed(2);
  const total = +(discountedMonthly * p.months).toFixed(2);
  const dm = Number.isInteger(discountedMonthly) ? discountedMonthly : +discountedMonthly.toFixed(2);
  const totalStr = Number.isInteger(total) ? `$${total}` : `$${total.toFixed(2)}`;
  if (p.key === 'monthly') return { display: `$${dm}`, period: '/month' };
  return {
    display: `$${dm}`,
    period: '/month',
    badge: `${totalStr} billed ${p.label.toLowerCase()} · Save ${p.discount}%`,
  };
}


// ?????? Trial Status Banner ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
function TrialBanner({ trialEndsAt, onUpgrade }: { trialEndsAt: string | null; onUpgrade: () => void }) {
  if (!trialEndsAt) return null;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  const expired = daysLeft === 0;

  const bg = expired
    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
    : daysLeft <= 1
    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
    : daysLeft <= 3
    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
    : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30';
  const text = expired
    ? 'text-red-800 dark:text-red-300'
    : daysLeft <= 3
    ? 'text-amber-800 dark:text-amber-300'
    : 'text-blue-800 dark:text-blue-300';
  const icon = expired || daysLeft <= 3 ? AlertTriangle : Clock;
  const Icon = icon;
  const message = expired
    ? 'Your 14-day Pro trial has ended. Choose a plan to continue with full access.'
    : daysLeft === 1
    ? 'Last day of your Pro trial! Upgrade now to avoid interruption.'
    : `Your Pro trial ends in ${daysLeft} days. Upgrade to keep full access.`;

  return (
    <div className={`flex items-center justify-between gap-4 p-4 rounded-xl border mb-6 ${bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 shrink-0 ${text}`} />
        <p className={`text-sm font-medium ${text}`}>{message}</p>
      </div>
      <button
        onClick={onUpgrade}
        className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all ${
          expired || daysLeft <= 3
            ? 'bg-red-600 hover:bg-red-500'
            : 'bg-blue-600 hover:bg-blue-500'
        }`}
      >
        {expired ? 'Choose Plan' : 'Upgrade'}
      </button>
    </div>
  );
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
  const autoUpgradeRef = useRef(false);
  const { tier: storeTier, role } = useSubscription();
  const setSubscription = useAuthStore((s) => s.setSubscription);

  // Compute billing period discounts dynamically from admin planConfig
  const BILLING_PERIODS = BASE_BILLING_PERIODS.map((p) => ({
    ...p,
    discount: p.key === 'quarterly'
      ? (planConfig?.quarterlyDiscount ?? p.baseDiscount)
      : p.key === '6month'
      ? (planConfig?.sixMonthDiscount ?? p.baseDiscount)
      : p.key === 'yearly'
      ? (planConfig?.yearlyDiscount ?? p.baseDiscount)
      : p.baseDiscount,
  }));

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
    const raw = planConfig?.[tier]?.monthlyPrice ?? planConfig?.pricing?.[tier]?.monthlyPrice;
  if (raw === '__INFINITY__') return Infinity;
  return raw != null ? raw : DEFAULT_PRICES[tier];
  }

  const currentTier = (billingStatus?.tier || storeTier || 'basic') as SubscriptionTier;
  const tierOrder: Record<SubscriptionTier, number> = useMemo(
    () => ({ basic: 0, pro: 1, business: 2, enterprise: 3 }),
    [],
  );

  const isTrialing = billingStatus?.status === 'trialing';
  const trialEndsAt = billingStatus?.trialEndsAt || null;
  const trialExpired = trialEndsAt && new Date(trialEndsAt) < new Date() && !isTrialing;

  async function handlePlanChange(target: { tier: SubscriptionTier; priceKey?: string; couponCode?: string }) {
    const isDowngrade = (tierOrder[target.tier] ?? 0) < (tierOrder[currentTier] ?? 0);
    if (isDowngrade) {
      const ok = window.confirm(`Downgrade to ${target.tier}? Your data will remain intact, but features will be limited to the ${target.tier} plan.`);
      if (!ok) return;
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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Plan change failed');
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
      
        {/* Trial Status Banner */}
        {(isTrialing || trialExpired) && (
          <TrialBanner
            trialEndsAt={trialEndsAt as string}
            onUpgrade={() => {
              const proKey = `pro_monthly`;
              handlePlanChange({ tier: 'pro', priceKey: proKey });
            }}
          />
        )}
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const monthlyPrice = getMonthlyPrice(plan.tier);
          const isCustom = plan.tier === 'enterprise' && (monthlyPrice === null || monthlyPrice === undefined || monthlyPrice === 0);
          const priceKey = isCustom ? '' : `${plan.tier}_${billingPeriod}`;
          
          // Merge dynamic limits from admin entries
          const limits = (() => {
            const defaults = SUBSCRIPTION_LIMITS[plan.tier];
            const overrides = planConfig?.[plan.tier];
            if (!overrides) return defaults;
            return {
              socialAccounts: overrides.socialAccounts != null ? (overrides.socialAccounts === '__INFINITY__' ? Infinity : overrides.socialAccounts) : defaults.socialAccounts,
              postsPerMonth: overrides.postsPerMonth != null ? (overrides.postsPerMonth === '__INFINITY__' ? Infinity : overrides.postsPerMonth) : defaults.postsPerMonth,
              aiGenerationsPerMonth: overrides.aiGenerationsPerMonth != null ? (overrides.aiGenerationsPerMonth === '__INFINITY__' ? Infinity : overrides.aiGenerationsPerMonth) : defaults.aiGenerationsPerMonth,
              templatesPerMonth: overrides.templatesPerMonth != null ? (overrides.templatesPerMonth === '__INFINITY__' ? Infinity : overrides.templatesPerMonth) : defaults.templatesPerMonth,
              teamMembers: overrides.teamMembers != null ? (overrides.teamMembers === '__INFINITY__' ? Infinity : overrides.teamMembers) : defaults.teamMembers,
              analyticsDays: overrides.analyticsDays != null ? (overrides.analyticsDays === '__INFINITY__' ? Infinity : overrides.analyticsDays) : defaults.analyticsDays,
            };
          })();

          const platforms: string[] = (() => {
            const adminPlatforms = planConfig?.[plan.tier]?.platforms;
            if (Array.isArray(adminPlatforms) && adminPlatforms.length > 0) return adminPlatforms;
            return TIER_PLATFORMS[plan.tier] as string[];
          })();
          const isCurrent = plan.tier === currentTier;
          const isDowngrade = (tierOrder[plan.tier] ?? 0) < (tierOrder[currentTier] ?? 0);

          return (
            <Card
              key={plan.tier}
              className={`p-6 relative ${plan.popular ? 'ring-2 ring-brand-500 shadow-md' : ''}`}
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
                {isCustom ? (
                  <span className="text-3xl font-bold text-neutral-900">Custom</span>
                ) : (() => {
                  const activePeriod = BILLING_PERIODS.find((p) => p.key === billingPeriod)!;
          const price = computePrice(monthlyPrice, activePeriod);
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
                    <span className="text-xs text-neutral-600 font-medium">All 13 platforms</span>
                  ) : (
                    platforms.map((pid) => (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700"
                        style={{ borderLeft: `3px solid ${(PLATFORMS as Record<string, {color: string; name: string}>)[pid]?.color ?? '#888'}` }}
                      >
                        {(PLATFORMS as Record<string, {color: string; name: string}>)[pid]?.name ?? pid}
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

              {isCustom ? (
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
                  {isDowngrade ? 'Downgrade' : `Start ${plan.name} Plan`}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* FAQ / Info */}
      <Card className="p-6">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 mb-4">
          Frequently Asked Questions
        </h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-neutral-800 mb-1">Can I cancel anytime?</h4>
            <p className="text-neutral-500">
              Yes. Cancel anytime from the billing portal. You'll keep access until the end of your
              billing period.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-neutral-800 mb-1">What happens when I hit a limit?</h4>
            <p className="text-neutral-500">
              You'll be notified and prompted to upgrade. Your existing posts and data remain safe.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-neutral-800 mb-1">Is there a free trial?</h4>
            <p className="text-neutral-500">
              Pro plan includes a 14-day free trial. No credit card required to start.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-neutral-800 mb-1">Do you offer annual discounts?</h4>
            <p className="text-neutral-500">
              Yes — quarterly billing saves 5%, 6-month billing saves 15%, and yearly billing saves 30%. Use the slider above to switch billing periods.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
