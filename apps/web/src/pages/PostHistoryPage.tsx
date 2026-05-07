import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { saveComposeSeed } from '@/lib/composeSeed';
import { buildPostListParams, formatStatusLabel, getStatusBadgeVariant, summarizePlatformOutcomes } from '@/lib/postHistory';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  ChevronLeft, ChevronRight, Clock, RefreshCw,
  Trash2, StopCircle, BarChart3, X, Eye, ThumbsUp,
  MessageCircle, Share2, MousePointerClick, Bookmark, Loader2,
  RotateCcw, Pencil, Repeat2,
} from 'lucide-react';

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
  url: string | null;
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
  media: Array<{ id: string; url?: string; type?: string; mimeType?: string; fileSize?: number; fileName?: string }>;
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

function instagramMediaIdToShortcode(mediaId: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  try {
    // If it already looks like a shortcode (not purely numeric), return as-is
    if (!/^\d+$/.test(mediaId)) return mediaId;
    let n = BigInt(mediaId);
    let s = '';
    while (n > 0n) { s = alphabet[Number(n % 64n)] + s; n = n / 64n; }
    return s;
  } catch {
    return mediaId;
  }
}

function buildPlatformPostUrl(platform: PlatformType, platformPostId: string): string | null {
  const id = platformPostId.trim();
  if (!id) return null;
  if (platform === 'facebook') return `https://facebook.com/${id}`;
  if (platform === 'instagram') {
    const shortcode = instagramMediaIdToShortcode(id);
    return `https://www.instagram.com/p/${shortcode}/`;
  }
  if (platform === 'entreprenrs') return `https://entreprenrs.com/post/${encodeURIComponent(id)}`;
  if (platform === 'iohah') return `https://iohah.com/posts/${encodeURIComponent(id)}`;
  if (platform === 'chrxstians') return `https://chrxstians.com/posts/${encodeURIComponent(id)}`;
  if (platform === 'tiktok' && /^\d+$/.test(id)) return `https://www.tiktok.com/video/${id}`;
  if (platform === 'twitter') return `https://x.com/i/status/${id}`;
  if (platform === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
  if (platform === 'linkedin') return `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/`;
  if (platform === 'pinterest') return `https://www.pinterest.com/pin/${encodeURIComponent(id)}/`;
  if (platform === 'bluesky' && id.startsWith('at://')) {
    const parts = id.replace('at://', '').split('/');
    const did = parts[0];
    const rkey = parts[parts.length - 1];
    if (did && rkey) return `https://bsky.app/profile/${encodeURIComponent(did)}/post/${encodeURIComponent(rkey)}`;
  }
  return null;
}

interface PlatformAnalyticsData {
  platformPostId: string;
  platform: string;
  status: string;
  metrics: {
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    saves: number;
  } | null;
  error: string | null;
  fetchedLive: boolean;
}

const METRIC_ICONS: Record<string, typeof Eye> = {
  impressions: Eye,
  reach: Eye,
  likes: ThumbsUp,
  comments: MessageCircle,
  shares: Share2,
  clicks: MousePointerClick,
  saves: Bookmark,
};

function MetricCard({ label, value }: { label: string; value: number }) {
  const Icon = METRIC_ICONS[label] || Eye;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
      <Icon className="w-4 h-4 text-neutral-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-lg font-semibold text-neutral-900">{value.toLocaleString()}</p>
        <p className="text-[11px] text-neutral-500 capitalize">{label}</p>
      </div>
    </div>
  );
}

function AnalyticsModal({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<PlatformAnalyticsData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.posts
      .analytics(postId)
      .then((res) => setPlatforms(res.data?.platforms || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [postId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="text-lg font-semibold text-neutral-900">Post Analytics</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 transition">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
              <span className="text-sm text-neutral-500">Fetching live analytics...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {!loading && !error && platforms.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-6">No platform data available for this post.</p>
          )}

          {!loading &&
            platforms.map((p) => {
              const platform = PLATFORMS[p.platform as PlatformType];
              const platformName = platform?.name || p.platform;
              const platformColor = platform?.color || '#6B7280';

              return (
                <div key={p.platformPostId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platformColor }} />
                    <span className="text-sm font-semibold text-neutral-800">{platformName}</span>
                    <Badge variant={getStatusBadgeVariant(p.status)}>{formatStatusLabel(p.status)}</Badge>
                    {p.fetchedLive && (
                      <span className="text-[10px] text-green-600 font-medium ml-auto">● Live</span>
                    )}
                    {!p.fetchedLive && p.metrics && (
                      <span className="text-[10px] text-neutral-400 ml-auto">Cached</span>
                    )}
                  </div>

                  {p.error && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">{p.error}</p>
                  )}

                  {p.metrics ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <MetricCard label="impressions" value={p.metrics.impressions} />
                      <MetricCard label="reach" value={p.metrics.reach} />
                      <MetricCard label="likes" value={p.metrics.likes} />
                      <MetricCard label="comments" value={p.metrics.comments} />
                      <MetricCard label="shares" value={p.metrics.shares} />
                      <MetricCard label="clicks" value={p.metrics.clicks} />
                      {p.metrics.saves > 0 && <MetricCard label="saves" value={p.metrics.saves} />}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400">No analytics data available yet.</p>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export function PostHistoryPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [posts, setPosts] = useState<PostHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsPostId, setAnalyticsPostId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const handleStop = useCallback(async (postId: string) => {
    setActionLoading(postId);
    try {
      await api.schedule.cancel(postId);
      toast.success('Post Cancelled', 'Scheduled post has been cancelled.');
      void loadPosts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel post';
      setError(msg);
      toast.error('Cancel Failed', msg);
    } finally {
      setActionLoading(null);
    }
  }, [loadPosts, toast]);

  const handleDelete = useCallback(async (postId: string) => {
    setActionLoading(postId);
    try {
      await api.posts.delete(postId);
      setConfirmDelete(null);
      toast.success('Post Deleted');
      void loadPosts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete post';
      setError(msg);
      toast.error('Delete Failed', msg);
    } finally {
      setActionLoading(null);
    }
  }, [loadPosts, toast]);

  const handleRetry = useCallback(async (postId: string) => {
    setActionLoading(postId);
    try {
      await api.posts.publish(postId);
      toast.success('Retry Successful', 'Post has been re-published.');
      void loadPosts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      toast.error('Retry Failed', msg);
    } finally {
      setActionLoading(null);
    }
  }, [loadPosts, toast]);

  const handleEditInCompose = useCallback((post: PostHistoryItem) => {
    const media = (post.media || [])
      .filter((m: any) => m.url)
      .map((m: any) => ({
        url: m.url as string,
        type: (m.type || 'image') as 'image' | 'video',
        fileName: (m.fileName || m.url?.split('/').pop() || 'file') as string,
        mimeType: (m.mimeType || 'image/png') as string,
        size: (m.size || 0) as number,
      }));
    saveComposeSeed({
      source: 'ai',
      content: post.content || '',
      media,
    });
    navigate('/compose');
  }, [navigate]);

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
            {posts.map((post) => {
              const isScheduled = post.status === 'scheduled';
              const isPublished = post.status === 'published' || post.status === 'partial';
              const hasFailed = post.status === 'failed' || post.platformPosts.some((pp) => pp.status === 'failed');
              const isDeleting = confirmDelete === post.id;
              const isBusy = actionLoading === post.id;

              return (
              <div key={post.id} className="rounded-xl border border-neutral-200 p-4 bg-neutral-50/50 space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-500 truncate">Post ID: {post.id}</p>
                    <p className="text-sm text-neutral-800 whitespace-pre-wrap break-words line-clamp-3">{post.content}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={getStatusBadgeVariant(post.status)}>{formatStatusLabel(post.status)}</Badge>
                  </div>
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
                    const platformUrl = platformPost.url?.trim()
                      || (platformPost.platformPostId
                        ? buildPlatformPostUrl(platformPost.platform as PlatformType, platformPost.platformPostId)
                        : null);

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
                        {platformPost.platformPostId && (
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-[11px] text-neutral-500 truncate">
                              Ref: {platformPost.platformPostId}
                            </p>
                            {platformUrl && (
                              <a
                                href={platformUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-brand-blue hover:underline"
                              >
                                View
                              </a>
                            )}
                          </div>
                        )}
                        {platformPost.error && (
                          <p className="text-[11px] text-red-500 mt-1 break-words">{platformPost.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
                  {isPublished && (
                    <button
                      onClick={() => setAnalyticsPostId(post.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition"
                    >
                      <BarChart3 className="w-3.5 h-3.5" /> Analytics
                    </button>
                  )}

                  {isPublished && (
                    <button
                      onClick={() => handleEditInCompose(post)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
                    >
                      <Repeat2 className="w-3.5 h-3.5" /> Repost
                    </button>
                  )}

                  {hasFailed && (
                    <>
                      <button
                        onClick={() => void handleRetry(post.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        Retry
                      </button>
                      <button
                        onClick={() => handleEditInCompose(post)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit in Compose
                      </button>
                    </>
                  )}

                  {isScheduled && (
                    <button
                      onClick={() => void handleStop(post.id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
                      Stop
                    </button>
                  )}

                  {isDeleting ? (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-red-600">Delete this post?</span>
                      <button
                        onClick={() => void handleDelete(post.id)}
                        disabled={isBusy}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {isBusy ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(post.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-neutral-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>
              );
            })}
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

      {analyticsPostId && (
        <AnalyticsModal
          postId={analyticsPostId}
          onClose={() => setAnalyticsPostId(null)}
        />
      )}
    </div>
  );
}
