import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  MessageSquare,
  RefreshCw,
  Reply,
  EyeOff,
  Eye,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  Link2,
  AlertCircle,
} from 'lucide-react';

interface Comment {
  id: string;
  text: string;
  timestamp: string;
  username: string;
  hidden?: boolean;
  replies?: { data: Comment[] };
}

interface Post {
  id: string;
  platformPostId: string;
  content: string;
  createdAt: string;
  connectionId: string;
  accountName: string;
  url?: string;
}

interface Connection {
  id: string;
  accountName: string;
  accountId: string;
}

export function CommentsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, postRes] = await Promise.all([
        api.messaging.getConversations(),
        api.posts.list({ platform: 'instagram', status: 'published', limit: '20' }),
      ]);
      setConnections(connRes.data.connections || []);
      // Map posts to include connection info
      const igPosts: Post[] = ((postRes as any).data?.posts || [])
        .filter((p: any) => p.platforms?.includes('instagram') || p.platformPosts?.some((pp: any) => pp.platform === 'instagram'))
        .map((p: any) => {
          const igPlatformPost = p.platformPosts?.find((pp: any) => pp.platform === 'instagram');
          const conn = (connRes.data.connections || [])[0];
          return {
            id: p.id,
            platformPostId: igPlatformPost?.platformPostId || p.id,
            content: p.content || p.text || '',
            createdAt: p.createdAt || p.scheduledAt,
            connectionId: igPlatformPost?.connectionId || conn?.id || '',
            accountName: conn?.accountName || 'Instagram',
            url: igPlatformPost?.url,
          };
        });
      setPosts(igPosts);
    } catch (err: any) {
      toastError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function loadComments(post: Post) {
    setSelectedPost(post);
    setLoadingComments(true);
    setComments([]);
    try {
      const res = await api.messaging.getPostComments(post.platformPostId, post.connectionId);
      setComments(res.data || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleReply(comment: Comment) {
    const text = replyText[comment.id]?.trim();
    if (!text || !selectedPost) return;
    setActionLoading(comment.id + '_reply');
    try {
      await api.messaging.replyToComment(comment.id, selectedPost.connectionId, text);
      success('Reply sent!');
      setReplyText((prev) => ({ ...prev, [comment.id]: '' }));
      await loadComments(selectedPost);
    } catch (err: any) {
      toastError(err.message || 'Failed to send reply');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleHide(comment: Comment, hide: boolean) {
    if (!selectedPost) return;
    setActionLoading(comment.id + '_hide');
    try {
      await api.messaging.hideComment(comment.id, selectedPost.connectionId, hide);
      success(hide ? 'Comment hidden' : 'Comment visible');
      await loadComments(selectedPost);
    } catch (err: any) {
      toastError(err.message || 'Failed to update comment');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(comment: Comment) {
    if (!selectedPost) return;
    if (!confirm('Delete this comment? This cannot be undone.')) return;
    setActionLoading(comment.id + '_delete');
    try {
      await api.messaging.deleteComment(comment.id, selectedPost.connectionId);
      success('Comment deleted');
      await loadComments(selectedPost);
    } catch (err: any) {
      toastError(err.message || 'Failed to delete comment');
    } finally {
      setActionLoading(null);
    }
  }

  function toggleExpand(id: string) {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!loading && connections.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-8 h-8 text-purple-500" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">Comment Manager</h2>
        <p className="text-neutral-500 mb-6">Connect your Instagram Business account to manage comments on your posts.</p>
        <a href="/connections" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all">
          <Link2 className="w-4 h-4" />
          Connect Instagram
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Comment Manager</h1>
          <p className="text-sm text-neutral-500 mt-1">Moderate, reply to, and manage comments on your Instagram posts</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Posts list */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-700">Published Instagram Posts</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 text-neutral-300 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 p-6 text-center">
              <AlertCircle className="w-8 h-8 text-neutral-200 mb-2" />
              <p className="text-sm text-neutral-400">No published Instagram posts found</p>
              <p className="text-xs text-neutral-300 mt-1">Publish a post to manage its comments</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => loadComments(post)}
                  className={`w-full text-left p-4 hover:bg-neutral-50 transition-colors ${selectedPost?.id === post.id ? 'bg-purple-50 border-l-2 border-l-purple-500' : ''}`}
                >
                  <p className="text-sm text-neutral-800 line-clamp-2 mb-1">{post.content || '(No caption)'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">
                      {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-purple-500">@{post.accountName}</span>
                  </div>
                  {post.url && (
                    <a href={post.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> View on Instagram
                    </a>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comments panel */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-700">
              {selectedPost ? `Comments on: ${selectedPost.content?.slice(0, 40) || 'Post'}...` : 'Select a post'}
            </h3>
          </div>

          {!selectedPost ? (
            <div className="flex-1 flex flex-col items-center justify-center h-60 p-6 text-center">
              <MessageSquare className="w-10 h-10 text-neutral-200 mb-3" />
              <p className="text-sm text-neutral-400">Select a post to view and manage its comments</p>
            </div>
          ) : loadingComments ? (
            <div className="flex items-center justify-center h-60">
              <RefreshCw className="w-6 h-6 text-neutral-300 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 p-6 text-center">
              <MessageSquare className="w-8 h-8 text-neutral-200 mb-2" />
              <p className="text-sm text-neutral-400">No comments yet on this post</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-50">
              {comments.map((comment) => (
                <div key={comment.id} className={`p-4 ${comment.hidden ? 'bg-neutral-50 opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-neutral-800">@{comment.username}</span>
                        <span className="text-xs text-neutral-400">
                          {new Date(comment.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {comment.hidden && <span className="text-xs bg-neutral-200 text-neutral-500 px-1.5 py-0.5 rounded">Hidden</span>}
                      </div>
                      <p className="text-sm text-neutral-700">{comment.text}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleExpand(comment.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        title="Reply"
                      >
                        <Reply className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleHide(comment, !comment.hidden)}
                        disabled={actionLoading === comment.id + '_hide'}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                        title={comment.hidden ? 'Show comment' : 'Hide comment'}
                      >
                        {comment.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(comment)}
                        disabled={actionLoading === comment.id + '_delete'}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete comment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Replies */}
                  {(comment.replies?.data?.length ?? 0) > 0 && (
                    <button onClick={() => toggleExpand(comment.id + '_replies')} className="mt-2 text-xs text-purple-500 flex items-center gap-1">
                      {expandedComments.has(comment.id + '_replies') ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {comment.replies!.data.length} {comment.replies!.data.length === 1 ? 'reply' : 'replies'}
                    </button>
                  )}
                  {expandedComments.has(comment.id + '_replies') && comment.replies?.data?.map((reply) => (
                    <div key={reply.id} className="mt-2 ml-4 pl-3 border-l-2 border-purple-100">
                      <span className="text-xs font-semibold text-neutral-700">@{reply.username}</span>
                      <p className="text-xs text-neutral-600 mt-0.5">{reply.text}</p>
                    </div>
                  ))}

                  {/* Reply input */}
                  {expandedComments.has(comment.id) && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={replyText[comment.id] || ''}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleReply(comment)}
                        placeholder={`Reply to @${comment.username}...`}
                        className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={actionLoading === comment.id + '_reply'}
                      />
                      <button
                        onClick={() => handleReply(comment)}
                        disabled={!replyText[comment.id]?.trim() || actionLoading === comment.id + '_reply'}
                        className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
