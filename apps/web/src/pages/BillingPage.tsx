import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { SUBSCRIPTION_LIMITS, TIER_PLATFORMS, PLATFORMS, type SubscriptionTier } from '@ee-postmind/shared';
import {
  Check,
  CreditCard,
  Zap,
  Building2,
  Crown,
  ExternalLink,
  Loader2,
} from 'lucide-react';

const DEFAULT_PRICES: Record<SubscriptionTier, number> = { basic: 0, pro: 19, business: 49, enterprise: 0 };
const DEFAULT_YEARLY_DISCOUNT = 30;

const plans: {
  tier: SubscriptionTier;
  name: string;
  priceKeyMonthly: string;
  priceKeyYearly: string;
  description: string;
  icon: typeof Zap;
  popular?: boolean;
  custom?: boolean;
}[] = [
  {
    tier: 'basic',
    name: 'Basic',
    priceKeyMonthly: '',
    priceKeyYearly: '',
    description: 'Get started with the basics',
    icon: Zap,
  },
  {
    tier: 'pro',
    name: 'Pro',
    priceKeyMonthly: 'pro_monthly',
    priceKeyYearly: 'pro_yearly',
    description: 'For growing creators & teams',
    icon: CreditCard,
    popular: true,
  },
  {
    tier: 'business',
    name: 'Business',
    priceKeyMonthly: 'business_monthly',
    priceKeyYearly: 'business_yearly',
    description: 'For agencies & larger teams',
    icon: Building2,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    priceKeyMonthly: '',
    priceKeyYearly: '',
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

function formatPrice(monthlyPrice: number, yearly: boolean, yearlyDiscountPct: number): { display: string; period: string; originalYearly?: string } {
  if (monthlyPrice === 0) return { display: '$0', period: '' };
  if (yearly) {
    const fullYearly = +(monthlyPrice * 12).toFixed(2);
    const discountedYearly = +(fullYearly * (1 - yearlyDiscountPct / 100)).toFixed(2);
    return {
      display: `$${Number.isInteger(discountedYearly) ? discountedYearly : discountedYearly.toFixed(2)}`,
      period: '/year',
      originalYearly: `$${Number.isInteger(fullYearly) ? fullYearly : fullYearly.toFixed(2)}/year`,
    };
  }
  return { display: `$${monthlyPrice}`, period: '/month' };
}

export function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [yearly, setYearly] = useState(false);
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    let active = true;
    api.site.getPublicPlans()
      .then((res) => { if (active) setPlanConfig(res.data); })
      .catch(() => { /* use defaults */ });
    return () => { active = false; };
  }, []);

  function getMonthlyPrice(tier: SubscriptionTier): number {
    return planConfig?.pricing?.[tier]?.monthlyPrice ?? DEFAULT_PRICES[tier];
  }

  function getYearlyDiscount(tier: SubscriptionTier): number {
    return planConfig?.pricing?.[tier]?.yearlyDiscount ?? DEFAULT_YEARLY_DISCOUNT;
  }

  async function handleUpgrade(priceKey: string) {
    if (!priceKey) return;
    setLoading(priceKey);
    try {
      const res = await api.billing.checkout(priceKey);
      window.location.href = res.data.url;
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setLoading(null);
    }
  }

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

      {/* Monthly / Yearly Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${!yearly ? 'text-neutral-900' : 'text-neutral-400'}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly(!yearly)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${yearly ? 'bg-brand-500' : 'bg-neutral-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${yearly ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium ${yearly ? 'text-neutral-900' : 'text-neutral-400'}`}>
          Yearly <span className="text-success-600 font-semibold">(Save {getYearlyDiscount('pro')}%)</span>
        </span>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const limits = SUBSCRIPTION_LIMITS[plan.tier];
          const platforms = TIER_PLATFORMS[plan.tier];
          const priceKey = yearly ? plan.priceKeyYearly : plan.priceKeyMonthly;
          const monthlyPrice = getMonthlyPrice(plan.tier);
          const yearlyDiscount = getYearlyDiscount(plan.tier);

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
                {plan.custom ? (
                  <span className="text-3xl font-bold text-neutral-900">Custom</span>
                ) : (() => {
                  const price = formatPrice(monthlyPrice, yearly, yearlyDiscount);
                  return (
                    <>
                      <span className="text-3xl font-bold text-neutral-900">{price.display}</span>
                      {price.period && <span className="text-sm text-neutral-400">{price.period}</span>}
                      {price.originalYearly && (
                        <span className="block text-xs text-neutral-400 line-through mt-0.5">
                          {price.originalYearly}
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

              {plan.tier === 'basic' ? (
                <Button variant="secondary" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : plan.custom ? (
                <Button variant="secondary" className="w-full">
                  Contact Sales
                </Button>
              ) : (
                <Button
                  variant={plan.popular ? 'primary' : 'secondary'}
                  className="w-full"
                  loading={loading === priceKey}
                  onClick={() => handleUpgrade(priceKey)}
                >
                  {plan.popular ? 'Start 14-Day Trial' : 'Upgrade'}
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
              Yes — yearly plans save 30%. Toggle to yearly billing above to see discounted prices.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
