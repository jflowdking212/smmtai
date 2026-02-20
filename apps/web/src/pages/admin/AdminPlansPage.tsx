import { useEffect, useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { SUBSCRIPTION_LIMITS } from '@ee-postmind/shared';
import { Save, Percent } from 'lucide-react';

const LIMIT_FIELDS = [
  { key: 'socialAccounts', label: 'Social Accounts', icon: '🔗' },
  { key: 'postsPerMonth', label: 'Posts / Month', icon: '📝' },
  { key: 'aiGenerationsPerMonth', label: 'AI Generations / Month', icon: '🤖' },
  { key: 'templatesPerMonth', label: 'Templates / Month', icon: '🎨' },
  { key: 'teamMembers', label: 'Team Members', icon: '👥' },
  { key: 'analyticsDays', label: 'Analytics (Days)', icon: '📊' },
] as const;

function formatValue(val: any): string {
  if (val === Infinity || val === '__INFINITY__') return 'Unlimited';
  return String(val ?? '');
}

function parseValue(val: string): number {
  if (val.toLowerCase() === 'unlimited') return Infinity;
  return parseInt(val) || 0;
}

export function AdminPlansPage() {
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.admin.getPlans()
      .then((res) => {
        const data = JSON.parse(JSON.stringify(res.data), (_k, v) => (v === '__INFINITY__' ? Infinity : v));
        setPlanConfig(data);
      })
      .catch((err) => toast.error('Error', err instanceof ApiError ? err.message : 'Failed to load plans'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.admin.savePlans(planConfig);
      toast.success('Saved', 'Plan configuration saved — limits are now active');
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Failed to save plans');
    } finally {
      setSaving(false);
    }
  }

  function updatePlan(tier: string, field: string, value: any) {
    setPlanConfig((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], [field]: value },
    }));
  }

  const tiers = ['basic', 'pro', 'business', 'enterprise'];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-white">Plan Management</h1>
        <p className="text-neutral-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Plan Management</h1>
          <p className="text-sm text-neutral-400 mt-1">Configure subscription plans, limits, and pricing. Changes take effect immediately.</p>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving} className="bg-red-600 hover:bg-red-700 text-white">
          <Save className="w-4 h-4" /> Save All Changes
        </Button>
      </div>

      {/* Yearly Discount */}
      <Card className="p-6 bg-neutral-900 border-neutral-800">
        <h2 className="text-lg font-heading font-semibold text-white mb-4">
          <Percent className="w-5 h-5 inline-block mr-2 text-amber-400" />
          Yearly Discount
        </h2>
        <p className="text-sm text-neutral-400 mb-4">Set a discount percentage for annual billing. Changes apply immediately.</p>
        <div className="flex items-center gap-4 max-w-xs">
          <input
            type="number"
            min={0}
            max={100}
            value={planConfig.yearlyDiscount ?? 20}
            onChange={(e) => {
              const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
              setPlanConfig((prev) => ({ ...prev, yearlyDiscount: val }));
            }}
            className="w-24 px-4 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
          <span className="text-neutral-400 text-sm">% off yearly plans</span>
          <Button
            size="sm"
            variant="secondary"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            onClick={async () => {
              setSaving(true);
              try {
                await api.admin.savePlans(planConfig);
                toast.success('Applied', 'Yearly discount updated');
              } catch (err) {
                toast.error('Error', 'Failed to save discount');
              } finally {
                setSaving(false);
              }
            }}
          >
            Apply Now
          </Button>
        </div>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tiers.map((tier) => {
          const config = planConfig[tier] || {};
          const defaults = SUBSCRIPTION_LIMITS[tier as keyof typeof SUBSCRIPTION_LIMITS];
          return (
            <Card key={tier} className="p-6 bg-neutral-900 border-neutral-800">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-white capitalize">{tier}</h3>
                <Badge variant={tier === 'enterprise' ? 'brand' : tier === 'business' ? 'success' : tier === 'pro' ? 'warning' : 'default'}>
                  {tier === 'basic' ? 'Free' : 'Paid'}
                </Badge>
              </div>
              <div className="space-y-3">
                {/* Price */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">💰 Monthly Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={config.monthlyPrice ?? (tier === 'basic' ? 0 : tier === 'pro' ? 19 : tier === 'business' ? 49 : 99)}
                    onChange={(e) => updatePlan(tier, 'monthlyPrice', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                {/* All limit fields */}
                {LIMIT_FIELDS.map(({ key, label, icon }) => (
                  <div key={key}>
                    <label className="block text-xs text-neutral-400 mb-1">{icon} {label}</label>
                    <input
                      type="text"
                      value={formatValue(config[key] ?? defaults[key])}
                      onChange={(e) => updatePlan(tier, key, parseValue(e.target.value))}
                      placeholder={formatValue(defaults[key])}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <p className="text-[10px] text-neutral-600 mt-0.5">Default: {formatValue(defaults[key])}</p>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
