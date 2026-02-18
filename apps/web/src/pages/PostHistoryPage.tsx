import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { buildPostListParams, formatStatusLabel, getStatusBadgeVariant, summarizePlatformOutcomes } from '@/lib/postHistory';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import { ChevronLeft, ChevronRight, Clock, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
] as const;

interface PlatformPostHistory {
  id: string;
  platform: string;
  status: string;
  platformPostId: string | null;
  publishedAt: string | null;
  error: string | null;
}

interface PostHistoryItem {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  media: Array<{ id: string }>;
  platformPosts: PlatformPostHistory[];
}

interface PostListResponse {
  posts: PostHistoryItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function PostHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [posts, setPosts] = useState<PostHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildPostListParams(statusFilter, page, PAGE_SIZE);
      const res = await api.posts.list(params);
      const payload = (res.data || {}) as Partial<PostListResponse>;
      const nextPosts = Array.isArray(payload.posts) ? payload.posts : [];
      const nextTotal = typeof payload.total === 'number' ? payload.total : nextPosts.length;
      const nextPages = typeof payload.pages === 'number' ? payload.pages : 1;

      setPosts(nextPosts);
      setTotal(nextTotal);
      setPages(Math.max(nextPages, 1));
    } catch (loadError) {
      setPosts([]);
      setTotal(0);
      setPages(1);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load post history.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const platformOutcomeSummary = useMemo(
    () => posts.reduce((acc, post) => {
      const summary = summarizePlatformOutcomes(post.platformPosts || []);
      acc.published += summary.published;
      acc.failed += summary.failed;
      acc.pending += summary.pending;
      return acc;
    }, { published: 0, failed: 0, pending: 0 }),
    [posts],
  );

  const rangeStart = total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Post History</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Track publish outcomes by post and platform.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void loadPosts()} loading={loading}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-neutral-600">Status filter</label>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-neutral-500">
            Showing {rangeStart}-{rangeEnd} of {total}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="success">Published platforms: {platformOutcomeSummary.published}</Badge>
          <Badge variant="danger">Failed platforms: {platformOutcomeSummary.failed}</Badge>
          <Badge variant="default">Pending platforms: {platformOutcomeSummary.pending}</Badge>
        </div>
      </Card>

      <Card className="p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && posts.length === 0 ? (
          <div className="py-12 text-center text-neutral-400">
            <p className="text-sm">Loading post history...</p>
          </div>
        ) : !loading && posts.length === 0 ? (
          <div className="py-12 text-center text-neutral-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-60" />
            <p className="text-sm">No posts found for this filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl border border-neutral-200 p-4 bg-neutral-50/50 space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500 truncate">Post ID: {post.id}</p>
                    <p className="text-sm text-neutral-800 whitespace-pre-wrap break-words">{post.content}</p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(post.status)}>{formatStatusLabel(post.status)}</Badge>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                  <span>Created: {formatDateTime(post.createdAt)}</span>
                  <span>Scheduled: {formatDateTime(post.scheduledAt)}</span>
                  <span>Published: {formatDateTime(post.publishedAt)}</span>
                  <span>Media: {post.media?.length || 0}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {post.platformPosts.map((platformPost) => {
                    const platform = PLATFORMS[platformPost.platform as PlatformType];
                    const platformName = platform?.name || platformPost.platform;
                    const platformColor = platform?.color || '#6B7280';

                    return (
                      <div key={platformPost.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: platformColor }} />
                            <span className="text-xs font-medium text-neutral-700 truncate">{platformName}</span>
                          </div>
                          <Badge variant={getStatusBadgeVariant(platformPost.status)}>
                            {formatStatusLabel(platformPost.status)}
                          </Badge>
                        </div>
                        {platformPost.error && (
                          <p className="text-[11px] text-red-500 mt-1 break-words">{platformPost.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={loading || page <= 1}
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </Button>
        <span className="text-xs text-neutral-500 px-1">
          Page {page} of {pages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
          disabled={loading || page >= pages}
        >
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
