import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  MessageCircle,
  Send,
  RefreshCw,
  Inbox,
  User,
  Clock,
  ChevronLeft,
} from 'lucide-react';

interface Conversation {
  id: string;
  connectionId: string;
  accountName: string;
  participants?: { data: Array<{ id: string; username?: string; name?: string }> };
  updated_time?: string;
  messages?: { data: Array<{ id: string; message: string; created_time: string; from: { id: string; name?: string; username?: string } }> };
}

interface Message {
  id: string;
  message: string;
  created_time: string;
  from: { id: string; name?: string; username?: string };
  to?: { data: Array<{ id: string; name?: string }> };
}

export function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { success, error: toastError } = useToast();

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.messaging.getConversations();
      setConversations(res.data.conversations || []);
      setConnections(res.data.connections || []);
    } catch (err: any) {
      toastError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function openConversation(conv: Conversation) {
    setSelectedConv(conv);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await api.messaging.getMessages(conv.id, conv.connectionId);
      setMessages((res.data || []).reverse());
    } catch (err: any) {
      toastError(err.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleSend() {
    if (!replyText.trim() || !selectedConv) return;

    const participant = selectedConv.participants?.data?.find(
      (p) => p.id !== connections.find((c) => c.id === selectedConv.connectionId)?.accountId
    );
    if (!participant) {
      toastError('Cannot determine recipient');
      return;
    }

    setSending(true);
    try {
      await api.messaging.sendMessage(selectedConv.id, selectedConv.connectionId, participant.id, replyText.trim());
      success('Message sent!');
      setReplyText('');
      // Refresh messages
      const res = await api.messaging.getMessages(selectedConv.id, selectedConv.connectionId);
      setMessages((res.data || []).reverse());
    } catch (err: any) {
      toastError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  function getParticipantName(conv: Conversation): string {
    const ownAccountId = connections.find((c) => c.id === conv.connectionId)?.accountId;
    const other = conv.participants?.data?.find((p) => p.id !== ownAccountId);
    return other?.username || other?.name || other?.id || 'Unknown';
  }

  function getLastMessage(conv: Conversation): string {
    return conv.messages?.data?.[0]?.message || 'No messages';
  }

  function getLastTime(conv: Conversation): string {
    const time = conv.updated_time || conv.messages?.data?.[0]?.created_time;
    if (!time) return '';
    return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function isOwnMessage(msg: Message): boolean {
    if (!selectedConv) return false;
    const ownAccountId = connections.find((c) => c.id === selectedConv.connectionId)?.accountId;
    return msg.from?.id === ownAccountId;
  }

  // Empty state - no Instagram connections
  if (!loading && connections.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Inbox className="w-8 h-8 text-purple-500" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">Instagram Inbox</h2>
        <p className="text-neutral-500 mb-6">
          Connect your Instagram Business account to manage direct messages from here.
        </p>
        <a
          href="/connections"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          Connect Instagram
        </a>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Instagram Inbox</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage your Instagram direct messages • Human Agent supported (7-day reply window)
          </p>
        </div>
        <button
          onClick={fetchConversations}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main layout */}
      <div className="flex h-[calc(100%-4rem)] bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {/* Conversation list */}
        <div className={`w-full md:w-96 border-r border-neutral-100 flex flex-col ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-700">Conversations</h3>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-neutral-300 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="w-10 h-10 text-neutral-200 mb-3" />
              <p className="text-sm text-neutral-400">No conversations yet</p>
              <p className="text-xs text-neutral-300 mt-1">Messages from Instagram will appear here</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left p-4 border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${
                    selectedConv?.id === conv.id ? 'bg-purple-50 border-l-2 border-l-purple-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-neutral-900 truncate">
                          {getParticipantName(conv)}
                        </span>
                        <span className="text-xs text-neutral-400 flex-shrink-0 ml-2">
                          {getLastTime(conv)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{getLastMessage(conv)}</p>
                      <span className="text-[10px] text-purple-400 mt-1 inline-block">
                        via @{conv.accountName}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message thread */}
        <div className={`flex-1 flex flex-col ${!selectedConv ? 'hidden md:flex' : 'flex'}`}>
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl flex items-center justify-center mb-4">
                <MessageCircle className="w-10 h-10 text-purple-300" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-700 mb-1">Select a conversation</h3>
              <p className="text-sm text-neutral-400">Choose a conversation from the left to view messages</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 p-4 border-b border-neutral-100">
                <button
                  onClick={() => setSelectedConv(null)}
                  className="md:hidden p-1 rounded-lg hover:bg-neutral-100"
                >
                  <ChevronLeft className="w-5 h-5 text-neutral-500" />
                </button>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {getParticipantName(selectedConv)}
                  </p>
                  <p className="text-xs text-neutral-400">
                    via @{selectedConv.accountName}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <Clock className="w-3 h-3" />
                  Human Agent
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 text-neutral-300 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-neutral-400">No messages in this conversation</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const own = isOwnMessage(msg);
                    return (
                      <div key={msg.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                            own
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                              : 'bg-neutral-100 text-neutral-800'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${own ? 'text-white/60' : 'text-neutral-400'}`}>
                            {new Date(msg.created_time).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="p-4 border-t border-neutral-100">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Type a reply... (Human Agent: 7-day window)"
                    className="flex-1 px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!replyText.trim() || sending}
                    className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
