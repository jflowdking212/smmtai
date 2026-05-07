import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { Building2, Mail, Search, Users } from 'lucide-react';

interface EntrepreneurProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  workspaceName: string;
  tier: string;
  accountName: string;
  accountId: string;
  connectedAt: string;
}

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

function getTierLabel(tier: string) {
  return TIER_LABELS[tier] || tier.charAt(0).toUpperCase() + tier.slice(1);
}

function formatConnectedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString();
}

function initials(value: string) {
  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function EntrepreneursPage() {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('All');
  const [profiles, setProfiles] = useState<EntrepreneurProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api.users.listEntrepreneurs()
      .then((res) => {
        if (!active) return;
        setProfiles(res.data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load entrepreneur profiles';
        setError(message);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const tiers = useMemo(
    () => ['All', ...Array.from(new Set(profiles.map((entry) => getTierLabel(entry.tier))))],
    [profiles],
  );

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return profiles.filter((entry) => {
      const tierLabel = getTierLabel(entry.tier);
      const matchesTier = tierFilter === 'All' || tierLabel === tierFilter;
      const matchesQuery =
        !query ||
        entry.name.toLowerCase().includes(query) ||
        entry.workspaceName.toLowerCase().includes(query) ||
        entry.accountName.toLowerCase().includes(query) ||
        entry.accountId.toLowerCase().includes(query) ||
        (entry.bio || '').toLowerCase().includes(query);
      return matchesTier && matchesQuery;
    });
  }, [profiles, search, tierFilter]);

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-brand-blue/10 via-brand-blue/5 to-transparent border-brand-blue/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-neutral-900">Entrepreneurs</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Live entrepreneur profiles pulled from connected Entreprenrs accounts.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="brand">
              <Users className="w-3 h-3 mr-1" />
              {profiles.length} Profiles
            </Badge>
            <Badge variant="default">{Math.max(0, tiers.length - 1)} Plans</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,220px] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, workspace, or account"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </div>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="h-10 rounded-xl border border-neutral-200 px-3 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
          >
            {tiers.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {loading && (
        <Card className="p-8 text-center">
          <p className="text-sm text-neutral-500">Loading entrepreneur profiles...</p>
        </Card>
      )}

      {!loading && error && (
        <Card className="p-8 text-center border-red-200 bg-red-50/50">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && !error && filteredProfiles.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-neutral-500">No entrepreneurs matched your filters.</p>
        </Card>
      )}

      {!loading && !error && filteredProfiles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProfiles.map((entry) => {
            const mailto = `mailto:${entry.email}?subject=${encodeURIComponent(`Let's connect on Entreprenrs`)}`;
            return (
              <Card key={entry.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt={entry.name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-semibold shrink-0">
                        {initials(entry.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-neutral-900 truncate">{entry.name}</h3>
                      <p className="text-xs text-neutral-500 flex items-center gap-1 truncate">
                        <Building2 className="w-3.5 h-3.5" />
                        {entry.workspaceName}
                      </p>
                    </div>
                  </div>
                  <Badge variant="brand">{getTierLabel(entry.tier)}</Badge>
                </div>

                <p className="text-xs text-neutral-500 flex items-center gap-1 truncate">
                  <Users className="w-3.5 h-3.5" />
                  {entry.accountName} ({entry.accountId})
                </p>

                <p className="text-sm text-neutral-600 leading-relaxed">{entry.bio || 'No bio added yet.'}</p>

                <p className="text-[11px] text-neutral-500">Connected: {formatConnectedDate(entry.connectedAt)}</p>

                <a href={mailto}>
                  <Button size="sm" className="w-full">
                    <Mail className="w-3.5 h-3.5" />
                    Connect
                  </Button>
                </a>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
