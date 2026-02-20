import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { PLATFORMS, isPlatformType, type PlatformType } from '@ee-postmind/shared';
import { OnboardingWizard, shouldShowOnboarding } from '@/components/OnboardingWizard';
import {
  TrendingUp,
  Users,
  BarChart3,
  FileText,
  Plus,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface DashboardOverview {
  publishedPosts: number;
  connectedAccounts: number;
  engagementRate: number;
  metrics: {
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    saves: number;
  };
}

interface DashboardConnection {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
  tokenExpired: boolean;
  lastSyncAt: string | null;
}

interface DashboardPost {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  platformPosts: Array<{
    platform: string;
    status: string;
  }>;
}

const EMPTY_OVERVIEW: DashboardOverview = {
  publishedPosts: 0,
  connectedAccounts: 0,
  engagementRate: 0,
  metrics: {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    saves: 0,
  },
};

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  if (status === 'published' || status === 'active') return 'success';
  if (status === 'scheduled' || status === 'pending' || status === 'partial') return 'warning';
  if (status === 'failed' || status === 'rejected' || status === 'inactive') return 'danger';
  return 'default';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);
  const [overview, setOverview] = useState<DashboardOverview>(EMPTY_OVERVIEW);
  const [connections, setConnections] = useState<DashboardConnection[]>([]);
  const [recentPosts, setRecentPosts] = useState<DashboardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    const [overviewRes, connectionsRes, postsRes] = await Promise.all([
      api.analytics.overview(30),
      api.connections.list(),
      api.posts.list({ limit: '5' }),
    ]);

    setOverview((overviewRes.data as DashboardOverview) || EMPTY_OVERVIEW);
    setConnections(Array.isArray(connectionsRes.data) ? (connectionsRes.data as DashboardConnection[]) : []);
    const postList = postsRes.data as { posts?: DashboardPost[] } | undefined;
    setRecentPosts(Array.isArray(postList?.posts) ? postList.posts : []);
    setError(null);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadDashboard()
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : 'Unable to load dashboard analytics';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [loadDashboard]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await api.analytics.refresh();
      await loadDashboard();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to refresh analytics';
      setError(message);
    } finally {
      setRefreshing(false);
    }
  }

  const statCards = [
    { label: 'Impressions (30d)', value: formatCompact(overview.metrics.impressions), icon: BarChart3 },
    { label: 'Engagement Rate', value: `${overview.engagementRate.toFixed(2)}%`, icon: TrendingUp },
    { label: 'Published Posts (30d)', value: formatCompact(overview.publishedPosts), icon: FileText },
    { label: 'Connected Accounts', value: formatCompact(overview.connectedAccounts || connections.length), icon: Users },
  ];

  return (
    <div className="space-y-8">
      {/* Onboarding wizard */}
      {showOnboarding && (
        <OnboardingWizard onDismiss={() => setShowOnboarding(false)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Welcome back! Here&apos;s your live social media overview.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" loading={refreshing} onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/ai')}>
            <Sparkles className="w-4 h-4" /> AI Suggest
          </Button>
          <Button size="sm" onClick={() => navigate('/compose')}>
            <Plus className="w-4 h-4" /> New Post
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="p-4 border-red-200 bg-red-50/60">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-brand-600" />
              </div>
              <Badge variant="brand">Live</Badge>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-neutral-900">{loading ? '—' : stat.value}</p>
              <p className="text-sm text-neutral-500 mt-0.5">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Connected Platforms */}
      <Card className="p-6">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 mb-4">
          Connected Platforms
        </h2>
        <div className="flex flex-wrap gap-3">
          {connections.map((connection) => {
            const platformId: PlatformType | null = isPlatformType(connection.platform) ? connection.platform : null;
            const platform = platformId
              ? PLATFORMS[platformId]
              : { name: connection.platform, color: '#9CA3AF' };
            return (
              <div
                key={connection.id}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 bg-white hover:shadow-sm transition-all duration-200"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: platform.color }}
                />
                <span className="text-sm font-medium text-neutral-700">{platform.name}</span>
                <Badge variant={connection.isActive ? 'success' : 'danger'}>
                  {connection.isActive ? 'Connected' : 'Inactive'}
                </Badge>
                {connection.tokenExpired ? <Badge variant="warning">Token expired</Badge> : null}
              </div>
            );
          })}
          {connections.length === 0 ? (
            <p className="text-sm text-neutral-500">No platforms connected yet.</p>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => navigate('/connections')}>
            <Plus className="w-4 h-4" />
            Add Platform
          </Button>
        </div>
      </Card>

      {/* Recent Posts */}
      <Card className="p-6">
        <h2 className="text-lg font-heading font-semibold text-neutral-900 mb-4">Recent Posts</h2>
        {recentPosts.length > 0 ? (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <div key={post.id} className="p-3 rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-neutral-800 line-clamp-2">{post.content}</p>
                  <Badge variant={getStatusVariant(post.status)}>{formatStatus(post.status)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>
                    {post.publishedAt ? 'Published' : 'Created'}{' '}
                    {new Date(post.publishedAt || post.createdAt).toLocaleString()}
                  </span>
                  {(Array.isArray(post.platformPosts) ? post.platformPosts : []).map((platformPost) => {
                    const platformId: PlatformType | null = isPlatformType(platformPost.platform) ? platformPost.platform : null;
                    const platformName = platformId ? PLATFORMS[platformId].name : platformPost.platform;
                    return (
                      <Badge key={`${post.id}-${platformPost.platform}`} variant="default">
                        {platformName}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No posts yet. Create your first post to get started!</p>
          </div>
        )}
        <Button size="sm" className="mt-4" onClick={() => navigate('/compose')}>
          <Plus className="w-4 h-4" /> Create Post
        </Button>
      </Card>
    </div>
  );
}
