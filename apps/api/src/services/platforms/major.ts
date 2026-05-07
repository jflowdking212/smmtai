import type { PlatformType } from '@ee-postmind/shared';
import type {
  PlatformAdapter,
  PlatformOAuthContext,
  PlatformTokens,
  PlatformAccount,
  PlatformPostPayload,
  PlatformPostResult,
  PlatformAnalytics,
} from './base.js';
import crypto from 'crypto';

const VIDEO_EXTENSION_REGEX = /\.(mp4|mov|avi|webm|m4v|mkv)(\?.*)?$/i;

// Convert Instagram numeric media ID to shortcode for post URLs
const IG_SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function instagramMediaIdToShortcode(mediaId: string): string {
  try {
    let n = BigInt(mediaId);
    let shortcode = '';
    while (n > 0n) {
      shortcode = IG_SHORTCODE_ALPHABET[Number(n % 64n)] + shortcode;
      n = n / 64n;
    }
    return shortcode;
  } catch {
    return mediaId;
  }
}

async function fetchInstagramPermalink(mediaId: string, accessToken: string, baseUrl: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/${mediaId}?fields=permalink&access_token=${accessToken}`);
    const data = await res.json() as any;
    if (data.permalink) {
      console.log(`[Instagram] permalink fetched: ${data.permalink}`);
      return data.permalink;
    }
    console.log(`[Instagram] permalink field empty, falling back to shortcode. API response: ${JSON.stringify(data)}`);
  } catch (err) {
    console.log(`[Instagram] permalink fetch failed: ${err}`);
  }
  // Fallback: convert numeric ID to shortcode
  const shortcode = instagramMediaIdToShortcode(mediaId);
  return `https://www.instagram.com/p/${shortcode}/`;
}

// Poll until container is FINISHED (required before media_publish)
async function waitForInstagramContainer(containerId: string, accessToken: string, baseUrl: string, maxRetries = 12): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, 3000)); // wait 3s between checks
    const res = await fetch(`${baseUrl}/${containerId}?fields=status_code,status&access_token=${accessToken}`);
    const data = await res.json() as any;
    const status = data.status_code || data.status;
    console.log(`[Instagram] container ${containerId} status: ${status} (attempt ${i + 1})`);
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Instagram media container failed with status: ${status}`);
    }
  }
  throw new Error('Instagram media container timed out — try again in a moment');
}

function isVideoPost(post: PlatformPostPayload, mediaUrl: string): boolean {
  if (post.mediaType) {
    return post.mediaType === 'video';
  }
  return VIDEO_EXTENSION_REGEX.test(mediaUrl);
}

function isVideoMediaUrl(mediaUrl: string): boolean {
  return VIDEO_EXTENSION_REGEX.test(mediaUrl);
}

function requirePrimaryMediaUrl(post: PlatformPostPayload, platformName: string): string {
  const mediaUrl = post.mediaUrls?.[0]?.trim();
  if (!mediaUrl) {
    throw new Error(`${platformName} publishing requires at least one media URL`);
  }
  return mediaUrl;
}

function buildPostText(post: PlatformPostPayload): string {
  const hashtags = post.hashtags?.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ') || '';
  return `${post.text || ''}${hashtags ? ` ${hashtags}` : ''}`.trim();
}

function buildXPostText(post: PlatformPostPayload): string {
  const text = buildPostText(post);
  const link = typeof post.link === 'string' ? post.link.trim() : '';
  if (!link || text.includes(link)) return text;
  return `${text} ${link}`.trim();
}

function getEnvValue(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function parseEnvBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (typeof rawValue !== 'string') return fallback;
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function resolveTikTokAuthScope(): string {
  const defaultScope = 'user.info.profile,user.info.stats,video.list,video.publish';
  const rawScope = getEnvValue('TIKTOK_AUTH_SCOPE', 'TIKTOK_AUTH_SCOPES', 'TIKTOK_SCOPE', 'TIKTOK_SCOPES');
  const scopeList = (rawScope || defaultScope)
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (!scopeList.length) {
    return defaultScope;
  }
  return [...new Set(scopeList)].join(',');
}

function resolveTikTokMediaUploadFallbackEnabled(): boolean {
  const rawValue = getEnvValue(
    'TIKTOK_ENABLE_MEDIA_UPLOAD_FALLBACK',
    'TIKTOK_ALLOW_MEDIA_UPLOAD_FALLBACK',
    'TIKTOK_ALLOW_MEDIA_UPLOAD',
  );
  return parseEnvBoolean(rawValue || undefined, false);
}

function resolveTikTokMediaProxyEnabled(): boolean {
  const rawValue = getEnvValue('TIKTOK_MEDIA_PROXY_ENABLED');
  return parseEnvBoolean(rawValue || undefined, true);
}

function resolveTikTokMediaProxyBaseUrl(): string {
  const raw = getEnvValue('TIKTOK_MEDIA_PROXY_BASE_URL', 'PUBLIC_API_BASE_URL', 'FRONTEND_URL');
  return raw.replace(/\/+$/, '');
}

function resolveTikTokMediaProxyTtlSeconds(): number {
  const raw = getEnvValue('TIKTOK_MEDIA_PROXY_TTL_SECONDS');
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3600;
  return Math.min(parsed, 24 * 60 * 60);
}

function resolveTikTokMediaProxySecret(): string {
  return getEnvValue('TIKTOK_MEDIA_PROXY_SECRET', 'JWT_SECRET') || 'ee-postmind-tiktok-media-proxy';
}

function resolveTikTokPublishStatusPollAttempts(): number {
  const raw = getEnvValue('TIKTOK_PUBLISH_STATUS_POLL_ATTEMPTS');
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 6;
  return Math.min(parsed, 30);
}

function resolveTikTokPublishStatusPollDelayMs(): number {
  const raw = getEnvValue('TIKTOK_PUBLISH_STATUS_POLL_DELAY_MS');
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000;
  return Math.min(Math.max(parsed, 1000), 30000);
}

function buildTikTokMediaProxySignature(url: string, expiresAt: number, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${url}|${expiresAt}`)
    .digest('hex');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function inferVideoContentType(mediaUrl: string): string {
  const normalized = mediaUrl.toLowerCase();
  if (normalized.includes('.mov')) return 'video/quicktime';
  if (normalized.includes('.webm')) return 'video/webm';
  if (normalized.includes('.avi')) return 'video/x-msvideo';
  if (normalized.includes('.mkv')) return 'video/x-matroska';
  return 'video/mp4';
}

function resolveErrorMessage(data: any): string | undefined {
  if (!data) return undefined;
  if (typeof data === 'string') return data;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.title === 'string') return data.title;
  if (typeof data.reason === 'string') return data.reason;
  if (typeof data.error_description === 'string') return data.error_description;
  if (typeof data.error === 'string') return data.error;
  if (Array.isArray(data.errors)) {
    const firstError = data.errors[0];
    if (typeof firstError === 'string') return firstError;
    if (typeof firstError?.message === 'string') return firstError.message;
    if (typeof firstError?.detail === 'string') return firstError.detail;
  }
  if (typeof data.error?.message === 'string') return data.error.message;
  if (typeof data.error?.error_message === 'string') return data.error.error_message;
  if (typeof data.error?.details === 'string') return data.error.details;
  return undefined;
}

function resolveTikTokErrorMessage(data: any): string | undefined {
  const baseMessage = resolveErrorMessage(data);
  const errorCode = data?.error?.code ?? data?.code;
  const normalizedCode = typeof errorCode === 'string' ? errorCode.trim() : '';
  const logId = data?.error?.log_id ?? data?.log_id;
  const metadataParts = [errorCode ? `code=${errorCode}` : '', logId ? `log_id=${logId}` : '']
    .filter((value) => value.length > 0);

  if (normalizedCode === 'unaudited_client_can_only_post_to_private_accounts') {
    const advisory = [
      'TikTok blocked this request because the app is unaudited and the connected TikTok account is not in private-account mode.',
      'Set the TikTok account to Private in TikTok settings, reconnect in EE PostMind, and retry.',
    ].join(' ');
    if (metadataParts.length > 0) {
      return `${advisory} (${metadataParts.join(', ')})`;
    }
    return advisory;
  }

  if (normalizedCode === 'scope_not_authorized') {
    const advisory = [
      'TikTok rejected this action because the connected token is missing required publish scopes.',
      'Reconnect TikTok and approve at least video.publish.',
      'If you use MEDIA_UPLOAD fallback, also include video.upload.',
    ].join(' ');
    if (metadataParts.length > 0) {
      return `${advisory} (${metadataParts.join(', ')})`;
    }
    return advisory;
  }

  if (baseMessage && metadataParts.length > 0) {
    return `${baseMessage} (${metadataParts.join(', ')})`;
  }
  if (baseMessage) return baseMessage;
  if (metadataParts.length > 0) return metadataParts.join(', ');
  return undefined;
}

async function readJson(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getGraphInsightMetric(data: any, metricName: string): number {
  const metric = data?.insights?.data?.find((item: any) => item?.name === metricName);
  const rawValue = metric?.values?.[0]?.value ?? metric?.value;
  if (rawValue && typeof rawValue === 'object') {
    return Object.values(rawValue as Record<string, unknown>)
      .reduce<number>((sum, current) => sum + toNumber(current), 0);
  }
  return toNumber(rawValue);
}

function isYouTubeDataApiDisabledMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  if (!normalized.includes('youtube data api v3')) return false;
  return normalized.includes('has not been used') || normalized.includes('disabled');
}

function getInstagramInsightMetric(data: any, metricName: string): number {
  const metric = data?.data?.find((item: any) => item?.name === metricName);
  const rawValue = metric?.values?.[0]?.value ?? metric?.value;
  if (rawValue && typeof rawValue === 'object') {
    return Object.values(rawValue as Record<string, unknown>)
      .reduce<number>((sum, current) => sum + toNumber(current), 0);
  }
  return toNumber(rawValue);
}

function resolveLinkedInUrn(platformPostId: string): string {
  if (platformPostId.startsWith('urn:li:')) return platformPostId;
  return `urn:li:ugcPost:${platformPostId}`;
}

function resolveLinkedInApiVersion(): string {
  const raw = (getEnvValue('LINKEDIN_API_VERSION', 'LINKEDIN_VERSION') || '').trim();
  return /^\d{6}$/.test(raw) ? raw : '202511';
}

function isLinkedInAnalyticsPermissionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('socialactions.get.no_version')
    || normalized.includes('not enough permissions')
    || normalized.includes('forbidden')
    || normalized.includes('unauthorized');
}

function isLinkedInAnalyticsFetchFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('fetch failed')
    || normalized.includes('networkerror')
    || normalized.includes('network error')
    || normalized.includes('enotfound')
    || normalized.includes('eai_again')
    || normalized.includes('econnreset')
    || normalized.includes('etimedout')
    || normalized.includes('timeout');
}

function buildLinkedInAnalyticsFallback(warning: string, raw?: unknown): PlatformAnalytics {
  return {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    saves: 0,
    metadata: raw === undefined ? { warning } : { warning, raw },
  };
}

function getPinterestMetric(data: any, metricName: string): number {
  const lower = metricName.toLowerCase();
  const candidates = [
    data?.all?.[metricName],
    data?.all?.[lower],
    data?.summary?.[metricName],
    data?.summary?.[lower],
    data?.[metricName],
    data?.[lower],
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return toNumber(candidate);
    }
  }

  const dailyMetrics = Array.isArray(data?.daily_metrics) ? data.daily_metrics : [];
  if (dailyMetrics.length > 0) {
    const latest = dailyMetrics[dailyMetrics.length - 1] as Record<string, unknown>;
    const dailyValue = latest?.[metricName] ?? latest?.[lower];
    return toNumber(dailyValue);
  }

  return 0;
}

// ============================================================
// Facebook / Instagram (Graph API)
// ============================================================

const FACEBOOK_GRAPH_OAUTH_SCOPES = 'public_profile,email,pages_show_list,pages_manage_posts,pages_read_engagement';
const INSTAGRAM_GRAPH_OAUTH_SCOPES = 'public_profile,email,pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,instagram_manage_messages,pages_manage_metadata';

export class FacebookAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'facebook';
  private get clientId(): string {
    return getEnvValue('FACEBOOK_APP_ID', 'FACEBOOK_CLIENT_ID');
  }

  private get clientSecret(): string {
    return getEnvValue('FACEBOOK_APP_SECRET', 'FACEBOOK_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    return getEnvValue('FACEBOOK_REDIRECT_URI', 'FACEBOOK_CALLBACK_URL') || 'http://localhost:4016/api/v1/connections/facebook/callback';
  }

  getAuthUrl(state: string): string {
    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${FACEBOOK_GRAPH_OAUTH_SCOPES}&state=${state}&response_type=code`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${encodeURIComponent(this.redirectUri)}&code=${code}`);
    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${this.clientId}&client_secret=${this.clientSecret}&fb_exchange_token=${refreshToken}`);
    const data = await res.json() as any;
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${accessToken}`);
    const data = await res.json() as any;
    return { id: data.id, name: data.name, avatar: data.picture?.data?.url };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    let pageId = post.metadata?.facebookPageId as string | undefined;
    let pageToken = post.metadata?.facebookPageToken as string | undefined;

    // If no page specified, auto-resolve the first managed page
    if (!pageId || !pageToken) {
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`);
      const pagesData = await pagesRes.json() as any;
      const firstPage = pagesData?.data?.[0];
      if (firstPage?.id && firstPage?.access_token) {
        pageId = firstPage.id;
        pageToken = firstPage.access_token;
      }
    }

    if (!pageId || !pageToken) {
      throw new Error('No Facebook Page found. Connect a Facebook account that manages at least one Page.');
    }

    const mediaUrls = (post.mediaUrls || []).filter((u) => u.trim());
    const hasMedia = mediaUrls.length > 0;
    const hasVideo = hasMedia && isVideoPost(post, mediaUrls[0]);

    // Video post
    if (hasMedia && hasVideo) {
      const body: Record<string, string> = { file_url: mediaUrls[0], access_token: pageToken };
      if (post.text) body.description = post.text;
      const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to publish video to Facebook');
      const postId = data.id ? `${pageId}_${data.id}` : '';
      return { platformPostId: postId, url: postId ? `https://facebook.com/${postId}` : undefined };
    }

    // Single image post
    if (hasMedia && mediaUrls.length === 1) {
      const body: Record<string, string> = { url: mediaUrls[0], access_token: pageToken };
      if (post.text) body.message = post.text;
      const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to publish photo to Facebook');
      const postId = data.post_id || (data.id ? `${pageId}_${data.id}` : '');
      return { platformPostId: postId, url: postId ? `https://facebook.com/${postId}` : undefined };
    }

    // Multiple images: upload each as unpublished, then attach to a feed post
    if (hasMedia && mediaUrls.length > 1) {
      const photoIds: string[] = [];
      for (const url of mediaUrls) {
        const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, published: false, access_token: pageToken }),
        });
        const data = await res.json() as any;
        if (!res.ok) throw new Error(data?.error?.message || 'Failed to upload photo to Facebook');
        if (data.id) photoIds.push(data.id);
      }
      const feedBody: Record<string, unknown> = { access_token: pageToken };
      if (post.text) feedBody.message = post.text;
      photoIds.forEach((id, i) => { feedBody[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
      const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedBody),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to publish multi-photo post to Facebook');
      const postId = data.id || '';
      return { platformPostId: postId, url: postId ? `https://facebook.com/${postId}` : undefined };
    }

    // Text-only (or link) post
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: post.text, link: post.link, access_token: pageToken }),
    });
    const data = await res.json() as any;
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Failed to publish to Facebook');
    }
    const postId = data.id || '';
    return { platformPostId: postId, url: postId ? `https://facebook.com/${postId}` : undefined };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    // Resolve page token — FB post IDs are formatted as pageId_postId
    let token = accessToken;
    const pageId = platformPostId.split('_')[0];
    if (pageId) {
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&access_token=${accessToken}`);
      const pagesData = await readJson(pagesRes) as any;
      const page = pagesData?.data?.find((p: any) => p.id === pageId);
      if (page?.access_token) token = page.access_token;
    }

    // Fetch fields that work in development mode (reactions, likes, shares)
    const basicRes = await fetch(`https://graph.facebook.com/v21.0/${platformPostId}?fields=${encodeURIComponent('likes.limit(0).summary(true),reactions.limit(0).summary(true),shares')}&access_token=${token}`);
    const basicData = await readJson(basicRes);
    if (!basicRes.ok) {
      throw new Error(resolveErrorMessage(basicData) || 'Failed to fetch Facebook analytics');
    }

    const likes = toNumber(basicData?.reactions?.summary?.total_count || basicData?.likes?.summary?.total_count);
    const shares = toNumber(basicData?.shares?.count);

    // Comments need pages_read_user_content — try gracefully
    let comments = 0;
    try {
      const commRes = await fetch(`https://graph.facebook.com/v21.0/${platformPostId}?fields=${encodeURIComponent('comments.limit(0).summary(true)')}&access_token=${token}`);
      const commData = await readJson(commRes) as any;
      if (commRes.ok) comments = toNumber(commData?.comments?.summary?.total_count);
    } catch { /* comments unavailable in dev mode */ }

    // Try insights (may fail without advanced access, that's OK)
    let impressions = 0;
    let reach = 0;
    try {
      const insightsRes = await fetch(`https://graph.facebook.com/v21.0/${platformPostId}/insights?metric=post_impressions,post_engaged_users&access_token=${token}`);
      const insightsData = await readJson(insightsRes) as any;
      if (insightsData?.data) {
        impressions = getGraphInsightMetric(insightsData, 'post_impressions');
        reach = getGraphInsightMetric(insightsData, 'post_engaged_users');
      }
    } catch { /* insights unavailable */ }

    return {
      impressions,
      reach,
      likes,
      comments,
      shares,
      clicks: 0,
      saves: 0,
      metadata: basicData,
    };
  }
}

export class InstagramAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'instagram';
  private get clientId(): string {
    return getEnvValue('INSTAGRAM_APP_ID', 'FACEBOOK_APP_ID', 'FACEBOOK_CLIENT_ID');
  }

  private get clientSecret(): string {
    return getEnvValue('INSTAGRAM_APP_SECRET', 'FACEBOOK_APP_SECRET', 'FACEBOOK_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    return getEnvValue('INSTAGRAM_REDIRECT_URI', 'INSTAGRAM_CALLBACK_URL') || 'http://localhost:4016/api/v1/connections/instagram/callback';
  }

  getAuthUrl(state: string): string {
    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${INSTAGRAM_GRAPH_OAUTH_SCOPES}&state=${state}&response_type=code`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${encodeURIComponent(this.redirectUri)}&code=${code}`);
    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${this.clientId}&client_secret=${this.clientSecret}&fb_exchange_token=${refreshToken}`);
    const data = await res.json() as any;
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    // Try me/accounts first (works when app is Live or user granted page access)
    const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account,access_token&limit=100&access_token=${accessToken}`);
    const pages = await res.json() as any;

    let igId: string | undefined;
    let pageAccessToken: string | undefined;

    if (pages.data?.length) {
      for (const page of pages.data) {
        if (page.instagram_business_account?.id) {
          igId = page.instagram_business_account.id;
          pageAccessToken = page.access_token;
          break;
        }
      }
    }

    // Fallback for dev mode: query known pages directly by ID
    if (!igId) {
      console.log('[Instagram] me/accounts empty, trying direct page queries...');
      const knownPageIds = ['635023013019902', '108319364836316', '1054240364432475', '400899663102071'];
      for (const pid of knownPageIds) {
        try {
          const pRes = await fetch(`https://graph.facebook.com/v21.0/${pid}?fields=id,name,instagram_business_account&access_token=${accessToken}`);
          const pData = await pRes.json() as any;
          if (pData.instagram_business_account?.id) {
            igId = pData.instagram_business_account.id;
            console.log(`[Instagram] Found IG business account ${igId} via page ${pData.name} (${pid})`);
            break;
          }
        } catch {
          // Skip inaccessible pages
        }
      }
    }

    if (!igId) {
      console.error('[Instagram] No Instagram Business account found via any method');
      return { id: '', name: 'Instagram' };
    }

    const profileRes = await fetch(`https://graph.facebook.com/v21.0/${igId}?fields=id,username,profile_picture_url&access_token=${accessToken}`);
    const profile = await profileRes.json() as any;
    return { id: profile.id || igId, name: profile.username || 'Instagram', avatar: profile.profile_picture_url };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const account = await this.getAccountInfo(accessToken);
    if (!account.id) {
      throw new Error('Could not resolve Instagram business account');
    }

    const mediaUrl = requirePrimaryMediaUrl(post, 'Instagram');
    const text = buildPostText(post);
    const isVideo = isVideoPost(post, mediaUrl);

    const createBody = new URLSearchParams({
      access_token: accessToken,
      caption: text,
      [isVideo ? 'video_url' : 'image_url']: mediaUrl,
    });
    if (isVideo) {
      createBody.set('media_type', 'REELS');
    }

    const createRes = await fetch(`https://graph.facebook.com/v21.0/${account.id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: createBody.toString(),
    });
    const createData = await readJson(createRes);
    if (!createRes.ok || !createData.id) {
      throw new Error(resolveErrorMessage(createData) || 'Failed to create Instagram media');
    }

    // Wait for container to be ready before publishing (images are fast, videos take longer)
    if (isVideo) {
      await waitForInstagramContainer(createData.id, accessToken, 'https://graph.facebook.com/v21.0');
    }

    const publishBody = new URLSearchParams({
      access_token: accessToken,
      creation_id: createData.id,
    });
    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${account.id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishBody.toString(),
    });
    const publishData = await readJson(publishRes);
    if (!publishRes.ok || !publishData.id) {
      throw new Error(resolveErrorMessage(publishData) || 'Failed to publish Instagram media');
    }

    // Fetch real permalink (shortcode-based URL) after publish
    const mediaId = publishData.id.toString();
    const postUrl = await fetchInstagramPermalink(mediaId, accessToken, 'https://graph.facebook.com/v21.0');

    return { platformPostId: mediaId, url: postUrl };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const params = new URLSearchParams({
      metric: 'impressions,reach,likes,comments,shares,saved',
      access_token: accessToken,
    });
    const res = await fetch(`https://graph.facebook.com/v21.0/${platformPostId}/insights?${params.toString()}`);
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(resolveErrorMessage(data) || 'Failed to fetch Instagram analytics');
    }

    return {
      impressions: getInstagramInsightMetric(data, 'impressions'),
      reach: getInstagramInsightMetric(data, 'reach'),
      likes: getInstagramInsightMetric(data, 'likes'),
      comments: getInstagramInsightMetric(data, 'comments'),
      shares: getInstagramInsightMetric(data, 'shares'),
      clicks: 0,
      saves: getInstagramInsightMetric(data, 'saved'),
      metadata: data,
    };
  }

  async getConversations(accessToken: string): Promise<any[]> {
    const account = await this.getAccountInfo(accessToken);
    if (!account.id) return [];
    const res = await fetch(`https://graph.facebook.com/v21.0/${account.id}/conversations?platform=instagram&fields=participants,updated_time,id,messages.limit(1){id,created_time,from,to,message}&access_token=${accessToken}`);
    const data = await readJson(res);
    if (!res.ok) {
      console.error('[Instagram] getConversations error:', resolveErrorMessage(data));
      return [];
    }
    return data.data || [];
  }

  async getMessages(accessToken: string, conversationId: string): Promise<any[]> {
    const res = await fetch(`https://graph.facebook.com/v21.0/${conversationId}?fields=messages{id,created_time,from,to,message}&access_token=${accessToken}`);
    const data = await readJson(res);
    if (!res.ok) {
      console.error('[Instagram] getMessages error:', resolveErrorMessage(data));
      return [];
    }
    return data.messages?.data || [];
  }

  async sendMessage(accessToken: string, recipientId: string, messageText: string): Promise<any> {
    const account = await this.getAccountInfo(accessToken);
    if (!account.id) throw new Error('Could not resolve Instagram business account');
    const res = await fetch(`https://graph.facebook.com/v21.0/${account.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
        messaging_type: 'HUMAN_AGENT',
      }),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(resolveErrorMessage(data) || 'Failed to send message');
    return data;
  }

  async getPostComments(accessToken: string, mediaId: string): Promise<any[]> {
    const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}/comments?fields=id,text,timestamp,username,replies{id,text,timestamp,username}&access_token=${accessToken}`);
    const data = await readJson(res);
    if (!res.ok) {
      console.error('[Instagram] getPostComments error:', resolveErrorMessage(data));
      return [];
    }
    return data.data || [];
  }

  async replyToComment(accessToken: string, commentId: string, replyText: string): Promise<any> {
    const body = new URLSearchParams({ message: replyText, access_token: accessToken });
    const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(resolveErrorMessage(data) || 'Failed to reply to comment');
    return data;
  }

  async hideComment(accessToken: string, commentId: string, hide: boolean): Promise<any> {
    const body = new URLSearchParams({ hide: String(hide), access_token: accessToken });
    const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(resolveErrorMessage(data) || 'Failed to update comment visibility');
    return data;
  }

  async deleteComment(accessToken: string, commentId: string): Promise<any> {
    const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}?access_token=${accessToken}`, {
      method: 'DELETE',
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(resolveErrorMessage(data) || 'Failed to delete comment');
    return data;
  }
}

// ============================================================
// Instagram Direct Login (no Facebook required)
// ============================================================

const INSTAGRAM_DIRECT_SCOPES = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights';

export class InstagramDirectAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'instagram';
  private get clientId(): string {
    return getEnvValue('INSTAGRAM_DIRECT_APP_ID');
  }
  private get clientSecret(): string {
    return getEnvValue('INSTAGRAM_DIRECT_APP_SECRET');
  }
  private get redirectUri(): string {
    const uri = getEnvValue('INSTAGRAM_DIRECT_REDIRECT_URI', 'INSTAGRAM_REDIRECT_URI') || 'http://localhost:4016/api/v1/connections/instagram/callback';
    console.log('[Instagram Direct] Using redirect URI:', uri);
    return uri;
  }

  getAuthUrl(state: string): string {
    const url = `https://www.instagram.com/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${INSTAGRAM_DIRECT_SCOPES}&response_type=code&state=${state}&enable_fb_login=0`;
    console.log('[Instagram Direct] Auth URL:', url);
    return url;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    // Short-lived token
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code,
    });
    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json() as any;
    if (!data.access_token) {
      throw new Error(data.error_message || 'Failed to exchange Instagram code');
    }

    // Exchange for long-lived token
    const longRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${this.clientSecret}&access_token=${data.access_token}`);
    const longData = await longRes.json() as any;

    return {
      accessToken: longData.access_token || data.access_token,
      expiresAt: longData.expires_in ? new Date(Date.now() + longData.expires_in * 1000) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`);
    const data = await res.json() as any;
    return {
      accessToken: data.access_token || refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch(`https://graph.instagram.com/v21.0/me?fields=user_id,username,profile_picture_url,account_type&access_token=${accessToken}`);
    const data = await res.json() as any;
    if (data.error) {
      console.error('[Instagram Direct] getAccountInfo error:', data.error.message);
      return { id: '', name: 'Instagram' };
    }
    return {
      id: data.user_id?.toString() || data.id?.toString() || '',
      name: data.username || 'Instagram',
      avatar: data.profile_picture_url,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const account = await this.getAccountInfo(accessToken);
    if (!account.id) throw new Error('Could not resolve Instagram account');

    const mediaUrl = requirePrimaryMediaUrl(post, 'Instagram');
    const text = buildPostText(post);
    const isVideo = isVideoPost(post, mediaUrl);

    const createBody = new URLSearchParams({
      access_token: accessToken,
      caption: text,
      [isVideo ? 'video_url' : 'image_url']: mediaUrl,
    });
    if (isVideo) createBody.set('media_type', 'REELS');

    const createRes = await fetch(`https://graph.instagram.com/v21.0/${account.id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: createBody.toString(),
    });
    const createData = await readJson(createRes);
    if (!createRes.ok || !createData.id) {
      throw new Error(resolveErrorMessage(createData) || 'Failed to create Instagram media');
    }

    // Wait for container to be ready before publishing (required for videos)
    if (isVideo) {
      await waitForInstagramContainer(createData.id, accessToken, 'https://graph.instagram.com/v21.0');
    }

    const publishBody = new URLSearchParams({
      access_token: accessToken,
      creation_id: createData.id,
    });
    const publishRes = await fetch(`https://graph.instagram.com/v21.0/${account.id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishBody.toString(),
    });
    const publishData = await readJson(publishRes);
    if (!publishRes.ok || !publishData.id) {
      throw new Error(resolveErrorMessage(publishData) || 'Failed to publish Instagram media');
    }

    // Fetch real permalink (shortcode-based URL) after publish
    const mediaId = publishData.id.toString();
    const postUrl = await fetchInstagramPermalink(mediaId, accessToken, 'https://graph.instagram.com/v21.0');

    return { platformPostId: mediaId, url: postUrl };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const params = new URLSearchParams({
      metric: 'impressions,reach,likes,comments,shares,saved',
      access_token: accessToken,
    });
    const res = await fetch(`https://graph.instagram.com/v21.0/${platformPostId}/insights?${params.toString()}`);
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(resolveErrorMessage(data) || 'Failed to fetch Instagram analytics');
    }
    return {
      impressions: getInstagramInsightMetric(data, 'impressions'),
      reach: getInstagramInsightMetric(data, 'reach'),
      likes: getInstagramInsightMetric(data, 'likes'),
      comments: getInstagramInsightMetric(data, 'comments'),
      shares: getInstagramInsightMetric(data, 'shares'),
      clicks: 0,
      saves: getInstagramInsightMetric(data, 'saved'),
      metadata: data,
    };
  }

  async getConversations(accessToken: string): Promise<any[]> {
    const account = await this.getAccountInfo(accessToken);
    if (!account.id) return [];
    const res = await fetch(`https://graph.instagram.com/v21.0/${account.id}/conversations?platform=instagram&fields=participants,updated_time,id,messages.limit(1){id,created_time,from,to,message}&access_token=${accessToken}`);
    const data = await readJson(res);
    if (!res.ok) {
      console.error('[Instagram Direct] getConversations error:', resolveErrorMessage(data));
      return [];
    }
    return data.data || [];
  }

  async getMessages(accessToken: string, conversationId: string): Promise<any[]> {
    const res = await fetch(`https://graph.instagram.com/v21.0/${conversationId}?fields=messages{id,created_time,from,to,message}&access_token=${accessToken}`);
    const data = await readJson(res);
    if (!res.ok) {
      console.error('[Instagram Direct] getMessages error:', resolveErrorMessage(data));
      return [];
    }
    return data.messages?.data || [];
  }

  async sendMessage(accessToken: string, recipientId: string, messageText: string): Promise<any> {
    const account = await this.getAccountInfo(accessToken);
    if (!account.id) throw new Error('Could not resolve Instagram account');
    const res = await fetch(`https://graph.instagram.com/v21.0/${account.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
        messaging_type: 'HUMAN_AGENT',
      }),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(resolveErrorMessage(data) || 'Failed to send message');
    return data;
  }

  async getPostComments(accessToken: string, mediaId: string): Promise<any[]> {
    const res = await fetch(`https://graph.instagram.com/v21.0/${mediaId}/comments?fields=id,text,timestamp,username,replies{id,text,timestamp,username}&access_token=${accessToken}`);
    const data = await readJson(res);
    if (!res.ok) {
      console.error('[Instagram Direct] getPostComments error:', resolveErrorMessage(data));
      return [];
    }
    return data.data || [];
  }

  async replyToComment(accessToken: string, commentId: string, replyText: string): Promise<any> {
    const body = new URLSearchParams({ message: replyText, access_token: accessToken });
    const res = await fetch(`https://graph.instagram.com/v21.0/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(resolveErrorMessage(data) || 'Failed to reply to comment');
    return data;
  }

  async hideComment(accessToken: string, commentId: string, hide: boolean): Promise<any> {
    const body = new URLSearchParams({ hide: String(hide), access_token: accessToken });
    const res = await fetch(`https://graph.instagram.com/v21.0/${commentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(resolveErrorMessage(data) || 'Failed to update comment visibility');
    return data;
  }

  async deleteComment(accessToken: string, commentId: string): Promise<any> {
    const res = await fetch(`https://graph.instagram.com/v21.0/${commentId}?access_token=${accessToken}`, {
      method: 'DELETE',
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(resolveErrorMessage(data) || 'Failed to delete comment');
    return data;
  }
}

export class TwitterAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'twitter';
  private clientId = process.env.TWITTER_CLIENT_ID || '';
  private clientSecret = process.env.TWITTER_CLIENT_SECRET || '';
  private redirectUri = process.env.TWITTER_REDIRECT_URI || 'http://localhost:4016/api/v1/connections/twitter/callback';
  private authBaseUrl = 'https://x.com';
  private apiBaseUrl = 'https://api.x.com/2';
  private legacyApiBaseUrl = 'https://api.twitter.com/2';

  private buildClientAuthorizationHeader(): string {
    const encodedClientId = encodeURIComponent(this.clientId);
    const encodedClientSecret = encodeURIComponent(this.clientSecret);
    return `Basic ${Buffer.from(`${encodedClientId}:${encodedClientSecret}`).toString('base64')}`;
  }

  private buildPkceCodeVerifier(state: string): string {
    return crypto
      .createHash('sha256')
      .update(`${state}:${this.clientSecret || this.clientId}`)
      .digest('base64url');
  }

  private buildPkceCodeChallenge(codeVerifier: string): string {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  getAuthUrl(state: string): string {
    const codeVerifier = this.buildPkceCodeVerifier(state);
    const codeChallenge = this.buildPkceCodeChallenge(codeVerifier);
    return `${this.authBaseUrl}/i/oauth2/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  }

  async exchangeCode(code: string, context?: PlatformOAuthContext): Promise<PlatformTokens> {
    if (!context?.state) {
      throw new Error('Missing OAuth state for Twitter token exchange');
    }
    const codeVerifier = this.buildPkceCodeVerifier(context.state);
    const res = await fetch(`${this.apiBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.buildClientAuthorizationHeader(),
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to exchange X authorization code');
    }

    const expiresIn = toNumber(data.expires_in);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch(`${this.apiBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.buildClientAuthorizationHeader(),
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.clientId,
      }).toString(),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to refresh X access token');
    }
    const expiresIn = toNumber(data.expires_in);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : undefined,
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const profileUrls = [
      `${this.apiBaseUrl}/users/me?user.fields=profile_image_url,username`,
      `${this.legacyApiBaseUrl}/users/me?user.fields=profile_image_url,username`,
    ];

    let lastErrorMessage = 'Failed to fetch X account profile';

    for (const profileUrl of profileUrls) {
      const res = await fetch(profileUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await readJson(res);
      if (res.ok && data?.data?.id) {
        return {
          id: data.data.id,
          name: data.data.name,
          username: data.data.username,
          avatar: data.data.profile_image_url,
        };
      }

      const reason = resolveErrorMessage(data);
      const fallback = `Failed to fetch X account profile (HTTP ${res.status})`;
      lastErrorMessage = reason ? `${fallback}: ${reason}` : fallback;
    }

    throw new Error(lastErrorMessage);
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const text = buildXPostText(post);
    if (!text) {
      throw new Error('X posts require text content');
    }
    if (text.length > 280) {
      throw new Error('X posts are limited to 280 characters');
    }

    const metadata = post.metadata as { mediaIds?: string[] } | undefined;
    const mediaIds = Array.isArray(metadata?.mediaIds)
      ? metadata.mediaIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim())
      : [];
    const hasMediaUrls = post.mediaUrls?.some((url) => url.trim().length > 0) ?? false;
    if (hasMediaUrls && mediaIds.length === 0) {
      throw new Error('X media URLs require metadata.mediaIds for pre-uploaded assets');
    }
    if (mediaIds.length > 4) {
      throw new Error('X supports up to 4 media attachments per post');
    }

    const payload: Record<string, unknown> = { text };
    if (mediaIds.length > 0) {
      payload.media = { media_ids: mediaIds };
    }

    const res = await fetch(`${this.apiBaseUrl}/tweets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.data?.id) {
      throw new Error(resolveErrorMessage(data) || 'Failed to publish X post');
    }

    const tweetId = data.data.id.toString();
    return { platformPostId: tweetId, url: `https://x.com/i/status/${tweetId}` };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const res = await fetch(
      `${this.apiBaseUrl}/tweets/${platformPostId}?tweet.fields=public_metrics,organic_metrics,non_public_metrics`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const data = await readJson(res);
    if (!res.ok || !data?.data) {
      throw new Error(resolveErrorMessage(data) || 'Failed to fetch X analytics');
    }

    const publicMetrics = data.data.public_metrics || {};
    const organicMetrics = data.data.organic_metrics || {};
    const impressions = toNumber(organicMetrics.impression_count ?? publicMetrics.impression_count);
    const retweets = toNumber(publicMetrics.retweet_count);
    const quotes = toNumber(publicMetrics.quote_count);

    return {
      impressions,
      reach: impressions,
      likes: toNumber(publicMetrics.like_count),
      comments: toNumber(publicMetrics.reply_count),
      shares: retweets + quotes,
      clicks: toNumber(organicMetrics.url_link_clicks ?? organicMetrics.user_profile_clicks),
      saves: toNumber(publicMetrics.bookmark_count),
      metadata: data,
    };
  }
}

// ============================================================
// LinkedIn — Marketing API
// ============================================================

export class LinkedInAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'linkedin';
  private clientId = getEnvValue('LINKEDIN_CLIENT_ID', 'LINKEDIN_APP_ID');
  private clientSecret = getEnvValue('LINKEDIN_CLIENT_SECRET', 'LINKEDIN_APP_SECRET');
  private redirectUri = getEnvValue('LINKEDIN_REDIRECT_URI', 'LINKEDIN_CALLBACK_URL') || 'http://localhost:4016/api/v1/connections/linkedin/callback';
  private analyticsApiVersion = resolveLinkedInApiVersion();

  getAuthUrl(state: string): string {
    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=openid%20profile%20w_member_social&state=${state}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to exchange LinkedIn authorization code');
    }
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + toNumber(data.expires_in) * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${this.clientId}&client_secret=${this.clientSecret}`,
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return { id: data.sub, name: data.name, avatar: data.picture };
  }

  private async uploadImageAsset(accessToken: string, ownerUrn: string, mediaUrl: string): Promise<string> {
    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) {
      throw new Error(`Unable to fetch media for LinkedIn upload (${mediaRes.status})`);
    }

    const contentType = mediaRes.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error('LinkedIn currently supports image attachments only');
    }
    const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());

    const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          owner: ownerUrn,
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    });
    const registerData = await readJson(registerRes);
    const uploadUrl = registerData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    const assetUrn = registerData?.value?.asset;
    if (!registerRes.ok || !uploadUrl || !assetUrn) {
      throw new Error(resolveErrorMessage(registerData) || 'Failed to initialize LinkedIn media upload');
    }

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: mediaBuffer,
    });
    const uploadData = await readJson(uploadRes);
    if (!uploadRes.ok) {
      throw new Error(resolveErrorMessage(uploadData) || `Failed to upload LinkedIn media (${uploadRes.status})`);
    }

    return assetUrn.toString();
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const userInfo = await this.getAccountInfo(accessToken);
    const authorUrn = `urn:li:person:${userInfo.id}`;
    const text = buildPostText(post);
    const mediaUrl = post.mediaUrls?.[0]?.trim();
    const link = post.link?.trim();

    let shareContent: Record<string, unknown> = {
      shareCommentary: { text },
      shareMediaCategory: 'NONE',
    };

    if (mediaUrl) {
      if (isVideoPost(post, mediaUrl)) {
        throw new Error('LinkedIn currently supports image attachments only');
      }

      const assetUrn = await this.uploadImageAsset(accessToken, authorUrn, mediaUrl);
      shareContent = {
        shareCommentary: { text },
        shareMediaCategory: 'IMAGE',
        media: [
          {
            status: 'READY',
            media: assetUrn,
            originalUrl: mediaUrl,
            title: { text: (text.split('\n')[0] || 'Post image').slice(0, 200) },
          },
        ],
      };
    } else if (link) {
      shareContent = {
        shareCommentary: { text },
        shareMediaCategory: 'ARTICLE',
        media: [{ status: 'READY', originalUrl: link }],
      };
    }

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.id) {
      throw new Error(resolveErrorMessage(data) || 'Failed to publish LinkedIn post');
    }

    const postUrn = data.id.toString();
    return { platformPostId: postUrn, url: `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/` };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const urn = resolveLinkedInUrn(platformPostId);
    let res: Response;
    let data: any;

    try {
      res = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(urn)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Linkedin-Version': this.analyticsApiVersion,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      data = await readJson(res);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch LinkedIn analytics';
      if (isLinkedInAnalyticsFetchFailure(errorMessage)) {
        return buildLinkedInAnalyticsFallback(
          'LinkedIn analytics is temporarily unavailable. Please retry in a few minutes.',
          errorMessage,
        );
      }
      throw error instanceof Error ? error : new Error('Failed to fetch LinkedIn analytics');
    }

    if (!res.ok) {
      const errorMessage = resolveErrorMessage(data) || 'Failed to fetch LinkedIn analytics';
      if (isLinkedInAnalyticsPermissionError(errorMessage)) {
        return buildLinkedInAnalyticsFallback(errorMessage, data);
      }
      if (isLinkedInAnalyticsFetchFailure(errorMessage)) {
        return buildLinkedInAnalyticsFallback(
          'LinkedIn analytics is temporarily unavailable. Please retry in a few minutes.',
          data,
        );
      }
      throw new Error(errorMessage);
    }

    const impressions = toNumber(
      data?.impressionSummary?.impressionCount
      ?? data?.impressionSummary?.organicImpressionCount
      ?? data?.impressionSummary?.uniqueImpressions,
    );
    const likes = toNumber(data?.likesSummary?.totalLikes);
    const comments = toNumber(data?.commentsSummary?.totalFirstLevelComments);
    const shares = toNumber(data?.sharesSummary?.count);

    return {
      impressions,
      reach: impressions,
      likes,
      comments,
      shares,
      clicks: 0,
      saves: 0,
      metadata: data,
    };
  }
}

// ============================================================
// TikTok — Content Posting API
// ============================================================

export class TikTokAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'tiktok';
  private clientKey = getEnvValue('TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_ID');
  private clientSecret = getEnvValue('TIKTOK_CLIENT_SECRET', 'TIKTOK_APP_SECRET');
  private redirectUri = (getEnvValue('TIKTOK_REDIRECT_URI', 'TIKTOK_CALLBACK_URL') || 'http://localhost:4016/api/v1/connections/tiktok/callback').replace(/\/+$/, '');
  private authScope = resolveTikTokAuthScope();
  private mediaUploadFallbackEnabled = resolveTikTokMediaUploadFallbackEnabled();
  private mediaProxyEnabled = resolveTikTokMediaProxyEnabled();
  private mediaProxyBaseUrl = resolveTikTokMediaProxyBaseUrl();
  private mediaProxyTtlSeconds = resolveTikTokMediaProxyTtlSeconds();
  private mediaProxySecret = resolveTikTokMediaProxySecret();
  private publishStatusPollAttempts = resolveTikTokPublishStatusPollAttempts();
  private publishStatusPollDelayMs = resolveTikTokPublishStatusPollDelayMs();

  private buildPkceCodeVerifier(state: string): string {
    return crypto
      .createHash('sha256')
      .update(`${state}:${this.clientSecret || this.clientKey}`)
      .digest('base64url');
  }

  private buildPkceCodeChallenge(codeVerifier: string): string {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  getAuthUrl(state: string): string {
    const codeVerifier = this.buildPkceCodeVerifier(state);
    const codeChallenge = this.buildPkceCodeChallenge(codeVerifier);
    const params = new URLSearchParams({
      client_key: this.clientKey,
      response_type: 'code',
      scope: this.authScope,
      redirect_uri: this.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      disable_auto_auth: '1',
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  async exchangeCode(code: string, context?: PlatformOAuthContext): Promise<PlatformTokens> {
    if (!context?.state) {
      throw new Error('Missing OAuth state for TikTok token exchange');
    }
    const codeVerifier = this.buildPkceCodeVerifier(context.state);
    const body = new URLSearchParams({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to exchange TikTok authorization code');
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + toNumber(data.expires_in) * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const body = new URLSearchParams({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to refresh TikTok access token');
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + toNumber(data.expires_in) * 1000) : undefined,
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return { id: data.data?.user?.open_id, name: data.data?.user?.display_name, avatar: data.data?.user?.avatar_url };
  }

  private async queryCreatorInfo(accessToken: string): Promise<{
    privacyLevelOptions: string[];
    canToggleComments: boolean;
    canToggleDuet: boolean;
    canToggleStitch: boolean;
  }> {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(resolveTikTokErrorMessage(data) || 'Failed to query TikTok creator info');
    }

    const privacyLevelOptions = Array.isArray(data?.data?.privacy_level_options)
      ? data.data.privacy_level_options
        .filter((value: unknown) => typeof value === 'string' && value.trim().length > 0)
        .map((value: string) => value.trim())
      : [];

    return {
      privacyLevelOptions,
      canToggleComments: data?.data?.comment_disabled !== true,
      canToggleDuet: data?.data?.duet_disabled !== true,
      canToggleStitch: data?.data?.stitch_disabled !== true,
    };
  }

  private resolveTikTokPrivacyLevel(
    preferredPrivacyLevel: string | undefined,
    privacyLevelOptions: string[],
  ): string {
    const normalizedPreferred = (preferredPrivacyLevel || '').trim();
    if (normalizedPreferred && privacyLevelOptions.includes(normalizedPreferred)) {
      return normalizedPreferred;
    }
    if (privacyLevelOptions.includes('SELF_ONLY')) {
      return 'SELF_ONLY';
    }
    if (privacyLevelOptions.length > 0) {
      return privacyLevelOptions[0];
    }
    return 'PUBLIC_TO_EVERYONE';
  }

  private async fetchTikTokPublishStatus(accessToken: string, publishId: string): Promise<any> {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(resolveTikTokErrorMessage(data) || 'Failed to fetch TikTok publish status');
    }
    return data;
  }

  private extractTikTokPublicPostId(statusPayload: any): string | undefined {
    const raw = statusPayload?.data?.publicaly_available_post_id;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    if (Array.isArray(raw)) {
      const first = raw.find((value: unknown) => typeof value === 'string' && value.trim().length > 0);
      if (typeof first === 'string') return first.trim();
    }
    return undefined;
  }

  private buildTikTokPostUrl(publicPostId: string): string {
    return `https://www.tiktok.com/video/${encodeURIComponent(publicPostId)}`;
  }

  private async resolveTikTokPublishResult(
    accessToken: string,
    publishId: string,
  ): Promise<PlatformPostResult> {
    const maxAttempts = this.publishStatusPollAttempts;
    const delayMs = this.publishStatusPollDelayMs;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const statusData = await this.fetchTikTokPublishStatus(accessToken, publishId);
      const status = typeof statusData?.data?.status === 'string'
        ? statusData.data.status.trim().toUpperCase()
        : '';
      const failReason = typeof statusData?.data?.fail_reason === 'string'
        ? statusData.data.fail_reason.trim()
        : '';
      const publicPostId = this.extractTikTokPublicPostId(statusData);

      if (publicPostId) {
        return {
          platformPostId: publishId,
          url: this.buildTikTokPostUrl(publicPostId),
        };
      }
      if (status.includes('FAIL') || failReason) {
        throw new Error(`TikTok publish failed (${failReason || status || 'unknown_reason'})`);
      }
      if (status === 'PUBLISH_COMPLETE' || status === 'SUCCESS' || status === 'PUBLISHED') {
        return { platformPostId: publishId };
      }

      if (attempt < maxAttempts - 1) {
        await sleep(delayMs);
      }
    }

    return { platformPostId: publishId };
  }

  private async initTikTokVideoUploadFromUrl(accessToken: string, mediaUrl: string): Promise<PlatformPostResult> {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: mediaUrl,
        },
      }),
    });
    const data = await readJson(res);
    const publishId = data.data?.publish_id || data.publish_id;
    if (!res.ok || !publishId) {
      throw new Error(resolveTikTokErrorMessage(data) || 'Failed to initialize TikTok video upload');
    }
    return this.resolveTikTokPublishResult(accessToken, publishId.toString());
  }

  private async initTikTokPhotoPublish(
    accessToken: string,
    postInfo: Record<string, unknown>,
    photoImages: string[],
    photoCoverIndex: number,
    postMode: 'DIRECT_POST' | 'MEDIA_UPLOAD',
  ): Promise<PlatformPostResult> {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_info: postInfo,
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: photoCoverIndex,
          photo_images: photoImages,
        },
        post_mode: postMode,
        media_type: 'PHOTO',
      }),
    });
    const data = await readJson(res);
    const publishId = data.data?.publish_id || data.publish_id;
    if (!res.ok || !publishId) {
      throw new Error(resolveTikTokErrorMessage(data) || 'Failed to initialize TikTok photo publish');
    }
    return this.resolveTikTokPublishResult(accessToken, publishId.toString());
  }

  private resolveTikTokPublishMediaUrls(mediaUrls: string[]): string[] {
    if (!this.mediaProxyEnabled || !this.mediaProxyBaseUrl) {
      return mediaUrls;
    }

    const expiresAt = Math.floor(Date.now() / 1000) + this.mediaProxyTtlSeconds;
    return mediaUrls.map((mediaUrl) => {
      const normalized = mediaUrl.trim();
      if (!/^https?:\/\//i.test(normalized)) return normalized;

      const signature = buildTikTokMediaProxySignature(normalized, expiresAt, this.mediaProxySecret);
      const params = new URLSearchParams({
        url: normalized,
        expires: expiresAt.toString(),
        sig: signature,
      });
      return `${this.mediaProxyBaseUrl}/api/v1/posts/media/tiktok-proxy?${params.toString()}`;
    });
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const mediaUrls = (post.mediaUrls || [])
      .map((url) => (typeof url === 'string' ? url.trim() : ''))
      .filter(Boolean);
    if (mediaUrls.length === 0) {
      throw new Error('TikTok publishing requires media attachments. Text-only posts are not supported.');
    }

    const hasVideoMedia = mediaUrls.some((url) => isVideoMediaUrl(url));
    const hasImageMedia = mediaUrls.some((url) => !isVideoMediaUrl(url));
    if (hasVideoMedia && hasImageMedia) {
      throw new Error('TikTok publishing does not support mixed photo and video attachments in one post.');
    }
    const publishMediaUrls = this.resolveTikTokPublishMediaUrls(mediaUrls);

    const metadata = post.metadata as {
      privacyLevel?: string;
      disableComment?: boolean;
      disableDuet?: boolean;
      disableStitch?: boolean;
      postMode?: string;
      photoCoverIndex?: number;
      autoAddMusic?: boolean;
      brandContentToggle?: boolean;
      brandOrganicToggle?: boolean;
    } | undefined;
    const postText = buildPostText(post);
    const normalizedPostMode = metadata?.postMode?.toUpperCase() === 'MEDIA_UPLOAD'
      ? 'MEDIA_UPLOAD'
      : 'DIRECT_POST';
    if (normalizedPostMode === 'MEDIA_UPLOAD' && !this.mediaUploadFallbackEnabled) {
      throw new Error(
        'TikTok MEDIA_UPLOAD is disabled for this workspace. Browser-only publishing uses DIRECT_POST.',
      );
    }
    const shouldUseVideoFlow = post.mediaType === 'video'
      || (post.mediaType !== 'image' && post.mediaType !== 'carousel' && hasVideoMedia);

    if (shouldUseVideoFlow) {
      if (mediaUrls.length > 1) {
        throw new Error('TikTok video publishing supports a single video attachment.');
      }
      const mediaUrl = mediaUrls[0];
      const publishMediaUrl = publishMediaUrls[0];
      if (!isVideoPost(post, mediaUrl)) {
        throw new Error('TikTok video publishing requires video media.');
      }

      if (normalizedPostMode === 'MEDIA_UPLOAD') {
        return this.initTikTokVideoUploadFromUrl(accessToken, publishMediaUrl);
      }

      try {
        const creatorInfo = await this.queryCreatorInfo(accessToken);
        const resolvedPrivacyLevel = this.resolveTikTokPrivacyLevel(
          metadata?.privacyLevel,
          creatorInfo.privacyLevelOptions,
        );
        const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_info: {
              title: postText.slice(0, 2200),
              privacy_level: resolvedPrivacyLevel,
              disable_comment: creatorInfo.canToggleComments ? Boolean(metadata?.disableComment) : false,
              disable_duet: creatorInfo.canToggleDuet ? Boolean(metadata?.disableDuet) : false,
              disable_stitch: creatorInfo.canToggleStitch ? Boolean(metadata?.disableStitch) : false,
            },
            source_info: {
              source: 'PULL_FROM_URL',
              video_url: publishMediaUrl,
            },
          }),
        });
        const data = await readJson(res);
        const publishId = data.data?.publish_id || data.publish_id;
        if (!res.ok || !publishId) {
          throw new Error(resolveTikTokErrorMessage(data) || 'Failed to initialize TikTok direct video publish');
        }
        return this.resolveTikTokPublishResult(accessToken, publishId.toString());
      } catch (directError: any) {
        if (!this.mediaUploadFallbackEnabled) {
          const directMessage = directError?.message || String(directError);
          throw new Error(
            `TikTok direct post failed (${directMessage}). MEDIA_UPLOAD fallback is disabled because this workspace is configured for browser-only publishing.`,
          );
        }
        try {
          return await this.initTikTokVideoUploadFromUrl(accessToken, publishMediaUrl);
        } catch (uploadError: any) {
          const directMessage = directError?.message || String(directError);
          const uploadMessage = uploadError?.message || String(uploadError);
          throw new Error(`TikTok direct post failed (${directMessage}); upload fallback failed (${uploadMessage})`);
        }
      }
    }

    if (mediaUrls.some((url) => isVideoMediaUrl(url))) {
      throw new Error('TikTok photo publishing requires image media URLs.');
    }
    const photoImages = publishMediaUrls.slice(0, 35);
    const requestedCoverIndex = Number(metadata?.photoCoverIndex ?? 0);
    const normalizedCoverIndex = Number.isInteger(requestedCoverIndex)
      ? Math.min(Math.max(requestedCoverIndex, 0), photoImages.length - 1)
      : 0;
    const postInfoBase: Record<string, unknown> = {};
    if (postText) {
      postInfoBase.title = postText.slice(0, 90);
      postInfoBase.description = postText.slice(0, 4000);
    }

    if (normalizedPostMode === 'MEDIA_UPLOAD') {
      return this.initTikTokPhotoPublish(
        accessToken,
        postInfoBase,
        photoImages,
        normalizedCoverIndex,
        'MEDIA_UPLOAD',
      );
    }

    try {
      const creatorInfo = await this.queryCreatorInfo(accessToken);
      const directPostInfo: Record<string, unknown> = {
        ...postInfoBase,
        privacy_level: this.resolveTikTokPrivacyLevel(
          metadata?.privacyLevel,
          creatorInfo.privacyLevelOptions,
        ),
        disable_comment: creatorInfo.canToggleComments ? Boolean(metadata?.disableComment) : false,
        auto_add_music: Boolean(metadata?.autoAddMusic),
      };
      if (typeof metadata?.brandContentToggle === 'boolean') {
        directPostInfo.brand_content_toggle = metadata.brandContentToggle;
      }
      if (typeof metadata?.brandOrganicToggle === 'boolean') {
        directPostInfo.brand_organic_toggle = metadata.brandOrganicToggle;
      }

      return await this.initTikTokPhotoPublish(
        accessToken,
        directPostInfo,
        photoImages,
        normalizedCoverIndex,
        'DIRECT_POST',
      );
    } catch (directError: any) {
      if (!this.mediaUploadFallbackEnabled) {
        const directMessage = directError?.message || String(directError);
        throw new Error(
          `TikTok direct photo post failed (${directMessage}). MEDIA_UPLOAD fallback is disabled because this workspace is configured for browser-only publishing.`,
        );
      }
      try {
        return await this.initTikTokPhotoPublish(
          accessToken,
          postInfoBase,
          photoImages,
          normalizedCoverIndex,
          'MEDIA_UPLOAD',
        );
      } catch (uploadError: any) {
        const directMessage = directError?.message || String(directError);
        const uploadMessage = uploadError?.message || String(uploadError);
        throw new Error(`TikTok direct photo post failed (${directMessage}); upload fallback failed (${uploadMessage})`);
      }
    }
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: platformPostId }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(resolveTikTokErrorMessage(data) || 'Failed to fetch TikTok analytics');
    }

    const metrics = data?.data?.public_metrics || data?.data?.metrics || {};
    const impressions = toNumber(metrics.view_count ?? metrics.impression_count);

    return {
      impressions,
      reach: impressions,
      likes: toNumber(metrics.like_count),
      comments: toNumber(metrics.comment_count),
      shares: toNumber(metrics.share_count),
      clicks: 0,
      saves: toNumber(metrics.save_count),
      metadata: data,
    };
  }
}

// ============================================================
// YouTube — Data API v3
// ============================================================

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'youtube';
  private clientId = getEnvValue('YOUTUBE_CLIENT_ID', 'GOOGLE_CLIENT_ID');
  private clientSecret = getEnvValue('YOUTUBE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET');
  private redirectUri = getEnvValue('YOUTUBE_REDIRECT_URI', 'YOUTUBE_CALLBACK_URL', 'GOOGLE_CALLBACK_URL') || 'http://localhost:4016/api/v1/connections/youtube/callback';

  getAuthUrl(state: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'openid',
      'profile',
      'email',
    ].join(' ');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      state,
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to exchange YouTube authorization code');
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + toNumber(data.expires_in) * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await readJson(res);
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to refresh YouTube access token');
    }
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + toNumber(data.expires_in) * 1000) : undefined,
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await readJson(res);
    const channelLookupError = !res.ok
      ? (resolveErrorMessage(data) || `Failed to fetch YouTube account profile (HTTP ${res.status})`)
      : '';

    const channel = res.ok ? data?.items?.find((item: any) => typeof item?.id === 'string' && item.id.trim().length > 0) : undefined;
    if (channel?.id) {
      return {
        id: channel.id.trim(),
        name: channel?.snippet?.title || channel.id.trim(),
        avatar: channel?.snippet?.thumbnails?.default?.url,
      };
    }

    if (channelLookupError && isYouTubeDataApiDisabledMessage(channelLookupError)) {
      throw new Error(`Failed to fetch YouTube account profile: ${channelLookupError}`);
    }

    // Fallback for Google accounts without an initialized YouTube channel.
    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userInfo = await readJson(userInfoRes);
    if (userInfoRes.ok) {
      const subject = typeof userInfo?.sub === 'string'
        ? userInfo.sub.trim()
        : typeof userInfo?.id === 'string'
          ? userInfo.id.trim()
          : '';
      if (subject) {
        const name = typeof userInfo?.name === 'string' && userInfo.name.trim().length > 0
          ? userInfo.name.trim()
          : typeof userInfo?.email === 'string' && userInfo.email.trim().length > 0
            ? userInfo.email.trim()
            : 'YouTube Account';
        return {
          id: `google:${subject}`,
          name,
          avatar: typeof userInfo?.picture === 'string' ? userInfo.picture : undefined,
        };
      }
    }

    if (channelLookupError) {
      throw new Error(`Failed to fetch YouTube account profile: ${channelLookupError}`);
    }

    throw new Error('No YouTube channel found for this Google account. Open YouTube once to create a channel, then reconnect.');
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const mediaUrl = requirePrimaryMediaUrl(post, 'YouTube');
    if (!isVideoPost(post, mediaUrl)) {
      throw new Error('YouTube publishing requires video media');
    }

    const metadata = post.metadata as { title?: string; privacyStatus?: string } | undefined;
    const defaultTitle = buildPostText(post).split('\n')[0] || 'New video';
    const title = (metadata?.title || defaultTitle).slice(0, 100);
    const privacyStatus = metadata?.privacyStatus === 'private' || metadata?.privacyStatus === 'unlisted'
      ? metadata.privacyStatus
      : 'public';
    const description = buildPostText(post).slice(0, 5000);

    const startRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': inferVideoContentType(mediaUrl),
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
          },
          status: {
            privacyStatus,
          },
        }),
      },
    );
    const uploadUrl = startRes.headers.get('location');
    const startData = await readJson(startRes);
    if (!startRes.ok || !uploadUrl) {
      throw new Error(resolveErrorMessage(startData) || 'Failed to initialize YouTube upload');
    }

    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) {
      throw new Error(`Unable to fetch media for YouTube upload (${mediaRes.status})`);
    }
    const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());
    const contentType = mediaRes.headers.get('content-type') || inferVideoContentType(mediaUrl);

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': mediaBuffer.byteLength.toString(),
      },
      body: mediaBuffer,
    });
    const uploadData = await readJson(uploadRes);
    if (!uploadRes.ok || !uploadData.id) {
      throw new Error(resolveErrorMessage(uploadData) || 'Failed to upload YouTube video');
    }

    const videoId = uploadData.id.toString();
    return {
      platformPostId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(platformPostId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const data = await readJson(res);
    if (!res.ok || !Array.isArray(data?.items) || data.items.length === 0) {
      throw new Error(resolveErrorMessage(data) || 'Failed to fetch YouTube analytics');
    }

    const stats = data.items[0]?.statistics || {};
    const impressions = toNumber(stats.viewCount);
    return {
      impressions,
      reach: impressions,
      likes: toNumber(stats.likeCount),
      comments: toNumber(stats.commentCount),
      shares: 0,
      clicks: 0,
      saves: toNumber(stats.favoriteCount),
      metadata: data,
    };
  }
}

// ============================================================
// Pinterest — API v5
// ============================================================

export class PinterestAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'pinterest';
  private clientId = getEnvValue('PINTEREST_CLIENT_ID', 'PINTEREST_APP_ID');
  private clientSecret = getEnvValue('PINTEREST_CLIENT_SECRET', 'PINTEREST_APP_SECRET');
  private redirectUri = getEnvValue('PINTEREST_REDIRECT_URI', 'PINTEREST_CALLBACK_URL') || 'http://localhost:4016/api/v1/connections/pinterest/callback';
  private apiBaseUrl = (getEnvValue('PINTEREST_API_BASE_URL') || 'https://api.pinterest.com').replace(/\/+$/, '');
  private sandboxApiBaseUrl = 'https://api-sandbox.pinterest.com';

  private isPinterestTrialAccessError(data: any): boolean {
    const message = (resolveErrorMessage(data) || '').toLowerCase();
    return message.includes('trial access') && message.includes('api-sandbox.pinterest.com');
  }

  private async pinterestApiFetch(path: string, init: RequestInit): Promise<{ res: Response; data: any }> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const baseUrl = this.apiBaseUrl;
    const primaryUrl = `${baseUrl}${normalizedPath}`;
    const primaryRes = await fetch(primaryUrl, init);
    const primaryData = await readJson(primaryRes);

    if (
      !primaryRes.ok
      && baseUrl === 'https://api.pinterest.com'
      && this.isPinterestTrialAccessError(primaryData)
    ) {
      const sandboxUrl = `${this.sandboxApiBaseUrl}${normalizedPath}`;
      const sandboxRes = await fetch(sandboxUrl, init);
      const sandboxData = await readJson(sandboxRes);
      return { res: sandboxRes, data: sandboxData };
    }

    return { res: primaryRes, data: primaryData };
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'user_accounts:read,boards:read,boards:write,pins:read,pins:write',
      state,
    });
    return `https://www.pinterest.com/oauth/?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });
    const { res, data } = await this.pinterestApiFetch('/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: body.toString(),
    });
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to exchange Pinterest authorization code');
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + toNumber(data.expires_in) * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const { res, data } = await this.pinterestApiFetch('/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: body.toString(),
    });
    if (!res.ok || !data?.access_token) {
      throw new Error(resolveErrorMessage(data) || 'Failed to refresh Pinterest access token');
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + toNumber(data.expires_in) * 1000) : undefined,
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const { res, data } = await this.pinterestApiFetch('/v5/user_account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = (data && typeof data === 'object' && !Array.isArray(data) && data.data && typeof data.data === 'object')
      ? data.data
      : data;

    if (!res.ok) {
      throw new Error(resolveErrorMessage(payload) || resolveErrorMessage(data) || `Failed to fetch Pinterest account profile (HTTP ${res.status})`);
    }

    const rawId = payload?.id
      ?? payload?.account_id
      ?? payload?.user_id
      ?? payload?.username;
    const rawName = payload?.username
      ?? payload?.name
      ?? payload?.full_name
      ?? rawId;
    const rawAvatar = payload?.profile_image
      ?? payload?.image_medium_url
      ?? payload?.image_small_url
      ?? undefined;

    const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : '';
    const name = typeof rawName === 'string' || typeof rawName === 'number' ? String(rawName).trim() : '';
    const avatar = typeof rawAvatar === 'string' ? rawAvatar : undefined;

    if (!id) {
      throw new Error('Could not verify Pinterest account profile (missing id)');
    }

    return { id, name: name || `Pinterest ${id}`, avatar };
  }

  private async resolveBoardId(accessToken: string, post: PlatformPostPayload): Promise<string> {
    const metadata = post.metadata as { boardId?: string; board_id?: string } | undefined;
    const explicitBoardId = metadata?.boardId || metadata?.board_id;
    if (explicitBoardId) {
      return explicitBoardId;
    }

    const { res: boardsRes, data: boardsData } = await this.pinterestApiFetch('/v5/boards?page_size=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const firstBoardId = boardsData?.items?.[0]?.id || boardsData?.data?.[0]?.id;
    if (boardsRes.ok && firstBoardId) {
      return firstBoardId.toString();
    }

    // First-time Pinterest accounts can have zero boards. Create a default board automatically.
    if (boardsRes.ok && !firstBoardId) {
      const { res: createBoardRes, data: createBoardData } = await this.pinterestApiFetch('/v5/boards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'EE PostMind',
          description: 'Auto-created by EE PostMind for publishing.',
        }),
      });
      const createdBoardId = createBoardData?.id || createBoardData?.data?.id;
      if (createBoardRes.ok && createdBoardId) {
        return createdBoardId.toString();
      }
      throw new Error(
        resolveErrorMessage(createBoardData)
          || 'Pinterest publish requires a destination board. Create a board in Pinterest and reconnect, or pass board_id in platform metadata.',
      );
    }

    throw new Error(resolveErrorMessage(boardsData) || 'Pinterest publish requires a destination board');
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const boardId = await this.resolveBoardId(accessToken, post);
    const mediaUrl = requirePrimaryMediaUrl(post, 'Pinterest');
    const mediaSource = isVideoPost(post, mediaUrl)
      ? { source_type: 'video_url', url: mediaUrl }
      : { source_type: 'image_url', url: mediaUrl };
    const metadata = post.metadata as { altText?: string; alt_text?: string } | undefined;
    const text = buildPostText(post);
    const title = (text || 'New pin').slice(0, 100);
    const description = text.slice(0, 500);
    const link = typeof post.link === 'string' ? post.link.trim() : '';

    const { res, data } = await this.pinterestApiFetch('/v5/pins', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: boardId,
        title,
        description,
        link: link || undefined,
        media_source: mediaSource,
        alt_text: metadata?.altText || metadata?.alt_text || undefined,
      }),
    });
    if (!res.ok || !data?.id) {
      throw new Error(resolveErrorMessage(data) || 'Failed to publish Pinterest pin');
    }

    return { platformPostId: data.id.toString(), url: data.url || data.link };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      metric_types: 'IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE',
    });

    const { res, data } = await this.pinterestApiFetch(
      `/v5/pins/${encodeURIComponent(platformPostId)}/analytics?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      throw new Error(resolveErrorMessage(data) || 'Failed to fetch Pinterest analytics');
    }

    const impressions = getPinterestMetric(data, 'IMPRESSION');
    const pinClicks = getPinterestMetric(data, 'PIN_CLICK');
    const outboundClicks = getPinterestMetric(data, 'OUTBOUND_CLICK');
    const saves = getPinterestMetric(data, 'SAVE');

    return {
      impressions,
      reach: impressions,
      likes: 0,
      comments: 0,
      shares: saves,
      clicks: pinClicks + outboundClicks,
      saves,
      metadata: data,
    };
  }
}
