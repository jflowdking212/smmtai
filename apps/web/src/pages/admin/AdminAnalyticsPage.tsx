import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import {
  Users,
  FileText,
  MessageCircle,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';

interface AnalyticsData {
  users: { total: number; newThisMonth: number; newThisWeek: number };
  posts: { total: number; published: number; scheduled: number };
  conversations: { active: number; total: number };
  planDistribution: Record<string, number>;
}

const EMPTY: AnalyticsData = {
  users: { total: 0, newThisMonth: 0, newThisWeek: 0 },
  posts: { total: 0, published: 0, scheduled: 0 },
  conversations: { active: 0, total: 0 },
  planDistribution: {},
};

export function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin.getAnalytics()
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">Analytics</h1>
        <p className="text-neutral-500 text-sm">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">System Analytics</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">User growth, engagement, and platform health metrics.</p>
      </div>

      {error && (
        <Card className="p-4 border-red-800 bg-red-900/30">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      {/* User Growth */}
      <Card className="p-6 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 dark:text-white mb-4">
          <Users className="w-5 h-5 inline-block mr-2 text-blue-400" />
          User Growth
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatBlock label="Total Users" value={data.users.total} color="text-blue-400" />
          <StatBlock label="New This Month" value={data.users.newThisMonth} color="text-emerald-400" icon={<ArrowUpRight className="w-4 h-4" />} />
          <StatBlock label="New This Week" value={data.users.newThisWeek} color="text-purple-400" icon={<ArrowUpRight className="w-4 h-4" />} />
        </div>
      </Card>

      {/* Engagement */}
      <Card className="p-6 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 dark:text-white mb-4">
          <FileText className="w-5 h-5 inline-block mr-2 text-amber-400" />
          Content & Engagement
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatBlock label="Total Posts" value={data.posts.total} color="text-amber-400" />
          <StatBlock label="Published" value={data.posts.published} color="text-emerald-400" />
          <StatBlock label="Scheduled" value={data.posts.scheduled} color="text-blue-400" />
        </div>
      </Card>

      {/* Conversations */}
      <Card className="p-6 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 dark:text-white mb-4">
          <MessageCircle className="w-5 h-5 inline-block mr-2 text-green-400" />
          Conversations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatBlock label="Active Conversations" value={data.conversations.active} color="text-green-400" />
          <StatBlock label="Total Conversations" value={data.conversations.total} color="text-neutral-600 dark:text-neutral-300" />
        </div>
      </Card>

      {/* Plan Distribution */}
      <Card className="p-6 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 dark:text-white mb-4">
          <TrendingUp className="w-5 h-5 inline-block mr-2 text-purple-400" />
          Plan Distribution
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['basic', 'pro', 'business', 'enterprise'].map((tier) => (
            <div key={tier} className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700/50 text-center">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize mb-1">{tier}</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{data.planDistribution[tier] || 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatBlock({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700/50">
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
        {icon && <span className={color}>{icon}</span>}
      </div>
    </div>
  );
}
