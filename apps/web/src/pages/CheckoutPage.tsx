import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { Sparkles, ArrowLeft, CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react';

function resolvePlanLabel(priceKey: string): string {
  const tier = priceKey.split('_')[0] || '';
  const interval = priceKey.split('_')[1] || '';
  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Plan';
  const intervalLabel = interval ? `(${interval})` : '';
  return `${tierLabel} ${intervalLabel}`.trim();
}

export function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const priceKey = useMemo(() => searchParams.get('priceKey') || '', [searchParams]);
  const canceled = searchParams.get('canceled') === '1';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);

  const nextPath = useMemo(() => `/billing?upgrade=${encodeURIComponent(priceKey)}`, [priceKey]);
  const loginHref = useMemo(() => `/auth/login?next=${encodeURIComponent(nextPath)}`, [nextPath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setExistingAccount(false);

    if (!priceKey) {
      setError('Missing plan selection. Please go back and choose a plan.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.billing.checkoutPublic({ name, email, priceKey });
      window.location.href = res.data.url;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to start checkout';
      setError(message);
      if (err instanceof ApiError && err.code === 'EMAIL_EXISTS') {
        setExistingAccount(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        <Link to="/#pricing" className="inline-flex items-center gap-2 text-sm text-brand-blue hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to pricing
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-bold text-neutral-900 truncate">Complete checkout</h1>
            <p className="text-sm text-neutral-500">Create your account and finish payment in one flow.</p>
          </div>
        </div>

        {canceled && (
          <Card className="p-4 border-amber-200 bg-amber-50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Checkout canceled</p>
                <p className="text-xs text-amber-700">You can try again anytime.</p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-neutral-500" />
            <p className="text-sm font-medium text-neutral-700">
              Selected plan: <span className="font-semibold">{resolvePlanLabel(priceKey)}</span>
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {existingAccount && (
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-700">
              <p className="font-medium">Already have an account?</p>
              <p className="text-xs text-neutral-500 mt-1">Log in to continue your upgrade and payment.</p>
              <div className="mt-3">
                <Link to={loginHref}>
                  <Button variant="secondary" className="w-full">Log in to continue</Button>
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
            />

            <Button type="submit" className="w-full" loading={loading} disabled={existingAccount}>
              Continue to payment
            </Button>
          </form>

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <CheckCircle2 className="w-4 h-4 text-success-600" />
            You&apos;ll set your password after payment via a welcome email.
          </div>
        </Card>
      </div>
    </div>
  );
}

