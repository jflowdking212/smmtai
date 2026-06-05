import { PLATFORMS as SHARED_PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  threads: 500,
  pinterest: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
  reddit: 40000,
  facebook: 63000,
};
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { saveComposeSeed } from '@/lib/composeSeed';
import {
  Sparkles, Hash, Image, RefreshCw, Languages, ShieldCheck,
  Clock, TrendingUp, Copy, CheckCircle2, Loader2, Send,
} from 'lucide-react';

type Tab = 'caption' | 'hashtags' | 'image-prompt' | 'rewrite' | 'translate' | 'compliance' | 'best-times' | 'trending';
type HistoryEntry = {
  id: string;
  tab: Tab;
  platform: string;
  createdAt: string;
  content: string;
};

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'caption', label: 'Caption', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'hashtags', label: 'Hashtags', icon: <Hash className="w-4 h-4" /> },
  { id: 'image-prompt', label: 'Image Prompt', icon: <Image className="w-4 h-4" /> },
  { id: 'rewrite', label: 'Rewrite', icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'translate', label: 'Translate', icon: <Languages className="w-4 h-4" /> },
  { id: 'compliance', label: 'Compliance', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'best-times', label: 'Best Times', icon: <Clock className="w-4 h-4" /> },
  { id: 'trending', label: 'Trending', icon: <TrendingUp className="w-4 h-4" /> },
];

const TONES = ['professional', 'casual', 'witty', 'formal', 'inspirational', 'educational', 'persuasive'];
const BRAND_VOICE_PROFILES = ['formal', 'casual', 'witty', 'professional'];
const BRAND_VOICE_DETAILS_OPTIONS = [
  'Bold and practical',
  'Clever and direct',
  'Friendly and conversational',
  'Authoritative and expert-led',
  'Data-driven and analytical',
  'Warm and empathetic',
  'Minimal and concise',
  'Storytelling and narrative',
  'Premium and aspirational',
  'Playful and humorous',
  'Confident and motivational',
  'Community-first and inclusive',
  'Technical and precise',
  'Luxury and refined',
  'Trustworthy and reassuring',
  'Action-oriented and energetic',
  'Thought-leadership focused',
  'Transparent and honest',
  'Trend-savvy and modern',
  'Educational and step-by-step',
];
const INDUSTRY_OPTIONS = [
  'SaaS',
  'Technology',
  'E-commerce',
  'Retail',
  'Fintech',
  'Banking',
  'Insurance',
  'Healthcare',
  'Pharmaceuticals',
  'Biotech',
  'Telecommunications',
  'Media & Entertainment',
  'Gaming',
  'Education',
  'EdTech',
  'Real Estate',
  'Construction',
  'Hospitality',
  'Travel & Tourism',
  'Food & Beverage',
  'Restaurants',
  'Agriculture',
  'Automotive',
  'Transportation & Logistics',
  'Manufacturing',
  'Energy',
  'Utilities',
  'Oil & Gas',
  'Renewables',
  'Fashion & Apparel',
  'Beauty & Cosmetics',
  'Wellness & Fitness',
  'Sports',
  'Nonprofit',
  'Government',
  'Legal',
  'HR & Recruiting',
  'Marketing & Advertising',
  'Public Relations',
  'Cybersecurity',
  'Cloud Computing',
  'AI & Machine Learning',
  'Data Analytics',
  'Blockchain & Web3',
  'Consumer Electronics',
  'Home Services',
  'Professional Services',
  'Consulting',
  'Architecture & Design',
  'Interior Design',
  'Events & Conferences',
  'Music',
  'Film & TV',
  'Publishing',
  'Parenting & Family',
  'Pet Care',
  'Spirituality & Faith',
  'Community Development',
];
const AUDIENCE_PERSONA_OPTIONS = [
  'Startup founders',
  'First-time store owners',
  'Small business owners',
  'Enterprise decision-makers',
  'Marketing managers',
  'Sales leaders',
  'Product managers',
  'Software developers',
  'IT administrators',
  'HR professionals',
  'Finance professionals',
  'Operations managers',
  'Creators and influencers',
  'Freelancers and solopreneurs',
  'Students and early-career professionals',
  'Job seekers',
  'Parents with young children',
  'Gen Z consumers',
  'Millennial professionals',
  'High-income professionals',
  'Budget-conscious shoppers',
  'Health-conscious adults',
  'Fitness enthusiasts',
  'Beauty enthusiasts',
  'Gamers',
  'Travel enthusiasts',
  'Foodies',
  'Homeowners',
  'Real estate investors',
  'Local community members',
  'Nonprofit donors',
  'Faith-based community leaders',
  'Educators and teachers',
  'Researchers and analysts',
  'B2B procurement teams',
  'Customer support teams',
  'E-commerce growth teams',
  'Agency owners',
  'Content marketers',
  'Event organizers',
  'Women entrepreneurs',
  'First-time buyers',
];
const PLATFORMS = Object.keys(SHARED_PLATFORMS);
const HISTORY_LIMIT = 12;

function summarizeResult(tab: Tab, value: any): string {
  if (!value || typeof value !== 'object') return '';
  switch (tab) {
    case 'caption':
      return typeof value.caption === 'string' ? value.caption : '';
    case 'hashtags':
      return Array.isArray(value.hashtags) ? value.hashtags.map((tag: string) => `#${tag}`).join(' ') : '';
    case 'image-prompt':
      return typeof value.prompt === 'string' ? value.prompt : '';
    case 'rewrite':
      return typeof value.rewritten === 'string' ? value.rewritten : '';
    case 'translate':
      return typeof value.translated === 'string' ? value.translated : '';
    case 'compliance':
      return `Compliance: ${value.is_safe ? 'Safe' : 'Issues detected'} (${Math.round((value.score || 0) * 100)}% risk)`;
    case 'best-times':
      return Array.isArray(value.times)
        ? value.times.map((item: any) => `${item.day || ''} ${item.time || ''}`.trim()).filter(Boolean).join(', ')
        : '';
    case 'trending':
      return Array.isArray(value.topics)
        ? value.topics.map((item: any) => item.topic).filter(Boolean).join(', ')
        : '';
    default:
      return '';
  }
}

export function AIPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('caption');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // Form state
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [tone, setTone] = useState('professional');
  const [language, setLanguage] = useState('en');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [industry, setIndustry] = useState('');
  const [audiencePersona, setAudiencePersona] = useState('');
  const [brandVoiceProfile, setBrandVoiceProfile] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [length, setLength] = useState<'short' | 'medium' | 'long' | 'extra_long'>('medium');

  useEffect(() => {
    const limit = PLATFORM_LIMITS[platform] || 2200;
    const lenMaxes = { short: 150, medium: 500, long: 1500, extra_long: 5000 };
    if (lenMaxes[length] > limit) {
      if (limit >= 5000) {
        setLength('extra_long');
      } else if (limit >= 1500) {
        setLength('long');
      } else if (limit >= 500) {
        setLength('medium');
      } else {
        setLength('short');
      }
    }
  }, [platform, length]);

  const optionalValue = (value: string) => value.trim() || undefined;

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    try {
      let res: any;
      switch (tab) {
        case 'caption':
          res = await api.ai.caption({
            topic,
            platform,
            tone,
            language,
            include_emoji: true,
            include_cta: true,
            brand_voice_profile: brandVoiceProfile || undefined,
            brand_voice: optionalValue(brandVoice),
            industry: optionalValue(industry),
            audience_persona: optionalValue(audiencePersona),
            length,
          });
          break;
        case 'hashtags':
          res = await api.ai.hashtags({
            topic,
            platform,
            count: 15,
            industry: optionalValue(industry),
            audience_persona: optionalValue(audiencePersona),
          });
          break;
        case 'image-prompt':
          res = await api.ai.imagePrompt({ topic, platform, style: 'modern, clean, professional' });
          break;
        case 'rewrite':
          res = await api.ai.rewrite({ content, platform, tone, length });
          break;
        case 'translate':
          res = await api.ai.translate({ content, platform, target_language: targetLang });
          break;
        case 'compliance':
          res = await api.ai.compliance({ content, platform });
          break;
        case 'best-times':
          res = await api.ai.bestTimes({ platform, industry: optionalValue(industry) });
          break;
        case 'trending':
          res = await api.ai.trending({
            platform,
            industry: optionalValue(industry),
            audience_persona: optionalValue(audiencePersona),
            count: 10,
          });
          break;
      }
      const data = res?.data || res;
      setResult(data);
      const summary = summarizeResult(tab, data).trim();
      if (summary) {
        setHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            tab,
            platform,
            createdAt: new Date().toISOString(),
            content: summary,
          },
          ...prev,
        ].slice(0, HISTORY_LIMIT));
      }
    } catch (err: any) {
      setResult({ error: err.message || 'AI service unavailable' });
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleUseInCompose(payload: { content?: string; hashtags?: string[] }) {
    const nextContent = payload.content?.trim();
    const nextHashtags = payload.hashtags?.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    saveComposeSeed({
      source: 'ai',
      content: nextContent || undefined,
      hashtags: nextHashtags && nextHashtags.length > 0 ? nextHashtags : undefined,
    });
    navigate('/compose');
  }

  const needsTopic = ['caption', 'hashtags', 'image-prompt'].includes(tab);
  const needsContent = ['rewrite', 'translate', 'compliance'].includes(tab);
  const showsIndustry = ['caption', 'hashtags', 'best-times', 'trending'].includes(tab);
  const showsAudiencePersona = ['caption', 'hashtags', 'trending'].includes(tab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-neutral-900">AI Assistant</h1>
        <p className="text-sm text-neutral-500 mt-1">Generate content, get insights, and optimize posts with AI</p>
      </div>

      {/* Tab pills */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setResult(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${tab === t.id
                ? 'bg-brand-blue text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input panel */}
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-neutral-900">Input</h3>

          {/* Platform selector */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            >
              {PLATFORMS.map((p) => {
                const meta = SHARED_PLATFORMS[p as PlatformType];
                return (
                  <option key={p} value={p}>
                    {meta?.name || (p.charAt(0).toUpperCase() + p.slice(1))}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tone (for caption/rewrite) */}
          {['caption', 'rewrite'].includes(tab) && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tone</label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all
                      ${tone === t ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Length (for caption/rewrite) */}
          {['caption', 'rewrite'].includes(tab) && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Content Length</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'short', label: 'Short (~150 chars)', max: 150 },
                  { id: 'medium', label: 'Medium (~500 chars)', max: 500 },
                  { id: 'long', label: 'Long (~1500 chars)', max: 1500 },
                  { id: 'extra_long', label: 'Extra Long (~5000 chars)', max: 5000 },
                ].map((len) => {
                  const limit = PLATFORM_LIMITS[platform] || 2200;
                  const isDisabled = len.max > limit;
                  return (
                    <button
                      key={len.id}
                      disabled={isDisabled}
                      onClick={() => setLength(len.id as any)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        isDisabled
                          ? 'bg-neutral-50 border border-neutral-100 text-neutral-300 cursor-not-allowed opacity-50'
                          : length === len.id
                          ? 'bg-brand-blue text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {len.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Topic input */}
          {needsTopic && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Topic</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Describe what your post should be about..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
          )}

          {tab === 'caption' && (
            <>
              <div>
                <label htmlFor="brand-voice-profile" className="block text-sm font-medium text-neutral-700 mb-1">Brand Voice Profile (optional)</label>
                <select
                  id="brand-voice-profile"
                  value={brandVoiceProfile}
                  onChange={(e) => setBrandVoiceProfile(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                >
                  <option value="">Select a profile</option>
                  {BRAND_VOICE_PROFILES.map((profile) => (
                    <option key={profile} value={profile}>
                      {profile.charAt(0).toUpperCase() + profile.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="brand-voice-details" className="block text-sm font-medium text-neutral-700 mb-1">Brand Voice Details (optional)</label>
                <select
                  id="brand-voice-details"
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                >
                  <option value="">Select brand voice details</option>
                  {BRAND_VOICE_DETAILS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {showsIndustry && (
            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-neutral-700 mb-1">Industry (optional)</label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              >
                <option value="">Select an industry</option>
                {INDUSTRY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showsAudiencePersona && (
            <div>
              <label htmlFor="audience-persona" className="block text-sm font-medium text-neutral-700 mb-1">Audience Persona (optional)</label>
              <select
                id="audience-persona"
                value={audiencePersona}
                onChange={(e) => setAudiencePersona(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              >
                <option value="">Select an audience persona</option>
                {AUDIENCE_PERSONA_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Content input */}
          {needsContent && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your content here..."
                rows={5}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
          )}

          {/* Target language for translate */}
          {tab === 'translate' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Target Language</label>
              <input
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                placeholder="e.g. Spanish, French, Japanese"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>
          )}

          <Button onClick={handleGenerate} loading={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Generating...' : 'Generate'}
          </Button>
        </Card>

        {/* Result panel */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Result</h3>
            {result && !result.error && (
              <button
                onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>

          {!result && !loading && (
            <div className="py-12 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-neutral-200" />
              <p className="text-sm text-neutral-400">Results will appear here</p>
            </div>
          )}

          {loading && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-brand-blue animate-spin" />
              <p className="text-sm text-neutral-500">AI is thinking...</p>
            </div>
          )}

          {result?.error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-600">{result.error}</p>
            </div>
          )}

          {result && !result.error && tab === 'caption' && (
            <div className="space-y-3">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{result.caption}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>{result.character_count} / {result.platform_limit} chars</span>
              </div>
              {result.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.hashtags.map((h: string) => (
                    <Badge key={h} variant="default">#{h}</Badge>
                  ))}
                </div>
              )}
              {result.cta && (
                <p className="text-xs text-brand-blue font-medium">CTA: {result.cta}</p>
              )}
              <Button size="sm" variant="secondary" onClick={() => copyToClipboard(result.caption)}>
                <Copy className="w-3 h-3" /> Copy Caption
              </Button>
              <Button
                size="sm"
                onClick={() => handleUseInCompose({
                  content: result.caption,
                  hashtags: Array.isArray(result.hashtags) ? result.hashtags : undefined,
                })}
              >
                <Send className="w-3 h-3" /> Use in Compose
              </Button>
            </div>
          )}

          {result && !result.error && tab === 'hashtags' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags?.map((h: string) => (
                  <Badge key={h} variant="default" className="cursor-pointer hover:bg-neutral-200">#{h}</Badge>
                ))}
              </div>
              {result.trending?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-600 mb-1">🔥 Trending</p>
                  <div className="flex flex-wrap gap-1">
                    {result.trending.map((h: string) => (
                      <Badge key={h} variant="success">#{h}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={() => copyToClipboard(result.hashtags.map((h: string) => `#${h}`).join(' '))}>
                <Copy className="w-3 h-3" /> Copy All
              </Button>
              <Button
                size="sm"
                onClick={() => handleUseInCompose({
                  hashtags: Array.isArray(result.hashtags) ? result.hashtags : undefined,
                })}
              >
                <Send className="w-3 h-3" /> Use in Compose
              </Button>
            </div>
          )}

          {result && !result.error && tab === 'image-prompt' && (
            <div className="space-y-3">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-800">{result.prompt}</p>
              </div>
              {result.suggested_style && (
                <p className="text-xs text-neutral-500">Style: {result.suggested_style}</p>
              )}
              <Button size="sm" variant="secondary" onClick={() => copyToClipboard(result.prompt)}>
                <Copy className="w-3 h-3" /> Copy Prompt
              </Button>
            </div>
          )}

          {result && !result.error && tab === 'rewrite' && (
            <div className="space-y-3">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{result.rewritten}</p>
              </div>
              <p className="text-xs text-neutral-500">{result.character_count} chars — {result.changes_summary}</p>
              <Button size="sm" variant="secondary" onClick={() => copyToClipboard(result.rewritten)}>
                <Copy className="w-3 h-3" /> Copy
              </Button>
              <Button size="sm" onClick={() => handleUseInCompose({ content: result.rewritten })}>
                <Send className="w-3 h-3" /> Use in Compose
              </Button>
            </div>
          )}

          {result && !result.error && tab === 'translate' && (
            <div className="space-y-3">
              <div className="p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{result.translated}</p>
              </div>
              {result.cultural_notes && (
                <p className="text-xs text-neutral-500">📝 {result.cultural_notes}</p>
              )}
              <Button size="sm" variant="secondary" onClick={() => copyToClipboard(result.translated)}>
                <Copy className="w-3 h-3" /> Copy
              </Button>
              <Button size="sm" onClick={() => handleUseInCompose({ content: result.translated })}>
                <Send className="w-3 h-3" /> Use in Compose
              </Button>
            </div>
          )}

          {result && !result.error && tab === 'compliance' && (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg ${result.is_safe ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className={`w-5 h-5 ${result.is_safe ? 'text-green-500' : 'text-red-500'}`} />
                  <span className="font-medium text-sm">{result.is_safe ? 'Content is safe' : 'Issues detected'}</span>
                  <Badge variant={result.score < 0.3 ? 'success' : result.score < 0.7 ? 'warning' : 'danger'}>
                    Risk: {(result.score * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
              {result.issues?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1">Issues:</p>
                  <ul className="text-xs text-red-500 space-y-1">
                    {result.issues.map((i: string, idx: number) => <li key={idx}>• {i}</li>)}
                  </ul>
                </div>
              )}
              {result.suggestions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-600 mb-1">Suggestions:</p>
                  <ul className="text-xs text-neutral-500 space-y-1">
                    {result.suggestions.map((s: string, idx: number) => <li key={idx}>💡 {s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result && !result.error && tab === 'best-times' && (
            <div className="space-y-2">
              {result.times?.map((t: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-neutral-800">{t.day}</span>
                    <span className="ml-2 text-sm text-neutral-500">{t.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-blue rounded-full" style={{ width: `${(t.score || 0) * 100}%` }} />
                    </div>
                    <span className="text-xs text-neutral-400">{((t.score || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result && !result.error && tab === 'trending' && (
            <div className="space-y-3">
              {result.topics?.map((t: any, idx: number) => (
                <div key={idx} className="p-3 bg-neutral-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-neutral-800">{t.topic}</span>
                    <Badge variant={t.relevance > 0.8 ? 'success' : 'default'}>
                      {(t.relevance * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  {t.content_idea && <p className="text-xs text-neutral-500 mb-1">{t.content_idea}</p>}
                  {t.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.hashtags.map((h: string) => (
                        <span key={h} className="text-xs text-brand-blue">#{h}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-neutral-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-neutral-800">Recent history</h4>
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-neutral-400">No history yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <div key={entry.id} className="p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="default" className="text-[10px] uppercase tracking-wide">
                        {entry.tab}
                      </Badge>
                      <span className="text-[11px] text-neutral-400">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 mb-1">{entry.platform}</p>
                    <p className="text-sm text-neutral-800 whitespace-pre-wrap break-words">{entry.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
