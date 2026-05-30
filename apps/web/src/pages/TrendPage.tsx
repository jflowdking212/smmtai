import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  TrendingUp, Flame, RefreshCw, Search, Sparkles,
  ArrowUpRight, ArrowDownRight, BookmarkPlus, Filter,
} from 'lucide-react';

interface Trend {
  id: string;
  topic: string;
  normalizedTopic: string;
  category: string;
  platform: string;
  score: number;
  engagementCount: number;
  growthRate: number;
  trendStatus: 'Emerging' | 'Rising' | 'Hot' | 'Peak' | 'Declining';
  sentiment: 'positive' | 'neutral' | 'negative';
  competitionLevel: number;
  viralProbability: number;
  region?: string;
  lifespanDays?: number;
  createdAt: string;
}

const PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'threads', label: 'Threads' },
];

const CATEGORIES = ['All', 'Technology', 'Business', 'Marketing', 'Health', 'Finance', 'Lifestyle', 'Education', 'Sports', 'Entertainment', 'Fashion', 'Food', 'Travel'];

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  Hot: 'danger',
  Rising: 'warning',
  Emerging: 'default',
  Peak: 'success',
  Declining: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  Hot: '🔥 Hot',
  Rising: '📈 Rising',
  Emerging: '🌱 Emerging',
  Peak: '⭐ Peak',
  Declining: '📉 Declining',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

async function fetchTrendsApi(params: {
  platform?: string;
  category?: string;
  timeframe?: string;
  limit?: number;
}): Promise<{ trends: Trend[]; total: number }> {
  const token = useAuthStore.getState().accessToken;
  const query = new URLSearchParams({ limit: String(params.limit || 50), timeframe: params.timeframe || '7d' });
  if (params.platform && params.platform !== 'all') query.set('platform', params.platform);
  if (params.category && params.category !== 'All') query.set('category', params.category);

  const res = await fetch(`/api/v1/trends?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function generatePostApi(trend: Trend): Promise<string> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch('/api/v1/trends/generate-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: JSON.stringify({ topic: trend.topic, platform: trend.platform, category: trend.category }),
  });
  const data = await res.json();
  return data.content || data.post || `🔥 ${trend.topic} is trending!\n\n#${trend.normalizedTopic} #trending #viral`;
}

export function TrendPage() {
  const navigate = useNavigate();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [category, setCategory] = useState('All');
  const [timeframe, setTimeframe] = useState('7d');
  const [sortBy, setSortBy] = useState<'score' | 'growthRate' | 'engagementCount' | 'viralProbability'>('score');
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedPost, setGeneratedPost] = useState<{ topic: string; content: string } | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrendsApi({ platform, category, timeframe, limit: 60 });
      setTrends(data.trends || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  }, [platform, category, timeframe]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const handleGenerate = async (trend: Trend) => {
    setGenerating(trend.id);
    try {
      const content = await generatePostApi(trend);
      setGeneratedPost({ topic: trend.topic, content });
    } catch {
      setGeneratedPost({
        topic: trend.topic,
        content: `🔥 ${trend.topic} is trending right now!\n\n${formatNumber(trend.engagementCount)} engagements and ${Math.abs(trend.growthRate || 0).toFixed(0)}% growth!\n\n#${trend.normalizedTopic} #trending #viral`,
      });
    } finally {
      setGenerating(null);
    }
  };

  const filtered = trends
    .filter(t => !search || t.topic.toLowerCase().includes(search.toLowerCase()) || (t.category || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

  const hotCount = trends.filter(t => t.score >= 80).length;
  const risingCount = trends.filter(t => ['Rising', 'Emerging'].includes(t.trendStatus)).length;
  const avgGrowth = trends.length ? Math.round(trends.reduce((s, t) => s + (t.growthRate || 0), 0) / trends.length) : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary-600" />
            Trend Intelligence Engine
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Real-time viral trend discovery across all platforms • Auto-refreshes every 5 min</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Trends', value: trends.length, icon: <TrendingUp className="w-5 h-5 text-primary-600" />, sub: 'tracked live' },
          { label: 'Hot Trends', value: hotCount, icon: <Flame className="w-5 h-5 text-red-500" />, sub: 'score ≥ 80' },
          { label: 'Emerging / Rising', value: risingCount, icon: <ArrowUpRight className="w-5 h-5 text-amber-500" />, sub: 'momentum' },
          { label: 'Avg Growth', value: `${avgGrowth}%`, icon: <Sparkles className="w-5 h-5 text-violet-500" />, sub: '7-day rate' },
        ].map((stat, i) => (
          <Card key={i} className="p-4 flex items-start gap-3">
            <div className="p-2 bg-neutral-100 rounded-lg flex-shrink-0">{stat.icon}</div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-neutral-900">{stat.value}</p>
              <p className="text-xs font-medium text-neutral-700 truncate">{stat.label}</p>
              <p className="text-xs text-neutral-400">{stat.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Platform tabs — scrollable on mobile */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              platform === p.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search trends..."
              className="flex-1 bg-transparent text-sm outline-none text-neutral-800 placeholder-neutral-400 min-w-0"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white text-neutral-700 cursor-pointer focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white text-neutral-700 cursor-pointer focus:outline-none"
            >
              <option value="1d">24h</option>
              <option value="3d">3 days</option>
              <option value="7d">7 days</option>
              <option value="15d">15 days</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white text-neutral-700 cursor-pointer focus:outline-none"
            >
              <option value="score">Score</option>
              <option value="viralProbability">Viral %</option>
              <option value="growthRate">Growth</option>
              <option value="engagementCount">Engagement</option>
            </select>
          </div>
          <span className="text-xs text-neutral-400 self-center flex-shrink-0">{filtered.length} found</span>
        </div>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <p className="text-sm text-neutral-500">Discovering trends across all platforms...</p>
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <p className="text-red-500 mb-4 text-sm">{error}</p>
          <Button onClick={load} size="sm">Try Again</Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
          <p className="text-neutral-500 text-sm">No trends found. Try changing filters or refreshing.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(trend => {
            const isHot = trend.score >= 85;
            return (
              <Card
                key={trend.id}
                className={`p-4 relative overflow-hidden hover:shadow-md transition-shadow ${isHot ? 'border-red-200' : ''}`}
              >
                {isHot && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-red-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                    VIRAL
                  </div>
                )}

                {/* Topic + status */}
                <div className="flex items-start justify-between gap-2 mb-3 pr-8">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-neutral-900 truncate">
                      {trend.topic.startsWith('#') ? trend.topic : `#${trend.normalizedTopic || trend.topic}`}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant={STATUS_BADGE[trend.trendStatus] || 'default'}>
                        {STATUS_LABEL[trend.trendStatus] || trend.trendStatus}
                      </Badge>
                      {trend.category && (
                        <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{trend.category}</span>
                      )}
                    </div>
                  </div>
                  <div className={`text-center flex-shrink-0 px-2 py-1 rounded-lg ${trend.score >= 80 ? 'bg-red-50' : 'bg-violet-50'}`}>
                    <span className={`text-lg font-extrabold ${trend.score >= 80 ? 'text-red-500' : 'text-violet-600'}`}>{trend.score}</span>
                    <p className="text-[9px] text-neutral-400 font-semibold">SCORE</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Engagement', value: formatNumber(trend.engagementCount) },
                    {
                      label: 'Growth',
                      value: (
                        <span className={`flex items-center gap-0.5 ${(trend.growthRate || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {(trend.growthRate || 0) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(trend.growthRate || 0).toFixed(0)}%
                        </span>
                      ),
                    },
                    { label: 'Lifespan', value: `${trend.lifespanDays || '?'}d` },
                  ].map((s, i) => (
                    <div key={i} className="bg-neutral-50 rounded-lg p-2 text-center">
                      <div className="text-xs font-bold text-neutral-800">{s.value}</div>
                      <div className="text-[9px] text-neutral-400 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Viral probability bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                    <span>Viral Probability</span>
                    <span>{Math.round(trend.viralProbability || 0)}%</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${trend.viralProbability >= 80 ? 'bg-red-500' : trend.viralProbability >= 60 ? 'bg-amber-500' : 'bg-violet-500'}`}
                      style={{ width: `${trend.viralProbability || 0}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                    onClick={() => handleGenerate(trend)}
                    disabled={!!generating}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generating === trend.id ? 'Generating...' : 'Generate Post'}
                  </Button>
                  <button
                    onClick={() => setSaved(prev => { const n = new Set(prev); n.has(trend.id) ? n.delete(trend.id) : n.add(trend.id); return n; })}
                    className={`p-2 rounded-lg border transition-colors ${saved.has(trend.id) ? 'bg-violet-100 border-violet-300 text-violet-600' : 'bg-neutral-50 border-neutral-200 text-neutral-400 hover:text-neutral-600'}`}
                    title={saved.has(trend.id) ? 'Saved' : 'Save trend'}
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Generate Post Modal */}
      {generatedPost && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setGeneratedPost(null)}
        >
          <Card
            className="w-full max-w-lg p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" /> Generated Post
              </h2>
              <button
                onClick={() => setGeneratedPost(null)}
                className="text-neutral-400 hover:text-neutral-600 text-sm bg-neutral-100 hover:bg-neutral-200 px-3 py-1 rounded-lg transition-colors"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-2 font-medium">Topic: {generatedPost.topic}</p>
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 mb-4 text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap min-h-[100px]">
              {generatedPost.content}
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => { navigator.clipboard.writeText(generatedPost.content); }}
              >
                📋 Copy
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => navigate(`/compose?content=${encodeURIComponent(generatedPost.content)}`)}
              >
                ✍️ Open in Compose
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Generating toast */}
      {generating && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white text-sm px-4 py-3 rounded-xl flex items-center gap-2 shadow-xl z-50">
          <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
          AI is generating your post...
        </div>
      )}
    </div>
  );
}

export default TrendPage;
