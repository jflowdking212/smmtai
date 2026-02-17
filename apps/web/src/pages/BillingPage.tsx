import { useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '@ee-postmind/shared';
import {
  Check,
  CreditCard,
  Zap,
  Building2,
  Crown,
  ExternalLink,
  Loader2,
} from 'lucide-react';

const plans: {
  tier: SubscriptionTier;
  name: string;
  price: string;
  priceKey: string;
  description: string;
  icon: typeof Zap;
  popular?: boolean;
}[] = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    priceKey: '',
    description: 'Get started with the basics',
    icon: Zap,
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$19',
    priceKey: 'pro_monthly',
    description: 'For growing creators & small teams',
    icon: CreditCard,
    popular: true,
  },
  {
    tier: 'business',
    name: 'Business',
    price: '$49',
    priceKey: 'business_monthly',
    description: 'For agencies & larger teams',
    icon: Building2,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    priceKey: '',
    description: 'Dedicated support & custom limits',
    icon: Crown,
  },
];

const featureLabels: { key: keyof (typeof SUBSCRIPTION_LIMITS)['free']; label: string }[] = [
  { key: 'socialAccounts', label: 'Social accounts' },
  { key: 'postsPerMonth', label: 'Posts per month' },
  { key: 'aiGenerationsPerMonth', label: 'AI generations per month' },
  { key: 'teamMembers', label: 'Team members' },
  { key: 'analyticsDays', label: 'Analytics history' },
];

function formatLimit(value: number, isDays = false): string {
  if (value === Infinity) return 'Unlimited';
  if (isDays) return `${value} days`;
  return value.toLocaleString();
}

export function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);

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

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const limits = SUBSCRIPTION_LIMITS[plan.tier];
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

              <div className="mb-6">
                <span className="text-3xl font-bold text-neutral-900">{plan.price}</span>
                {plan.price !== 'Custom' && plan.price !== '$0' && (
                  <span className="text-sm text-neutral-400">/month</span>
                )}
              </div>

              <ul className="space-y-3 mb-6">
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

              {plan.tier === 'free' ? (
                <Button variant="secondary" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : plan.tier === 'enterprise' ? (
                <Button variant="secondary" className="w-full">
                  Contact Sales
                </Button>
              ) : (
                <Button
                  variant={plan.popular ? 'primary' : 'secondary'}
                  className="w-full"
                  loading={loading === plan.priceKey}
                  onClick={() => handleUpgrade(plan.priceKey)}
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
              Yes — annual plans save 20%. Contact us for enterprise pricing.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
