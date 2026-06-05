import { createPortal } from 'react-dom';
import { useState, useEffect, useMemo, useRef, type ChangeEvent, type DragEvent } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { LayoutGrid, List, ChevronLeft, ChevronRight, Clock, Repeat, Search, X, Tag, BarChart2, CalendarDays, FileText, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';

type ViewMode = 'month' | 'week';

interface CalendarPost {
  id: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformPosts: Array<{ platform: string; status: string }>;
  label?: string;
  labelColor?: string;
}

interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: boolean;
  recurring: number;
}

interface SmartRecommendation {
  day: string;
  time: string;
  score: number;
  reason?: string;
  scheduledAt: string;
}

// Label definitions
const LABEL_OPTIONS = [
  { value: 'promo',       label: 'Promotional',    color: '#f59e0b' },
  { value: 'edu',         label: 'Educational',    color: '#3b82f6' },
  { value: 'engage',      label: 'Engagement',     color: '#8b5cf6' },
  { value: 'campaign',    label: 'Campaign',       color: '#ec4899' },
  { value: 'bts',         label: 'Behind-Scenes',  color: '#10b981' },
  { value: 'announce',    label: 'Announcement',   color: '#ef4444' },
];

const LABEL_MAP = Object.fromEntries(LABEL_OPTIONS.map(l => [l.value, l]));

function getLabel(value: string | undefined) {
  return value ? LABEL_MAP[value] : null;
}

// localStorage helpers for labels (until backend supports it)
function getStoredLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem('smmtai_post_labels') || '{}'); } catch { return {}; }
}
function saveStoredLabel(postId: string, labelValue: string) {
  const m = getStoredLabels();
  if (labelValue) m[postId] = labelValue; else delete m[postId];
  localStorage.setItem('smmtai_post_labels', JSON.stringify(m));
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toLocalInputValue(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Smart Portal Tooltip ─────────────────────────────────────────────────────
// Renders into document.body so it is never clipped by overflow:hidden parents.
// Auto-positions based on available viewport space (prefers right, then left,
// then above, then below). Always stays 12 px inside the viewport.
const TOOLTIP_W = 272; // px
const TOOLTIP_GAP = 8; // gap between anchor and tooltip

function PostTooltip({
  post,
  visible,
  anchorRef,
}: {
  post: CalendarPost;
  visible: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !anchorRef.current) { setPos(null); return; }

    const rect = anchorRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tipH = tipRef.current?.offsetHeight || 180;
    const PAD = 12;

    // Preferred: right of the card
    let left = rect.right + TOOLTIP_GAP;
    let top  = rect.top + rect.height / 2 - tipH / 2;

    // If overflows right, try left
    if (left + TOOLTIP_W + PAD > vw) {
      left = rect.left - TOOLTIP_W - TOOLTIP_GAP;
    }
    // If overflows left too, centre below
    if (left < PAD) {
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      top  = rect.bottom + TOOLTIP_GAP;
    }
    // Clamp vertical
    if (top + tipH + PAD > vh) top = vh - tipH - PAD;
    if (top < PAD) top = PAD;
    // Clamp horizontal
    if (left + TOOLTIP_W + PAD > vw) left = vw - TOOLTIP_W - PAD;
    if (left < PAD) left = PAD;

    setPos({ top, left });
  }, [visible, anchorRef]);

  if (!visible || !pos) return null;

  const platforms = post.platformPosts.map(pp => PLATFORMS[pp.platform as PlatformType]).filter(Boolean);
  const label = getLabel(post.label);
  const statusVariant = post.status === 'scheduled' ? 'brand' : post.status === 'published' ? 'success' : 'default';

  return createPortal(
    <div
      ref={tipRef}
      className="fixed z-[9999] pointer-events-none"
      style={{ top: pos.top, left: pos.left, width: TOOLTIP_W }}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-neutral-100 overflow-hidden"
        style={{ animation: 'tooltip-fade-in 0.12s ease-out' }}
      >
        {/* Coloured header bar */}
        {platforms[0] && (
          <div
            className="h-1 w-full"
            style={{ background: platforms[0].color }}
          />
        )}
        <div className="p-3.5">
          {/* Platform badges + label */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
            {platforms.map((pl, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${pl!.color}18`, color: pl!.color }}
              >
                {pl!.name}
              </span>
            ))}
            {label && (
              <span
                className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${label.color}18`, color: label.color }}
              >
                ● {label.label}
              </span>
            )}
          </div>

          {/* Content preview */}
          <p className="text-xs text-neutral-700 leading-relaxed mb-2.5"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.content || <span className="text-neutral-400 italic">No content preview</span>}
          </p>

          {/* Footer */}
          <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2">
            <span className="text-[10px] text-neutral-400 tabular-nums">
              {post.scheduledAt
                ? new Date(post.scheduledAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : 'Not scheduled'}
            </span>
            <Badge variant={statusVariant}>
              {post.status}
            </Badge>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}


// ── Quick-Schedule Drawer ─────────────────────────────────────────────────────
interface DraftPost {
  id: string;
  content: string;
  status: string;
  platformPosts: Array<{ platform: string }>;
}

function QuickScheduleDrawer({
  date,
  onClose,
  onScheduled,
}: {
  date: string; // "YYYY-MM-DD"
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<DraftPost | null>(null);
  const [time, setTime] = useState('09:00');
  const [scheduling, setScheduling] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pre-fill time to 09:00 on the clicked date
  useEffect(() => {
    async function loadDrafts() {
      setLoading(true);
      try {
        const res = await api.posts.list({ status: 'draft', limit: '30' });
        const list = (res.data?.posts || res.data || []) as DraftPost[];
        setDrafts(list.filter((p: DraftPost) => p.id));
      } catch {
        setDrafts([]);
      } finally {
        setLoading(false);
      }
    }
    void loadDrafts();
  }, []);

  async function handleSchedule() {
    if (!selectedPost) { setMsg({ type: 'error', text: 'Pick a draft post first.' }); return; }
    setScheduling(true);
    setMsg(null);
    try {
      const [yr, mo, dy] = date.split('-').map(Number);
      const [hr, mn] = time.split(':').map(Number);
      const dt = new Date(yr, mo - 1, dy, hr, mn, 0);
      await api.schedule.schedulePost(selectedPost.id, dt.toISOString());
      setMsg({ type: 'success', text: `Scheduled for ${dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}!` });
      setTimeout(() => { onScheduled(); onClose(); }, 1200);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Could not schedule post.' });
    } finally {
      setScheduling(false);
    }
  }

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-gradient-to-r from-violet-50 to-blue-50">
          <div>
            <h2 className="font-bold text-neutral-900 text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-violet-500" />
              Schedule a Post
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">{displayDate}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Time picker */}
        <div className="px-5 py-4 border-b border-neutral-100">
          <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wide block mb-2">
            Posting Time
          </label>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            <div className="flex gap-1">
              {['09:00', '12:00', '18:00', '20:00'].map(t => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                    time === t
                      ? 'bg-violet-100 border-violet-300 text-violet-700 font-medium'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Draft list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wide block mb-2">
            Pick a Draft Post
          </label>

          {loading ? (
            <div className="py-10 text-center">
              <RefreshCw className="w-6 h-6 mx-auto text-neutral-300 animate-spin mb-2" />
              <p className="text-xs text-neutral-400">Loading drafts...</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-neutral-200 rounded-xl">
              <FileText className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
              <p className="text-sm text-neutral-500 font-medium">No draft posts</p>
              <p className="text-xs text-neutral-400 mt-1 mb-3">Create a post in Compose first</p>
              <a
                href="/compose"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Go to Compose
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map(post => {
                const isSelected = selectedPost?.id === post.id;
                const platforms = post.platformPosts?.map(pp => pp.platform) || [];
                return (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPost(isSelected ? null : post)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                        : 'border-neutral-200 hover:border-violet-200 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-violet-500 bg-violet-500' : 'border-neutral-300'}`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-800 line-clamp-2 leading-relaxed">
                          {post.content || '(No content)'}
                        </p>
                        {platforms.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {platforms.map((pl, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">
                                {pl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-100 space-y-3 bg-white">
          {msg && (
            <div className={`text-xs px-3 py-2 rounded-lg ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {msg.text}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { void handleSchedule(); }}
              disabled={!selectedPost || scheduling}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {scheduling ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Scheduling...</>
              ) : (
                <><Clock className="w-4 h-4" /> Schedule Post</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Post card on calendar cell ────────────────────────────────────────────────
function PostCard({
  post,
  onDragStart,
  onLabelChange,
}: {
  post: CalendarPost;
  onDragStart: (e: DragEvent<HTMLDivElement>, postId: string) => void;
  onLabelChange: (postId: string, labelValue: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const mainPlatform = post.platformPosts[0]?.platform as PlatformType | undefined;
  const color = mainPlatform ? PLATFORMS[mainPlatform]?.color : '#888';
  const label = getLabel(post.label);

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={e => onDragStart(e, post.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowLabelPicker(false); }}
      className="relative group text-[10px] px-1.5 py-1 rounded-md cursor-grab active:cursor-grabbing select-none transition-transform hover:scale-[1.03] hover:z-10"
      style={{
        backgroundColor: label ? `${label.color}15` : `${color}20`,
        color: label ? label.color : color,
        borderLeft: `2px solid ${label ? label.color : color}`,
      }}
    >
      <PostTooltip post={post} visible={hovered && !showLabelPicker} anchorRef={cardRef} />
      <span className="truncate block max-w-[90px]">{post.content?.slice(0, 28) || '(no content)'}</span>

      {/* Label dot + picker trigger */}
      <button
        onMouseDown={e => { e.stopPropagation(); setShowLabelPicker(v => !v); }}
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Set label"
      >
        <Tag className="w-2.5 h-2.5" style={{ color: label?.color || '#9ca3af' }} />
      </button>

      {showLabelPicker && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-100 p-1.5 w-40 pointer-events-auto">
          <button
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-50 text-neutral-500"
            onClick={() => { onLabelChange(post.id, ''); setShowLabelPicker(false); }}
          >
            No label
          </button>
          {LABEL_OPTIONS.map(l => (
            <button
              key={l.value}
              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-50 flex items-center gap-2"
              style={{ color: l.color }}
              onClick={() => { onLabelChange(post.id, l.value); setShowLabelPicker(false); }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Content Mix Stats Bar ─────────────────────────────────────────────────────
function ContentMixBar({ posts }: { posts: CalendarPost[] }) {
  const total = posts.length;
  if (total === 0) return null;

  // Platform breakdown
  const platformCounts: Record<string, number> = {};
  posts.forEach(p => {
    p.platformPosts.forEach(pp => {
      platformCounts[pp.platform] = (platformCounts[pp.platform] || 0) + 1;
    });
  });
  const topPlatforms = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Label breakdown
  const labelCounts: Record<string, number> = {};
  posts.forEach(p => {
    if (p.label) labelCounts[p.label] = (labelCounts[p.label] || 0) + 1;
  });

  // Status breakdown
  const scheduled = posts.filter(p => p.status === 'scheduled').length;
  const published = posts.filter(p => p.status === 'published').length;

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-semibold text-neutral-700">{total} posts</span>
        </div>
        <div className="flex items-center gap-1 text-neutral-500">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          {scheduled} scheduled
        </div>
        <div className="flex items-center gap-1 text-neutral-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          {published} published
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {topPlatforms.map(([platform, count]) => {
            const pl = PLATFORMS[platform as PlatformType];
            if (!pl) return null;
            return (
              <span key={platform} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${pl.color}15`, color: pl.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: pl.color }} />
                {pl.name} {count}
              </span>
            );
          })}
        </div>
        {Object.keys(labelCounts).length > 0 && (
          <div className="flex items-center gap-1 border-l border-neutral-100 pl-3">
            {Object.entries(labelCounts).slice(0, 3).map(([lv, cnt]) => {
              const l = LABEL_MAP[lv];
              if (!l) return null;
              return (
                <span key={lv} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: `${l.color}15`, color: l.color }}>
                  {l.label} {cnt}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

export function CalendarPage() {
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recurringPostId, setRecurringPostId] = useState('');
  const [recurringStartsAt, setRecurringStartsAt] = useState('');
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [bulkCsv, setBulkCsv] = useState('postId,scheduledAt');
  const [smartPlatform, setSmartPlatform] = useState<PlatformType>('instagram');
  const [smartIndustry, setSmartIndustry] = useState('');
  const [smartRecommendations, setSmartRecommendations] = useState<SmartRecommendation[]>([]);
  const [smartConflicts, setSmartConflicts] = useState<Array<{
    day: string;
    time: string;
    score: number;
    scheduledAt: string;
    conflictPostId: string;
    conflictScheduledAt: string | null;
  }>>([]);

  // ── NEW: filter state ──────────────────────────────────────────────────────
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<PlatformType | ''>('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLabel, setFilterLabel] = useState('');

  // ── NEW: labels stored in localStorage ────────────────────────────────────
  const [postLabels, setPostLabels] = useState<Record<string, string>>(getStoredLabels);

  // ── NEW: quick-schedule drawer state ──────────────────────────────────────────
  const [drawerDate, setDrawerDate] = useState<string | null>(null);

  // ── NEW: drag-and-drop state ───────────────────────────────────────────────
  const draggingPostId = useRef<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  async function refreshCalendarData() {
    try {
      const res = await api.schedule.calendar();
      const raw = (res.data || []) as CalendarPost[];
      const labels = getStoredLabels();
      const enriched = raw.map(p => ({ ...p, label: labels[p.id] || '' }));
      setPosts(enriched);
    } catch {
      setPosts([]);
    }
  }

  async function refreshQueueStatsData() {
    try {
      const res = await api.schedule.stats();
      setQueueStats(res.data as QueueStats);
    } catch {
      setQueueStats(null);
    }
  }

  useEffect(() => {
    void refreshCalendarData();
    void refreshQueueStatsData();
  }, [year, month]);

  // ── NEW: label handler ─────────────────────────────────────────────────────
  function handleLabelChange(postId: string, labelValue: string) {
    saveStoredLabel(postId, labelValue);
    const newLabels = getStoredLabels();
    setPostLabels(newLabels);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, label: labelValue } : p));
  }

  // ── NEW: drag handlers ─────────────────────────────────────────────────────
  function handleDragStart(e: DragEvent<HTMLDivElement>, postId: string) {
    draggingPostId.current = postId;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, dateKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateKey);
  }

  function handleDragLeave() {
    setDragOverDate(null);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, dateKey: string) {
    e.preventDefault();
    setDragOverDate(null);
    const postId = draggingPostId.current;
    draggingPostId.current = null;
    if (!postId) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Keep same time, change date
    const existingTime = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
    const [yr, mo, dy] = dateKey.split('-').map(Number);
    const newDate = new Date(yr, mo - 1, dy, existingTime.getHours(), existingTime.getMinutes(), 0);
    const newISO = newDate.toISOString();

    // Optimistic update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, scheduledAt: newISO } : p));

    setLoadingKey(`reschedule-${postId}`);
    setMessage(null);
    try {
      await api.schedule.schedulePost(postId, newISO);
      setMessage({ type: 'success', text: `Post rescheduled to ${newDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${existingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` });
      await refreshCalendarData();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not reschedule post.' });
      await refreshCalendarData(); // revert
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleQueueToggle() {
    setLoadingKey('queue-toggle');
    setMessage(null);
    try {
      if (queueStats?.paused) {
        await api.schedule.resumeQueue();
        setMessage({ type: 'success', text: 'Publishing queue resumed.' });
      } else {
        await api.schedule.pauseQueue();
        setMessage({ type: 'success', text: 'Publishing queue paused.' });
      }
      await refreshQueueStatsData();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to update queue state.' });
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleCancelSchedule(postId: string) {
    setLoadingKey(`cancel-${postId}`);
    setMessage(null);
    try {
      await api.schedule.cancel(postId);
      await refreshCalendarData();
      setMessage({ type: 'success', text: 'Schedule cancelled.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to cancel schedule.' });
    } finally {
      setLoadingKey(null);
    }
  }

  function prepareRecurring(post: CalendarPost) {
    setRecurringPostId(post.id);
    setRecurringStartsAt(toLocalInputValue(post.scheduledAt));
    setMessage(null);
  }

  async function handleSaveRecurring() {
    if (!recurringPostId || !recurringStartsAt) {
      setMessage({ type: 'error', text: 'Post ID and start date are required.' });
      return;
    }
    const startsAtDate = new Date(recurringStartsAt);
    if (Number.isNaN(startsAtDate.getTime())) {
      setMessage({ type: 'error', text: 'Provide a valid start date.' });
      return;
    }
    setLoadingKey('save-recurring');
    setMessage(null);
    try {
      await api.schedule.recurring(recurringPostId, {
        startsAt: startsAtDate.toISOString(),
        recurrence,
        timezone: timezone.trim() || 'UTC',
      });
      await refreshCalendarData();
      await refreshQueueStatsData();
      setMessage({ type: 'success', text: 'Recurring schedule saved.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save recurring schedule.' });
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleGenerateSmartRecommendations() {
    setLoadingKey('smart-recommendations');
    setMessage(null);
    try {
      const res = await api.schedule.recommendations({
        platform: smartPlatform,
        industry: smartIndustry.trim() || undefined,
        timezone: timezone.trim() || 'UTC',
        limit: 7,
      });
      const recommendations = (res.data?.recommendations || []) as SmartRecommendation[];
      const conflicts = (res.data?.conflicts || []) as Array<{
        day: string;
        time: string;
        score: number;
        scheduledAt: string;
        conflictPostId: string;
        conflictScheduledAt: string | null;
      }>;
      setSmartRecommendations(recommendations);
      setSmartConflicts(conflicts);
      setMessage({
        type: recommendations.length > 0 ? 'success' : 'error',
        text: `Smart slots: ${recommendations.length} available, ${conflicts.length} conflicting.`,
      });
    } catch (error) {
      setSmartRecommendations([]);
      setSmartConflicts([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load smart slots.' });
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleAutofillDraftCsv() {
    if (smartRecommendations.length === 0) {
      setMessage({ type: 'error', text: 'Generate smart slots first.' });
      return;
    }
    setLoadingKey('autofill-smart-csv');
    setMessage(null);
    try {
      const drafts = await api.posts.list({
        status: 'draft',
        limit: String(Math.max(20, smartRecommendations.length)),
      });
      const draftPosts = ((drafts.data?.posts || []) as Array<{ id: string }>)
        .filter((post) => typeof post.id === 'string' && post.id.length > 0);
      if (draftPosts.length === 0) {
        setMessage({ type: 'error', text: 'No draft posts available to auto-fill.' });
        return;
      }
      const count = Math.min(draftPosts.length, smartRecommendations.length);
      const rows = smartRecommendations
        .slice(0, count)
        .map((recommendation, index) => `${draftPosts[index].id},${recommendation.scheduledAt}`);
      setBulkCsv(`postId,scheduledAt\n${rows.join('\n')}`);
      setMessage({ type: 'success', text: `Filled CSV with ${count} draft post schedules.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to auto-fill CSV.' });
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleBulkFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setBulkCsv(content);
      setMessage(null);
    } catch {
      setMessage({ type: 'error', text: 'Unable to read selected CSV file.' });
    }
  }

  async function handleBulkSchedule() {
    if (!bulkCsv.trim()) {
      setMessage({ type: 'error', text: 'Provide CSV rows before importing.' });
      return;
    }
    setLoadingKey('bulk-schedule');
    setMessage(null);
    try {
      const res = await api.schedule.bulk(bulkCsv);
      await refreshCalendarData();
      await refreshQueueStatsData();
      const { scheduled, failed } = res.data;
      setMessage({
        type: failed > 0 ? 'error' : 'success',
        text: `Bulk scheduling finished: ${scheduled} scheduled, ${failed} failed.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Bulk scheduling failed.' });
    } finally {
      setLoadingKey(null);
    }
  }

  function navigate(delta: number) {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + delta);
    setCurrentDate(d);
  }

  // ── Filtered posts (NEW) ───────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (filterSearch && !p.content?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      if (filterPlatform && !p.platformPosts.some(pp => pp.platform === filterPlatform)) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterLabel && p.label !== filterLabel) return false;
      return true;
    });
  }, [posts, filterSearch, filterPlatform, filterStatus, filterLabel]);

  const hasFilters = !!(filterSearch || filterPlatform || filterStatus || filterLabel);

  // Group filtered posts by date
  const postsByDate = useMemo(() => {
    const map: Record<string, CalendarPost[]> = {};
    filteredPosts.forEach((p) => {
      const date = p.scheduledAt || p.publishedAt;
      if (!date) return;
      const key = new Date(date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [filteredPosts]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Content Calendar</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {filteredPosts.length}{hasFilters ? ` of ${posts.length}` : ''} scheduled post{filteredPosts.length !== 1 ? 's' : ''} this month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5 inline mr-1" /> Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}
            >
              <List className="w-3.5 h-3.5 inline mr-1" /> Week
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={loadingKey === 'queue-toggle'}
            onClick={handleQueueToggle}
          >
            {queueStats?.paused ? 'Resume Queue' : 'Pause Queue'}
          </Button>
        </div>
      </div>

      {/* ── Content Mix Stats Bar (NEW) ── */}
      <ContentMixBar posts={filteredPosts} />

      {/* ── Filter Bar (NEW) ── */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search posts…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Platform filter */}
          <select
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value as PlatformType | '')}
            className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All platforms</option>
            {(Object.keys(PLATFORMS) as PlatformType[]).map(p => (
              <option key={p} value={p}>{PLATFORMS[p].name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
          </select>

          {/* Label filter */}
          <select
            value={filterLabel}
            onChange={e => setFilterLabel(e.target.value)}
            className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All labels</option>
            {LABEL_OPTIONS.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={() => { setFilterSearch(''); setFilterPlatform(''); setFilterStatus(''); setFilterLabel(''); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}

          {/* Label legend */}
          <div className="flex items-center gap-1.5 ml-auto">
            {LABEL_OPTIONS.slice(0, 4).map(l => (
              <button
                key={l.value}
                title={l.label}
                onClick={() => setFilterLabel(filterLabel === l.value ? '' : l.value)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all border"
                style={{
                  background: filterLabel === l.value ? `${l.color}25` : 'transparent',
                  borderColor: filterLabel === l.value ? l.color : '#e5e7eb',
                  color: l.color,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Alert / Message ── */}
      {message && (
        <Card className={`p-3 ${message.type === 'error' ? 'border-red-200 bg-red-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
          <p className={`text-sm ${message.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>
        </Card>
      )}

      {/* ── Queue Stats ── */}
      {queueStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Waiting',   value: queueStats.waiting,   color: 'text-amber-600',   bg: 'bg-amber-50' },
            { label: 'Active',    value: queueStats.active,    color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: 'Completed', value: queueStats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Failed',    value: queueStats.failed,    color: 'text-red-600',     bg: 'bg-red-50' },
          ].map(s => (
            <Card key={s.label} className={`p-3 ${s.bg}`}>
              <p className="text-xs text-neutral-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* ── Drag-and-Drop tip ── */}
      <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
        <span>💡</span> Drag any post card to a new day to reschedule it instantly. Hover over a card to preview content.
      </p>

      {/* ── Calendar Grid ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-neutral-800">{monthName}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-neutral-600" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-2.5 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-neutral-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-px bg-neutral-100 rounded-xl overflow-hidden border border-neutral-100">
          {cells.map((day, i) => {
            const dateKey = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
            const dayPosts = day && dateKey ? (postsByDate[dateKey] || []) : [];
            const isToday = dateKey === today;
            const isDragOver = dragOverDate === dateKey && !!day;

            return (
              <div
                key={i}
                className={`
                  bg-white min-h-[80px] p-1.5 transition-colors group/cell
                  ${!day ? 'bg-neutral-50' : 'cursor-pointer hover:bg-violet-50/40'}
                  ${isToday ? 'ring-2 ring-inset ring-brand-blue/30' : ''}
                  ${isDragOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : ''}
                `}
                onClick={day && !isDragOver ? () => setDrawerDate(dateKey) : undefined}
                onDragOver={day ? e => { e.stopPropagation(); handleDragOver(e, dateKey); } : undefined}
                onDragLeave={day ? handleDragLeave : undefined}
                onDrop={day ? e => { e.stopPropagation(); void handleDrop(e, dateKey); } : undefined}
              >
                {day && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-blue text-white' : 'text-neutral-700'}`}>
                        {day}
                      </div>
                      <Plus className="w-3 h-3 text-violet-400 opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 3).map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onDragStart={handleDragStart}
                          onLabelChange={handleLabelChange}
                        />
                      ))}
                      {dayPosts.length > 3 && (
                        <span className="text-[10px] text-neutral-400 pl-1">+{dayPosts.length - 3} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Recurring Schedule ── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-700">Recurring Schedule</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            value={recurringPostId}
            onChange={(e) => setRecurringPostId(e.target.value)}
            placeholder="Post ID"
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
          />
          <input
            type="datetime-local"
            value={recurringStartsAt}
            onChange={(e) => setRecurringStartsAt(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
          />
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as 'daily' | 'weekly' | 'monthly')}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Timezone (e.g. America/New_York)"
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" loading={loadingKey === 'save-recurring'} onClick={handleSaveRecurring}>
            Save recurring schedule
          </Button>
        </div>
      </Card>

      {/* ── Smart Scheduling ── */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700">Smart Scheduling Suggestions</h3>
        <p className="text-xs text-neutral-500">
          Generate AI time slots and auto-fill draft post IDs into the CSV importer.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select
            value={smartPlatform}
            onChange={(event) => setSmartPlatform(event.target.value as PlatformType)}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white"
          >
            {(Object.keys(PLATFORMS) as PlatformType[]).map((platformOption) => (
              <option key={platformOption} value={platformOption}>
                {PLATFORMS[platformOption].name}
              </option>
            ))}
          </select>
          <input
            value={smartIndustry}
            onChange={(event) => setSmartIndustry(event.target.value)}
            placeholder="Industry (optional)"
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="secondary"
              loading={loadingKey === 'smart-recommendations'}
              onClick={handleGenerateSmartRecommendations}
            >
              Generate slots
            </Button>
            <Button
              size="sm"
              loading={loadingKey === 'autofill-smart-csv'}
              onClick={handleAutofillDraftCsv}
              disabled={smartRecommendations.length === 0}
            >
              Auto-fill CSV
            </Button>
          </div>
        </div>
        {smartRecommendations.length > 0 && (
          <div className="space-y-2">
            {smartRecommendations.map((recommendation, index) => (
              <div key={`${recommendation.scheduledAt}-${index}`} className="flex items-center justify-between text-xs p-2 bg-neutral-50 rounded-lg">
                <div>
                  <span className="font-medium text-neutral-700">{recommendation.day}</span>
                  <span className="ml-2 text-neutral-500">{recommendation.time}</span>
                  <span className="ml-2 text-neutral-400">{new Date(recommendation.scheduledAt).toLocaleString()}</span>
                </div>
                <Badge variant="brand">{Math.round((recommendation.score || 0) * 100)}%</Badge>
              </div>
            ))}
          </div>
        )}
        {smartConflicts.length > 0 && (
          <p className="text-xs text-amber-700">
            {smartConflicts.length} suggestions were skipped due to schedule conflicts.
          </p>
        )}
      </Card>

      {/* ── Bulk CSV Import ── */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700">Bulk Schedule Import (CSV)</h3>
        <p className="text-xs text-neutral-500">
          Use CSV columns: <span className="font-medium">postId,scheduledAt</span> (ISO datetime).
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => { void handleBulkFileChange(event); }}
          className="text-xs text-neutral-600"
        />
        <textarea
          value={bulkCsv}
          onChange={(event) => setBulkCsv(event.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm font-mono"
          placeholder={"postId,scheduledAt\npost_1,2030-01-01T10:00:00.000Z"}
        />
        <div className="flex justify-end">
          <Button size="sm" loading={loadingKey === 'bulk-schedule'} onClick={handleBulkSchedule}>
            Import schedule CSV
          </Button>
        </div>
      </Card>

      {/* ── Upcoming Posts List ── */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Upcoming Scheduled Posts</h3>
        {filteredPosts.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
            <p className="text-sm text-neutral-400">{hasFilters ? 'No posts match your filters' : 'No scheduled posts'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPosts.slice(0, 10).map((p) => {
              const label = getLabel(p.label);
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 transition-colors hover:bg-neutral-100">
                  {/* Label indicator */}
                  {label && (
                    <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: label.color }} title={label.label} />
                  )}
                  <div className="flex gap-1 flex-shrink-0">
                    {p.platformPosts.map((pp, i) => {
                      const color = PLATFORMS[pp.platform as PlatformType]?.color || '#888';
                      return (
                        <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-800 truncate">{p.content}</p>
                    <p className="text-xs text-neutral-400">
                      {p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : 'Not scheduled'}
                      {label && <span className="ml-2 font-medium" style={{ color: label.color }}>{label.label}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="secondary" size="sm" onClick={() => prepareRecurring(p)}>
                      Recurring
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={loadingKey === `cancel-${p.id}`}
                      onClick={() => handleCancelSchedule(p.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <Badge variant={p.status === 'scheduled' ? 'brand' : p.status === 'published' ? 'success' : 'default'}>
                    {p.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {/* Quick Schedule Drawer */}
      {drawerDate && (
        <QuickScheduleDrawer
          date={drawerDate}
          onClose={() => setDrawerDate(null)}
          onScheduled={() => { void refreshCalendarData(); }}
        />
      )}
    </div>
  );
}
