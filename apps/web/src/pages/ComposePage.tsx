import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  Send, Save, Clock, Image, X, Check, AlertTriangle,
  Loader2, Eye, ChevronDown,
} from 'lucide-react';

const CHAR_LIMITS: Record<string, number> = {
  twitter: 280, linkedin: 3000, facebook: 63206, instagram: 2200,
  tiktok: 2200, youtube: 5000, pinterest: 500, bluesky: 300,
  mastodon: 500, telegram: 4096, entreprenrs: 5000, chrxstians: 5000, iohah: 5000,
};

interface Connection {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
}

export function ComposePage() {
  const [content, setContent] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [perPlatformCaptions, setPerPlatformCaptions] = useState<Record<string, string>>({});
  const [showPerPlatform, setShowPerPlatform] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    api.connections.list().then((res) => setConnections(res.data)).catch(() => {});
  }, []);

  function toggleConnection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getCharCount(platform: string) {
    const text = perPlatformCaptions[platform] || content;
    return { count: text.length, limit: CHAR_LIMITS[platform] || 5000 };
  }

  async function handlePublish(isDraft = false) {
    if (!content.trim() || selectedIds.size === 0) return;

    isDraft ? setSavingDraft(true) : setPublishing(true);
    setResult(null);

    try {
      const platforms = Array.from(selectedIds).map((connId) => {
        const conn = connections.find((c) => c.id === connId);
        return {
          connectionId: connId,
          platform: conn?.platform || 'facebook',
          caption: perPlatformCaptions[conn?.platform || ''] || undefined,
        };
      });

      const res = await api.posts.create({
        content,
        platforms,
        isDraft,
        scheduledAt: scheduledAt || undefined,
      });

      setResult({
        success: true,
        message: isDraft ? 'Draft saved!' : scheduledAt ? 'Post scheduled!' : 'Post published!',
        data: res.data,
      });

      if (!isDraft) {
        setContent('');
        setSelectedIds(new Set());
        setPerPlatformCaptions({});
        setScheduledAt('');
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to publish' });
    } finally {
      setPublishing(false);
      setSavingDraft(false);
    }
  }

  const selectedConnections = connections.filter((c) => selectedIds.has(c.id));
  const hasOverLimit = selectedConnections.some((c) => {
    const { count, limit } = getCharCount(c.platform);
    return count > limit;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Compose Post</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Create and publish to {selectedIds.size} platform{selectedIds.size !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => handlePublish(true)} loading={savingDraft}>
            <Save className="w-4 h-4" /> Save Draft
          </Button>
          <Button
            size="sm"
            onClick={() => handlePublish(false)}
            loading={publishing}
            disabled={!content.trim() || selectedIds.size === 0 || hasOverLimit}
          >
            {scheduledAt ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {scheduledAt ? 'Schedule' : 'Publish Now'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to share?"
              rows={6}
              className="w-full resize-none border-none text-base text-neutral-800 placeholder-neutral-300 focus:outline-none focus:ring-0"
            />
            <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
              <div className="flex gap-2">
                <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600">
                  <Image className="w-5 h-5" />
                </button>
              </div>
              <span className="text-xs text-neutral-400">{content.length} characters</span>
            </div>
          </Card>

          {/* Per-platform captions */}
          {showPerPlatform && selectedConnections.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700">Platform-Specific Captions</h3>
              {selectedConnections.map((conn) => {
                const { count, limit } = getCharCount(conn.platform);
                const isOver = count > limit;
                return (
                  <div key={conn.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-600">
                        {PLATFORMS[conn.platform as PlatformType]?.name || conn.platform} — {conn.accountName}
                      </span>
                      <span className={`text-xs ${isOver ? 'text-red-500 font-medium' : 'text-neutral-400'}`}>
                        {count}/{limit}
                      </span>
                    </div>
                    <textarea
                      value={perPlatformCaptions[conn.platform] || ''}
                      onChange={(e) => setPerPlatformCaptions((prev) => ({ ...prev, [conn.platform]: e.target.value }))}
                      placeholder={`Custom caption for ${conn.platform} (leave empty to use main)`}
                      rows={2}
                      className={`w-full px-3 py-2 border rounded-lg text-sm resize-none ${isOver ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`}
                    />
                  </div>
                );
              })}
            </Card>
          )}

          {/* Schedule */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-neutral-400" />
              <div className="flex-1">
                <label className="text-sm font-medium text-neutral-700">Schedule for later</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                />
              </div>
              {scheduledAt && (
                <button onClick={() => setScheduledAt('')} className="p-1 rounded hover:bg-neutral-100">
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              )}
            </div>
          </Card>

          {/* Result */}
          {result && (
            <Card className={`p-4 ${result.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <span className={`text-sm font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.message}
                </span>
              </div>
            </Card>
          )}
        </div>

        {/* Right sidebar — platform selection */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700">Platforms</h3>
              <button
                onClick={() => setShowPerPlatform(!showPerPlatform)}
                className="text-xs text-brand-blue hover:underline"
              >
                {showPerPlatform ? 'Hide' : 'Customize'} per platform
              </button>
            </div>
            {connections.length === 0 ? (
              <p className="text-xs text-neutral-400 py-4 text-center">No accounts connected yet</p>
            ) : (
              <div className="space-y-2">
                {connections.filter((c) => c.isActive).map((conn) => {
                  const platform = PLATFORMS[conn.platform as PlatformType];
                  const isSelected = selectedIds.has(conn.id);
                  const { count, limit } = getCharCount(conn.platform);
                  const isOver = count > limit && isSelected;

                  return (
                    <button
                      key={conn.id}
                      onClick={() => toggleConnection(conn.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left
                        ${isSelected
                          ? isOver ? 'border-red-300 bg-red-50' : 'border-brand-blue bg-blue-50'
                          : 'border-neutral-200 hover:border-neutral-300'}`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${platform?.color || '#888'}20` }}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: platform?.color || '#888' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate">{conn.accountName}</p>
                        <p className="text-xs text-neutral-400">{platform?.name || conn.platform}</p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1.5">
                          {isOver && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          <Check className={`w-4 h-4 ${isOver ? 'text-red-500' : 'text-brand-blue'}`} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Character limits summary */}
          {selectedConnections.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">Character Limits</h3>
              <div className="space-y-1.5">
                {selectedConnections.map((conn) => {
                  const { count, limit } = getCharCount(conn.platform);
                  const pct = Math.min((count / limit) * 100, 100);
                  const isOver = count > limit;
                  return (
                    <div key={conn.id}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-600">{PLATFORMS[conn.platform as PlatformType]?.name || conn.platform}</span>
                        <span className={isOver ? 'text-red-500 font-medium' : 'text-neutral-400'}>{count}/{limit}</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-100 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-brand-blue'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
