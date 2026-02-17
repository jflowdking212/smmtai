import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, LayoutGrid, List,
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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarPage() {
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0).toISOString();
    api.posts.list({ status: 'scheduled' }).then((res) => setPosts(res.data?.posts || [])).catch(() => {});
  }, [year, month]);

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
        </div>
      </div>

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
