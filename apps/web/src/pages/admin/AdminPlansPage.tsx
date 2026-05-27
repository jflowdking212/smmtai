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
const ALL_PLATFORMS = [
  { id: 'facebook',   name: 'Facebook',   color: '#1877F2' },
  { id: 'instagram',  name: 'Instagram',  color: '#E4405F' },
  { id: 'twitter',    name: 'X (Twitter)', color: '#000000' },
  { id: 'youtube',    name: 'YouTube',    color: '#FF0000' },
  { id: 'tiktok',     name: 'TikTok',     color: '#010101' },
  { id: 'linkedin',   name: 'LinkedIn',   color: '#0A66C2' },
  { id: 'pinterest',  name: 'Pinterest',  color: '#E60023' },
  { id: 'bluesky',    name: 'Bluesky',    color: '#0085FF' },
  { id: 'mastodon',   name: 'Mastodon',   color: '#6364FF' },
  { id: 'telegram',   name: 'Telegram',   color: '#26A5E4' },
  { id: 'entreprenrs', name: 'Entreprenrs', color: '#7C3AED' },
  { id: 'chrxstians', name: 'Chrxstians', color: '#059669' },
  { id: 'iohah',      name: 'Iohah',      color: '#DC2626' },
] as const;

const DEFAULT_TIER_PLATFORMS: Record<string, string[]> = {
  basic:      ['entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram'],
  pro:        ['entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram', 'twitter', 'youtube', 'pinterest'],
  business:   ['entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'linkedin', 'pinterest', 'bluesky', 'mastodon', 'telegram'],
  enterprise: ['entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'linkedin', 'pinterest', 'bluesky', 'mastodon', 'telegram'],
};


function formatValue(val: any): string {
  if (val === Infinity || val === '__INFINITY__') return 'Unlimited';
  return String(val ?? '');
}

function parseValue(val: string): number {
  if (val.toLowerCase() === 'unlimited') return Infinity;
  return parseInt(val, 10) || 0;
}

export function AdminPlansPage() {
  const [planConfig, setPlanConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let active = true;

    api.admin.getPlans()
      .then((res) => {
        if (!active) return;
        const data = JSON.parse(JSON.stringify(res.data), (_k, v) => (v === '__INFINITY__' ? Infinity : v));
        setPlanConfig(data);
      })
      .catch((err) => {
        if (!active) return;
        toast.error('Error', err instanceof ApiError ? err.message : 'Failed to load plans');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
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
  function togglePlatform(tier: string, platformId: string) {
    setPlanConfig((prev) => {
      const current: string[] = prev[tier]?.platforms ?? DEFAULT_TIER_PLATFORMS[tier] ?? [];
      const updated = current.includes(platformId)
        ? current.filter((p) => p !== platformId)
        : [...current, platformId];
      // Auto-sync socialAccounts to match number of selected platforms
      // If all platforms selected -> Unlimited (Infinity), else use count
      const allCount = ALL_PLATFORMS.length;
      const newSocialAccounts = updated.length >= allCount ? Infinity : updated.length;
      return { ...prev, [tier]: { ...prev[tier], platforms: updated, socialAccounts: newSocialAccounts } };
    });
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
          <p className="text-sm text-neutral-400 mt-1">Configure subscription plans, limits, and pricing.</p>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving} className="bg-red-600 hover:bg-red-700 text-white">
          <Save className="w-4 h-4" /> Save All Changes
        </Button>
      </div>

      <Card className="p-6 bg-neutral-900 border-neutral-800">
        <h2 className="text-lg font-heading font-semibold text-white mb-4">
          <Percent className="w-5 h-5 inline-block mr-2 text-amber-400" />
          Billing Period Discounts
        </h2>
        <p className="text-sm text-neutral-400 mb-6">Set discount percentages for each billing period. Changes apply immediately to both the billing page and landing page.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { key: 'quarterlyDiscount', label: 'Quarterly', sublabel: '3-month billing', default: 5 },
            { key: 'sixMonthDiscount',  label: '6-Month',   sublabel: '6-month billing', default: 15 },
            { key: 'yearlyDiscount',    label: 'Yearly',    sublabel: 'Annual billing',   default: 30 },
          ].map(({ key, label, sublabel, default: def }) => (
            <div key={key} className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white">{label}</label>
              <p className="text-xs text-neutral-500">{sublabel}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={planConfig[key] ?? def}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                    setPlanConfig((prev) => ({ ...prev, [key]: val }));
                  }}
                  className="w-24 px-3 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <span className="text-neutral-400 text-sm">% off</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-neutral-800">
          <Button
            size="sm"
            variant="secondary"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            onClick={async () => {
              setSaving(true);
              try {
                await api.admin.savePlans(planConfig);
                toast.success('Applied', 'Billing discounts updated — landing page & billing page now reflect new rates');
              } catch {
                toast.error('Error', 'Failed to save discounts');
              } finally {
                setSaving(false);
              }
            }}
          >
            Apply Now
          </Button>
        </div>
      </Card>

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
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">💰 Monthly Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={config.monthlyPrice ?? (tier === 'basic' ? 0 : tier === 'pro' ? 19 : tier === 'business' ? 49 : 99)}
                    onChange={(e) => updatePlan(tier, 'monthlyPrice', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

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

                {/* Platform Assignment */}
                <div className="pt-3 border-t border-neutral-800">
                  <label className="block text-xs text-neutral-400 mb-2">📡 Platforms Available</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_PLATFORMS.map(({ id, name, color }) => {
                      const assigned: string[] = config.platforms ?? DEFAULT_TIER_PLATFORMS[tier] ?? [];
                      const checked = assigned.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePlatform(tier, id)}
                            className="w-3.5 h-3.5 rounded accent-red-500 cursor-pointer"
                          />
                          <span className="flex items-center gap-1.5 text-xs text-neutral-300 group-hover:text-white transition-colors">
                            <span
                              className="w-2 h-2 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            {name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
