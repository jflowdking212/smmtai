import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { saveComposeSeed } from '@/lib/composeSeed';
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
  country?: string;
  lifespanDays?: number;
  createdAt: string;
}

const PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'threads', label: 'Threads' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'slack', label: 'Slack' },
  { id: 'discord', label: 'Discord' },
  { id: 'wordpress', label: 'WordPress' },
  { id: 'medium', label: 'Medium' },
  { id: 'blogger', label: 'Blogger' },
  { id: 'google_business', label: 'Google Business' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'mastodon', label: 'Mastodon' },
  { id: 'tumblr', label: 'Tumblr' },
  { id: 'truth_social', label: 'Truth Social' },
  { id: 'lemmy', label: 'Lemmy' },
  { id: 'pleroma', label: 'Pleroma' },
  { id: 'entreprenrs', label: 'Entreprenrs' },
  { id: 'chrxstians', label: 'Chrxstians' },
  { id: 'iohah', label: 'Iohah' },
];

const CATEGORIES = ['All', 'Art & Culture', 'Business', 'Crypto / Web3', 'Education', 'Entertainment', 'Environment', 'Fashion', 'Film / TV', 'Finance', 'Food', 'Gaming', 'Health', 'Lifestyle', 'Marketing', 'Music', 'News / Current Events', 'Parenting & Family', 'Politics', 'Real Estate', 'Religion / Faith', 'Science', 'Sports', 'Technology', 'Travel'];

const PLATFORM_LIMITS: Record<string, number> = {
  facebook: 63000,
  instagram: 2200,
  tiktok: 4000,
  linkedin: 3000,
  twitter: 280,
  youtube: 5000,
  pinterest: 500,
  threads: 500,
  reddit: 40000,
  telegram: 4096,
  slack: 4000,
  discord: 2000,
  wordpress: 100000,
  medium: 100000,
  blogger: 100000,
  google_business: 1500,
  bluesky: 300,
  mastodon: 500,
  tumblr: 100000,
  truth_social: 500,
  lemmy: 10000,
  pleroma: 500,
  entreprenrs: 100000,
  chrxstians: 100000,
  iohah: 100000,
};

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
  scope?: string;
}): Promise<{ trends: Trend[]; total: number }> {
  const token = useAuthStore.getState().accessToken;
  const query = new URLSearchParams({ limit: String(params.limit || 50), timeframe: params.timeframe || '7d' });
  if (params.platform && params.platform !== 'all') query.set('platform', params.platform);
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.scope && params.scope !== 'all') query.set('scope', params.scope);

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

async function generatePostWithGuidelinesApi(trendTopic: string, platform: string, instructions?: string): Promise<string> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch('/api/v1/ai/caption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: JSON.stringify({
      topic: `${trendTopic} ${instructions ? `(Additional Guidelines: ${instructions})` : ''}`,
      platform,
      tone: 'professional',
    }),
  });
  const data = await res.json();
  if (data.success && data.data) {
    const caption = data.data.caption || '';
    const hashtags = Array.isArray(data.data.hashtags) ? data.data.hashtags.join(' ') : '';
    return `${caption}\n\n${hashtags}`;
  }
  throw new Error('Failed to generate post');
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
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const [customContent, setCustomContent] = useState('');
  const [humanizing, setHumanizing] = useState(false);
  const [rewriteTone, setRewriteTone] = useState('casual');
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [targetPlatform, setTargetPlatform] = useState('instagram');
  const [targetLength, setTargetLength] = useState<'short' | 'medium' | 'long' | 'extra_long'>('medium');
  const [scope, setScope] = useState('all');

  useEffect(() => {
    const limit = PLATFORM_LIMITS[targetPlatform] || 2200;
    const lenMaxes = { short: 150, medium: 500, long: 1500, extra_long: 5000 };
    if (lenMaxes[targetLength] > limit) {
      if (limit >= 5000) {
        setTargetLength('extra_long');
      } else if (limit >= 1500) {
        setTargetLength('long');
      } else if (limit >= 500) {
        setTargetLength('medium');
      } else {
        setTargetLength('short');
      }
    }
  }, [targetPlatform, targetLength]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrendsApi({ platform, category, timeframe, limit: 60, scope });
      setTrends(data.trends || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  }, [platform, category, timeframe, scope]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const handleGeneratePost = async (trend: Trend) => {
    setHumanizing(true);
    setRewriteError(null);
    try {
      const hashtag = trend.normalizedTopic || trend.topic.replace(/\s+/g, '');
      const instructions = rewriteInstruction.trim()
        ? `Guidelines: ${rewriteInstruction.trim()}`
        : '';
      const prompt = `Write an engaging, highly detailed, and organic post about the trending topic "${trend.topic}". Include the hashtag #${hashtag} naturally. ${instructions}`;
      
      const res = await api.ai.caption({
        topic: prompt,
        platform: targetPlatform,
        tone: rewriteTone,
        include_emoji: true,
        include_cta: true,
        length: targetLength,
      });

      const captionData = res?.data || res || {};
      const baseCaption = typeof captionData.caption === 'string' ? captionData.caption.trim() : '';
      if (!baseCaption) {
        throw new Error('AI did not return generated content');
      }

      const tags = Array.isArray(captionData.hashtags)
        ? captionData.hashtags.map((t: string) => t.startsWith('#') ? t : `#${t}`).join(' ')
        : `#${hashtag}`;

      setCustomContent(`${baseCaption}\n\n${tags}`);
    } catch (e: any) {
      setRewriteError(e.message || 'Failed to generate post');
    } finally {
      setHumanizing(false);
    }
  };

  const handleHumanize = async () => {
    if (!customContent.trim()) return;
    setHumanizing(true);
    setRewriteError(null);
    try {
      const instruction = rewriteInstruction.trim() 
        || 'Rewrite and humanize this content so it sounds natural, authentic, and engaging.';
      const res = await api.ai.rewrite({
        content: customContent,
        platform: targetPlatform,
        tone: rewriteTone,
        instruction,
        length: targetLength,
      });
      const rewritten = res.data?.rewritten;
      if (rewritten) {
        setCustomContent(rewritten);
      } else {
        throw new Error('No rewritten content returned from AI');
      }
    } catch (e: any) {
      setRewriteError(e.message || 'Failed to humanize content');
    } finally {
      setHumanizing(false);
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
              value={scope}
              onChange={e => setScope(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white text-neutral-700 cursor-pointer focus:outline-none"
            >
              <option value="all">📍 Detect Location</option>
              <option value="Global">🌍 Global Space</option>
              <optgroup label="Continents">
                <option value="Africa">Africa</option>
                <option value="Asia">Asia</option>
                <option value="Europe">Europe</option>
                <option value="North America">North America</option>
                <option value="South America">South America</option>
                <option value="Oceania">Oceania</option>
              </optgroup>
              <optgroup label="Countries">
                <option value="Nigeria">Nigeria</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Australia">Australia</option>
                <option value="South Africa">South Africa</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="India">India</option>
                <option value="Japan">Japan</option>
                <option value="Brazil">Brazil</option>
                <option value="Singapore">Singapore</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
              </optgroup>
              </select>
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
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base text-neutral-900 truncate" title={trend.topic}>
                      {trend.topic}
                    </h3>
                    <p className="text-xs text-primary-600 font-semibold truncate mt-0.5">
                      #{trend.normalizedTopic || trend.topic.replace(/\s+/g, '')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant={STATUS_BADGE[trend.trendStatus] || 'default'}>
                        {STATUS_LABEL[trend.trendStatus] || trend.trendStatus}
                      </Badge>
                      {trend.category && (
                        <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{trend.category}</span>
                      )}
                      {(trend.country || trend.region) && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                          {"\uD83D\uDCCD "}{trend.country || trend.region}
                        </span>
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
                    onClick={() => {
                      setSelectedTrend(trend);
                      setCustomContent('');
                      setRewriteInstruction('Write an engaging, highly detailed, and organic viral post about this trend.');
                      setRewriteError(null);
                      const plat = trend.platform && trend.platform !== 'all' ? trend.platform : 'instagram';
                      setTargetPlatform(plat);
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Post
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
      {selectedTrend && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelectedTrend(null)}
        >
          <Card
            className="w-full max-w-xl p-6 shadow-2xl my-8 bg-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
              <div>
                <h2 className="font-bold text-lg text-neutral-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-500 animate-pulse" /> SmmtAI Content Engine
                </h2>
                <div className="mt-1">
                  <span className="text-xs font-bold text-neutral-800">Topic: {selectedTrend.topic}</span>
                  <span className="text-xs text-primary-600 font-bold ml-2">
                    #{selectedTrend.normalizedTopic || selectedTrend.topic.replace(/\s+/g, '')}
                  </span>
                  {(selectedTrend.country || selectedTrend.region) && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5 ml-2">
                      {"\uD83D\uDCCD "}{selectedTrend.country || selectedTrend.region}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedTrend(null)}
                className="text-neutral-400 hover:text-neutral-600 text-sm bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                ✕ Close
              </button>
            </div>

            {/* Custom Interactive Text Editor */}
            <div className="space-y-1.5 mb-4">
              <label className="block text-xs font-bold text-neutral-600">Generated Post Content</label>
              <textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm leading-relaxed text-neutral-800 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                placeholder="Post content will appear here once generated..."
              />
            </div>

            {/* Premium AI Generator & Humanizer Panel */}
            <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 mb-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-violet-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> ⚡ Content Generator
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400 font-semibold">Target Platform:</span>
                  <select
                    value={targetPlatform}
                    onChange={(e) => setTargetPlatform(e.target.value)}
                    className="text-xs border border-neutral-200 rounded px-1.5 py-0.5 bg-white text-neutral-600 font-medium cursor-pointer"
                  >
                    <optgroup label="Major Networks">
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="tiktok">TikTok</option>
                      <option value="twitter">Twitter/X</option>
                      <option value="youtube">YouTube</option>
                      <option value="pinterest">Pinterest</option>
                      <option value="threads">Threads</option>
                      <option value="reddit">Reddit</option>
                    </optgroup>
                    <optgroup label="Messaging Platforms">
                      <option value="telegram">Telegram</option>
                      <option value="slack">Slack</option>
                      <option value="discord">Discord</option>
                    </optgroup>
                    <optgroup label="Blogs & Websites">
                      <option value="wordpress">WordPress</option>
                      <option value="medium">Medium</option>
                      <option value="blogger">Blogger</option>
                      <option value="google_business">Google Business</option>
                    </optgroup>
                    <optgroup label="Microblogs & Federated">
                      <option value="bluesky">Bluesky</option>
                      <option value="mastodon">Mastodon</option>
                      <option value="tumblr">Tumblr</option>
                      <option value="truth_social">Truth Social</option>
                      <option value="lemmy">Lemmy</option>
                      <option value="pleroma">Pleroma</option>
                    </optgroup>
                    <optgroup label="Custom Communities">
                      <option value="entreprenrs">Entreprenrs</option>
                      <option value="chrxstians">Chrxstians</option>
                      <option value="iohah">Iohah</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {rewriteError && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-1.5 text-xs text-red-600">
                  {rewriteError}
                </div>
              )}

              {/* Tone Selection */}
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-semibold block">Tone Profile</span>
                <div className="flex flex-wrap gap-1">
                  {['casual', 'professional', 'witty', 'inspirational', 'educational'].map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setRewriteTone(tone)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        rewriteTone === tone
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      {tone.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Length Selection */}
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-semibold block">Content Length</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'short', label: 'Short (~150 chars)', max: 150 },
                    { id: 'medium', label: 'Medium (~500 chars)', max: 500 },
                    { id: 'long', label: 'Long (~1500 chars)', max: 1500 },
                    { id: 'extra_long', label: 'Extra Long (~5000 chars)', max: 5000 },
                  ].map((len) => {
                    const limit = PLATFORM_LIMITS[targetPlatform] || 2200;
                    const isDisabled = len.max > limit;
                    return (
                      <button
                        key={len.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setTargetLength(len.id as any)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          isDisabled
                            ? 'bg-neutral-50 border border-neutral-100 text-neutral-300 cursor-not-allowed opacity-50'
                            : targetLength === len.id
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {len.label.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-semibold block">Guidelines & Custom Instructions (optional)</span>
                <input
                  value={rewriteInstruction}
                  onChange={(e) => setRewriteInstruction(e.target.value)}
                  placeholder="e.g. write an educational thread, make it short & punchy, add emojis..."
                  className="w-full text-xs border border-neutral-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-violet-500 text-neutral-700"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    loading={humanizing}
                    onClick={() => handleGeneratePost(selectedTrend)}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Generate Post
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={humanizing}
                    disabled={!customContent.trim()}
                    onClick={handleHumanize}
                    className="flex-1 border-violet-200 text-violet-700 hover:bg-violet-50 font-bold text-xs flex items-center justify-center gap-1"
                  >
                    ✨ Humanize Existing
                  </Button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2 border-t border-neutral-100">
              <Button
                variant="secondary"
                className="flex-1 font-bold text-xs"
                disabled={!customContent.trim()}
                onClick={() => {
                  navigator.clipboard.writeText(customContent);
                  alert('Copied to clipboard!');
                }}
              >
                📋 Copy Text
              </Button>
              <Button
                className="flex-1 font-bold text-xs"
                disabled={!customContent.trim()}
                onClick={() => {
                  saveComposeSeed({
                    source: 'ai',
                    content: customContent,
                  });
                  navigate('/compose');
                }}
              >
                ✍️ Push to Compose
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
