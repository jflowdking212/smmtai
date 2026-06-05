import { useCallback, useEffect, useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Search,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';

interface ConversationItem {
  id: string;
  sessionId: string;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  sentiment: string | null;
  tags: string[];
  startedAt: string;
  updatedAt: string;
  messages: any[];
}

export function AdminMessagesPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const toast = useToast();

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.admin.getMessages(params);
      setConversations(res.data.conversations);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, toast]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const totalPages = Math.ceil(total / 20);

  function getStatusColor(status: string): 'success' | 'warning' | 'danger' | 'default' {
    if (status === 'ACTIVE') return 'success';
    if (status === 'TRANSFERRED') return 'warning';
    if (status === 'ENDED') return 'default';
    return 'default';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-neutral-900 dark:text-white">Messages</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Monitor all user conversations and support inquiries.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="ENDED">Ended</option>
          <option value="TRANSFERRED">Transferred</option>
        </select>
        <Badge variant="default" className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 self-center">
          {total} conversations
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation List */}
        <div className="lg:col-span-2">
          <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
            <div className="divide-y divide-neutral-200 dark:divide-neutral-200 dark:divide-neutral-800/50">
              {loading ? (
                <div className="p-8 text-center text-neutral-500">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No conversations found.</p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => setSelectedConversation(convo)}
                    className={`w-full text-left px-4 py-3 hover:bg-neutral-50 dark:bg-neutral-50 dark:bg-neutral-800/50 transition-colors ${selectedConversation?.id === convo.id ? 'bg-neutral-50 dark:bg-neutral-800/70' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          {convo.customerName || convo.customerEmail || 'Anonymous'}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {convo.customerEmail || 'No email'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(convo.status)}>{convo.status}</Badge>
                        <span className="text-xs text-neutral-500">
                          {new Date(convo.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {convo.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {convo.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-500 dark:text-neutral-400">{tag}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1} className="text-neutral-500 dark:text-neutral-400">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="text-neutral-500 dark:text-neutral-400">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-1">
          <Card className="p-4 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 sticky top-20">
            {selectedConversation ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Conversation Detail</h3>
                  <Badge variant={getStatusColor(selectedConversation.status)}>{selectedConversation.status}</Badge>
                </div>
                <div className="space-y-1 text-xs">
                  <p className="text-neutral-500 dark:text-neutral-400">Name: <span className="text-neutral-800 dark:text-neutral-200">{selectedConversation.customerName || '—'}</span></p>
                  <p className="text-neutral-500 dark:text-neutral-400">Email: <span className="text-neutral-800 dark:text-neutral-200">{selectedConversation.customerEmail || '—'}</span></p>
                  <p className="text-neutral-500 dark:text-neutral-400">Sentiment: <span className="text-neutral-800 dark:text-neutral-200">{selectedConversation.sentiment || '—'}</span></p>
                  <p className="text-neutral-500 dark:text-neutral-400">Started: <span className="text-neutral-800 dark:text-neutral-200">{new Date(selectedConversation.startedAt).toLocaleString()}</span></p>
                </div>
                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Messages ({Array.isArray(selectedConversation.messages) ? selectedConversation.messages.length : 0})</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {(Array.isArray(selectedConversation.messages) ? selectedConversation.messages : []).map((msg: any, i: number) => (
                      <div key={i} className={`p-2 rounded-lg text-xs ${msg.role === 'user' ? 'bg-blue-500/10 text-blue-200' : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}>
                        <span className="font-medium capitalize">{msg.role}: </span>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-500">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a conversation to view details</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
