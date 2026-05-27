import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { Sparkles, ArrowLeft, CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

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
  const couponFromQuery = useMemo(() => searchParams.get('coupon') || '', [searchParams]);
  const canceled = searchParams.get('canceled') === '1';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [couponCode, setCouponCode] = useState(couponFromQuery);
  const [couponPreview, setCouponPreview] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    let active = true;
    api.site.getPublicPlans()
      .then((res) => { if (active) setPlanConfig(res.data); })
      .catch(() => { /* ignore */ });
    return () => { active = false; };
  }, []);

  const nextPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set('upgrade', priceKey);
    if (couponCode.trim()) {
      params.set('coupon', couponCode.trim());
    }
    return `/billing?${params.toString()}`;
  }, [priceKey, couponCode]);
  const loginHref = useMemo(() => `/auth/login?next=${encodeURIComponent(nextPath)}`, [nextPath]);

  useEffect(() => {
    setCouponCode(couponFromQuery);
  }, [couponFromQuery]);

  useEffect(() => {
    let active = true;
    const code = couponCode.trim();
    if (!code) {
      setCouponPreview(null);
      setCouponError('');
      return () => { active = false; };
    }
    api.billing.previewCoupon(code, priceKey || undefined)
      .then((res) => {
        if (!active) return;
        setCouponPreview(res.data);
        setCouponError('');
      })
      .catch((err) => {
        if (!active) return;
        setCouponPreview(null);
        setCouponError(err instanceof ApiError ? err.message : 'Invalid coupon');
      });
    return () => { active = false; };
  }, [couponCode, priceKey]);

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
      const res = await api.billing.checkoutPublic({
        name,
        email,
        priceKey,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      });
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

  const { settings } = useSiteSettings();

  const planSummary = useMemo(() => {
    const tier = priceKey.split('_')[0] || '';
    const interval = priceKey.split('_')[1] || '';
    const baseMonthly = planConfig?.[tier]?.monthlyPrice || (tier === 'pro' ? 25 : tier === 'business' ? 50 : 0);
    
    let months = 1;
    if (interval === '6month') months = 6;
    if (interval === 'yearly') months = 12;
    if (interval === 'quarterly') months = 3;
    
    let subtotal = baseMonthly * months;
    let total = subtotal;
    
    if (couponPreview?.discountPercent) {
      total = subtotal * (1 - couponPreview.discountPercent / 100);
    }

    return {
      tierName: tier.charAt(0).toUpperCase() + tier.slice(1),
      periodName: interval === '6month' ? '6 Months' : interval === 'yearly' ? 'Annually' : interval === 'quarterly' ? 'Quarterly' : 'Monthly',
      subtotal,
      total,
      hasDiscount: !!couponPreview?.discountPercent
    };
  }, [priceKey, planConfig, couponPreview]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        <a href="/#pricing" className="inline-flex items-center gap-2 text-sm text-brand-blue hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to pricing
        </a>

        <div className="flex items-center gap-3">
          {settings.site_logo ? (
            <img src={settings.site_logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
          ) : (
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          )}
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
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
              <div className="space-y-1">
                <p className="text-lg font-bold text-neutral-900">
                  {planSummary.tierName} Plan
                </p>
                <p className="text-sm text-neutral-500 font-medium">
                  Billing Period: {planSummary.periodName}
                </p>
              </div>
              <a href="/#pricing" className="text-xs font-semibold text-brand-blue bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors border border-brand-200">
                Change plan
              </a>
            </div>
            
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-neutral-600">Subtotal</span>
              <span className="text-sm font-medium text-neutral-900">${planSummary.subtotal.toFixed(2)}</span>
            </div>
            
            {planSummary.hasDiscount && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-600 font-medium">Discount ({couponPreview.discountPercent}%)</span>
                <span className="text-sm font-bold text-emerald-600">-${(planSummary.subtotal - planSummary.total).toFixed(2)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
              <span className="text-base font-bold text-neutral-900">Estimated Total</span>
              <span className="text-xl font-extrabold text-neutral-900">${planSummary.total.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-neutral-400 text-right mt-1">Final exact amount computed securely at Stripe checkout</p>
          </div>

          <Input
            label="Coupon code (optional)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="SPRING50"
          />

          {couponPreview && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <p className="font-medium">{couponPreview.name} applied</p>
              <p className="text-xs text-emerald-700 mt-1">
                {couponPreview.discountPercent ? `${couponPreview.discountPercent}% discount` : 'No percentage discount'}
                {couponPreview.freeDurationDays ? ` • ${couponPreview.freeDurationDays} free day(s)` : ''}
                {couponPreview.remainingUserSlots !== null && couponPreview.remainingUserSlots !== undefined
                  ? ` • ${couponPreview.remainingUserSlots} user slot(s) left`
                  : ''}
                {couponPreview.remainingTotalUses !== null && couponPreview.remainingTotalUses !== undefined
                  ? ` • ${couponPreview.remainingTotalUses} total use(s) left`
                  : ''}
                {couponPreview.requireCardForFreeCheckout === false
                  ? ' • No card required for free checkout'
                  : ' • Card required at checkout'}
              </p>
            </div>
          )}

          {couponError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {couponError}
            </div>
          )}

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
