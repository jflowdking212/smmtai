import { useCallback, useEffect, useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import {
  Users,
  CalendarClock,
  CreditCard,
  TrendingUp,
  RefreshCw,
  Activity,
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  scheduledPosts: number;
  activeSubscriptions: number;
  planBreakdown: Record<string, number>;
}

const EMPTY_STATS: DashboardStats = {
  totalUsers: 0,
  scheduledPosts: 0,
  activeSubscriptions: 0,
  planBreakdown: {},
};

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const res = await api.admin.getDashboard();
    setStats(res.data);
    setError(null);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadStats()
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [loadStats]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadStats();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Scheduled Posts', value: stats.scheduledPosts, icon: CalendarClock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Active Plans', value: stats.activeSubscriptions, icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Growth', value: `${Object.values(stats.planBreakdown).reduce((a, b) => a + b, 0)} subs`, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-neutral-400 mt-1">System overview and key metrics.</p>
        </div>
        <Button variant="secondary" size="sm" loading={refreshing} onClick={handleRefresh} className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-red-800 bg-red-900/30">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-5 bg-neutral-900 border-neutral-800">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <Badge variant="default" className="bg-neutral-800 text-neutral-300">Live</Badge>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-white">{loading ? '—' : stat.value}</p>
              <p className="text-sm text-neutral-400 mt-0.5">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Plan Breakdown */}
      <Card className="p-6 bg-neutral-900 border-neutral-800">
        <h2 className="text-lg font-heading font-semibold text-white mb-4">
          <CreditCard className="w-5 h-5 inline-block mr-2 text-neutral-400" />
          Subscription Distribution
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['basic', 'pro', 'business', 'enterprise'].map((tier) => (
            <div key={tier} className="p-4 rounded-xl bg-neutral-800/50 border border-neutral-700/50">
              <p className="text-sm text-neutral-400 capitalize">{tier}</p>
              <p className="text-xl font-bold text-white mt-1">{stats.planBreakdown[tier] || 0}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Activity placeholder */}
      <Card className="p-6 bg-neutral-900 border-neutral-800">
        <h2 className="text-lg font-heading font-semibold text-white mb-4">
          <Activity className="w-5 h-5 inline-block mr-2 text-neutral-400" />
          Recent Admin Activity
        </h2>
        <RecentAuditLog />
      </Card>
    </div>
  );
}

function RecentAuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getAuditLog({ limit: '10' })
      .then((res) => setLogs(res.data.logs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Loading...</p>;
  if (logs.length === 0) return <p className="text-sm text-neutral-500">No admin actions recorded yet.</p>;

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/30 border border-neutral-700/30">
          <div>
            <p className="text-sm text-neutral-200">
              <span className="font-medium">{log.admin?.name || 'Admin'}</span>{' '}
              <span className="text-neutral-400">{log.action}</span>
              {log.targetId && <span className="text-neutral-500"> on {log.targetType} {log.targetId.slice(0, 8)}...</span>}
            </p>
          </div>
          <span className="text-xs text-neutral-500">{new Date(log.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
