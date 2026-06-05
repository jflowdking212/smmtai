import { useEffect, useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { CircleHelp, Copy, Ticket, Users } from 'lucide-react';

const PRICE_OPTIONS = [
  { value: 'basic_monthly', label: 'Basic Monthly' },
  { value: 'basic_quarterly', label: 'Basic Quarterly' },
  { value: 'basic_6month', label: 'Basic 6-Month' },
  { value: 'basic_yearly', label: 'Basic Yearly' },

  { value: 'pro_monthly', label: 'Pro Monthly' },
  { value: 'pro_quarterly', label: 'Pro Quarterly' },
  { value: 'pro_6month', label: 'Pro 6-Month' },
  { value: 'pro_yearly', label: 'Pro Yearly' },

  { value: 'business_monthly', label: 'Business Monthly' },
  { value: 'business_quarterly', label: 'Business Quarterly' },
  { value: 'business_6month', label: 'Business 6-Month' },
  { value: 'business_yearly', label: 'Business Yearly' },

  { value: 'enterprise_monthly', label: 'Enterprise Monthly' },
  { value: 'enterprise_quarterly', label: 'Enterprise Quarterly' },
  { value: 'enterprise_6month', label: 'Enterprise 6-Month' },
  { value: 'enterprise_yearly', label: 'Enterprise Yearly' },
] as const;

type CouponFormState = {
  code: string;
  name: string;
  description: string;
  discountPercent: string;
  freeDurationDays: string;
  discountDurationMonths: string;
  maxTotalUses: string;
  maxUniqueUsers: string;
  requireCardForFreeCheckout: 'yes' | 'no';
  maxUsesPerUser: string;
  allowedPriceKeys: string[];
  defaultPriceKey: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

function defaultCouponForm(): CouponFormState {
  return {
    code: '',
    name: '',
    description: '',
    discountPercent: '',
    freeDurationDays: '',
    discountDurationMonths: '',
    maxTotalUses: '',
    maxUniqueUsers: '',
    requireCardForFreeCheckout: 'yes',
    maxUsesPerUser: '1',
    allowedPriceKeys: [],
    defaultPriceKey: '',
    startsAt: '',
    endsAt: '',
    isActive: true,
  };
}

function toNullableInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function FieldLabel({ text, help }: { text: string; help: string }) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className="block text-xs text-neutral-500 dark:text-neutral-400">{text}</span>
      <span className="group relative inline-flex items-center">
        <CircleHelp className="h-3.5 w-3.5 text-neutral-500 cursor-help" />
        <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-[11px] leading-4 text-neutral-800 dark:text-neutral-200 shadow-lg group-hover:block">
          {help}
        </span>
      </span>
    </div>
  );
}

export function AdminCouponsPage() {
  const [couponForm, setCouponForm] = useState<CouponFormState>(defaultCouponForm());
  const [couponLoading, setCouponLoading] = useState(true);
  const [couponSaving, setCouponSaving] = useState(false);
  const [couponList, setCouponList] = useState<any[]>([]);

  const toast = useToast();

  async function refreshCoupons() {
    const res = await api.admin.getCoupons();
    setCouponList(res.data || []);
  }

  useEffect(() => {
    let active = true;
    api.admin.getCoupons()
      .then((res) => {
        if (!active) return;
        setCouponList(res.data || []);
      })
      .catch((err) => {
        if (!active) return;
        toast.error('Error', err instanceof ApiError ? err.message : 'Failed to load coupons');
      })
      .finally(() => {
        if (active) setCouponLoading(false);
      });

    return () => {
      active = false;
    };
  }, [toast]);

  async function handleCreateCoupon() {
    if (!couponForm.code.trim() || !couponForm.name.trim()) {
      toast.error('Validation', 'Coupon code and name are required');
      return;
    }

    const payload = {
      code: couponForm.code.trim(),
      name: couponForm.name.trim(),
      description: couponForm.description.trim() || undefined,
      discountPercent: toNullableInt(couponForm.discountPercent),
      freeDurationDays: toNullableInt(couponForm.freeDurationDays),
      discountDurationMonths: toNullableInt(couponForm.discountDurationMonths),
      maxTotalUses: toNullableInt(couponForm.maxTotalUses),
      maxUniqueUsers: toNullableInt(couponForm.maxUniqueUsers),
      requireCardForFreeCheckout: couponForm.requireCardForFreeCheckout === 'yes',
      maxUsesPerUser: toNullableInt(couponForm.maxUsesPerUser) ?? 1,
      allowedPriceKeys: couponForm.allowedPriceKeys,
      defaultPriceKey: couponForm.defaultPriceKey || null,
      startsAt: couponForm.startsAt || null,
      endsAt: couponForm.endsAt || null,
      isActive: couponForm.isActive,
    };

    setCouponSaving(true);
    try {
      await api.admin.createCoupon(payload);
      await refreshCoupons();
      setCouponForm(defaultCouponForm());
      toast.success('Coupon created', 'Share the generated checkout link with users');
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Failed to create coupon');
    } finally {
      setCouponSaving(false);
    }
  }

  async function handleToggleCoupon(coupon: any) {
    try {
      await api.admin.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      await refreshCoupons();
      toast.success('Updated', `Coupon ${!coupon.isActive ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Failed to update coupon');
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied', 'Coupon link copied to clipboard');
    } catch {
      toast.error('Error', 'Could not copy link');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">Coupon Manager</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Create checkout coupons with limits by total uses, unique users, and per user.</p>
      </div>

      <Card className="p-6 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 space-y-4">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 dark:text-white">
          <Ticket className="w-5 h-5 inline-block mr-2 text-emerald-400" />
          Create Coupon
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <FieldLabel text="Coupon Code" help="Unique code users enter at checkout, for example LAUNCH50." />
            <input
              type="text"
              value={couponForm.code}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="LAUNCH50"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Coupon Name" help="Internal display name used in admin and shown in checkout preview." />
            <input
              type="text"
              value={couponForm.name}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Launch Promo"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel text="Description (optional)" help="Short explanation shown with the coupon to help users understand the offer." />
            <input
              type="text"
              value={couponForm.description}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="First 100 users"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Discount Percent (1-100)" help="Percentage discount applied to the selected package price." />
            <input
              type="number"
              min={1}
              max={100}
              value={couponForm.discountPercent}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Free Duration Days" help="Number of free days granted before billing starts." />
            <input
              type="number"
              min={0}
              max={730}
              value={couponForm.freeDurationDays}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, freeDurationDays: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Discount Duration Months (optional)" help="How many months the percentage discount remains active for subscriptions." />
            <input
              type="number"
              min={1}
              max={36}
              value={couponForm.discountDurationMonths}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, discountDurationMonths: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Max Total Uses (blank = unlimited)" help="Total number of successful redemptions allowed across all users." />
            <input
              type="number"
              min={1}
              value={couponForm.maxTotalUses}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, maxTotalUses: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Max Users (blank = unlimited)" help="Maximum number of unique users that can redeem this coupon." />
            <input
              type="number"
              min={1}
              value={couponForm.maxUniqueUsers}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, maxUniqueUsers: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Max Uses Per User" help="How many times one user can use this coupon." />
            <input
              type="number"
              min={1}
              value={couponForm.maxUsesPerUser}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, maxUsesPerUser: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Require Card For Free Checkout" help="If checkout is free upfront (trial/free offer), choose whether users must still enter card details." />
            <select
              value={couponForm.requireCardForFreeCheckout}
              onChange={(e) => setCouponForm((prev) => ({
                ...prev,
                requireCardForFreeCheckout: (e.target.value === 'no' ? 'no' : 'yes'),
              }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            >
              <option value="yes">Yes, require card details</option>
              <option value="no">No, allow without card</option>
            </select>
          </div>
          <div>
            <FieldLabel text="Starts At (optional)" help="Date and time when this coupon becomes valid." />
            <input
              type="datetime-local"
              value={couponForm.startsAt}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, startsAt: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <FieldLabel text="Ends At (optional)" help="Date and time when this coupon expires." />
            <input
              type="datetime-local"
              value={couponForm.endsAt}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, endsAt: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
        </div>

        <div>
          <FieldLabel text="Eligible Packages" help="Select which packages this coupon can be used on. Leave all unchecked to allow all packages." />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {PRICE_OPTIONS.map((option) => {
              const checked = couponForm.allowedPriceKeys.includes(option.value);
              return (
                <label key={option.value} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setCouponForm((prev) => ({
                        ...prev,
                        allowedPriceKeys: e.target.checked
                          ? [...prev.allowedPriceKeys, option.value]
                          : prev.allowedPriceKeys.filter((value) => value !== option.value),
                      }));
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <FieldLabel text="Default Link Package (optional)" help="Preselect a package when users open the coupon checkout link." />
            <select
              value={couponForm.defaultPriceKey}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, defaultPriceKey: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            >
              <option value="">No default package</option>
              {(couponForm.allowedPriceKeys.length > 0
                ? PRICE_OPTIONS.filter((option) => couponForm.allowedPriceKeys.includes(option.value))
                : PRICE_OPTIONS
              ).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={couponForm.isActive}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active immediately
              <span className="group relative inline-flex items-center">
                <CircleHelp className="h-3.5 w-3.5 text-neutral-500 cursor-help" />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-[11px] leading-4 text-neutral-800 dark:text-neutral-200 shadow-lg group-hover:block">
                  Turn this on to allow immediate use after saving. Turn it off to keep the coupon inactive.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleCreateCoupon} loading={couponSaving} className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 dark:text-white">
            Create Coupon
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-neutral-900 dark:text-white">Existing Coupons</h2>
          <Button size="sm" variant="secondary" onClick={() => void refreshCoupons()}>Refresh</Button>
        </div>

        {couponLoading ? (
          <p className="text-sm text-neutral-500">Loading coupons...</p>
        ) : couponList.length === 0 ? (
          <p className="text-sm text-neutral-500">No coupons yet.</p>
        ) : (
          <div className="space-y-3">
            {couponList.map((coupon) => (
              <div key={coupon.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-white">{coupon.code}</span>
                      <Badge variant={coupon.isActive ? 'success' : 'default'}>{coupon.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">{coupon.name}</p>
                    {coupon.description && <p className="text-xs text-neutral-500 mt-1">{coupon.description}</p>}
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                      {coupon.discountPercent ? `${coupon.discountPercent}% discount` : 'No % discount'}
                      {coupon.freeDurationDays ? ` • ${coupon.freeDurationDays} free day(s)` : ''}
                      {coupon.maxTotalUses ? ` • ${coupon.redemptionCount}/${coupon.maxTotalUses} used` : ` • ${coupon.redemptionCount} redeemed`}
                      {` • per user: ${coupon.maxUsesPerUser}`}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 inline-flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {coupon.maxUniqueUsers
                        ? `${coupon.uniqueUserCount}/${coupon.maxUniqueUsers} users used`
                        : `${coupon.uniqueUserCount} users used`}
                      {coupon.remainingUserSlots !== null ? ` • ${coupon.remainingUserSlots} user slots left` : ''}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Free checkout card: {coupon.requireCardForFreeCheckout ? 'Required' : 'Not required'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void handleCopy(coupon.checkoutLink)}>
                      <Copy className="w-4 h-4" /> Copy Link
                    </Button>
                    <Button
                      size="sm"
                      variant={coupon.isActive ? 'secondary' : 'primary'}
                      onClick={() => void handleToggleCoupon(coupon)}
                    >
                      {coupon.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-2 break-all">{coupon.checkoutLink}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
