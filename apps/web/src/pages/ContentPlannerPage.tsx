import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import {
  Sparkles, CalendarDays, Upload, Image as ImageIcon, Send, RefreshCw,
  Trash2, Edit, Palette, X, AlertCircle, CheckCircle2, MessageSquare, Lock,
  Clock, ThumbsUp, ThumbsDown, RotateCcw, ExternalLink, WifiOff, PlusCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '@/lib/api';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ── Platform badge colours ───────────────────────────────────────────────────
const PLATFORM_COLOURS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  twitter: 'bg-sky-100 text-sky-700',
  linkedin: 'bg-indigo-100 text-indigo-700',
  tiktok: 'bg-slate-100 text-slate-700',
  youtube: 'bg-red-100 text-red-700',
};

const TONES = ['Professional', 'Casual', 'Hype', 'Educational', 'Inspirational'];

function PlatformBadge({ platform }: { platform: string }) {
  const cls = PLATFORM_COLOURS[platform.toLowerCase()] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {platform}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function ContentPlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPlanId = searchParams.get('planId');
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [viewingPlanId, setViewingPlanId] = useState<string | null>(urlPlanId);

  const handleViewPlan = (planId: string) => {
    setViewingPlanId(planId);
    setActiveTab('new');
    setSearchParams({ planId });
  };

  const handleTabChange = (tab: 'new' | 'history') => {
    setActiveTab(tab);
    if (tab !== 'new') setViewingPlanId(null);
  };

  const handleNewPlan = () => {
    setViewingPlanId(null);
    setActiveTab('new');
    setSearchParams({});
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            AI Content Planner
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">Generate a complete multi-platform social media plan in seconds.</p>
        </div>
        {viewingPlanId && (
          <Button size="sm" variant="secondary" onClick={handleNewPlan}>
            <PlusCircle className="w-4 h-4 mr-1" /> New Plan
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b border-neutral-200">
        {(['new', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-violet-500 text-violet-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab === 'new' ? (viewingPlanId ? 'Review Plan' : 'New Plan') : 'History'}
          </button>
        ))}
      </div>

      {activeTab === 'new'
        ? (viewingPlanId
            ? <PlanReviewDashboard planId={viewingPlanId} onNewPlan={handleNewPlan} />
            : <NewPlanWizard onPlanCreated={(id) => { setViewingPlanId(id); setSearchParams({ planId: id }); }} />
          )
        : <PlanHistory onViewPlan={handleViewPlan} />
      }
    </div>
  );
}

// ── Step Wizard ──────────────────────────────────────────────────────────────
function NewPlanWizard({ onPlanCreated }: { onPlanCreated: (planId: string) => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [tone, setTone] = useState('Professional');
  const [duration, setDuration] = useState(5);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [clarification, setClarification] = useState<string | null>(null);

  // Fetch real connected platforms
  const { data: connectionsData, isLoading: loadingConnections } = useQuery({
    queryKey: ['connections-list'],
    queryFn: () => api.connections.list(),
    staleTime: 60000
  });

  const connectedPlatforms: string[] = React.useMemo(() => {
    const conns = (connectionsData as any)?.data || [];
    return [...new Set<string>(conns.filter((c: any) => c.isActive).map((c: any) => c.platform as string))];
  }, [connectionsData]);

  // Default-select all connected platforms once loaded
  useEffect(() => {
    if (connectedPlatforms.length > 0 && selectedPlatforms.length === 0) {
      setSelectedPlatforms(connectedPlatforms);
    }
  }, [connectedPlatforms]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.contentPlanner.generate({
        prompt,
        platforms: selectedPlatforms,
        tone,
        durationDays: duration
      });
      return res;
    },
    onSuccess: (data: any) => {
      setClarification(null);
      onPlanCreated(data.planId);
    },
    onError: (err: any) => {
      const clarificationMsg = (err as any)?.clarification || err?.response?.clarification;
      if (clarificationMsg) {
        setClarification(clarificationMsg);
      } else {
        toast.error(err?.message || 'Generation failed. Please try again.');
      }
    }
  });

  const isPending = generateMutation.isPending;
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress stepper */}
      <div className="flex items-center mb-8 gap-2">
        {[1, 2].map(s => (
          <React.Fragment key={s}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
              step >= s ? 'bg-violet-600 text-white' : 'bg-neutral-200 text-neutral-500'
            }`}>{s}</div>
            {s < 2 && <div className={`flex-1 h-1 rounded ${step > s ? 'bg-violet-500' : 'bg-neutral-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" /> Describe Your Goal
            </h2>
            <p className="text-sm text-neutral-500">What do you want to achieve? <span className="text-violet-500 font-medium">(Min 15 words for best results)</span></p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. I want to grow my software agency's brand awareness for the next 5 days. Post educational content about AI tools every morning at 9am. Keep the tone professional but approachable."
              className="w-full min-h-[160px] px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
            />
            <div className="flex justify-between text-xs text-neutral-400">
              <span>{wordCount} words</span>
              {wordCount < 15 && wordCount > 0 && (
                <span className="text-amber-500">Add more detail for better results</span>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-violet-500" /> Configure Your Plan
            </h2>

            {/* Connected Platforms */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-neutral-700">Target Platforms
                <span className="text-xs text-neutral-400 font-normal ml-2">(your connected accounts)</span>
              </h3>
              {loadingConnections ? (
                <div className="text-sm text-neutral-400 animate-pulse">Loading your connected platforms…</div>
              ) : connectedPlatforms.length === 0 ? (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <WifiOff className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">No connected platforms</p>
                    <p className="text-xs text-amber-600 mt-1">Connect at least one social account before creating a plan.</p>
                    <button
                      onClick={() => navigate('/connections')}
                      className="mt-2 text-xs text-violet-600 font-semibold hover:underline flex items-center gap-1"
                    >
                      Connect platforms <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {connectedPlatforms.map(p => (
                    <label key={p} className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer text-sm transition-all capitalize ${
                      selectedPlatforms.includes(p) ? 'border-violet-500 bg-violet-50' : 'border-neutral-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="checkbox"
                        className="accent-violet-600"
                        checked={selectedPlatforms.includes(p)}
                        onChange={e => {
                          if (e.target.checked) setSelectedPlatforms(prev => [...prev, p]);
                          else setSelectedPlatforms(prev => prev.filter(x => x !== p));
                        }}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Tone */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-neutral-700">Content Tone</h3>
              <div className="flex flex-wrap gap-2">
                {TONES.map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      tone === t ? 'border-violet-500 bg-violet-100 text-violet-700' : 'border-neutral-200 hover:bg-slate-50'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-neutral-700">Plan Duration: <span className="text-violet-600">{duration} days</span>
                <span className="text-xs text-neutral-400 font-normal ml-2">({duration * selectedPlatforms.length} posts total)</span>
              </h3>
              <input
                type="range" min={3} max={30} step={1}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-1">
                <span>3 days</span><span>30 days</span>
              </div>
            </div>

            {/* Media upload */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-neutral-700">Attach Media (Optional)</h3>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-xl p-6 cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm font-medium text-neutral-600">Drop images/videos here or click to browse</p>
                <p className="text-xs text-neutral-400 mt-1">They will be attached to generated posts</p>
                <input
                  type="file" accept="image/*,video/*" multiple className="hidden"
                  onChange={e => setPendingFiles(Array.from(e.target.files || []))}
                />
              </label>
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-3 py-1">
                      <ImageIcon className="w-3 h-3" /> {f.name}
                      <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clarification dialog */}
        {clarification && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 text-sm">Need more details</h3>
                <p className="text-sm text-amber-700 mt-1">{clarification}</p>
                <p className="text-xs text-amber-500 mt-2">Update your prompt above and try again.</p>
              </div>
              <button onClick={() => setClarification(null)} className="text-amber-400 hover:text-amber-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between mt-8 pt-6 border-t border-neutral-100">
          {step === 2 ? (
            <Button onClick={() => setStep(1)} variant="secondary" size="sm">Back</Button>
          ) : <div />}
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!prompt.trim()} className="bg-violet-600 hover:bg-violet-700">
              Next Step →
            </Button>
          ) : (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={isPending || selectedPlatforms.length === 0 || connectedPlatforms.length === 0}
              className="bg-violet-600 hover:bg-violet-700 min-w-[160px]"
            >
              {isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Plan</>}
            </Button>
          )}
        </div>
      </div>

      {isPending && (
        <div className="mt-8 text-center space-y-2">
          <div className="flex justify-center gap-3 text-sm text-neutral-500">
            <span className="animate-pulse">✨ Parsing intent...</span>
            <span className="animate-pulse" style={{ animationDelay: '0.5s' }}>→ Generating content...</span>
            <span className="animate-pulse" style={{ animationDelay: '1s' }}>→ Composing schedule...</span>
          </div>
          <p className="text-xs text-neutral-400">This takes ~15-30 seconds. Hang tight!</p>
        </div>
      )}
    </div>
  );
}

// ── Plan Review Dashboard ────────────────────────────────────────────────────
function PlanReviewDashboard({ planId, onNewPlan }: { planId: string; onNewPlan: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasUploadedInitialMedia, setHasUploadedInitialMedia] = useState(false);
  const [authResult, setAuthResult] = useState<{ authorizedCount: number; errors: string[] } | null>(null);

  const { data: plan, isLoading } = useQuery({
    queryKey: ['content-plan', planId],
    queryFn: async () => {
      const res = await api.contentPlanner.getPlan(planId);
      return res;
    },
    refetchInterval: (query: any) => query.state.data?.status === 'generating' ? 2000 : false
  });

  // Prompt media dialog once plan is ready and no media exists
  useEffect(() => {
    if (plan?.status === 'ready' && !hasUploadedInitialMedia) {
      const hasMedia = plan.posts?.some((p: any) => p.mediaUrls?.length > 0);
      if (!hasMedia) setShowMediaDialog(true);
    }
  }, [plan?.status]);

  const authorizeMutation = useMutation({
    mutationFn: async () => api.contentPlanner.authorizePlan(planId),
    onSuccess: (data: any) => {
      setShowConfirmModal(false);
      setAuthResult({ authorizedCount: data.authorizedCount || 0, errors: data.errors || [] });
      queryClient.invalidateQueries({ queryKey: ['content-plan', planId] });
      if (!data.errors?.length) {
        toast.success('🎉 Plan authorized! All posts have been scheduled.');
      } else {
        toast(data.message, { icon: '⚠️' });
      }
    },
    onError: (err: any) => {
      setShowConfirmModal(false);
      toast.error(err?.message || 'Failed to authorize plan');
    }
  });

  const reauthorizeMutation = useMutation({
    mutationFn: async () => api.contentPlanner.reauthorizePlan(planId),
    onSuccess: (data: any) => {
      setAuthResult({ authorizedCount: data.authorizedCount || 0, errors: data.errors || [] });
      queryClient.invalidateQueries({ queryKey: ['content-plan', planId] });
      toast(data.message, { icon: data.errors?.length ? '⚠️' : '✅' });
    },
    onError: (err: any) => toast.error(err?.message || 'Retry failed')
  });

  const cancelMutation = useMutation({
    mutationFn: async () => api.contentPlanner.cancelPlan(planId),
    onSuccess: () => {
      toast.success('Plan cancelled');
      queryClient.invalidateQueries({ queryKey: ['content-plans-history'] });
      onNewPlan();
    },
    onError: () => toast.error('Could not cancel plan')
  });

  if (isLoading || plan?.status === 'generating') {
    return (
      <div className="py-20 text-center">
        <RefreshCw className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-medium text-neutral-700">Generating your content plan…</h3>
        <p className="text-sm text-neutral-400 mt-2">AI is writing your posts and building a schedule</p>
      </div>
    );
  }

  if (!plan) return null;

  const isAuthorized = ['authorized', 'partial', 'cancelled'].includes(plan.status);
  const activePosts = plan.posts?.filter((p: any) => p.status !== 'deleted') || [];
  const failedPosts = activePosts.filter((p: any) => p.status === 'failed');
  const scheduledPosts = activePosts.filter((p: any) => p.status === 'scheduled');
  const pendingPosts = activePosts.filter((p: any) => ['pending_review', 'approved'].includes(p.status));
  const platformsCovered = [...new Set(activePosts.map((p: any) => p.platform))];
  const approvedCount = activePosts.filter((p: any) => p.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-lg font-bold">{isAuthorized ? 'Plan Overview' : 'Review Your Plan'}</h2>
          <p className="text-sm text-neutral-500">
            {activePosts.length} posts across {platformsCovered.length} platform{platformsCovered.length !== 1 ? 's' : ''} for{' '}
            <span className="font-medium text-neutral-700">{plan.theme}</span>
          </p>
          {plan.dateRangeStart && plan.dateRangeEnd && (
            <p className="text-xs text-neutral-400 mt-1">
              {new Date(plan.dateRangeStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
              {new Date(plan.dateRangeEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {!isAuthorized && (
            <Button
              variant="secondary" size="sm"
              onClick={() => { if (confirm('Cancel this plan?')) cancelMutation.mutate(); }}
              disabled={cancelMutation.isPending}
            >
              <X className="w-4 h-4 mr-1" /> Cancel Plan
            </Button>
          )}
          {!isAuthorized && (
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 shadow-sm"
              onClick={() => setShowConfirmModal(true)}
              disabled={authorizeMutation.isPending || activePosts.length === 0}
            >
              <Send className="w-4 h-4 mr-2" /> Authorize & Schedule All
            </Button>
          )}
          {plan.status === 'authorized' && (
            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
              <CheckCircle2 className="w-5 h-5" /> All posts scheduled
            </div>
          )}
          {plan.status === 'partial' && (
            <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
              <AlertCircle className="w-5 h-5" /> Some posts failed
            </div>
          )}
          {plan.status === 'cancelled' && (
            <div className="flex items-center gap-2 text-neutral-500 font-medium text-sm">
              <X className="w-5 h-5" /> Plan cancelled
            </div>
          )}
        </div>
      </div>

      {/* Pre-authorize approval helper */}
      {!isAuthorized && activePosts.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl text-sm">
          <div className="flex items-center gap-2 text-violet-700">
            <ThumbsUp className="w-4 h-4" />
            <span><strong>{approvedCount}</strong> approved · <strong>{pendingPosts.length - approvedCount}</strong> pending review</span>
            <span className="text-violet-400 text-xs">(Approve posts you want scheduled, or skip to authorize all)</span>
          </div>
        </div>
      )}

      {/* Post-authorization result panel */}
      {authResult && (
        <div className={`rounded-xl border p-5 ${authResult.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {authResult.errors.length === 0
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />}
              <div>
                <p className="font-semibold text-sm">
                  {authResult.errors.length === 0
                    ? `✅ ${authResult.authorizedCount} post${authResult.authorizedCount !== 1 ? 's' : ''} successfully scheduled!`
                    : `⚠️ ${authResult.authorizedCount} scheduled · ${authResult.errors.length} failed`}
                </p>
                {authResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {authResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                        <span className="mt-0.5">•</span> {e}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button onClick={() => setAuthResult(null)} className="text-neutral-400 hover:text-neutral-600 ml-4">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            {scheduledPosts.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => navigate('/calendar')}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> View in Calendar
              </Button>
            )}
            {authResult.errors.length > 0 && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => reauthorizeMutation.mutate()}
                disabled={reauthorizeMutation.isPending}
              >
                {reauthorizeMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
                Retry Failed Posts
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onNewPlan}>
              <PlusCircle className="w-3.5 h-3.5 mr-1" /> New Plan
            </Button>
          </div>
        </div>
      )}

      {/* Read-only banner */}
      {isAuthorized && (
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {plan.status === 'cancelled' ? 'Plan cancelled.' : `${scheduledPosts.length} posts scheduled · ${failedPosts.length} failed.`}
          </div>
          <div className="flex gap-2">
            {scheduledPosts.length > 0 && (
              <button onClick={() => navigate('/calendar')} className="text-xs text-violet-600 font-semibold flex items-center gap-1 hover:underline">
                View in Calendar <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {plan.status === 'partial' && failedPosts.length > 0 && (
              <button
                onClick={() => reauthorizeMutation.mutate()}
                disabled={reauthorizeMutation.isPending}
                className="text-xs text-amber-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <RotateCcw className="w-3 h-3" /> Retry {failedPosts.length} failed
              </button>
            )}
          </div>
        </div>
      )}

      {/* Post grid */}
      {activePosts.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-neutral-200">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">No posts in this plan.</p>
          <p className="text-neutral-400 text-sm mt-1">Something went wrong during generation. Try creating a new plan.</p>
          <Button size="sm" className="mt-4 bg-violet-600 hover:bg-violet-700" onClick={onNewPlan}>
            New Plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activePosts.map((post: any) => (
            <PostCard
              key={post.id}
              post={post}
              planId={planId}
              readOnly={isAuthorized && post.status !== 'failed'}
            />
          ))}
        </div>
      )}

      {/* Media check dialog */}
      {showMediaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6 relative">
            <button onClick={() => setShowMediaDialog(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
            <h2 className="text-xl font-bold mb-2">Add Media to Your Posts?</h2>
            <p className="text-sm text-neutral-500 mb-6">Posts with images or videos get 2-3× more engagement.</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 border border-neutral-200 rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition-all">
                <Upload className="w-5 h-5 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">Upload your own files</p>
                  <p className="text-xs text-neutral-400">JPG, PNG, MP4 up to 250MB each</p>
                </div>
                <input type="file" accept="image/*,video/*" multiple className="hidden"
                  onChange={async e => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length || !plan.posts?.length) return;
                    setShowMediaDialog(false);
                    const firstPost = plan.posts[0];
                    const fd = new FormData();
                    files.forEach(f => fd.append('media', f));
                    toast.loading('Uploading…', { id: 'upload-dialog' });
                    try {
                      await api.contentPlanner.uploadMedia(firstPost.id, fd);
                      toast.success('Media uploaded!', { id: 'upload-dialog' });
                      queryClient.invalidateQueries({ queryKey: ['content-plan', planId] });
                    } catch {
                      toast.error('Upload failed', { id: 'upload-dialog' });
                    }
                  }}
                />
              </label>
              <button
                onClick={() => {
                  setShowMediaDialog(false);
                  navigate(`/editor?contentPlanPostId=${plan.posts?.[0]?.id}&platform=${plan.posts?.[0]?.platform}`);
                }}
                className="flex items-center gap-3 border border-neutral-200 rounded-xl p-4 hover:bg-slate-50 transition-all text-left"
              >
                <Palette className="w-5 h-5 text-violet-500" />
                <div>
                  <p className="text-sm font-medium">Design with Template Editor</p>
                  <p className="text-xs text-neutral-400">Use pre-made templates and brand elements</p>
                </div>
              </button>
              <button onClick={() => setShowMediaDialog(false)} className="text-sm text-neutral-400 hover:text-neutral-600 py-2">
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6 relative">
            <button onClick={() => setShowConfirmModal(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-black"><X className="w-5 h-5" /></button>
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-7 h-7 text-violet-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Authorize & Schedule?</h2>
              <p className="text-sm text-neutral-500 mb-2">
                You're about to schedule <strong>{activePosts.length} posts</strong> across{' '}
                <strong>{platformsCovered.length} platform{platformsCovered.length !== 1 ? 's' : ''}</strong>.
              </p>
              {plan.dateRangeStart && plan.dateRangeEnd && (
                <p className="text-sm text-neutral-500 mb-4">
                  From{' '}
                  <strong>{new Date(plan.dateRangeStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong> to{' '}
                  <strong>{new Date(plan.dateRangeEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>.
                </p>
              )}
              <p className="text-xs text-amber-600 mb-6">
                ⚠️ Posts without a connected platform will be skipped. You can retry them after.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-700"
                  onClick={() => authorizeMutation.mutate()}
                  disabled={authorizeMutation.isPending}
                >
                  {authorizeMutation.isPending
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
                    : 'Confirm & Schedule'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, planId, readOnly }: { post: any; planId: string; readOnly: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(post.contentBody);
  const [scheduledAt, setScheduledAt] = useState(
    post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : ''
  );

  useEffect(() => {
    setContent(post.contentBody);
    setScheduledAt(post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '');
  }, [post.contentBody, post.scheduledAt]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['content-plan', planId] });

  const regenerateMutation = useMutation({
    mutationFn: () => api.contentPlanner.regeneratePost(post.id),
    onSuccess: () => { toast.success('Post regenerated'); invalidate(); },
    onError: () => toast.error('Failed to regenerate post')
  });

  const updateMutation = useMutation({
    mutationFn: () => api.contentPlanner.editPost(post.id, {
      contentBody: content,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined
    }),
    onSuccess: () => { toast.success('Post updated'); setIsEditing(false); invalidate(); },
    onError: () => toast.error('Failed to update post')
  });

  const approveMutation = useMutation({
    mutationFn: () => api.contentPlanner.editPost(post.id, { status: 'approved' } as any),
    onSuccess: () => { invalidate(); },
    onError: () => toast.error('Failed to approve post')
  });

  const unapproveMutation = useMutation({
    mutationFn: () => api.contentPlanner.editPost(post.id, { status: 'pending_review' } as any),
    onSuccess: () => { invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.contentPlanner.deletePost(post.id),
    onSuccess: () => { toast.success('Post removed'); invalidate(); },
    onError: () => toast.error('Failed to delete post')
  });

  const charCount = content.length;
  const charLimit: Record<string, number> = { twitter: 280, linkedin: 3000, instagram: 2200, facebook: 63206, tiktok: 2200 };
  const limit = charLimit[post.platform?.toLowerCase()];
  const overLimit = limit && charCount > limit;

  const isApproved = post.status === 'approved';
  const isFailed = post.status === 'failed';
  const isScheduled = post.status === 'scheduled';

  const borderAccent = isFailed
    ? 'border-l-4 border-l-red-400'
    : isScheduled
    ? 'border-l-4 border-l-emerald-400'
    : isApproved
    ? 'border-l-4 border-l-violet-400'
    : post.regenerated
    ? 'border-l-4 border-l-purple-400'
    : post.editedByUser
    ? 'border-l-4 border-l-blue-400'
    : '';

  return (
    <div className={`bg-white border border-neutral-200 rounded-2xl shadow-sm flex flex-col hover:shadow-md transition-shadow overflow-hidden ${borderAccent}`}>
      {/* Card header */}
      <div className="px-4 py-3 border-b border-neutral-100 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <PlatformBadge platform={post.platform} />
          {isFailed && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Failed</span>}
          {isScheduled && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Scheduled</span>}
          {isApproved && !isScheduled && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">Approved</span>}
          {post.regenerated && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">Regenerated</span>}
          {post.editedByUser && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Edited</span>}
        </div>
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <Clock className="w-3 h-3" />
          {post.scheduledAt
            ? new Date(post.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Not scheduled'}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1">
        {isEditing && !readOnly ? (
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className={`w-full min-h-[120px] text-sm rounded-xl border p-3 resize-none focus:ring-2 focus:outline-none ${
                overLimit ? 'border-red-400 focus:ring-red-400' : 'border-neutral-200 focus:ring-violet-500'
              }`}
            />
            <div className={`text-xs text-right ${overLimit ? 'text-red-500' : 'text-neutral-400'}`}>
              {charCount}{limit ? `/${limit}` : ''}
            </div>
            <div>
              <label className="text-xs text-neutral-500 font-medium block mb-1">Schedule time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-200 p-2 focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{post.contentBody}</p>
            {post.hashtags?.length > 0 && (
              <p className="text-xs text-violet-600 font-medium">{post.hashtags.map((t: string) => `#${t}`).join(' ')}</p>
            )}
            {isFailed && (
              <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-600">Failed to schedule — platform may not be connected or time passed. Edit the schedule time and retry.</p>
              </div>
            )}
            {post.mediaSuggestion && !post.mediaUrls?.length && (
              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                <ImageIcon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-500 italic">Suggestion: {post.mediaSuggestion}</p>
              </div>
            )}
            {post.mediaUrls?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {post.mediaUrls.map((url: string, i: number) => (
                  <img key={i} src={url} alt="Media" className="h-20 w-20 object-cover rounded-lg border" />
                ))}
                <span className="text-xs text-neutral-400 self-end ml-1">
                  {post.mediaSource === 'editor' ? '🎨 Designed' : post.mediaSource === 'upload' ? '📎 Uploaded' : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-neutral-100 flex justify-between items-center">
        {readOnly && !isFailed ? (
          <div className="text-xs text-neutral-400 italic flex items-center gap-1"><Lock className="w-3 h-3" /> Read-only</div>
        ) : isEditing ? (
          <div className="flex gap-2 w-full">
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => { setContent(post.contentBody); setIsEditing(false); }}>Cancel</Button>
            <Button size="sm" className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !!overLimit}>
              {updateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Save'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-1">
              <button
                title="Edit content & time" onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              ><Edit className="w-4 h-4" /></button>
              <button
                title="Regenerate" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              ><RefreshCw className={`w-4 h-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} /></button>
              <label title="Upload media" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                <input type="file" accept="image/*,video/*" multiple className="hidden"
                  onChange={async e => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const fd = new FormData();
                    files.forEach(f => fd.append('media', f));
                    toast.loading('Uploading…', { id: `upload-${post.id}` });
                    try {
                      await api.contentPlanner.uploadMedia(post.id, fd);
                      toast.success('Uploaded!', { id: `upload-${post.id}` });
                      queryClient.invalidateQueries({ queryKey: ['content-plan', planId] });
                    } catch {
                      toast.error('Upload failed', { id: `upload-${post.id}` });
                    }
                  }}
                />
              </label>
              <button
                title="Design in Editor"
                onClick={() => navigate(`/editor?contentPlanPostId=${post.id}&platform=${post.platform}`)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              ><Palette className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-1 items-center">
              {!isScheduled && (
                <button
                  title={isApproved ? 'Un-approve' : 'Approve this post'}
                  onClick={() => isApproved ? unapproveMutation.mutate() : approveMutation.mutate()}
                  className={`p-1.5 rounded-lg transition-colors ${isApproved ? 'bg-violet-100 text-violet-600' : 'hover:bg-violet-50 text-slate-400 hover:text-violet-600'}`}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
              )}
              <button
                title="Delete post"
                onClick={() => { if (confirm('Remove this post from the plan?')) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
              ><Trash2 className="w-4 h-4" /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Plan History ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  ready: 'bg-emerald-50 text-emerald-700',
  generating: 'bg-blue-50 text-blue-700',
  authorized: 'bg-violet-50 text-violet-700',
  partial: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-neutral-100 text-neutral-500',
  draft: 'bg-slate-50 text-slate-500',
};

function PlanHistory({ onViewPlan }: { onViewPlan: (planId: string) => void }) {
  const queryClient = useQueryClient();
  const { data: response, isLoading } = useQuery({
    queryKey: ['content-plans-history'],
    queryFn: () => api.contentPlanner.listPlans()
  });

  const plans: any[] = (response as any)?.data ?? [];

  const cancelMutation = useMutation({
    mutationFn: (planId: string) => api.contentPlanner.cancelPlan(planId),
    onSuccess: () => {
      toast.success('Plan cancelled');
      queryClient.invalidateQueries({ queryKey: ['content-plans-history'] });
    },
    onError: () => toast.error('Could not cancel plan')
  });

  if (isLoading) {
    return <div className="p-12 text-center text-neutral-400 animate-pulse">Loading history…</div>;
  }

  if (!plans.length) {
    return (
      <div className="text-center p-16 bg-slate-50 rounded-2xl border-2 border-dashed border-neutral-200">
        <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-neutral-500 font-medium">No plans generated yet.</p>
        <p className="text-neutral-400 text-sm mt-1">Create your first AI content plan above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan: any) => (
        <div key={plan.id} className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm transition-shadow">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_BADGE[plan.status] || STATUS_BADGE.draft}`}>
                {plan.status}
              </span>
              {plan._count?.posts != null && (
                <span className="text-xs text-neutral-400">{plan._count.posts} posts</span>
              )}
            </div>
            <h3 className="font-semibold text-neutral-800">{plan.theme}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Created {new Date(plan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {plan.tone && ` · ${plan.tone} tone`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => onViewPlan(plan.id)}>
              View Plan
            </Button>
            {['ready', 'draft', 'generating', 'partial'].includes(plan.status) && (
              <Button
                size="sm" variant="ghost"
                onClick={() => { if (confirm('Cancel this plan?')) cancelMutation.mutate(plan.id); }}
                disabled={cancelMutation.isPending}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
