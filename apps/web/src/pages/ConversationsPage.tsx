import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Card, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { MessageCircle, Trash2, Search, Filter, BarChart3, Eye, X } from 'lucide-react';

interface Conversation {
  id: string;
  sessionId: string;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  startedAt: string;
  endedAt: string | null;
  tags: string[];
  sentiment: string | null;
}

interface Stats {
  total: number;
  active: number;
  transferred: number;
  ended: number;
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (emailFilter) params.email = emailFilter;
      const [convRes, statsRes] = await Promise.all([
        api.chat.getConversations(Object.keys(params).length > 0 ? params : undefined),
        api.chat.getConversationStats(),
      ]);
      setConversations(convRes.data);
      setStats(statsRes.data);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load conversations.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [statusFilter]);

  // Send heartbeat to mark support agent as online
  useEffect(() => {
    const sendHeartbeat = () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) return;
      fetch('/api/v1/chat/agent/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this conversation?')) return;
    try {
      await api.chat.deleteConversation(sessionId);
      setMsg({ type: 'success', text: 'Conversation deleted.' });
      setSelectedConversation(null);
      loadData();
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete conversation.' });
    }
  };

  const handleEndConversation = async (sessionId: string) => {
    try {
      await api.chat.endConversation(sessionId);
      setMsg({ type: 'success', text: 'Conversation ended.' });
      loadData();
    } catch {
      setMsg({ type: 'error', text: 'Failed to end conversation.' });
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700';
      case 'ENDED': return 'bg-neutral-100 text-neutral-600';
      case 'TRANSFERRED': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-neutral-900">Chat Conversations</h1>
        <p className="text-sm text-neutral-500 mt-1">View and manage AI chatbot conversations</p>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: <MessageCircle className="w-5 h-5" /> },
            { label: 'Active', value: stats.active, icon: <BarChart3 className="w-5 h-5 text-green-500" /> },
            { label: 'Transferred', value: stats.transferred, icon: <BarChart3 className="w-5 h-5 text-yellow-500" /> },
            { label: 'Ended', value: stats.ended, icon: <BarChart3 className="w-5 h-5 text-neutral-400" /> },
          ].map((s) => (
            <Card key={s.label} className="p-4 flex items-center gap-3">
              {s.icon}
              <div>
                <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
                <p className="text-xs text-neutral-500">{s.label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg text-sm">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ENDED">Ended</option>
            <option value="TRANSFERRED">Transferred</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-neutral-400" />
          <input value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)}
            placeholder="Filter by email..." className="px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
          <Button variant="secondary" size="sm" onClick={loadData}>Search</Button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-neutral-500 py-8 text-center">Loading conversations...</p>
        ) : conversations.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No conversations found</p>
          </Card>
        ) : (
          conversations.map((conv) => (
            <Card key={conv.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {conv.customerName || conv.customerEmail || conv.sessionId.substring(0, 20) + '...'}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(conv.status)}`}>{conv.status}</span>
                </div>
                <p className="text-xs text-neutral-500">
                  {new Date(conv.startedAt).toLocaleString()} · {Array.isArray(conv.messages) ? conv.messages.length : 0} messages
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" size="sm" onClick={() => setSelectedConversation(conv)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                {conv.status === 'ACTIVE' && (
                  <Button variant="secondary" size="sm" onClick={() => handleEndConversation(conv.sessionId)}>End</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleDelete(conv.sessionId)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedConversation(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-neutral-900">{selectedConversation.customerName || 'Anonymous'}</h3>
                <p className="text-xs text-neutral-500">{selectedConversation.customerEmail || selectedConversation.sessionId}</p>
              </div>
              <button onClick={() => setSelectedConversation(null)} className="p-1 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {Array.isArray(selectedConversation.messages) && selectedConversation.messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-brand-blue text-white' : 'bg-neutral-100 text-neutral-800'}`}>
                    <p>{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-neutral-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
