import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Clock, TrendingUp, TrendingDown, Minus, Loader2, ThumbsUp, ThumbsDown, Lightbulb, Users, Zap, FlaskConical } from 'lucide-react';

interface EngagementSnapshot {
  id: string;
  weekStart: string;
  platform: string;
  avgEngRate: number;
  totalReach: number;
  totalPosts: number;
  topContentType: string | null;
  topTopic: string | null;
  topPostingHour: number | null;
}

interface PatternAnalysis {
  bestPostingTimes: { day: number; hour: number; avgEngRate: number }[];
  bestContentTypes: { type: string; avgEngRate: number; count: number }[];
  bestTopics: { topic: string; avgEngRate: number; count: number }[];
  platformTrends: { platform: string; avgEngRate: number; trend: 'improving' | 'declining' | 'stable' }[];
  weeklyTrend: { week: string; avgEngRate: number }[];
  heatmap: number[][];
  abTestResults: { variableType: string; variationA: string; variationB: string; engRateA: number; engRateB: number; winner: string; confidence: number }[];
}

interface Recommendation {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: number;
  status: string;
  createdAt: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export default function PerformanceIntelligencePage() {
  const [patterns, setPatterns] = useState<PatternAnalysis | null>(null);
  const [snapshots, setSnapshots] = useState<EngagementSnapshot[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [patternsRes, snapshotsRes, recsRes] = await Promise.all([
        fetch('/api/v1/intelligence/patterns', { credentials: 'include' }),
        fetch('/api/v1/intelligence/snapshots', { credentials: 'include' }),
        fetch('/api/v1/intelligence/recommendations', { credentials: 'include' }),
      ]);
      const patternsData = await patternsRes.json();
      const snapshotsData = await snapshotsRes.json();
      const recsData = await recsRes.json();
      if (patternsData.success) setPatterns(patternsData.data);
      if (snapshotsData.success) setSnapshots(snapshotsData.data);
      if (recsData.success) setRecommendations(recsData.data);
    } catch (err) {
      console.error('Failed to load performance data:', err);
    }
    setLoading(false);
  }

  async function updateRecommendation(id: string, status: 'acted' | 'dismissed') {
    try {
      await fetch(`/api/v1/intelligence/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      setRecommendations(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to update recommendation:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  const hasData = patterns && (patterns.bestPostingTimes.length > 0 || patterns.bestContentTypes.length > 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-red-500" />
          Performance Intelligence
        </h1>
        <p className="text-neutral-400 mt-1">AI-powered analysis of your content performance across all platforms</p>
      </div>

      {!hasData ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center">
          <BarChart3 className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Performance Data Yet</h3>
          <p className="text-sm text-neutral-400 max-w-md mx-auto">
            Publish content through SMMTAI and the AI will automatically collect engagement data at 2h, 24h, and 7d intervals. Once enough data is available, you'll see detailed analytics here.
          </p>
        </div>
      ) : (
        <>
          {/* Strategy Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Strategy Recommendations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`bg-neutral-900 border rounded-xl p-4 ${
                      rec.priority >= 2 ? 'border-red-800/50' : rec.priority === 1 ? 'border-yellow-800/50' : 'border-neutral-800'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-sm">{
                        rec.type === 'timing' ? '⏰' :
                        rec.type === 'content_type' ? '📱' :
                        rec.type === 'topic' ? '📝' :
                        rec.type === 'profile_nudge' ? '👤' :
                        rec.type === 'growth' ? '📈' :
                        rec.type === 'ab_test' ? '🔬' : '💡'
                      }</span>
                      <h4 className="text-sm font-semibold text-white leading-tight">{rec.title}</h4>
                    </div>
                    <p className="text-xs text-neutral-400 mb-3 line-clamp-3">{rec.body}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateRecommendation(rec.id, 'acted')}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-green-900/30 text-green-400 border border-green-800/30 hover:bg-green-900/50 transition-colors"
                      >
                        <ThumbsUp className="w-3 h-3" /> Act on it
                      </button>
                      <button
                        onClick={() => updateRecommendation(rec.id, 'dismissed')}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 transition-colors"
                      >
                        <ThumbsDown className="w-3 h-3" /> Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Engagement Heatmap */}
            {patterns.heatmap && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 lg:col-span-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-red-500" />
                  Engagement Heatmap (Day × Hour)
                </h3>
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    {/* Hour labels */}
                    <div className="flex mb-1 ml-10">
                      {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                        <div key={h} className="flex-1 text-[10px] text-neutral-600 text-center">
                          {h}:00
                        </div>
                      ))}
                    </div>
                    {/* Heatmap rows */}
                    {patterns.heatmap.map((row, dayIdx) => (
                      <div key={dayIdx} className="flex items-center gap-1 mb-0.5">
                        <span className="text-[10px] text-neutral-500 w-8 text-right shrink-0">{DAY_NAMES[dayIdx]}</span>
                        <div className="flex gap-[2px] flex-1">
                          {row.map((val, hourIdx) => {
                            const maxVal = Math.max(...patterns.heatmap.flat().filter(v => v > 0));
                            const intensity = maxVal > 0 ? val / maxVal : 0;
                            return (
                              <div
                                key={hourIdx}
                                className="flex-1 h-5 rounded-sm transition-all hover:scale-110 cursor-pointer"
                                style={{
                                  background: intensity > 0
                                    ? `rgba(239, 68, 68, ${0.15 + intensity * 0.85})`
                                    : 'rgb(38, 38, 38)',
                                }}
                                title={`${DAY_NAMES[dayIdx]} ${hourIdx}:00 — ${val.toFixed(1)}% engagement`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2">
                  <span className="text-[10px] text-neutral-600">Low</span>
                  <div className="flex gap-[1px]">
                    {[0.15, 0.35, 0.55, 0.75, 0.95].map((o, i) => (
                      <div key={i} className="w-4 h-2 rounded-sm" style={{ background: `rgba(239, 68, 68, ${o})` }} />
                    ))}
                  </div>
                  <span className="text-[10px] text-neutral-600">High</span>
                </div>
              </div>
            )}

            {/* Best Content Types */}
            {patterns.bestContentTypes.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Content Type Performance
                </h3>
                <div className="space-y-3">
                  {patterns.bestContentTypes.map((ct, i) => {
                    const maxRate = patterns.bestContentTypes[0].avgEngRate;
                    return (
                      <div key={ct.type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-neutral-300 capitalize">{ct.type}</span>
                          <span className="text-xs text-neutral-500">{ct.avgEngRate.toFixed(1)}% ({ct.count} posts)</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(ct.avgEngRate / maxRate) * 100}%`,
                              background: i === 0 ? '#22c55e' : i === 1 ? '#eab308' : '#ef4444',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Best Topics */}
            {patterns.bestTopics.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  📝 Topic Performance
                </h3>
                <div className="space-y-3">
                  {patterns.bestTopics.slice(0, 6).map((tp, i) => {
                    const maxRate = patterns.bestTopics[0].avgEngRate;
                    return (
                      <div key={tp.topic}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-neutral-300 capitalize">{tp.topic}</span>
                          <span className="text-xs text-neutral-500">{tp.avgEngRate.toFixed(1)}% ({tp.count} posts)</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(tp.avgEngRate / maxRate) * 100}%`,
                              background: `hsl(${280 + i * 20}, 60%, 50%)`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Platform Trends */}
            {patterns.platformTrends.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-blue-500" />
                  Platform Comparison
                </h3>
                <div className="space-y-3">
                  {patterns.platformTrends.map((pt) => (
                    <div key={pt.platform} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
                      <span className="text-xs text-neutral-300 capitalize font-medium">{pt.platform}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-400">{pt.avgEngRate.toFixed(1)}%</span>
                        <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                          pt.trend === 'improving' ? 'bg-green-900/30 text-green-400' :
                          pt.trend === 'declining' ? 'bg-red-900/30 text-red-400' :
                          'bg-neutral-800 text-neutral-500'
                        }`}>
                          {pt.trend === 'improving' ? <TrendingUp className="w-3 h-3" /> :
                           pt.trend === 'declining' ? <TrendingDown className="w-3 h-3" /> :
                           <Minus className="w-3 h-3" />}
                          {pt.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Trend */}
            {patterns.weeklyTrend.length > 1 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Week-over-Week Trend
                </h3>
                <div className="flex items-end gap-1 h-32">
                  {patterns.weeklyTrend.map((wk, i) => {
                    const maxRate = Math.max(...patterns.weeklyTrend.map(w => w.avgEngRate));
                    const height = maxRate > 0 ? (wk.avgEngRate / maxRate) * 100 : 0;
                    return (
                      <div key={wk.week} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-neutral-500">{wk.avgEngRate.toFixed(1)}%</span>
                        <div
                          className="w-full rounded-t-sm transition-all duration-500"
                          style={{
                            height: `${Math.max(4, height)}%`,
                            background: i === patterns.weeklyTrend.length - 1 ? '#ef4444' : 'rgb(64, 64, 64)',
                          }}
                        />
                        <span className="text-[9px] text-neutral-600">{wk.week.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* A/B Test Results (Enhancement 4) */}
            {patterns.abTestResults.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 lg:col-span-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <FlaskConical className="w-4 h-4 text-cyan-500" />
                  Natural A/B Test Results
                </h3>
                <div className="space-y-3">
                  {patterns.abTestResults.map((test, i) => (
                    <div key={i} className="bg-neutral-800/50 rounded-lg p-4">
                      <p className="text-xs text-neutral-400 mb-2 capitalize">
                        Testing: <span className="text-white font-medium">{test.variableType}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`rounded-lg p-3 border ${test.winner === 'A' ? 'border-green-800/50 bg-green-900/10' : 'border-neutral-700 bg-neutral-800/30'}`}>
                          <p className="text-[10px] text-neutral-500 uppercase mb-1">
                            {test.winner === 'A' && '🏆 '}Variation A
                          </p>
                          <p className="text-sm font-semibold text-white capitalize">{test.variationA}</p>
                          <p className="text-xs text-neutral-400 mt-1">{test.engRateA.toFixed(1)}% engagement</p>
                        </div>
                        <div className={`rounded-lg p-3 border ${test.winner === 'B' ? 'border-green-800/50 bg-green-900/10' : 'border-neutral-700 bg-neutral-800/30'}`}>
                          <p className="text-[10px] text-neutral-500 uppercase mb-1">
                            {test.winner === 'B' && '🏆 '}Variation B
                          </p>
                          <p className="text-sm font-semibold text-white capitalize">{test.variationB}</p>
                          <p className="text-xs text-neutral-400 mt-1">{test.engRateB.toFixed(1)}% engagement</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-neutral-600 mt-2">
                        Confidence: {(test.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
