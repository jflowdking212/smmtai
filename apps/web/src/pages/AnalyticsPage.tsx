import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
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

export function AnalyticsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.analytics.overview(days)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

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
      </div>

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
    </div>
  );
}
