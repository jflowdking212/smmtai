import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Eye, Heart, MessageCircle, Share2, MousePointer, Bookmark,
  TrendingUp, Users, FileText, Zap,
} from 'lucide-react';

const CHART_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

interface OverviewData {
  totalPosts: number;
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
  postsPerDay: Record<string, number>;
  platformBreakdown: Record<string, number>;
  recentPosts: any[];
}

interface AnalyticsInsight {
  id: string;
  severity: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: {
    label: string;
    value: string;
  };
}

export function AnalyticsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [platformDetails, setPlatformDetails] = useState<any | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadOverview = useCallback(async (daysValue: number) => {
    const [overviewRes, topPostsRes, insightsRes] = await Promise.all([
      api.analytics.overview(daysValue),
      api.analytics.topPosts(10),
      api.analytics.insights(daysValue),
    ]);
    setData(overviewRes.data);
    setTopPosts(Array.isArray(topPostsRes.data) ? topPostsRes.data : []);
    setInsights(Array.isArray(insightsRes.data?.insights) ? insightsRes.data.insights : []);
  }, []);

  const loadPlatformDetails = useCallback(async (platform: string, daysValue: number) => {
    if (platform === 'all') {
      setPlatformDetails(null);
      return;
    }
    const res = await api.analytics.platform(platform, daysValue);
    setPlatformDetails(res.data);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadOverview(days)
      .catch(() => {
        setData(null);
        setTopPosts([]);
        setInsights([]);
      })
      .finally(() => setLoading(false));
  }, [days, loadOverview]);

  useEffect(() => {
    loadPlatformDetails(selectedPlatform, days).catch(() => setPlatformDetails(null));
  }, [selectedPlatform, days, loadPlatformDetails]);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    try {
      await api.analytics.refresh();
      await loadOverview(days);
      await loadPlatformDetails(selectedPlatform, days);
      setMessage({ type: 'success', text: 'Analytics refresh queued and dashboard data updated.' });
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'Unable to refresh analytics';
      setMessage({ type: 'error', text });
    } finally {
      setRefreshing(false);
    }
  }

  // Generate demo data for charts when no real data exists
  const trendData = data?.postsPerDay
    ? Object.entries(data.postsPerDay).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        posts: count,
      }))
    : Array.from({ length: 14 }, (_, i) => ({
        date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        posts: 0,
      }));

  const platformData = data?.platformBreakdown
    ? Object.entries(data.platformBreakdown).map(([platform, count]) => ({
        name: PLATFORMS[platform as PlatformType]?.name || platform,
        value: count,
        color: PLATFORMS[platform as PlatformType]?.color || '#888',
      }))
    : [];

  const metrics = data?.metrics || { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };

  const statCards = [
    { label: 'Total Posts', value: data?.totalPosts || 0, icon: <FileText className="w-5 h-5" />, color: '#2563EB' },
    { label: 'Published', value: data?.publishedPosts || 0, icon: <Zap className="w-5 h-5" />, color: '#10B981' },
    { label: 'Connected', value: data?.connectedAccounts || 0, icon: <Users className="w-5 h-5" />, color: '#8B5CF6' },
    { label: 'Engagement', value: `${data?.engagementRate || 0}%`, icon: <TrendingUp className="w-5 h-5" />, color: '#F59E0B' },
  ];

  const engagementCards = [
    { label: 'Impressions', value: metrics.impressions, icon: <Eye className="w-4 h-4" /> },
    { label: 'Likes', value: metrics.likes, icon: <Heart className="w-4 h-4" /> },
    { label: 'Comments', value: metrics.comments, icon: <MessageCircle className="w-4 h-4" /> },
    { label: 'Shares', value: metrics.shares, icon: <Share2 className="w-4 h-4" /> },
    { label: 'Clicks', value: metrics.clicks, icon: <MousePointer className="w-4 h-4" /> },
    { label: 'Saves', value: metrics.saves, icon: <Bookmark className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Analytics</h1>
          <p className="text-sm text-neutral-500 mt-1">Track performance across all platforms</p>
        </div>
        <div className="flex bg-neutral-100 rounded-lg p-0.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${days === d ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}
            >
              {d}d
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" loading={refreshing} onClick={handleRefresh}>
          Refresh analytics
        </Button>
      </div>

      {message && (
        <Card className={`p-3 ${message.type === 'error' ? 'border-red-200 bg-red-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
          <p className={`text-sm ${message.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">AI-driven Insights</h3>
          <Badge variant="brand">{days}d window</Badge>
        </div>
        {insights.length > 0 ? (
          <div className="space-y-2">
            {insights.slice(0, 5).map((insight) => (
              <div key={insight.id} className="p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{insight.title}</p>
                    <p className="text-xs text-neutral-500 mt-1">{insight.description}</p>
                    {insight.metric ? (
                      <p className="text-xs text-neutral-600 mt-1">
                        {insight.metric.label}: <span className="font-semibold">{insight.metric.value}</span>
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={insight.severity === 'success' ? 'success' : insight.severity === 'warning' ? 'warning' : 'default'}>
                    {insight.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-400">No insights available yet. Publish and collect more analytics data.</p>
        )}
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                <div style={{ color: s.color }}>{s.icon}</div>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-neutral-900">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Engagement metrics */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {engagementCards.map((e) => (
          <Card key={e.label} className="p-3 text-center">
            <div className="text-neutral-400 mb-1 flex justify-center">{e.icon}</div>
            <p className="text-lg font-bold text-neutral-800">{e.value.toLocaleString()}</p>
            <p className="text-[10px] text-neutral-400">{e.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts trend chart */}
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">Posting Activity</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
              />
              <Bar dataKey="posts" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Platform distribution */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">Platform Distribution</h3>
          {platformData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {platformData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {platformData.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-neutral-600">{p.name}</span>
                    </div>
                    <span className="font-medium text-neutral-800">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs text-neutral-400">No platform data yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent posts */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Recent Published Posts</h3>
        {(data?.recentPosts || []).length > 0 ? (
          <div className="space-y-2">
            {data!.recentPosts.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                <div className="flex gap-1">
                  {p.platformPosts?.map((pp: any, i: number) => (
                    <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${PLATFORMS[pp.platform as PlatformType]?.color || '#888'}20` }}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLATFORMS[pp.platform as PlatformType]?.color || '#888' }} />
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800 truncate">{p.content}</p>
                  <p className="text-xs text-neutral-400">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : ''}</p>
                </div>
                <Badge variant={p.status === 'published' ? 'success' : 'default'}>{p.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-400 py-6 text-center">No published posts yet. Create your first post!</p>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">Platform Drilldown</h3>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white"
          >
            <option value="all">All platforms</option>
            {Object.keys(data?.platformBreakdown || {}).map((platformId) => (
              <option key={platformId} value={platformId}>
                {PLATFORMS[platformId as PlatformType]?.name || platformId}
              </option>
            ))}
          </select>
        </div>

        {selectedPlatform === 'all' || !platformDetails ? (
          <p className="text-xs text-neutral-400">Select a platform to view post-level metrics.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3"><p className="text-xs text-neutral-500">Impressions</p><p className="text-lg font-bold">{(platformDetails.metrics?.impressions || 0).toLocaleString()}</p></Card>
              <Card className="p-3"><p className="text-xs text-neutral-500">Likes</p><p className="text-lg font-bold">{(platformDetails.metrics?.likes || 0).toLocaleString()}</p></Card>
              <Card className="p-3"><p className="text-xs text-neutral-500">Comments</p><p className="text-lg font-bold">{(platformDetails.metrics?.comments || 0).toLocaleString()}</p></Card>
              <Card className="p-3"><p className="text-xs text-neutral-500">Shares</p><p className="text-lg font-bold">{(platformDetails.metrics?.shares || 0).toLocaleString()}</p></Card>
            </div>
            <div className="space-y-2">
              {(platformDetails.posts || []).slice(0, 5).map((post: any) => (
                <div key={post.id} className="p-3 rounded-lg bg-neutral-50">
                  <p className="text-sm text-neutral-800 truncate">{post.content}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {(post.metrics?.impressions || 0).toLocaleString()} impressions • {(post.metrics?.likes || 0).toLocaleString()} likes
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700">Top Posts by Engagement</h3>
        {topPosts.length > 0 ? (
          <div className="space-y-2">
            {topPosts.slice(0, 8).map((post: any) => (
              <div key={post.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-800 truncate">{post.post?.content || 'Untitled post'}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {PLATFORMS[post.platform as PlatformType]?.name || post.platform}
                  </p>
                </div>
                <Badge variant="brand">Score {Math.round(post.engagementScore || 0)}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-400">No top post data yet.</p>
        )}
      </Card>
    </div>
  );
}
