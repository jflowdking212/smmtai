import { useState, useEffect } from 'react';
import { Brain, Target, Mic2, Sparkles, TrendingUp, Loader2, Save, CheckCircle, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';

interface IntelligenceProfile {
  id: string;
  niche: string | null;
  targetAudience: { demographics?: string; painPoints?: string[]; aspirations?: string[] } | null;
  contentPillars: string[];
  tonePreference: string | null;
  avoidedTopics: string[];
  goals: { primary?: string; secondary?: string } | null;
  postingPreferences: { preferredDays?: number[]; preferredTimes?: string[]; frequency?: string } | null;
  brandKeywords: string[];
  completenessScore: number;
}

interface VoiceModel {
  formalityScore: number;
  energyScore: number;
  avgSentenceLength: number | null;
  emojiUsageRate: number;
  ctaStyle: string | null;
  confidenceScore: number;
  samplesAnalyzed: number;
  hashtagPatterns: { avgCount?: number; preferred?: string[] } | null;
}

const TONE_OPTIONS = ['Professional', 'Casual', 'Inspirational', 'Educational', 'Humorous', 'Bold', 'Warm', 'Authoritative'];
const GOAL_OPTIONS = ['Grow followers', 'Drive website traffic', 'Increase sales', 'Build community', 'Generate leads', 'Build brand awareness', 'Educate audience'];

export default function AIProfilePage() {
  const [profile, setProfile] = useState<IntelligenceProfile | null>(null);
  const [voice, setVoice] = useState<VoiceModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newPillar, setNewPillar] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newAvoidTopic, setNewAvoidTopic] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [profileRes, voiceRes] = await Promise.all([
        fetch('/api/v1/intelligence/profile', { credentials: 'include' }),
        fetch('/api/v1/intelligence/voice', { credentials: 'include' }),
      ]);
      const profileData = await profileRes.json();
      const voiceData = await voiceRes.json();
      if (profileData.success) setProfile(profileData.data);
      if (voiceData.success) setVoice(voiceData.data);
    } catch (err) {
      console.error('Failed to load intelligence data:', err);
    }
    setLoading(false);
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/intelligence/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          niche: profile.niche,
          targetAudience: profile.targetAudience,
          contentPillars: profile.contentPillars,
          tonePreference: profile.tonePreference,
          avoidedTopics: profile.avoidedTopics,
          goals: profile.goals,
          brandKeywords: profile.brandKeywords,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
    setSaving(false);
  }

  async function enrichProfile() {
    try {
      const res = await fetch('/api/v1/intelligence/profile/enrich', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) setProfile(data.data);
    } catch (err) {
      console.error('Failed to enrich profile:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  const completeness = profile?.completenessScore || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-red-500" />
            AI Intelligence Profile
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Your AI learns from this profile to generate personalized content</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={enrichProfile}
            className="px-4 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Enrich
          </button>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Completeness Ring */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                className="text-neutral-200 dark:text-neutral-700"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={completeness >= 80 ? '#22c55e' : completeness >= 50 ? '#eab308' : '#ef4444'}
                strokeWidth="3"
                strokeDasharray={`${completeness}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-neutral-900 dark:text-white">{completeness}%</span>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Profile Completeness</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {completeness >= 80
                ? '🎉 Your profile is well-optimized! The AI knows you well.'
                : completeness >= 50
                ? '📈 Good progress! Fill in more details for better AI personalization.'
                : '🚀 Complete your profile to unlock smarter content generation.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Identity Card */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            Brand Identity
          </h3>

          {/* Niche */}
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Niche / Industry</label>
            <input
              type="text"
              value={profile?.niche || ''}
              onChange={(e) => setProfile(p => p ? { ...p, niche: e.target.value } : p)}
              placeholder="e.g. Fitness coaching, SaaS marketing, Fashion"
              className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-sm focus:ring-1 focus:ring-red-500 focus:outline-none placeholder:text-neutral-400"
            />
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Target Audience</label>
            <textarea
              value={profile?.targetAudience?.demographics || ''}
              onChange={(e) => setProfile(p => p ? {
                ...p,
                targetAudience: { ...(p.targetAudience || {}), demographics: e.target.value }
              } : p)}
              placeholder="e.g. Women aged 25-40 interested in home workouts and clean eating"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-sm focus:ring-1 focus:ring-red-500 focus:outline-none resize-none placeholder:text-neutral-400"
            />
          </div>

          {/* Goals */}
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Primary Goal</label>
            <select
              value={profile?.goals?.primary || ''}
              onChange={(e) => setProfile(p => p ? { ...p, goals: { ...(p.goals || {}), primary: e.target.value } } : p)}
              className="w-full px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-sm focus:ring-1 focus:ring-red-500 focus:outline-none"
            >
              <option value="">Select a goal</option>
              {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Preferred Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map(tone => (
                <button
                  key={tone}
                  onClick={() => setProfile(p => p ? { ...p, tonePreference: tone.toLowerCase() } : p)}
                  className={`px-3 py-1 text-xs rounded-full border transition-all ${
                    profile?.tonePreference?.toLowerCase() === tone.toLowerCase()
                      ? 'border-red-500 bg-red-500/20 text-red-600 dark:text-red-400'
                      : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          {/* Content Pillars */}
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Content Pillars</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {profile?.contentPillars.map((pillar, i) => (
                <span key={i} className="px-2.5 py-1 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 flex items-center gap-1.5">
                  {pillar}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500"
                    onClick={() => setProfile(p => p ? { ...p, contentPillars: p.contentPillars.filter((_, idx) => idx !== i) } : p)}
                  />
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPillar}
                onChange={(e) => setNewPillar(e.target.value)}
                placeholder="Add a content pillar"
                className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs focus:ring-1 focus:ring-red-500 focus:outline-none placeholder:text-neutral-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPillar.trim()) {
                    setProfile(p => p ? { ...p, contentPillars: [...p.contentPillars, newPillar.trim()] } : p);
                    setNewPillar('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newPillar.trim()) {
                    setProfile(p => p ? { ...p, contentPillars: [...p.contentPillars, newPillar.trim()] } : p);
                    setNewPillar('');
                  }
                }}
                className="px-2 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Brand Keywords */}
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Brand Keywords / Hashtags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {profile?.brandKeywords.map((kw, i) => (
                <span key={i} className="px-2.5 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 flex items-center gap-1.5">
                  {kw}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500"
                    onClick={() => setProfile(p => p ? { ...p, brandKeywords: p.brandKeywords.filter((_, idx) => idx !== i) } : p)}
                  />
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="#brandhashtag"
                className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs focus:ring-1 focus:ring-red-500 focus:outline-none placeholder:text-neutral-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newKeyword.trim()) {
                    setProfile(p => p ? { ...p, brandKeywords: [...p.brandKeywords, newKeyword.trim()] } : p);
                    setNewKeyword('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newKeyword.trim()) {
                    setProfile(p => p ? { ...p, brandKeywords: [...p.brandKeywords, newKeyword.trim()] } : p);
                    setNewKeyword('');
                  }
                }}
                className="px-2 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Avoided Topics */}
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">⚠️ Avoided Topics</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {profile?.avoidedTopics.map((topic, i) => (
                <span key={i} className="px-2.5 py-1 text-xs rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 flex items-center gap-1.5">
                  {topic}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-700"
                    onClick={() => setProfile(p => p ? { ...p, avoidedTopics: p.avoidedTopics.filter((_, idx) => idx !== i) } : p)}
                  />
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAvoidTopic}
                onChange={(e) => setNewAvoidTopic(e.target.value)}
                placeholder="Topic to avoid"
                className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs focus:ring-1 focus:ring-red-500 focus:outline-none placeholder:text-neutral-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newAvoidTopic.trim()) {
                    setProfile(p => p ? { ...p, avoidedTopics: [...p.avoidedTopics, newAvoidTopic.trim()] } : p);
                    setNewAvoidTopic('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newAvoidTopic.trim()) {
                    setProfile(p => p ? { ...p, avoidedTopics: [...p.avoidedTopics, newAvoidTopic.trim()] } : p);
                    setNewAvoidTopic('');
                  }
                }}
                className="px-2 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Voice Model Card */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-purple-500" />
              Brand Voice Model
            </h3>

            {voice && voice.confidenceScore > 0 ? (
              <>
                {/* Confidence Bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Voice Confidence</span>
                    <span className="text-xs text-neutral-600 dark:text-neutral-300">{(voice.confidenceScore * 100).toFixed(0)}% ({voice.samplesAnalyzed} samples)</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${voice.confidenceScore * 100}%`,
                        background: voice.confidenceScore >= 0.7 ? '#22c55e' : voice.confidenceScore >= 0.4 ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                </div>

                {/* Voice Dimensions */}
                <div className="grid grid-cols-2 gap-4">
                  <VoiceDimension label="Formality" value={voice.formalityScore} low="Casual" high="Formal" color="#ef4444" />
                  <VoiceDimension label="Energy" value={voice.energyScore} low="Calm" high="High Energy" color="#8b5cf6" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase">Avg Sentence</p>
                    <p className="text-lg font-semibold text-neutral-900 dark:text-white">{voice.avgSentenceLength ? `${Math.round(voice.avgSentenceLength)} words` : '—'}</p>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase">Emoji Rate</p>
                    <p className="text-lg font-semibold text-neutral-900 dark:text-white">{voice.emojiUsageRate.toFixed(1)}/100w</p>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase">CTA Style</p>
                    <p className="text-lg font-semibold text-neutral-900 dark:text-white capitalize">{voice.ctaStyle || '—'}</p>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase">Hashtags/Post</p>
                    <p className="text-lg font-semibold text-neutral-900 dark:text-white">{voice.hashtagPatterns?.avgCount ?? '—'}</p>
                  </div>
                </div>

                {/* Preferred Hashtags */}
                {voice.hashtagPatterns?.preferred && voice.hashtagPatterns.preferred.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Your Most Used Hashtags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {voice.hashtagPatterns.preferred.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Mic2 className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Voice model not yet trained</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  Edit AI-generated content to train your voice model. The more you edit, the better it learns.
                </p>
              </div>
            )}
          </div>

          {/* Voice Model Preview */}
          {voice && voice.confidenceScore >= 0.3 && (
            <div className="bg-gradient-to-br from-purple-50 dark:from-purple-900/20 to-white dark:to-neutral-900 border border-purple-200 dark:border-purple-800/30 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                Voice Model Preview
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">See how your voice model transforms AI-generated content:</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-neutral-100 dark:bg-neutral-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase mb-1">Without Voice Model</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">"Check out our new product launch today! Click the link below to learn more."</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800/30">
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 uppercase mb-1">With Your Voice</p>
                  <p className="text-xs text-neutral-800 dark:text-white italic">
                    {voice.formalityScore < 0.4
                      ? `"yo fam 🔥 we just dropped something INSANE — you gotta check this out fr fr ${voice.hashtagPatterns?.preferred?.[0] || '#new'} 💯"`
                      : voice.formalityScore > 0.7
                      ? `"We are excited to announce our latest product offering. We invite you to explore the details and discover how it can benefit your workflow."`
                      : `"Big news! 🎉 We just launched something we've been working on for months. Can't wait for you to try it — check it out! ${voice.hashtagPatterns?.preferred?.[0] || ''}".trim()`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VoiceDimension({ label, value, low, high, color }: { label: string; value: number; low: string; high: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden relative">
        <div
          className="absolute h-full rounded-full transition-all duration-500"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-neutral-400 dark:text-neutral-600">{low}</span>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-600">{high}</span>
      </div>
    </div>
  );
}
