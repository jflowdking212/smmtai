import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  ChevronLeft, ChevronRight,
  Clock, LayoutGrid, List, Pause, Play, RefreshCw, Repeat,
} from 'lucide-react';

type ViewMode = 'month' | 'week';

interface CalendarPost {
  id: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformPosts: { platform: string; status: string }[];
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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  async function refreshCalendarData() {
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await api.schedule.calendar(start, end);
      setPosts(res.data || []);
    } catch {
      setPosts([]);
    }
  }

  async function refreshQueueStatsData() {
    try {
      const res = await api.schedule.stats();
      setQueueStats(res.data);
    } catch {
      setQueueStats(null);
    }
  }

  useEffect(() => {
    void refreshCalendarData();
    void refreshQueueStatsData();
  }, [year, month]);

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

  // Group posts by date
  const postsByDate = useMemo(() => {
    const map: Record<string, CalendarPost[]> = {};
    posts.forEach((p) => {
      const date = p.scheduledAt || p.publishedAt;
      if (!date) return;
      const key = new Date(date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [posts]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date().toISOString().slice(0, 10);

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Content Calendar</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {posts.length} scheduled post{posts.length !== 1 ? 's' : ''} this month
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
            onClick={() => {
              void refreshCalendarData();
              void refreshQueueStatsData();
            }}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button
            size="sm"
            variant={queueStats?.paused ? 'primary' : 'secondary'}
            loading={loadingKey === 'queue-toggle'}
            onClick={handleQueueToggle}
          >
            {queueStats?.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {queueStats?.paused ? 'Resume Queue' : 'Pause Queue'}
          </Button>
        </div>
      </div>

      {message && (
        <Card className={`p-3 ${message.type === 'error' ? 'border-red-200 bg-red-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
          <p className={`text-sm ${message.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
          <Badge variant={queueStats?.paused ? 'warning' : 'success'}>
            Queue {queueStats?.paused ? 'Paused' : 'Running'}
          </Badge>
          <span>Waiting: {queueStats?.waiting ?? 0}</span>
          <span>Active: {queueStats?.active ?? 0}</span>
          <span>Delayed: {queueStats?.delayed ?? 0}</span>
          <span>Recurring jobs: {queueStats?.recurring ?? 0}</span>
        </div>
      </Card>

      {/* Month navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-neutral-100">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <h2 className="text-lg font-heading font-bold text-neutral-900">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-neutral-100">
            <ChevronRight className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-neutral-200 rounded-lg overflow-hidden">
          {/* Headers */}
          {DAYS.map((d) => (
            <div key={d} className="bg-neutral-50 px-2 py-2 text-xs font-medium text-neutral-500 text-center">
              {d}
            </div>
          ))}

          {/* Day cells */}
          {cells.map((day, i) => {
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
            const dayPosts = dateStr ? (postsByDate[dateStr] || []) : [];
            const isToday = dateStr === today;

            return (
              <div
                key={i}
                className={`bg-white min-h-[80px] p-1.5 ${!day ? 'bg-neutral-50' : ''} ${isToday ? 'ring-2 ring-inset ring-brand-blue/30' : ''}`}
              >
                {day && (
                  <>
                    <span className={`text-xs font-medium ${isToday ? 'bg-brand-blue text-white px-1.5 py-0.5 rounded-full' : 'text-neutral-600'}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayPosts.slice(0, 3).map((p) => {
                        const mainPlatform = p.platformPosts[0]?.platform;
                        const color = mainPlatform ? PLATFORMS[mainPlatform as PlatformType]?.color : '#888';
                        return (
                          <div
                            key={p.id}
                            className="text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: `${color}20`, color }}
                            title={p.content}
                          >
                            {p.content.slice(0, 25)}{p.content.length > 25 ? '...' : ''}
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <span className="text-[10px] text-neutral-400">+{dayPosts.length - 3} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Upcoming scheduled posts list */}
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

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700">Bulk Schedule Import (CSV)</h3>
        <p className="text-xs text-neutral-500">
          Use CSV columns: <span className="font-medium">postId,scheduledAt</span> (ISO datetime).
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            void handleBulkFileChange(event);
          }}
          className="text-xs text-neutral-600"
        />
        <textarea
          value={bulkCsv}
          onChange={(event) => setBulkCsv(event.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm font-mono"
          placeholder="postId,scheduledAt&#10;post_1,2030-01-01T10:00:00.000Z"
        />
        <div className="flex justify-end">
          <Button size="sm" loading={loadingKey === 'bulk-schedule'} onClick={handleBulkSchedule}>
            Import schedule CSV
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Upcoming Scheduled Posts</h3>
        {posts.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
            <p className="text-sm text-neutral-400">No scheduled posts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {posts.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                <div className="flex gap-1">
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
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
