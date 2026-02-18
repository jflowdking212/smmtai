import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { buildLinkPreviewData, buildPreviewText, parseHashtagsInput } from '@/lib/composePreview';
import { buildDraftAutosaveSignature, sortDraftsByUpdatedAt, toLocalDateTimeInput } from '@/lib/composeDrafts';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  Send, Save, Clock, Image, X, Check, AlertTriangle,
  Loader2, Eye, ChevronDown, Trash2,
} from 'lucide-react';

const CHAR_LIMITS: Record<string, number> = {
  twitter: 280, linkedin: 3000, facebook: 63206, instagram: 2200,
  tiktok: 2200, youtube: 5000, pinterest: 500, bluesky: 300,
  mastodon: 500, telegram: 4096, entreprenrs: 5000, chrxstians: 5000, iohah: 5000,
};
const HASHTAG_LIMITS: Record<string, number> = {
  instagram: 30,
  linkedin: 5,
};
const PLATFORM_CAPTION_MAP_KEY = '__postmindPlatformCaptions';
const PUBLISH_PAYLOAD_MAP_KEY = '__postmindPublishPayload';

interface Connection {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
}

interface PendingApprovalPost {
  id: string;
  content: string;
  author?: { name?: string };
}

interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
  fileName: string;
  mimeType: string;
  size: number;
}

interface DraftPlatformPost {
  id: string;
  platform: string;
  socialConnectionId: string;
}

interface DraftMedia {
  id: string;
  url: string;
  type: 'image' | 'video';
}

interface DraftPost {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  scheduledAt: string | null;
  designData?: Record<string, unknown> | null;
  media: DraftMedia[];
  platformPosts: DraftPlatformPost[];
}

export function ComposePage() {
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [platformMetadataInput, setPlatformMetadataInput] = useState('');
  const [showAdvancedMetadata, setShowAdvancedMetadata] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [perPlatformCaptions, setPerPlatformCaptions] = useState<Record<string, string>>({});
  const [showPerPlatform, setShowPerPlatform] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [mediaUploads, setMediaUploads] = useState<UploadedMedia[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState('');
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftActionLoading, setDraftActionLoading] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'paused'>('idle');
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [approvalPostId, setApprovalPostId] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalPost[]>([]);
  const [approvalActionLoading, setApprovalActionLoading] = useState<string | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutosaveSignatureRef = useRef<string>('');

  async function refreshApprovalQueue() {
    try {
      const res = await api.posts.list({ status: 'pending_approval', limit: '20' });
      setPendingApprovals(res.data?.posts || []);
    } catch {
      setPendingApprovals([]);
    }
  }

  async function refreshDrafts() {
    setLoadingDrafts(true);
    try {
      const res = await api.posts.list({ status: 'draft', limit: '50' });
      const draftPosts = Array.isArray(res.data?.posts) ? (res.data.posts as DraftPost[]) : [];
      setDrafts(sortDraftsByUpdatedAt(draftPosts));
    } catch {
      setDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }

  useEffect(() => {
    api.connections.list().then((res) => setConnections(res.data)).catch(() => {});
    void refreshApprovalQueue();
    void refreshDrafts();
  }, []);

  function toggleConnection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function parsePlatformMetadata(value: string): Record<string, Record<string, unknown>> | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Platform metadata must be valid JSON');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Platform metadata must be an object keyed by connection ID');
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    for (const [, entryValue] of entries) {
      if (!entryValue || typeof entryValue !== 'object' || Array.isArray(entryValue)) {
        throw new Error('Each platform metadata entry must be an object');
      }
    }

    return parsed as Record<string, Record<string, unknown>>;
  }

  function buildContentForCount(baseText: string): string {
    return buildPreviewText(baseText, hashtagsInput, link);
  }

  function getCharCount(connection: Connection) {
    const text = buildContentForCount(perPlatformCaptions[connection.id] || content);
    return { count: text.length, limit: CHAR_LIMITS[connection.platform] || 5000 };
  }

  function getPlatformValidationIssue(connection: Connection): string | null {
    const hashtagCount = parseHashtagsInput(hashtagsInput).length;
    const hashtagLimit = HASHTAG_LIMITS[connection.platform];
    if (hashtagLimit && hashtagCount > hashtagLimit) {
      return `Hashtag limit: ${hashtagLimit}`;
    }

    const mediaCount = mediaUploads.length;
    const hasVideo = mediaUploads.some((media) => media.type === 'video');
    if (connection.platform === 'instagram' && mediaCount === 0) return 'Requires at least one media attachment';
    if ((connection.platform === 'tiktok' || connection.platform === 'youtube') && mediaCount === 0) {
      return 'Requires at least one media attachment';
    }
    if ((connection.platform === 'tiktok' || connection.platform === 'youtube') && !hasVideo) {
      return 'Requires video media';
    }
    if (connection.platform === 'pinterest' && mediaCount === 0) return 'Requires at least one media attachment';
    if ((connection.platform === 'linkedin' || connection.platform === 'bluesky') && hasVideo) {
      return 'Only image attachments supported';
    }
    if (connection.platform === 'twitter' && mediaCount > 4) return 'Maximum 4 media attachments';

    return null;
  }

  async function handleMediaFileSelection(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const res = await api.posts.uploadMedia(file);
          return res.data;
        }),
      );
      setMediaUploads((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to upload media' });
    } finally {
      setUploadingMedia(false);
      if (mediaFileInputRef.current) {
        mediaFileInputRef.current.value = '';
      }
    }
  }

  function removeMediaUpload(index: number) {
    setMediaUploads((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  function resetComposerState(clearDraftSelection = true) {
    setContent('');
    setMediaUploads([]);
    setLink('');
    setHashtagsInput('');
    setPlatformMetadataInput('');
    setShowAdvancedMetadata(false);
    setSelectedIds(new Set());
    setPerPlatformCaptions({});
    setScheduledAt('');
    setAutosaveState('idle');
    setLastAutosavedAt(null);
    lastAutosaveSignatureRef.current = '';
    if (clearDraftSelection) {
      setCurrentDraftId('');
      setApprovalPostId('');
    }
  }

  function buildPlatformsPayload() {
    return Array.from(selectedIds).map((connId) => {
      const conn = connections.find((c) => c.id === connId);
      return {
        connectionId: connId,
        platform: conn?.platform || 'facebook',
        caption: perPlatformCaptions[connId] || undefined,
      };
    });
  }

  function buildPostPayload() {
    const hashtags = parseHashtagsInput(hashtagsInput);
    const platformMetadata = parsePlatformMetadata(platformMetadataInput);

    return {
      content,
      platforms: buildPlatformsPayload(),
      mediaUrls: mediaUploads.map((media) => media.url),
      link: link.trim() || undefined,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
      platformMetadata,
      scheduledAt: scheduledAt || undefined,
    };
  }

  function getAutosaveSignature() {
    return buildDraftAutosaveSignature({
      content,
      selectedConnectionIds: Array.from(selectedIds),
      perPlatformCaptions,
      mediaUrls: mediaUploads.map((media) => media.url),
      link,
      hashtagsInput,
      platformMetadataInput,
      scheduledAt,
    });
  }

  function hydrateDraft(post: DraftPost) {
    const selectedConnectionIds = (post.platformPosts || []).map((platformPost) => platformPost.socialConnectionId);
    const selectedSet = new Set(selectedConnectionIds);
    const designData = post.designData && typeof post.designData === 'object' ? post.designData : {};
    const rawCaptionMap = (designData as Record<string, unknown>)[PLATFORM_CAPTION_MAP_KEY];
    const captionMap = rawCaptionMap && typeof rawCaptionMap === 'object' && !Array.isArray(rawCaptionMap)
      ? rawCaptionMap as Record<string, unknown>
      : {};

    const nextCaptions = (post.platformPosts || []).reduce<Record<string, string>>((acc, platformPost) => {
      const compositeKey = `${platformPost.platform}:${platformPost.socialConnectionId}`;
      const caption = captionMap[compositeKey];
      if (typeof caption === 'string' && caption.trim().length > 0) {
        acc[platformPost.socialConnectionId] = caption.trim();
      }
      return acc;
    }, {});

    const rawPayloadMap = (designData as Record<string, unknown>)[PUBLISH_PAYLOAD_MAP_KEY];
    const payloadMap = rawPayloadMap && typeof rawPayloadMap === 'object' && !Array.isArray(rawPayloadMap)
      ? rawPayloadMap as Record<string, unknown>
      : {};
    const nextLink = typeof payloadMap.link === 'string' ? payloadMap.link : '';
    const nextHashtags = Array.isArray(payloadMap.hashtags)
      ? payloadMap.hashtags.filter((value): value is string => typeof value === 'string').join(', ')
      : '';
    const nextPlatformMetadata = payloadMap.platformMetadata
      && typeof payloadMap.platformMetadata === 'object'
      && !Array.isArray(payloadMap.platformMetadata)
        ? JSON.stringify(payloadMap.platformMetadata, null, 2)
        : '';

    const nextMedia = (post.media || []).map((media, index) => ({
      url: media.url,
      type: media.type === 'video' ? 'video' as const : 'image' as const,
      fileName: media.url.split('/').pop() || `media-${index + 1}`,
      mimeType: media.type === 'video' ? 'video/mp4' : 'image/*',
      size: 0,
    }));
    const nextScheduledAt = toLocalDateTimeInput(post.scheduledAt);

    setCurrentDraftId(post.id);
    setApprovalPostId(post.id);
    setContent(post.content || '');
    setSelectedIds(selectedSet);
    setPerPlatformCaptions(nextCaptions);
    setMediaUploads(nextMedia);
    setLink(nextLink);
    setHashtagsInput(nextHashtags);
    setPlatformMetadataInput(nextPlatformMetadata);
    setShowAdvancedMetadata(nextPlatformMetadata.length > 0);
    setScheduledAt(nextScheduledAt);
    setAutosaveState('idle');
    setLastAutosavedAt(null);

    lastAutosaveSignatureRef.current = buildDraftAutosaveSignature({
      content: post.content || '',
      selectedConnectionIds,
      perPlatformCaptions: nextCaptions,
      mediaUrls: nextMedia.map((media) => media.url),
      link: nextLink,
      hashtagsInput: nextHashtags,
      platformMetadataInput: nextPlatformMetadata,
      scheduledAt: nextScheduledAt,
    });
  }

  async function handleOpenDraft(draftId: string) {
    setDraftActionLoading(`open-${draftId}`);
    try {
      const res = await api.posts.get(draftId);
      hydrateDraft(res.data as DraftPost);
      setResult({ success: true, message: 'Draft loaded.' });
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to load draft.' });
    } finally {
      setDraftActionLoading(null);
    }
  }

  async function handleDeleteDraft(draftId: string) {
    setDraftActionLoading(`delete-${draftId}`);
    try {
      await api.posts.delete(draftId);
      if (currentDraftId === draftId) {
        resetComposerState();
      }
      await refreshDrafts();
      setResult({ success: true, message: 'Draft deleted.' });
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to delete draft.' });
    } finally {
      setDraftActionLoading(null);
    }
  }

  async function handlePublish(isDraft = false) {
    if (!content.trim() || selectedIds.size === 0) return;

    let payload: ReturnType<typeof buildPostPayload>;
    try {
      payload = buildPostPayload();
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Invalid platform metadata' });
      setAutosaveState('paused');
      return;
    }

    isDraft ? setSavingDraft(true) : setPublishing(true);
    setResult(null);

    try {
      if (isDraft) {
        let draftId = currentDraftId;
        if (draftId) {
          await api.posts.update(draftId, payload);
        } else {
          const res = await api.posts.create({ ...payload, isDraft: true });
          draftId = res.data?.id || '';
        }
        if (draftId) {
          setCurrentDraftId(draftId);
          setApprovalPostId(draftId);
        }
        lastAutosaveSignatureRef.current = getAutosaveSignature();
        setAutosaveState('saved');
        setLastAutosavedAt(new Date().toISOString());
        await refreshDrafts();
        setResult({ success: true, message: 'Draft saved!' });
        return;
      }

      if (currentDraftId) {
        await api.posts.update(currentDraftId, payload);

        if (scheduledAt) {
          const scheduledDate = new Date(scheduledAt);
          if (Number.isNaN(scheduledDate.getTime())) {
            throw new Error('Invalid scheduled date');
          }
          await api.schedule.schedulePost(currentDraftId, scheduledDate.toISOString());
        } else {
          await api.posts.publish(currentDraftId);
        }
      } else {
        await api.posts.create({ ...payload, isDraft: false });
      }

      setResult({
        success: true,
        message: scheduledAt ? 'Post scheduled!' : 'Post published!',
      });
      await refreshDrafts();
      resetComposerState();
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to publish' });
    } finally {
      setPublishing(false);
      setSavingDraft(false);
    }
  }

  async function handleSubmitForApproval() {
    if (!approvalPostId.trim()) {
      setResult({ success: false, message: 'Enter a post ID to submit for approval.' });
      return;
    }

    setApprovalActionLoading('submit');
    try {
      await api.posts.submitForApproval(approvalPostId.trim());
      setResult({ success: true, message: 'Post submitted for approval.' });
      await refreshApprovalQueue();
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to submit for approval.' });
    } finally {
      setApprovalActionLoading(null);
    }
  }

  async function handleReviewAction(postId: string, action: 'approve' | 'reject') {
    setApprovalActionLoading(`${action}-${postId}`);
    try {
      if (action === 'approve') {
        await api.posts.approve(postId);
      } else {
        await api.posts.reject(postId);
      }
      setResult({ success: true, message: `Post ${action === 'approve' ? 'approved' : 'rejected'}.` });
      await refreshApprovalQueue();
    } catch (err: any) {
      setResult({ success: false, message: err.message || `Failed to ${action} post.` });
    } finally {
      setApprovalActionLoading(null);
    }
  }

  const selectedConnectionIds = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const autosaveSignature = useMemo(
    () => buildDraftAutosaveSignature({
      content,
      selectedConnectionIds,
      perPlatformCaptions,
      mediaUrls: mediaUploads.map((media) => media.url),
      link,
      hashtagsInput,
      platformMetadataInput,
      scheduledAt,
    }),
    [
      content,
      selectedConnectionIds,
      perPlatformCaptions,
      mediaUploads,
      link,
      hashtagsInput,
      platformMetadataInput,
      scheduledAt,
    ],
  );

  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    if (uploadingMedia || publishing || savingDraft) return;
    if (!content.trim() || selectedIds.size === 0) {
      setAutosaveState('idle');
      return;
    }
    if (autosaveSignature === lastAutosaveSignatureRef.current) return;

    autosaveTimerRef.current = setTimeout(() => {
      void (async () => {
        let payload: ReturnType<typeof buildPostPayload>;
        try {
          payload = buildPostPayload();
        } catch {
          setAutosaveState('paused');
          return;
        }

        setAutosaveState('saving');
        try {
          let draftId = currentDraftId;
          if (draftId) {
            await api.posts.update(draftId, payload);
          } else {
            const res = await api.posts.create({ ...payload, isDraft: true });
            draftId = res.data?.id || '';
          }

          if (draftId) {
            setCurrentDraftId(draftId);
            setApprovalPostId(draftId);
          }

          await refreshDrafts();
          lastAutosaveSignatureRef.current = autosaveSignature;
          setAutosaveState('saved');
          setLastAutosavedAt(new Date().toISOString());
        } catch {
          setAutosaveState('error');
        }
      })();
    }, 1400);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    uploadingMedia,
    publishing,
    savingDraft,
    content,
    selectedIds.size,
    autosaveSignature,
    currentDraftId,
  ]);

  const selectedConnections = connections.filter((c) => selectedIds.has(c.id));
  const hasOverLimit = selectedConnections.some((c) => {
    const { count, limit } = getCharCount(c);
    return count > limit;
  });
  const hasRuleViolation = selectedConnections.some((connection) => Boolean(getPlatformValidationIssue(connection)));
  const parsedHashtags = parseHashtagsInput(hashtagsInput);
  const linkPreview = buildLinkPreviewData(link);
  const autosaveMessage = useMemo(() => {
    if (autosaveState === 'saving') return 'Autosaving draft...';
    if (autosaveState === 'saved') {
      const suffix = lastAutosavedAt ? ` at ${new Date(lastAutosavedAt).toLocaleTimeString()}` : '';
      return `Draft autosaved${suffix}`;
    }
    if (autosaveState === 'paused') return 'Autosave paused: fix metadata JSON to continue';
    if (autosaveState === 'error') return 'Autosave failed. Use Save Draft to retry.';
    return currentDraftId ? `Editing draft ${currentDraftId}` : null;
  }, [autosaveState, lastAutosavedAt, currentDraftId]);

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => resetComposerState()}
            disabled={uploadingMedia}
          >
            New Draft
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePublish(true)}
            loading={savingDraft}
            disabled={uploadingMedia}
          >
            <Save className="w-4 h-4" /> Save Draft
          </Button>
          <Button
            size="sm"
            onClick={() => handlePublish(false)}
            loading={publishing}
            disabled={!content.trim() || selectedIds.size === 0 || hasOverLimit || hasRuleViolation || uploadingMedia}
          >
            {scheduledAt ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {scheduledAt ? 'Schedule' : 'Publish Now'}
          </Button>
        </div>
      </div>
      {autosaveMessage && (
        <p className={`text-xs ${autosaveState === 'error' || autosaveState === 'paused' ? 'text-amber-600' : 'text-neutral-500'}`}>
          {autosaveMessage}
        </p>
      )}

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
                <button
                  type="button"
                  onClick={() => mediaFileInputRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
                  disabled={uploadingMedia}
                >
                  <Image className="w-5 h-5" />
                </button>
                <input
                  ref={mediaFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(event) => void handleMediaFileSelection(event.target.files)}
                />
                {uploadingMedia && (
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading media...
                  </div>
                )}
              </div>
              <span className="text-xs text-neutral-400">{content.length} characters</span>
            </div>
            {mediaUploads.length > 0 && (
              <div className="mt-3 space-y-2">
                {mediaUploads.map((media, index) => (
                  <div key={`${media.url}-${index}`} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-700 truncate">{media.fileName}</p>
                      <p className="text-[11px] text-neutral-400">{media.type} • {(media.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMediaUpload(index)}
                      className="p-1 rounded hover:bg-neutral-100 text-neutral-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-700">Post Options</h3>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Link (optional)</label>
              <input
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Hashtags (comma or space separated)</label>
              <input
                value={hashtagsInput}
                onChange={(event) => setHashtagsInput(event.target.value)}
                placeholder="launch, growth, product"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowAdvancedMetadata((prev) => !prev)}
                className="text-xs text-brand-blue hover:underline"
              >
                {showAdvancedMetadata ? 'Hide' : 'Show'} advanced platform metadata JSON
              </button>
              {showAdvancedMetadata && (
                <textarea
                  value={platformMetadataInput}
                  onChange={(event) => setPlatformMetadataInput(event.target.value)}
                  placeholder='{"connection_id":{"mediaIds":["media_1"]}}'
                  rows={4}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm font-mono resize-none"
                />
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-neutral-500" />
                <h3 className="text-sm font-semibold text-neutral-700">Preview</h3>
              </div>
              <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
            </button>

            {showPreview && (
              <div className="space-y-3">
                {linkPreview && (
                  <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50">
                    <p className="text-[11px] font-medium text-neutral-500 mb-1">Link Preview</p>
                    <a
                      href={linkPreview.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-brand-blue hover:underline break-all"
                    >
                      {linkPreview.title}
                    </a>
                    <p className="text-[11px] text-neutral-500 mt-1 break-all">{linkPreview.host}{linkPreview.path}</p>
                  </div>
                )}

                {selectedConnections.length === 0 ? (
                  <p className="text-xs text-neutral-400">Select at least one platform to see previews.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedConnections.map((conn) => {
                      const issue = getPlatformValidationIssue(conn);
                      const { count, limit } = getCharCount(conn);
                      const previewText = buildContentForCount(perPlatformCaptions[conn.id] || content);
                      const previewMedia = mediaUploads.slice(0, 2);
                      const platformName = PLATFORMS[conn.platform as PlatformType]?.name || conn.platform;

                      return (
                        <div key={`preview-${conn.id}`} className="rounded-lg border border-neutral-200 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-neutral-700 truncate">{platformName}</p>
                              <p className="text-[11px] text-neutral-500 truncate">{conn.accountName}</p>
                            </div>
                            <Badge variant={count > limit ? 'danger' : 'default'} className="shrink-0">
                              {count}/{limit}
                            </Badge>
                          </div>
                          <p className="text-sm text-neutral-700 whitespace-pre-wrap break-words">
                            {previewText || 'No content yet'}
                          </p>
                          {parsedHashtags.length > 0 && (
                            <p className="text-[11px] text-neutral-500">Hashtags: {parsedHashtags.map((tag) => `#${tag}`).join(' ')}</p>
                          )}
                          {previewMedia.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {previewMedia.map((media, index) =>
                                media.type === 'video' ? (
                                  <video
                                    key={`${conn.id}-video-${index}`}
                                    src={media.url}
                                    className="h-24 w-full rounded-md object-cover bg-black/5"
                                    controls
                                    muted
                                  />
                                ) : (
                                  <img
                                    key={`${conn.id}-image-${index}`}
                                    src={media.url}
                                    alt={media.fileName}
                                    className="h-24 w-full rounded-md object-cover bg-black/5"
                                  />
                                ),
                              )}
                            </div>
                          )}
                          {mediaUploads.length > previewMedia.length && (
                            <p className="text-[11px] text-neutral-500">
                              +{mediaUploads.length - previewMedia.length} more attachment
                              {mediaUploads.length - previewMedia.length > 1 ? 's' : ''}
                            </p>
                          )}
                          {issue && <p className="text-[11px] text-red-500">{issue}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Per-platform captions */}
          {showPerPlatform && selectedConnections.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700">Platform-Specific Captions</h3>
              {selectedConnections.map((conn) => {
                const { count, limit } = getCharCount(conn);
                const issue = getPlatformValidationIssue(conn);
                const hasIssue = count > limit || Boolean(issue);
                return (
                  <div key={conn.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-600">
                        {PLATFORMS[conn.platform as PlatformType]?.name || conn.platform} — {conn.accountName}
                      </span>
                      <span className={`text-xs ${hasIssue ? 'text-red-500 font-medium' : 'text-neutral-400'}`}>
                        {count}/{limit}
                      </span>
                    </div>
                    <textarea
                      value={perPlatformCaptions[conn.id] || ''}
                      onChange={(e) => setPerPlatformCaptions((prev) => ({ ...prev, [conn.id]: e.target.value }))}
                      placeholder={`Custom caption for ${conn.platform} (leave empty to use main)`}
                      rows={2}
                      className={`w-full px-3 py-2 border rounded-lg text-sm resize-none ${hasIssue ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`}
                    />
                    {issue && <p className="text-[11px] text-red-500">{issue}</p>}
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
                  const { count, limit } = getCharCount(conn);
                  const issue = getPlatformValidationIssue(conn);
                  const isOver = count > limit;
                  const hasIssue = isSelected && (isOver || Boolean(issue));

                  return (
                    <button
                      key={conn.id}
                      onClick={() => toggleConnection(conn.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left
                        ${isSelected
                          ? hasIssue ? 'border-red-300 bg-red-50' : 'border-brand-blue bg-blue-50'
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
                        {isSelected && issue && <p className="text-[11px] text-red-500 truncate">{issue}</p>}
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1.5">
                          {hasIssue && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          <Check className={`w-4 h-4 ${hasIssue ? 'text-red-500' : 'text-brand-blue'}`} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-700">Drafts</h3>
              <Button size="sm" variant="ghost" onClick={() => resetComposerState()}>
                New
              </Button>
            </div>
            {loadingDrafts ? (
              <p className="text-xs text-neutral-400">Loading drafts...</p>
            ) : drafts.length === 0 ? (
              <p className="text-xs text-neutral-400">No drafts yet</p>
            ) : (
              <div className="space-y-2">
                {drafts.slice(0, 8).map((draft) => {
                  const isActiveDraft = currentDraftId === draft.id;
                  return (
                    <div key={draft.id} className={`rounded-lg border p-2.5 space-y-2 ${isActiveDraft ? 'border-brand-blue bg-blue-50' : 'border-neutral-200'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-neutral-700 line-clamp-2">
                          {draft.content || '(No content)'}
                        </p>
                        <Badge variant="default" className="shrink-0">
                          {new Date(draft.updatedAt || draft.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-neutral-500">{draft.platformPosts?.length || 0} platform(s)</span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={draftActionLoading === `open-${draft.id}`}
                            onClick={() => void handleOpenDraft(draft.id)}
                          >
                            Open
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete draft ${draft.id}`}
                            loading={draftActionLoading === `delete-${draft.id}`}
                            onClick={() => void handleDeleteDraft(draft.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-700">Approval Workflow</h3>
            <div className="space-y-2">
              <input
                value={approvalPostId}
                onChange={(event) => setApprovalPostId(event.target.value)}
                placeholder="Draft post ID"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
              />
              <Button
                size="sm"
                className="w-full"
                loading={approvalActionLoading === 'submit'}
                onClick={handleSubmitForApproval}
              >
                Submit for approval
              </Button>
            </div>
            {pendingApprovals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-neutral-600">Pending review</p>
                {pendingApprovals.slice(0, 5).map((post) => (
                  <div key={post.id} className="rounded-lg border border-neutral-200 p-2 space-y-2">
                    <p className="text-xs text-neutral-700 line-clamp-2">{post.content}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-neutral-400">{post.author?.name || 'Unknown author'}</span>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={approvalActionLoading === `approve-${post.id}`}
                          onClick={() => handleReviewAction(post.id, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={approvalActionLoading === `reject-${post.id}`}
                          onClick={() => handleReviewAction(post.id, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Character limits summary */}
          {selectedConnections.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">Character Limits & Rules</h3>
              <div className="space-y-1.5">
                {selectedConnections.map((conn) => {
                  const { count, limit } = getCharCount(conn);
                  const pct = Math.min((count / limit) * 100, 100);
                  const issue = getPlatformValidationIssue(conn);
                  const isOver = count > limit;
                  const isInvalid = isOver || Boolean(issue);
                  return (
                    <div key={conn.id}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-600">{PLATFORMS[conn.platform as PlatformType]?.name || conn.platform}</span>
                        <span className={isInvalid ? 'text-red-500 font-medium' : 'text-neutral-400'}>{count}/{limit}</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-100 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${isInvalid ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-brand-blue'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      {issue && <p className="text-[11px] text-red-500 mt-1">{issue}</p>}
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
