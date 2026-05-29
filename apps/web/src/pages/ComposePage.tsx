import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { buildLinkPreviewData, buildPreviewText, parseHashtagsInput } from '@/lib/composePreview';
import {
  buildDraftAutosaveSignature,
  sortDraftsByUpdatedAt,
  toLocalDateTimeInput,
  toLocalDateTimeInputFromDate,
  toUtcIsoFromLocalDateTimeInput,
} from '@/lib/composeDrafts';
import { consumeComposeSeed } from '@/lib/composeSeed';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  Send, Save, Clock, Image, Video, X, Check, AlertTriangle,
  Loader2, Eye, ChevronDown, Trash2, Sparkles, LayoutTemplate,
} from 'lucide-react';

const CHAR_LIMITS: Record<string, number> = {
  twitter: 280, linkedin: 3000, facebook: 63206, instagram: 2200,
  tiktok: 2200, youtube: 5000, pinterest: 500, bluesky: 300,
  mastodon: 500, telegram: 4096, entreprenrs: 5000, chrxstians: 5000, iohah: 5000,
  threads: 500, reddit: 40000, tumblr: 5000, google_business: 1500,
  discord: 2000, slack: 4000, wordpress: 100000, medium: 100000,
  blogger: 100000, truth_social: 500, lemmy: 10000, pleroma: 500,
};
const HASHTAG_LIMITS: Record<string, number> = {
  instagram: 30,
  linkedin: 5,
};

type VideoPlatformLimit = {
  maxSizeMb?: number;
  maxDuration?: string;
  formats?: string;
  recommended?: string;
  note?: string;
};

// Guidance-only (platform limits change over time; we still enforce the API upload cap).
const VIDEO_LIMITS: Partial<Record<PlatformType, VideoPlatformLimit>> = {
  instagram: { maxSizeMb: 1024, maxDuration: 'up to ~15 min', formats: 'MP4/MOV', recommended: '9:16 (1080×1920)' },
  tiktok: { maxSizeMb: 500, maxDuration: 'up to ~10 min', formats: 'MP4/MOV', recommended: '9:16 (1080×1920)' },
  youtube: { maxSizeMb: 262144, maxDuration: 'up to ~12 hours', formats: 'MP4/MOV/WebM', recommended: '16:9 (long) or 9:16 (Shorts)' },
  twitter: { maxSizeMb: 512, maxDuration: 'up to ~2m20s (standard)', formats: 'MP4/MOV' },
  facebook: { maxSizeMb: 10240, maxDuration: 'up to ~240 min', formats: 'MP4/MOV' },
  pinterest: { maxSizeMb: 2048, maxDuration: 'up to ~15 min', formats: 'MP4/MOV' },
  mastodon: { note: 'Varies by server instance limits' },
  telegram: { note: 'Varies (Bot/API limits can be stricter)' },
  entreprenrs: { note: 'Varies by platform instance' },
  chrxstians: { note: 'Varies by platform instance' },
  iohah: { note: 'Varies by platform instance' },
};
const VIDEO_PLATFORM_IDS: PlatformType[] = [
  'facebook',
  'instagram',
  'tiktok',
  'twitter',
  'youtube',
  'pinterest',
  'mastodon',
  'telegram',
  'entreprenrs',
  'chrxstians',
  'iohah',
];
const SYSTEM_MEDIA_UPLOAD_LIMIT_MB = 250; // server-side cap (can be configured on the API)

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatVideoLimit(limit?: VideoPlatformLimit): string {
  if (!limit) return 'Video supported';
  const parts: string[] = [];
  if (limit.maxDuration) parts.push(limit.maxDuration);
  if (limit.maxSizeMb) parts.push(`max ${limit.maxSizeMb}MB`);
  if (limit.formats) parts.push(limit.formats);
  if (limit.recommended) parts.push(limit.recommended);
  if (limit.note) parts.push(limit.note);
  return parts.join(' • ') || 'Video supported';
}
const PLATFORM_CAPTION_MAP_KEY = '__smmtaiPlatformCaptions';
const PUBLISH_PAYLOAD_MAP_KEY = '__smmtaiPublishPayload';

function buildPlatformUrl(platform: string, postId: string): string | null {
  const id = postId.trim();
  if (!id) return null;
  if (platform === 'facebook') return `https://facebook.com/${id}`;
  if (platform === 'instagram') return `https://www.instagram.com/p/${id}/`;
  if (platform === 'twitter') return `https://x.com/i/status/${id}`;
  if (platform === 'linkedin') return `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/`;
  if (platform === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
  if (platform === 'pinterest') return `https://www.pinterest.com/pin/${encodeURIComponent(id)}/`;
  if (platform === 'entreprenrs') return `https://entreprenrs.com/post/${encodeURIComponent(id)}`;
  if (platform === 'iohah') return `https://iohah.com/posts/${encodeURIComponent(id)}`;
  if (platform === 'chrxstians') return `https://chrxstians.com/posts/${encodeURIComponent(id)}`;
  if (platform === 'tiktok' && /^\d+$/.test(id)) return `https://www.tiktok.com/video/${id}`;
  if (platform === 'threads') return `https://threads.net/@placeholder/post/${id}`;
  if (platform === 'reddit') return `https://reddit.com/comments/${id}`;
  if (platform === 'tumblr') return `https://tumblr.com/post/${id}`;
  if (platform === 'truth_social') return `https://truthsocial.com`;
  if (platform === 'pleroma') return `https://pleroma.social`;
  if (platform === 'lemmy') return `https://lemmy.ml`;
  if (platform === 'wordpress') return id.startsWith('http') ? id : null;
  if (platform === 'medium') return id.startsWith('http') ? id : null;
  if (platform === 'blogger') return id.startsWith('http') ? id : null;
  return null;
}

interface Connection {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
}

interface FacebookPage {
  id: string;
  name: string;
  picture: string | null;
  accessToken: string;
}

interface EntreprenrsPage {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
}

interface IohahDestinationResource {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  url?: string | null;
}

interface PublishResultItem {
  platform: string;
  status: string;
  platformPostId?: string;
  url?: string;
  error?: string;
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

type AiTone = 'professional' | 'casual' | 'witty' | 'formal' | 'inspirational' | 'educational' | 'persuasive';

type InlineAiAction = 'generate' | 'rewrite';

interface InlineAiSuggestion {
  mode: InlineAiAction;
  text: string;
  summary?: string;
  hashtags?: string[];
  start?: number;
  end?: number;
}

const INLINE_AI_TONES: AiTone[] = [
  'casual',
  'professional',
  'witty',
  'inspirational',
  'educational',
  'formal',
  'persuasive',
];

export function ComposePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const role = useAuthStore((s) => s.role);
  const canPublish = role !== 'viewer';
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
  const [showInlineAiPanel, setShowInlineAiPanel] = useState(false);
  const [inlineAiPrompt, setInlineAiPrompt] = useState('');
  const [inlineAiInstruction, setInlineAiInstruction] = useState('');
  const [inlineAiTone, setInlineAiTone] = useState<AiTone>('casual');
  const [inlineAiAction, setInlineAiAction] = useState<InlineAiAction | null>(null);
  const [inlineAiError, setInlineAiError] = useState<string | null>(null);
  const [inlineAiSuggestion, setInlineAiSuggestion] = useState<InlineAiSuggestion | null>(null);
  const [selectedTextLength, setSelectedTextLength] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scheduledAt, setScheduledAt] = useState('');

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [activeSidebarSection, setActiveSidebarSection] = useState<'destinations' | 'drafts' | null>('destinations');
  const [tempScheduledAt, setTempScheduledAt] = useState('');
  const [configModalPlatform, setConfigModalPlatform] = useState<PlatformType | null>(null);

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
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [loadingFbPages, setLoadingFbPages] = useState(false);
  const [selectedFacebookPage, setSelectedFacebookPage] = useState<FacebookPage | null>(null);
  const [fbDestination, setFbDestination] = useState<'timeline' | 'page'>('timeline');
  const [entreprenrsDestination, setEntreprenrsDestination] = useState<'timeline' | 'page'>('timeline');
  const [entreprenrsPageId, setEntreprenrsPageId] = useState('');
  const [chrxstiansDestination, setChrxstiansDestination] = useState<'timeline' | 'page' | 'group'>('timeline');
  const [chrxstiansPageId, setChrxstiansPageId] = useState('');
  const [chrxstiansGroupId, setChrxstiansGroupId] = useState('');
  const [chrxstiansPages, setChrxstiansPages] = useState<IohahDestinationResource[]>([]);
  const [chrxstiansGroups, setChrxstiansGroups] = useState<IohahDestinationResource[]>([]);
  const [loadingChrxstiansPages, setLoadingChrxstiansPages] = useState(false);
  const [loadingChrxstiansGroups, setLoadingChrxstiansGroups] = useState(false);
  const [iohahDestination, setIohahDestination] = useState<'timeline' | 'page' | 'group'>('timeline');
  const [iohahPageId, setIohahPageId] = useState('');
  const [iohahGroupId, setIohahGroupId] = useState('');
  const [iohahPages, setIohahPages] = useState<IohahDestinationResource[]>([]);
  const [iohahGroups, setIohahGroups] = useState<IohahDestinationResource[]>([]);
  const [loadingIohahPages, setLoadingIohahPages] = useState(false);
  const [loadingIohahGroups, setLoadingIohahGroups] = useState(false);
  const [entreprenrsPages, setEntreprenrsPages] = useState<EntreprenrsPage[]>([]);
  const [selectedEntreprenrsPage, setSelectedEntreprenrsPage] = useState<EntreprenrsPage | null>(null);
  const [loadingEntreprenrsPages, setLoadingEntreprenrsPages] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResultItem[]>([]);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showVideoLimits, setShowVideoLimits] = useState(false);
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
    
    const dateParam = searchParams.get('date');
    if (dateParam) {
      // Assuming dateParam is 'YYYY-MM-DD', set time to 12:00 PM local
      const localDatetime = `${dateParam}T12:00`;
      setScheduledAt(localDatetime);
      setTempScheduledAt(localDatetime);
      setShowScheduleModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const seed = consumeComposeSeed();
    if (!seed) return;

    if (seed.content?.trim()) setContent(seed.content);
    if (seed.link?.trim()) setLink(seed.link);
    if (seed.hashtags && seed.hashtags.length > 0) setHashtagsInput(seed.hashtags.join(', '));
    const seededMedia = seed.media;
    if (seededMedia && seededMedia.length > 0) setMediaUploads((prev) => [...seededMedia, ...prev]);

    setResult({
      success: true,
      message: seed.source === 'editor'
        ? 'Template design added to composer media.'
        : 'AI content loaded into composer.',
    });
    toast.success(seed.source === 'editor' ? 'Template Loaded' : 'AI Content Loaded');
  }, []);

  function toggleConnection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Load Facebook Pages when a Facebook connection is selected
  const selectedFbConnection = useMemo(
    () => connections.find((c) => c.platform === 'facebook' && selectedIds.has(c.id)),
    [connections, selectedIds],
  );
  const selectedEntreprenrsConnection = useMemo(
    () => connections.find((c) => c.platform === 'entreprenrs' && selectedIds.has(c.id)),
    [connections, selectedIds],
  );
  const selectedChrxstiansConnection = useMemo(
    () => connections.find((c) => c.platform === 'chrxstians' && selectedIds.has(c.id)),
    [connections, selectedIds],
  );
  const selectedIohahConnection = useMemo(
    () => connections.find((c) => c.platform === 'iohah' && selectedIds.has(c.id)),
    [connections, selectedIds],
  );
  const inlineAiPlatform = useMemo<PlatformType>(() => {
    const selectedConnection = connections.find((connection) => selectedIds.has(connection.id));
    const fallbackConnection = connections.find((connection) => connection.isActive);
    const candidate = selectedConnection?.platform || fallbackConnection?.platform || 'facebook';
    return Object.prototype.hasOwnProperty.call(PLATFORMS, candidate)
      ? candidate as PlatformType
      : 'facebook';
  }, [connections, selectedIds]);

  useEffect(() => {
    if (!selectedFbConnection) {
      setFacebookPages([]);
      setSelectedFacebookPage(null);
      setFbDestination('page');
      setLoadingFbPages(false);
      return;
    }
    setLoadingFbPages(true);
    api.connections.facebookPages(selectedFbConnection.id)
      .then((res) => {
        const pages = res.data || [];
        setFacebookPages(pages);
        // Auto-select first page
        if (pages.length > 0) {
          setSelectedFacebookPage(pages[0]);
          setFbDestination('page');
        }
    })
      .catch(() => setFacebookPages([]))
      .finally(() => setLoadingFbPages(false));
  }, [selectedFbConnection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedEntreprenrsConnection) {
      setEntreprenrsPages([]);
      setSelectedEntreprenrsPage(null);
      setLoadingEntreprenrsPages(false);
      return;
    }

    setLoadingEntreprenrsPages(true);
    api.connections.entreprenrsPages(selectedEntreprenrsConnection.id)
      .then((res) => {
        const pages = res.data || [];
        setEntreprenrsPages(pages);
        if (pages.length === 0) {
          setSelectedEntreprenrsPage(null);
          return;
        }

        const matchedPage = pages.find((page) => page.id === entreprenrsPageId.trim()) || pages[0];
        setSelectedEntreprenrsPage(matchedPage);
        setEntreprenrsPageId(matchedPage.id);
      })
      .catch(() => {
        setEntreprenrsPages([]);
        setSelectedEntreprenrsPage(null);
      })
      .finally(() => setLoadingEntreprenrsPages(false));
  }, [selectedEntreprenrsConnection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedChrxstiansConnection) {
      setChrxstiansPages([]);
      setChrxstiansGroups([]);
      setChrxstiansPageId('');
      setChrxstiansGroupId('');
      setLoadingChrxstiansPages(false);
      setLoadingChrxstiansGroups(false);
      return;
    }

    setLoadingChrxstiansPages(true);
    setLoadingChrxstiansGroups(true);

    api.connections.chrxstiansPages(selectedChrxstiansConnection.id)
      .then((res) => {
        const pages = res.data || [];
        setChrxstiansPages(pages);
        if (pages.length === 0) {
          setChrxstiansPageId('');
          return;
        }
        const matchedPage = pages.find((page) => page.id === chrxstiansPageId.trim()) || pages[0];
        setChrxstiansPageId(matchedPage.id);
      })
      .catch(() => {
        setChrxstiansPages([]);
        setChrxstiansPageId('');
      })
      .finally(() => setLoadingChrxstiansPages(false));

    api.connections.chrxstiansGroups(selectedChrxstiansConnection.id)
      .then((res) => {
        const groups = res.data || [];
        setChrxstiansGroups(groups);
        if (groups.length === 0) {
          setChrxstiansGroupId('');
          return;
        }
        const matchedGroup = groups.find((group) => group.id === chrxstiansGroupId.trim()) || groups[0];
        setChrxstiansGroupId(matchedGroup.id);
      })
      .catch(() => {
        setChrxstiansGroups([]);
        setChrxstiansGroupId('');
      })
      .finally(() => setLoadingChrxstiansGroups(false));
  }, [selectedChrxstiansConnection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedIohahConnection) {
      setIohahPages([]);
      setIohahGroups([]);
      setIohahPageId('');
      setIohahGroupId('');
      setLoadingIohahPages(false);
      setLoadingIohahGroups(false);
      return;
    }

    setLoadingIohahPages(true);
    setLoadingIohahGroups(true);

    api.connections.iohahPages(selectedIohahConnection.id)
      .then((res) => {
        const pages = res.data || [];
        setIohahPages(pages);
        if (pages.length === 0) {
          setIohahPageId('');
          return;
        }
        const matchedPage = pages.find((page) => page.id === iohahPageId.trim()) || pages[0];
        setIohahPageId(matchedPage.id);
      })
      .catch(() => {
        setIohahPages([]);
        setIohahPageId('');
      })
      .finally(() => setLoadingIohahPages(false));

    api.connections.iohahGroups(selectedIohahConnection.id)
      .then((res) => {
        const groups = res.data || [];
        setIohahGroups(groups);
        if (groups.length === 0) {
          setIohahGroupId('');
          return;
        }
        const matchedGroup = groups.find((group) => group.id === iohahGroupId.trim()) || groups[0];
        setIohahGroupId(matchedGroup.id);
      })
      .catch(() => {
        setIohahGroups([]);
        setIohahGroupId('');
      })
      .finally(() => setLoadingIohahGroups(false));
  }, [selectedIohahConnection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const hasImage = mediaUploads.some((media) => media.type === 'image');
    if (connection.platform === 'instagram' && mediaCount === 0) return 'Requires at least one media attachment';
    if ((connection.platform === 'tiktok' || connection.platform === 'youtube') && mediaCount === 0) {
      return 'Requires at least one media attachment';
    }
    if (connection.platform === 'tiktok' && hasVideo && hasImage) {
      return 'Cannot mix image and video attachments';
    }
    if (connection.platform === 'tiktok' && hasVideo && mediaCount > 1) {
      return 'TikTok video posts support one video attachment';
    }
    if (connection.platform === 'youtube' && !hasVideo) {
      return 'Requires video media';
    }
    if (connection.platform === 'pinterest' && mediaCount === 0) return 'Requires at least one media attachment';
    if ((connection.platform === 'linkedin' || connection.platform === 'bluesky') && hasVideo) {
      return 'Only image attachments supported';
    }
    if (connection.platform === 'twitter' && mediaCount > 4) return 'Maximum 4 media attachments';
    if (connection.platform === 'iohah' && iohahDestination === 'page' && !iohahPageId.trim()) {
      return 'Select an Iohah page or create one first';
    }
    if (connection.platform === 'iohah' && iohahDestination === 'group' && !iohahGroupId.trim()) {
      return 'Select an Iohah group or create one first';
    }
    if (connection.platform === 'chrxstians' && chrxstiansDestination === 'page' && !chrxstiansPageId.trim()) {
      return 'Select a Chrxstians page or create one first';
    }
    if (connection.platform === 'chrxstians' && chrxstiansDestination === 'group' && !chrxstiansGroupId.trim()) {
      return 'Select a Chrxstians group or create one first';
    }

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
      toast.error('Upload Failed', err.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
      if (videoFileInputRef.current) videoFileInputRef.current.value = '';
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
    setEntreprenrsDestination('timeline');
    setEntreprenrsPageId('');
    setSelectedEntreprenrsPage(null);
    setChrxstiansDestination('timeline');
    setChrxstiansPageId('');
    setChrxstiansGroupId('');
    setChrxstiansPages([]);
    setChrxstiansGroups([]);
    setIohahDestination('timeline');
    setIohahPageId('');
    setIohahGroupId('');
    setIohahPages([]);
    setIohahGroups([]);
    setSelectedIds(new Set());
    setPerPlatformCaptions({});
    setScheduledAt('');
    setAutosaveState('idle');
    setLastAutosavedAt(null);
    setInlineAiPrompt('');
    setInlineAiInstruction('');
    setInlineAiTone('casual');
    setInlineAiAction(null);
    setInlineAiError(null);
    setInlineAiSuggestion(null);
    setSelectedTextLength(0);
    setShowInlineAiPanel(false);
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

  function buildPostPayload(options?: { includeScheduledAt?: boolean }) {
    const includeScheduledAt = options?.includeScheduledAt ?? true;
    const hashtags = parseHashtagsInput(hashtagsInput);
    const platformMetadata = parsePlatformMetadata(platformMetadataInput);
    const scheduledAtIso = includeScheduledAt ? toUtcIsoFromLocalDateTimeInput(scheduledAt) : undefined;
    if (includeScheduledAt && scheduledAt && !scheduledAtIso) {
      throw new Error('Invalid scheduled date');
    }

    // Inject Facebook page target into platform metadata if a page is selected
    let mergedMetadata = platformMetadata;
    if (fbDestination === 'page' && selectedFacebookPage && selectedFbConnection) {
      mergedMetadata = mergedMetadata || {};
      mergedMetadata.facebook = {
        ...(mergedMetadata.facebook || {}),
        facebookPageId: selectedFacebookPage.id,
        facebookPageToken: selectedFacebookPage.accessToken,
      };
    }

    const selectedEntreprenrsConnectionIds = Array.from(selectedIds).filter((connectionId) => {
      const connection = connections.find((c) => c.id === connectionId);
      return connection?.platform === 'entreprenrs';
    });
    const resolvedEntreprenrsPageId = (selectedEntreprenrsPage?.id || entreprenrsPageId).trim();
    if (
      selectedEntreprenrsConnectionIds.length > 0
      && entreprenrsDestination === 'page'
      && resolvedEntreprenrsPageId
    ) {
      mergedMetadata = mergedMetadata || {};
      mergedMetadata.entreprenrs = {
        ...(mergedMetadata.entreprenrs || {}),
        destination: 'page',
        postOn: 'page',
        post_on: 'page',
        pageId: resolvedEntreprenrsPageId,
        page_id: resolvedEntreprenrsPageId,
      };
      selectedEntreprenrsConnectionIds.forEach((connectionId) => {
        mergedMetadata = mergedMetadata || {};
        mergedMetadata[connectionId] = {
          ...(mergedMetadata[connectionId] || {}),
          destination: 'page',
          postOn: 'page',
          post_on: 'page',
          pageId: resolvedEntreprenrsPageId,
          page_id: resolvedEntreprenrsPageId,
        };
      });
    }

    const selectedIohahConnectionIds = Array.from(selectedIds).filter((connectionId) => {
      const connection = connections.find((c) => c.id === connectionId);
      return connection?.platform === 'iohah';
    });
    const selectedChrxstiansConnectionIds = Array.from(selectedIds).filter((connectionId) => {
      const connection = connections.find((c) => c.id === connectionId);
      return connection?.platform === 'chrxstians';
    });
    if (selectedChrxstiansConnectionIds.length > 0) {
      mergedMetadata = mergedMetadata || {};
      const chrxMetadata: Record<string, unknown> = {
        destination: chrxstiansDestination,
        postOn: chrxstiansDestination,
        post_on: chrxstiansDestination,
      };
      if (chrxstiansDestination === 'page' && chrxstiansPageId.trim()) {
        chrxMetadata.pageId = chrxstiansPageId.trim();
        chrxMetadata.page_id = chrxstiansPageId.trim();
      }
      if (chrxstiansDestination === 'group' && chrxstiansGroupId.trim()) {
        chrxMetadata.groupId = chrxstiansGroupId.trim();
        chrxMetadata.group_id = chrxstiansGroupId.trim();
      }

      mergedMetadata.chrxstians = {
        ...(mergedMetadata.chrxstians || {}),
        ...chrxMetadata,
      };

      selectedChrxstiansConnectionIds.forEach((connectionId) => {
        mergedMetadata = mergedMetadata || {};
        mergedMetadata[connectionId] = {
          ...(mergedMetadata[connectionId] || {}),
          ...chrxMetadata,
        };
      });
    }

    if (selectedIohahConnectionIds.length > 0) {
      mergedMetadata = mergedMetadata || {};
      const ioMetadata: Record<string, unknown> = {
        destination: iohahDestination,
        postOn: iohahDestination,
        post_on: iohahDestination,
      };
      if (iohahDestination === 'page' && iohahPageId.trim()) {
        ioMetadata.pageId = iohahPageId.trim();
        ioMetadata.page_id = iohahPageId.trim();
      }
      if (iohahDestination === 'group' && iohahGroupId.trim()) {
        ioMetadata.groupId = iohahGroupId.trim();
        ioMetadata.group_id = iohahGroupId.trim();
      }

      mergedMetadata.iohah = {
        ...(mergedMetadata.iohah || {}),
        ...ioMetadata,
      };

      selectedIohahConnectionIds.forEach((connectionId) => {
        mergedMetadata = mergedMetadata || {};
        mergedMetadata[connectionId] = {
          ...(mergedMetadata[connectionId] || {}),
          ...ioMetadata,
        };
      });
    }

    return {
      content,
      platforms: buildPlatformsPayload(),
      mediaUrls: mediaUploads.map((media) => media.url),
      link: link.trim() || undefined,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
      platformMetadata: mergedMetadata,
      scheduledAt: scheduledAtIso,
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
    const rawPlatformMetadata = payloadMap.platformMetadata
      && typeof payloadMap.platformMetadata === 'object'
      && !Array.isArray(payloadMap.platformMetadata)
        ? payloadMap.platformMetadata as Record<string, unknown>
        : null;
    const entrepreneConnectionIds = (post.platformPosts || [])
      .filter((platformPost) => platformPost.platform === 'entreprenrs')
      .map((platformPost) => platformPost.socialConnectionId);
    const firstConnectionMetadata = rawPlatformMetadata && entrepreneConnectionIds.length > 0
      ? rawPlatformMetadata[entrepreneConnectionIds[0]]
      : null;
    const entreprenrsMetadata = firstConnectionMetadata
      && typeof firstConnectionMetadata === 'object'
      && !Array.isArray(firstConnectionMetadata)
        ? firstConnectionMetadata as Record<string, unknown>
        : rawPlatformMetadata
          && rawPlatformMetadata.entreprenrs
          && typeof rawPlatformMetadata.entreprenrs === 'object'
          && !Array.isArray(rawPlatformMetadata.entreprenrs)
            ? rawPlatformMetadata.entreprenrs as Record<string, unknown>
            : null;
    const nextEntreprenrsPageId = entreprenrsMetadata && typeof entreprenrsMetadata.pageId === 'string'
      ? entreprenrsMetadata.pageId
      : entreprenrsMetadata && typeof entreprenrsMetadata.page_id === 'string'
        ? entreprenrsMetadata.page_id
        : '';
    const chrxstiansConnectionIds = (post.platformPosts || [])
      .filter((platformPost) => platformPost.platform === 'chrxstians')
      .map((platformPost) => platformPost.socialConnectionId);
    const chrxstiansConnectionMetadata = rawPlatformMetadata && chrxstiansConnectionIds.length > 0
      ? rawPlatformMetadata[chrxstiansConnectionIds[0]]
      : null;
    const chrxstiansMetadata = chrxstiansConnectionMetadata
      && typeof chrxstiansConnectionMetadata === 'object'
      && !Array.isArray(chrxstiansConnectionMetadata)
        ? chrxstiansConnectionMetadata as Record<string, unknown>
        : rawPlatformMetadata
          && rawPlatformMetadata.chrxstians
          && typeof rawPlatformMetadata.chrxstians === 'object'
          && !Array.isArray(rawPlatformMetadata.chrxstians)
            ? rawPlatformMetadata.chrxstians as Record<string, unknown>
            : null;
    const rawChrxstiansDestination = chrxstiansMetadata
      && typeof chrxstiansMetadata.destination === 'string'
        ? chrxstiansMetadata.destination
        : chrxstiansMetadata && typeof chrxstiansMetadata.postOn === 'string'
          ? chrxstiansMetadata.postOn
          : chrxstiansMetadata && typeof chrxstiansMetadata.post_on === 'string'
            ? chrxstiansMetadata.post_on
            : '';
    const nextChrxstiansDestination = rawChrxstiansDestination.toLowerCase() === 'group'
      ? 'group'
      : rawChrxstiansDestination.toLowerCase() === 'page'
        ? 'page'
        : 'timeline';
    const nextChrxstiansPageId = chrxstiansMetadata && typeof chrxstiansMetadata.pageId === 'string'
      ? chrxstiansMetadata.pageId
      : chrxstiansMetadata && typeof chrxstiansMetadata.page_id === 'string'
        ? chrxstiansMetadata.page_id
        : '';
    const nextChrxstiansGroupId = chrxstiansMetadata && typeof chrxstiansMetadata.groupId === 'string'
      ? chrxstiansMetadata.groupId
      : chrxstiansMetadata && typeof chrxstiansMetadata.group_id === 'string'
        ? chrxstiansMetadata.group_id
        : '';
    const iohahConnectionIds = (post.platformPosts || [])
      .filter((platformPost) => platformPost.platform === 'iohah')
      .map((platformPost) => platformPost.socialConnectionId);
    const iohahConnectionMetadata = rawPlatformMetadata && iohahConnectionIds.length > 0
      ? rawPlatformMetadata[iohahConnectionIds[0]]
      : null;
    const iohahMetadata = iohahConnectionMetadata
      && typeof iohahConnectionMetadata === 'object'
      && !Array.isArray(iohahConnectionMetadata)
        ? iohahConnectionMetadata as Record<string, unknown>
        : rawPlatformMetadata
          && rawPlatformMetadata.iohah
          && typeof rawPlatformMetadata.iohah === 'object'
          && !Array.isArray(rawPlatformMetadata.iohah)
            ? rawPlatformMetadata.iohah as Record<string, unknown>
            : null;
    const rawIohahDestination = iohahMetadata
      && typeof iohahMetadata.destination === 'string'
        ? iohahMetadata.destination
        : iohahMetadata && typeof iohahMetadata.postOn === 'string'
          ? iohahMetadata.postOn
          : iohahMetadata && typeof iohahMetadata.post_on === 'string'
            ? iohahMetadata.post_on
            : '';
    const nextIohahDestination = rawIohahDestination.toLowerCase() === 'group'
      ? 'group'
      : rawIohahDestination.toLowerCase() === 'page'
        ? 'page'
        : 'timeline';
    const nextIohahPageId = iohahMetadata && typeof iohahMetadata.pageId === 'string'
      ? iohahMetadata.pageId
      : iohahMetadata && typeof iohahMetadata.page_id === 'string'
        ? iohahMetadata.page_id
        : '';
    const nextIohahGroupId = iohahMetadata && typeof iohahMetadata.groupId === 'string'
      ? iohahMetadata.groupId
      : iohahMetadata && typeof iohahMetadata.group_id === 'string'
        ? iohahMetadata.group_id
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
    setEntreprenrsDestination(nextEntreprenrsPageId ? 'page' : 'timeline');
    setEntreprenrsPageId(nextEntreprenrsPageId);
    setSelectedEntreprenrsPage(nextEntreprenrsPageId ? { id: nextEntreprenrsPageId, name: `Page ${nextEntreprenrsPageId}` } : null);
    setShowAdvancedMetadata(nextPlatformMetadata.length > 0);
    setScheduledAt(nextScheduledAt);
    setChrxstiansDestination(nextChrxstiansDestination);
    setChrxstiansPageId(nextChrxstiansPageId);
    setChrxstiansGroupId(nextChrxstiansGroupId);
    setIohahDestination(nextIohahDestination);
    setIohahPageId(nextIohahPageId);
    setIohahGroupId(nextIohahGroupId);
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
      toast.success('Draft Loaded');
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to load draft.' });
      toast.error('Load Failed', err.message || 'Failed to load draft.');
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
      toast.success('Draft Deleted');
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to delete draft.' });
      toast.error('Delete Failed', err.message || 'Failed to delete draft.');
    } finally {
      setDraftActionLoading(null);
    }
  }

  function readSelectedContentRange() {
    const textarea = contentTextareaRef.current;
    if (!textarea) {
      return { start: 0, end: 0, text: '' };
    }

    const start = Math.max(0, Math.min(textarea.selectionStart || 0, content.length));
    const end = Math.max(start, Math.min(textarea.selectionEnd || 0, content.length));
    return {
      start,
      end,
      text: content.slice(start, end),
    };
  }

  async function handleInlineAiGenerate() {
    const prompt = inlineAiPrompt.trim();
    if (!prompt) {
      setInlineAiError('Enter a prompt so AI can generate content.');
      return;
    }

    setInlineAiAction('generate');
    setInlineAiError(null);
    setInlineAiSuggestion(null);

    try {
      const captionRes = await api.ai.caption({
        topic: prompt,
        platform: inlineAiPlatform,
        tone: inlineAiTone,
        include_cta: true,
        include_emoji: true,
      });
      const captionData = captionRes.data || {};
      const baseCaption = typeof captionData.caption === 'string' ? captionData.caption.trim() : '';
      if (!baseCaption) {
        throw new Error('AI did not return generated content');
      }

      const instructionSuffix = inlineAiInstruction.trim()
        ? ` Additional instruction: ${inlineAiInstruction.trim()}`
        : '';
      const rewriteRes = await api.ai.rewrite({
        content: baseCaption,
        platform: inlineAiPlatform,
        tone: inlineAiTone,
        instruction: `Humanize this content so it sounds natural, authentic, and conversational while staying clear and post-ready.${instructionSuffix}`,
      });
      const rewriteData = rewriteRes.data || {};
      const rewritten = typeof rewriteData.rewritten === 'string' && rewriteData.rewritten.trim().length > 0
        ? rewriteData.rewritten.trim()
        : baseCaption;
      const hashtags = Array.isArray(captionData.hashtags)
        ? captionData.hashtags.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];

      setInlineAiSuggestion({
        mode: 'generate',
        text: rewritten,
        summary: typeof rewriteData.changes_summary === 'string' ? rewriteData.changes_summary : undefined,
        hashtags,
      });
      toast.success('AI Suggestion Ready');
    } catch (err: any) {
      const message = err.message || 'Failed to generate AI content';
      setInlineAiError(message);
      toast.error('AI Generation Failed', message);
    } finally {
      setInlineAiAction(null);
    }
  }

  async function handleInlineAiRewrite(autoApply = false) {
    const selection = readSelectedContentRange();
    const hasSelection = selection.end > selection.start && selection.text.trim().length > 0;
    const sourceText = hasSelection ? selection.text : content;
    if (!sourceText.trim()) {
      setInlineAiError('Write content first, then select a segment or rewrite all.');
      return;
    }

    setInlineAiAction('rewrite');
    setInlineAiError(null);
    setInlineAiSuggestion(null);

    try {
      const instruction = inlineAiInstruction.trim()
        || 'Rewrite and humanize this content while preserving the main message.';
      const rewriteRes = await api.ai.rewrite({
        content: sourceText,
        platform: inlineAiPlatform,
        tone: inlineAiTone,
        instruction,
      });
      const rewriteData = rewriteRes.data || {};
      const rewritten = typeof rewriteData.rewritten === 'string' ? rewriteData.rewritten.trim() : '';
      if (!rewritten) {
        throw new Error('AI did not return rewritten content');
      }

      const start = hasSelection ? selection.start : 0;
      const end = hasSelection ? selection.end : content.length;
      if (autoApply) {
        setContent((prev) => `${prev.slice(0, start)}${rewritten}${prev.slice(end)}`);
        setInlineAiSuggestion(null);
        setInlineAiError(null);
        toast.success(hasSelection ? 'Selected Text Rewritten' : 'Content Rewritten');
        requestAnimationFrame(() => {
          const textarea = contentTextareaRef.current;
          if (!textarea) return;
          textarea.focus();
          const caret = start + rewritten.length;
          textarea.setSelectionRange(caret, caret);
        });
      } else {
        setInlineAiSuggestion({
          mode: 'rewrite',
          text: rewritten,
          summary: typeof rewriteData.changes_summary === 'string' ? rewriteData.changes_summary : undefined,
          start,
          end,
        });
        toast.success(hasSelection ? 'Selected Text Rewritten' : 'Content Rewritten');
      }
    } catch (err: any) {
      const message = err.message || 'Failed to rewrite content';
      setInlineAiError(message);
      toast.error('AI Rewrite Failed', message);
    } finally {
      setInlineAiAction(null);
    }
  }

  function handleApplyInlineAiSuggestion() {
    if (!inlineAiSuggestion) return;

    if (inlineAiSuggestion.mode === 'generate') {
      setContent(inlineAiSuggestion.text);
      if ((inlineAiSuggestion.hashtags || []).length > 0 && !hashtagsInput.trim()) {
        setHashtagsInput((inlineAiSuggestion.hashtags || []).join(', '));
      }
      setInlineAiSuggestion(null);
      setInlineAiError(null);
      toast.success('AI content added to composer');
      return;
    }

    const start = typeof inlineAiSuggestion.start === 'number'
      ? Math.max(0, Math.min(inlineAiSuggestion.start, content.length))
      : 0;
    const end = typeof inlineAiSuggestion.end === 'number'
      ? Math.max(start, Math.min(inlineAiSuggestion.end, content.length))
      : content.length;

    setContent((prev) => `${prev.slice(0, start)}${inlineAiSuggestion.text}${prev.slice(end)}`);
    setInlineAiSuggestion(null);
    setInlineAiError(null);
    toast.success('AI rewrite applied');

    requestAnimationFrame(() => {
      const textarea = contentTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const caret = start + inlineAiSuggestion.text.length;
      textarea.setSelectionRange(caret, caret);
    });
  }

  async function handlePublish(action: 'draft' | 'publish' | 'schedule' = 'publish', dateOverride?: string) {
    if (!content.trim() || selectedIds.size === 0) return;

    let payload: ReturnType<typeof buildPostPayload>;
    try {
      payload = buildPostPayload({ includeScheduledAt: action !== 'publish' });
      if (dateOverride) payload.scheduledAt = dateOverride;
      if (action === 'schedule' && !payload.scheduledAt) {
        throw new Error('Choose a future date/time to schedule this post');
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Invalid platform metadata' });
      setAutosaveState('paused');
      return;
    }

    action === 'draft' ? setSavingDraft(true) : setPublishing(true);
    setResult(null);
    setPublishResults([]);

    try {
      if (action === 'draft') {
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
        toast.success('Draft Saved');
        return;
      }

      let results: PublishResultItem[] = [];
      if (currentDraftId) {
        await api.posts.update(currentDraftId, payload);

        if (action === 'schedule') {
          await api.schedule.schedulePost(currentDraftId, payload.scheduledAt!);
        } else {
          const pubRes = await api.posts.publish(currentDraftId);
          results = Array.isArray(pubRes.data) ? pubRes.data : [];
        }
      } else {
        if (action === 'schedule') {
          const createRes = await api.posts.create({ ...payload, scheduledAt: undefined, isDraft: true });
          const createdPostId = typeof createRes.data?.id === 'string' ? createRes.data.id : '';
          if (!createdPostId) {
            throw new Error('Could not create post for scheduling');
          }
          setCurrentDraftId(createdPostId);
          setApprovalPostId(createdPostId);
          await api.schedule.schedulePost(createdPostId, payload.scheduledAt!);
        } else {
          const createRes = await api.posts.create({ ...payload, isDraft: false });
          // For direct create+publish, results come from the platformPosts
          if (Array.isArray(createRes.data?.platformPosts)) {
            results = createRes.data.platformPosts.map((pp: any) => ({
              platform: pp.platform,
              status: pp.status,
              platformPostId: pp.platformPostId || undefined,
            }));
          }
        }
      }

      setPublishResults(results);
      setResult({
        success: true,
        message: action === 'schedule' ? 'Post scheduled!' : 'Post published!',
      });
      toast.success(
        action === 'schedule' ? 'Post Scheduled!' : 'Post Published!',
        action === 'schedule' ? 'Your post has been scheduled.' : 'Your post is now live.',
      );
      await refreshDrafts();
      resetComposerState();
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to publish' });
      const label = action === 'schedule' ? 'Schedule Failed' : action === 'publish' ? 'Publish Failed' : 'Save Failed';
      toast.error(label, err.message || 'Failed to publish');
    } finally {
      setPublishing(false);
      setSavingDraft(false);
    }
  }

  async function handleSubmitForApproval() {
    if (!approvalPostId.trim()) {
      setResult({ success: false, message: 'Enter a post ID to submit for approval.' });
      toast.warning('Missing Post ID', 'Enter a post ID to submit for approval.');
      return;
    }

    setApprovalActionLoading('submit');
    try {
      await api.posts.submitForApproval(approvalPostId.trim());
      setResult({ success: true, message: 'Post submitted for approval.' });
      toast.success('Submitted', 'Post submitted for approval.');
      await refreshApprovalQueue();
      resetComposerState();
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to submit for approval.' });
      toast.error('Submit Failed', err.message || 'Failed to submit for approval.');
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
      toast.success(action === 'approve' ? 'Approved' : 'Rejected', `Post ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await refreshApprovalQueue();
    } catch (err: any) {
      setResult({ success: false, message: err.message || `Failed to ${action} post.` });
      toast.error('Action Failed', err.message || `Failed to ${action} post.`);
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
  const selectedEntreprenrsConnections = selectedConnections.filter((c) => c.platform === 'entreprenrs');
  const selectedChrxstiansConnections = selectedConnections.filter((c) => c.platform === 'chrxstians');
  const selectedIohahConnections = selectedConnections.filter((c) => c.platform === 'iohah');
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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Compose Post</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Create and publish to {selectedIds.size} platform{selectedIds.size !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showInlineAiPanel ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setShowInlineAiPanel((prev) => !prev);
              setInlineAiError(null);
              setInlineAiSuggestion(null);
            }}
            disabled={uploadingMedia}
          >
            <Sparkles className="w-4 h-4" /> Compose AI
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/ai')}
            disabled={uploadingMedia}
          >
            <Sparkles className="w-4 h-4" /> AI Assistant
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/templates')}
            disabled={uploadingMedia}
          >
            <LayoutTemplate className="w-4 h-4" /> Templates
          </Button>
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
            onClick={() => void handlePublish('draft')}
            loading={savingDraft}
            disabled={uploadingMedia}
          >
            <Save className="w-4 h-4" /> Save Draft
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handlePublish('publish')}
            loading={publishing}
            disabled={!content.trim() || selectedIds.size === 0 || hasOverLimit || hasRuleViolation || uploadingMedia}
          >
            <Send className="w-4 h-4" /> Publish Now
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!scheduledAt) {
                setTempScheduledAt('');
                setShowScheduleModal(true);
              } else {
                void handlePublish('schedule');
              }
            }}
            loading={publishing}
            disabled={!content.trim() || selectedIds.size === 0 || hasOverLimit || hasRuleViolation || uploadingMedia}
          >
            <Clock className="w-4 h-4" /> Schedule Post
          </Button>

        </div>
      </div>
      {scheduledAt && (
        <div className="mt-4 flex items-center justify-between p-3 bg-brand-50 text-brand-700 rounded-xl border border-brand-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Scheduled for: {new Date(scheduledAt).toLocaleString()}</span>
          </div>
          <button onClick={() => setScheduledAt('')} className="text-brand-500 hover:text-brand-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {autosaveMessage && (
        <p className={`text-xs ${autosaveState === 'error' || autosaveState === 'paused' ? 'text-amber-600' : 'text-neutral-500'}`}>
          {autosaveMessage}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
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
          <Card className="p-4">
            <textarea
              ref={contentTextareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onSelect={(event) => {
                const target = event.currentTarget;
                const start = target.selectionStart || 0;
                const end = target.selectionEnd || 0;
                setSelectedTextLength(Math.max(0, end - start));
              }}
              placeholder="What do you want to share?"
              rows={6}
              className="w-full resize-none border-none text-base text-neutral-800 placeholder-neutral-300 focus:outline-none focus:ring-0"
            />
            <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineAiPanel((prev) => !prev);
                    setInlineAiError(null);
                    setInlineAiSuggestion(null);
                  }}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
                  disabled={uploadingMedia || inlineAiAction !== null}
                  aria-label="Open in-composer AI"
                  title="Open in-composer AI"
                >
                  <Sparkles className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleInlineAiRewrite(true)}
                  className="px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 text-xs font-medium text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                  disabled={uploadingMedia || inlineAiAction !== null || !content.trim()}
                  title={selectedTextLength > 0 ? 'Humanize selected text' : 'Humanize all content'}
                >
                  Humanize {selectedTextLength > 0 ? 'Selection' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVideoLimits(false);
                    imageFileInputRef.current?.click();
                  }}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
                  disabled={uploadingMedia}
                >
                  <Image className="w-5 h-5" />
                </button>
                <input
                  ref={imageFileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleMediaFileSelection(event.target.files)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowVideoLimits(true);
                    videoFileInputRef.current?.click();
                  }}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
                  disabled={uploadingMedia}
                  aria-label="Upload video"
                >
                  <Video className="w-5 h-5" />
                </button>
                <input
                  ref={videoFileInputRef}
                  type="file"
                  multiple
                  accept="video/*"
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
            {showVideoLimits && (
              <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-[11px] font-medium text-neutral-600">Video platforms & limits (guidance)</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Uploads are stored as-is (no transcoding). Platform limits can vary by account and may change.
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  System upload cap: ~{SYSTEM_MEDIA_UPLOAD_LIMIT_MB}MB per file.
                </p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VIDEO_PLATFORM_IDS.map((platformId) => (
                    <div key={platformId} className="text-[11px] text-neutral-600">
                      <span className="font-medium">{PLATFORMS[platformId].name}</span>
                      <span className="text-neutral-500"> — {formatVideoLimit(VIDEO_LIMITS[platformId])}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mediaUploads.length > 0 && (
              <div className="mt-3 space-y-2">
                {mediaUploads.map((media, index) => (
                  <div key={`${media.url}-${index}`} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-700 truncate">{media.fileName}</p>
                      <p className="text-[11px] text-neutral-400">{media.type} • {formatBytes(media.size)}</p>
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
            {showInlineAiPanel && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">In-Composer AI</p>
                    <p className="text-[11px] text-neutral-500">
                      Generate from a prompt or rewrite {selectedTextLength > 0 ? 'your selected text' : 'all content'} without leaving compose.
                    </p>
                  </div>
                  <Badge variant="brand">{PLATFORMS[inlineAiPlatform].name}</Badge>
                </div>

                <textarea
                  value={inlineAiPrompt}
                  onChange={(event) => setInlineAiPrompt(event.target.value)}
                  placeholder="Prompt for new content (optional for rewrite)"
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm resize-none bg-white"
                />
                <input
                  value={inlineAiInstruction}
                  onChange={(event) => setInlineAiInstruction(event.target.value)}
                  placeholder="Optional instruction (e.g. make it more persuasive)"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white"
                />

                <div className="flex flex-wrap gap-1.5">
                  {INLINE_AI_TONES.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setInlineAiTone(tone)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                        inlineAiTone === tone
                          ? 'bg-brand-blue text-white'
                          : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={inlineAiAction === 'generate'}
                    onClick={() => void handleInlineAiGenerate()}
                    disabled={inlineAiAction !== null}
                  >
                    <Sparkles className="w-4 h-4" /> Generate Humanized Content
                  </Button>
                  <Button
                    size="sm"
                    loading={inlineAiAction === 'rewrite'}
                    onClick={() => void handleInlineAiRewrite()}
                    disabled={inlineAiAction !== null || !content.trim()}
                  >
                    <Sparkles className="w-4 h-4" /> Rewrite & Humanize {selectedTextLength > 0 ? 'Selection' : 'All'}
                  </Button>
                </div>

                {inlineAiError && (
                  <p className="text-xs text-red-600">{inlineAiError}</p>
                )}

                {inlineAiSuggestion && (
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
                    <p className="text-xs font-medium text-neutral-600">
                      {inlineAiSuggestion.mode === 'generate' ? 'Generated suggestion' : 'Rewrite suggestion'}
                    </p>
                    <p className="text-sm text-neutral-800 whitespace-pre-wrap">{inlineAiSuggestion.text}</p>
                    {inlineAiSuggestion.summary && (
                      <p className="text-[11px] text-neutral-500">{inlineAiSuggestion.summary}</p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleApplyInlineAiSuggestion}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setInlineAiSuggestion(null)}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
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
              {publishResults.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {publishResults.map((pr, i) => {
                    const platform = PLATFORMS[pr.platform as PlatformType];
                    const url = pr.url || (pr.platformPostId ? buildPlatformUrl(pr.platform, pr.platformPostId) : null);
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: platform?.color || '#888' }} />
                          <span className="text-neutral-700">{platform?.name || pr.platform}</span>
                          <span className={pr.status === 'published' ? 'text-green-600' : 'text-red-500'}>
                            {pr.status === 'published' ? '✓' : '✗'}
                          </span>
                        </span>
                        {url && (
                          <a href={url} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">
                            View post →
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right sidebar — platform selection */}
        <div className="space-y-4">
          <Card className="p-4">
            <button 
              onClick={() => setActiveSidebarSection(activeSidebarSection === 'destinations' ? null : 'destinations')}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <h3 className="text-sm font-semibold text-neutral-700">Destinations</h3>
                <p className="text-xs text-neutral-500">{selectedIds.size} platform(s) selected</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${activeSidebarSection === 'destinations' ? 'rotate-180' : ''}`} />
            </button>
            
            {activeSidebarSection === 'destinations' && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
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
                      onClick={() => { toggleConnection(conn.id); if (!isSelected && ['facebook', 'entreprenrs', 'chrxstians', 'iohah'].includes(conn.platform)) { setConfigModalPlatform(conn.platform as PlatformType); } }}
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
          </div>
        )}
      </Card>
          

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setActiveSidebarSection(activeSidebarSection === 'drafts' ? null : 'drafts')}
                className="flex-1 flex items-center justify-between text-left pr-3"
              >
                <h3 className="text-sm font-semibold text-neutral-700">Drafts</h3>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${activeSidebarSection === 'drafts' ? 'rotate-180' : ''}`} />
              </button>
              <Button size="sm" variant="ghost" onClick={() => resetComposerState()}>
                New
              </Button>
            </div>
            
            {activeSidebarSection === 'drafts' && (
              <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
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
          </div>
            )}
          </Card>

          {!canPublish && (
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
          )}

          
        </div>
      </div>

      
      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-800">Schedule Post</h2>
              <button onClick={() => setShowScheduleModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-neutral-700">Select Date & Time</label>
              <input
                type="datetime-local"
                value={tempScheduledAt}
                onChange={(e) => setTempScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
              <Button 
                onClick={() => {
                  if (tempScheduledAt) {
                    setScheduledAt(tempScheduledAt);
                    setShowScheduleModal(false);
                    setTimeout(() => handlePublish('schedule', tempScheduledAt), 100);
                  }
                }}
                disabled={!tempScheduledAt}
              >
                Confirm Schedule
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Platform Config Modal */}
      {configModalPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-800 capitalize">Configure {configModalPlatform}</h2>
              <button onClick={() => setConfigModalPlatform(null)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {configModalPlatform === 'facebook' && selectedFbConnection && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-neutral-700">Post to Page</h3>
                  {loadingFbPages ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                      <p className="text-xs text-neutral-400">Loading your Pages...</p>
                    </div>
                  ) : facebookPages.length === 0 ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 space-y-2">
                      <p className="text-xs text-amber-700">
                        No Facebook Pages found. Facebook only allows apps to post to Pages you manage.
                      </p>
                      <a
                        href="https://www.facebook.com/pages/create"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs font-medium text-amber-800 hover:underline"
                      >
                        Create a Page &rarr;
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {facebookPages.map((page) => (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => {
                            setSelectedFacebookPage(page);
                            setFbDestination('page');
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            selectedFacebookPage?.id === page.id
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-neutral-200 hover:border-brand-300'
                          }`}
                        >
                          {(page as any).picture?.data?.url ? (
                            <img src={(page as any).picture.data.url} alt={page.name} className="w-8 h-8 rounded-full border border-neutral-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                              <span className="text-xs text-neutral-500 font-medium">{page.name.charAt(0)}</span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-neutral-800">{page.name}</p>
                            <p className="text-xs text-neutral-500">{(page as any).category || 'Facebook Page'}</p>
                          </div>
                          <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            selectedFacebookPage?.id === page.id ? 'border-brand-500 bg-brand-500' : 'border-neutral-300'
                          }`}>
                            {selectedFacebookPage?.id === page.id && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Iohah Config */}
              {configModalPlatform === 'iohah' && selectedIohahConnection && (
                <div className="space-y-3">
                  <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg w-fit">
                    {(['timeline', 'page', 'group'] as const).map((dest) => (
                      <button
                        key={dest}
                        type="button"
                        onClick={() => setIohahDestination(dest)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          iohahDestination === dest
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                      >
                        {dest.charAt(0).toUpperCase() + dest.slice(1)}
                      </button>
                    ))}
                  </div>

                  {iohahDestination === 'page' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-700">Select Page</label>
                      {loadingIohahPages ? (
                        <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-neutral-400" /><p className="text-xs text-neutral-400">Loading Pages...</p></div>
                      ) : iohahPages.length === 0 ? (
                        <p className="text-xs text-amber-600">No Iohah pages found. Please create one on Iohah first.</p>
                      ) : (
                        <select
                          value={iohahPageId}
                          onChange={(e) => setIohahPageId(e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                        >
                          <option value="">-- Select a Page --</option>
                          {iohahPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}

                  {iohahDestination === 'group' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-700">Select Group</label>
                      {loadingIohahGroups ? (
                        <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-neutral-400" /><p className="text-xs text-neutral-400">Loading Groups...</p></div>
                      ) : iohahGroups.length === 0 ? (
                        <p className="text-xs text-amber-600">No Iohah groups found. Please create or join one on Iohah first.</p>
                      ) : (
                        <select
                          value={iohahGroupId}
                          onChange={(e) => setIohahGroupId(e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                        >
                          <option value="">-- Select a Group --</option>
                          {iohahGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Entreprenrs Config */}
              {configModalPlatform === 'entreprenrs' && selectedEntreprenrsConnection && (
                <div className="space-y-3">
                  <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg w-fit">
                    {(['timeline', 'page'] as const).map((dest) => (
                      <button
                        key={dest}
                        type="button"
                        onClick={() => setEntreprenrsDestination(dest)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          entreprenrsDestination === dest
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                      >
                        {dest.charAt(0).toUpperCase() + dest.slice(1)}
                      </button>
                    ))}
                  </div>

                  {entreprenrsDestination === 'page' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-700">Select Page</label>
                      {loadingEntreprenrsPages ? (
                        <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-neutral-400" /><p className="text-xs text-neutral-400">Loading Pages...</p></div>
                      ) : entreprenrsPages.length === 0 ? (
                        <p className="text-xs text-amber-600">No Entreprenrs pages found. Please create one on Entreprenrs first.</p>
                      ) : (
                        <select
                          value={entreprenrsPageId}
                          onChange={(e) => {
                            const pageId = e.target.value;
                            setEntreprenrsPageId(pageId);
                            const p = entreprenrsPages.find(x => x.id === pageId);
                            if (p) setSelectedEntreprenrsPage(p);
                          }}
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                        >
                          <option value="">-- Select a Page --</option>
                          {entreprenrsPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Chrxstians Config */}
              {configModalPlatform === 'chrxstians' && selectedChrxstiansConnection && (
                <div className="space-y-3">
                  <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg w-fit">
                    {(['timeline', 'page', 'group'] as const).map((dest) => (
                      <button
                        key={dest}
                        type="button"
                        onClick={() => setChrxstiansDestination(dest)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          chrxstiansDestination === dest
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                      >
                        {dest.charAt(0).toUpperCase() + dest.slice(1)}
                      </button>
                    ))}
                  </div>

                  {chrxstiansDestination === 'page' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-700">Select Page</label>
                      {loadingChrxstiansPages ? (
                        <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-neutral-400" /><p className="text-xs text-neutral-400">Loading Pages...</p></div>
                      ) : chrxstiansPages.length === 0 ? (
                        <p className="text-xs text-amber-600">No Chrxstians pages found. Please create one on Chrxstians first.</p>
                      ) : (
                        <select
                          value={chrxstiansPageId}
                          onChange={(e) => setChrxstiansPageId(e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                        >
                          <option value="">-- Select a Page --</option>
                          {chrxstiansPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}

                  {chrxstiansDestination === 'group' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-700">Select Group</label>
                      {loadingChrxstiansGroups ? (
                        <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-neutral-400" /><p className="text-xs text-neutral-400">Loading Groups...</p></div>
                      ) : chrxstiansGroups.length === 0 ? (
                        <p className="text-xs text-amber-600">No Chrxstians groups found. Please create or join one on Chrxstians first.</p>
                      ) : (
                        <select
                          value={chrxstiansGroupId}
                          onChange={(e) => setChrxstiansGroupId(e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                        >
                          <option value="">-- Select a Group --</option>
                          {chrxstiansGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-4 border-t border-neutral-100">
              <Button onClick={() => setConfigModalPlatform(null)}>
                Save Selection
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
