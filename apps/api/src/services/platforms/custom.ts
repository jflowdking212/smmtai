import type { PlatformType } from '@ee-postmind/shared';
import { createHmac } from 'crypto';
import type {
  PlatformAdapter,
  PlatformTokens,
  PlatformAccount,
  PlatformPostPayload,
  PlatformPostResult,
  PlatformAnalytics,
} from './base.js';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function readMetricValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!isRecord(value)) return null;

  const nestedCandidates = [value.count, value.total, value.value];
  for (const candidate of nestedCandidates) {
    const parsed = readMetricValue(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

function pickMetric(record: JsonRecord, keys: string[]): number {
  for (const key of keys) {
    const parsed = readMetricValue(record[key]);
    if (parsed !== null) return parsed;
  }
  return 0;
}

function normalizeRecordId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  return null;
}

function normalizeUserId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  return undefined;
}

function normalizeMetadataString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  return '';
}

function findPostRecord(payload: unknown, platformPostId: string): JsonRecord | null {
  if (!isRecord(payload)) return null;

  const candidates: JsonRecord[] = [payload];
  if (isRecord(payload.post)) candidates.push(payload.post);
  if (isRecord(payload.post_data)) candidates.push(payload.post_data);
  if (Array.isArray(payload.post_data)) {
    payload.post_data.forEach((item) => {
      if (isRecord(item)) candidates.push(item);
    });
  }
  if (isRecord(payload.data)) candidates.push(payload.data);
  if (Array.isArray(payload.data)) {
    payload.data.forEach((item) => {
      if (isRecord(item)) candidates.push(item);
    });
  }
  if (Array.isArray(payload.posts)) {
    payload.posts.forEach((item) => {
      if (isRecord(item)) candidates.push(item);
    });
  }
  if (isRecord(payload.result)) candidates.push(payload.result);
  if (Array.isArray(payload.result)) {
    payload.result.forEach((item) => {
      if (isRecord(item)) candidates.push(item);
    });
  }

  const match = candidates.find((candidate) => {
    const id = normalizeRecordId(candidate.post_id) || normalizeRecordId(candidate.id);
    return id === platformPostId;
  });
  if (match) return match;

  return candidates[0] || null;
}

function mapAnalyticsFromPostRecord(postRecord: JsonRecord): PlatformAnalytics {
  const impressions = pickMetric(postRecord, ['impressions', 'views', 'view_count', 'post_views', 'reach']);
  const explicitReach = pickMetric(postRecord, ['reach']);

  return {
    impressions,
    reach: explicitReach || impressions,
    likes: pickMetric(postRecord, ['likes', 'likes_count', 'like_count', 'post_likes', 'reaction_count']),
    comments: pickMetric(postRecord, ['comments', 'comments_count', 'comment_count', 'post_comments']),
    shares: pickMetric(postRecord, ['shares', 'shares_count', 'share_count', 'post_shares', 'reposts']),
    clicks: pickMetric(postRecord, ['clicks', 'link_clicks', 'click_count']),
    saves: pickMetric(postRecord, ['saves', 'save_count']),
  };
}

function normalizeHashtag(value: string): string {
  const trimmed = value.trim().replace(/^#+/, '').replace(/\s+/g, '');
  return trimmed ? `#${trimmed}` : '';
}

function buildPostText(post: PlatformPostPayload): string {
  const baseText = (post.text || '').trim();
  const hashtags = (post.hashtags || [])
    .map((tag) => normalizeHashtag(tag))
    .filter((tag) => tag.length > 0);
  const uniqueHashtags = hashtags.filter((tag, index) => hashtags.indexOf(tag) === index);
  const missingHashtags = uniqueHashtags.filter(
    (tag) => !baseText.toLowerCase().includes(tag.toLowerCase()),
  );

  const link = typeof post.link === 'string' ? post.link.trim() : '';
  const parts = [baseText];
  if (missingHashtags.length > 0) {
    parts.push(missingHashtags.join(' '));
  }
  if (link && !baseText.includes(link)) {
    parts.push(link);
  }

  return parts.filter((part) => part.length > 0).join('\n').trim();
}

function inferMediaKind(post: PlatformPostPayload, mediaUrl: string): 'image' | 'video' {
  if (post.mediaType === 'video') return 'video';
  if (post.mediaType === 'image') return 'image';
  return /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv)$/i.test(mediaUrl) ? 'video' : 'image';
}

function inferUploadFileName(mediaUrl: string, mediaKind: 'image' | 'video', contentType: string): string {
  let candidate = '';
  try {
    const parsed = new URL(mediaUrl);
    candidate = decodeURIComponent(parsed.pathname.split('/').pop() || '');
  } catch {
    candidate = '';
  }

  const cleaned = candidate.trim();
  if (cleaned && /\.[A-Za-z0-9]{2,8}$/.test(cleaned)) {
    return cleaned;
  }

  const extensionByType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  const extension = extensionByType[contentType.toLowerCase()] || (mediaKind === 'video' ? 'mp4' : 'jpg');
  return `${mediaKind}-upload.${extension}`;
}

function extractPublishedPostUrl(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  if (typeof payload.url === 'string' && payload.url.trim()) {
    return payload.url.trim();
  }

  if (isRecord(payload.data) && typeof payload.data.url === 'string' && payload.data.url.trim()) {
    return payload.data.url.trim();
  }

  if (isRecord(payload.post) && typeof payload.post.url === 'string' && payload.post.url.trim()) {
    return payload.post.url.trim();
  }

  if (isRecord(payload.post_data) && typeof payload.post_data.url === 'string' && payload.post_data.url.trim()) {
    return payload.post_data.url.trim();
  }

  return undefined;
}

async function parseJsonResponseSafe(response: Response): Promise<{
  data: unknown;
  isJson: boolean;
  rawText: string;
}> {
  const rawText = await response.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      data: {},
      isJson: false,
      rawText,
    };
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const looksLikeJson = contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!looksLikeJson) {
    return {
      data: {},
      isJson: false,
      rawText,
    };
  }

  try {
    return {
      data: JSON.parse(trimmed),
      isJson: true,
      rawText,
    };
  } catch {
    return {
      data: {},
      isJson: false,
      rawText,
    };
  }
}

// ============================================================
// Base adapter for WoWonder-based platforms
// ============================================================

class WoWonderAdapter implements PlatformAdapter {
  readonly platform: PlatformType;
  private baseUrl: string;

  constructor(platform: PlatformType, baseUrl: string) {
    this.platform = platform;
    this.baseUrl = baseUrl;
  }

  getAuthUrl(_state: string): string {
    return `/connections/${this.platform}/setup`;
  }

  private getCredentialFormatMessage(): string {
    return `Provide ${this.platform} credentials as JSON: {"accessToken":"token","serverKey":"server-key"} or {"username":"user","password":"pass","serverKey":"server-key"}`;
  }

  private parseCredentials(value: string): {
    accessToken?: string;
    username?: string;
    password?: string;
    userId?: string;
    serverKey: string;
  } {
    const input = value.trim();
    if (!input) {
      throw new Error(this.getCredentialFormatMessage());
    }
    if (!input.startsWith('{')) {
      throw new Error(this.getCredentialFormatMessage());
    }

    try {
      const parsedValue = JSON.parse(input);
      if (!isRecord(parsedValue)) {
        throw new Error();
      }
      const accessToken = typeof parsedValue.accessToken === 'string'
        ? parsedValue.accessToken.trim()
        : typeof parsedValue.token === 'string'
          ? parsedValue.token.trim()
          : '';
      const serverKey = typeof parsedValue.serverKey === 'string'
        ? parsedValue.serverKey.trim()
        : typeof parsedValue.server_key === 'string'
          ? parsedValue.server_key.trim()
          : '';
      const envServerKey = this.platform === 'entreprenrs'
        ? (process.env.ENTREPRENRS_SERVER_KEY || '').trim()
        : '';
      const envAccessToken = this.platform === 'entreprenrs'
        ? (process.env.ENTREPRENRS_ACCESS_TOKEN || '').trim()
        : '';
      const username = typeof parsedValue.username === 'string' ? parsedValue.username.trim() : '';
      const password = typeof parsedValue.password === 'string' ? parsedValue.password.trim() : '';
      const userId = normalizeUserId(parsedValue.userId) || normalizeUserId(parsedValue.user_id);
      const resolvedServerKey = serverKey || envServerKey;
      const resolvedAccessToken = accessToken || envAccessToken;
      if (!resolvedServerKey) {
        throw new Error();
      }
      if (resolvedAccessToken) {
        return {
          accessToken: resolvedAccessToken,
          serverKey: resolvedServerKey,
          ...(userId ? { userId } : {}),
        };
      }
      if (username && password) {
        return { username, password, serverKey: resolvedServerKey };
      }
      throw new Error();
    } catch {
      throw new Error(this.getCredentialFormatMessage());
    }
  }

  private async authenticateWithPassword(credentials: {
    username: string;
    password: string;
    serverKey: string;
  }): Promise<{ accessToken: string; serverKey: string; userId?: string }> {
    const authBody = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
      server_key: credentials.serverKey,
    });
    const authUrl = new URL(`${this.baseUrl}/api/auth`);
    authUrl.searchParams.set('server_key', credentials.serverKey);
    const res = await fetch(authUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: authBody.toString(),
    });
    const data = await res.json().catch(() => ({})) as {
      access_token?: string;
      user_id?: string | number;
      user_data?: { user_id?: string | number };
      errors?: { error_text?: string };
      message?: string;
    };
    const accessToken = typeof data.access_token === 'string' ? data.access_token.trim() : '';
    if (!res.ok || !accessToken) {
      throw new Error(data.errors?.error_text || data.message || `Could not authenticate ${this.platform} user`);
    }
    const userId = normalizeUserId(data.user_id) || normalizeUserId(data.user_data?.user_id);
    return {
      accessToken,
      serverKey: credentials.serverKey,
      ...(userId ? { userId } : {}),
    };
  }

  private async resolveSessionCredentials(credentials: {
    accessToken?: string;
    username?: string;
    password?: string;
    userId?: string;
    serverKey: string;
  }): Promise<{ accessToken: string; serverKey: string; userId?: string }> {
    if (credentials.accessToken) {
      return {
        accessToken: credentials.accessToken,
        serverKey: credentials.serverKey,
        ...(credentials.userId ? { userId: credentials.userId } : {}),
      };
    }
    if (credentials.username && credentials.password) {
      return this.authenticateWithPassword({
        username: credentials.username,
        password: credentials.password,
        serverKey: credentials.serverKey,
      });
    }
    throw new Error(this.getCredentialFormatMessage());
  }

  private async verifyCredentials(credentials: {
    accessToken: string;
    serverKey: string;
    userId?: string;
  }): Promise<{
    user_id: string | number;
    name?: string;
    avatar?: string;
  }> {
    const params = new URLSearchParams({
      access_token: credentials.accessToken,
      server_key: credentials.serverKey,
      fetch: 'user_data',
    });
    if (credentials.userId) {
      params.set('user_id', credentials.userId);
    }
    const verifyUrl = new URL(`${this.baseUrl}/api/get-user-data`);
    // Compatibility: include credentials in both query and body since deployments vary on GET/POST parsing.
    params.forEach((value, key) => verifyUrl.searchParams.set(key, value));
    const res = await fetch(verifyUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({})) as {
      user_data?: { user_id?: string | number; name?: string; avatar?: string };
      user_id?: string | number;
      errors?: { error_text?: string };
      message?: string;
    };
    const userId = normalizeUserId(data.user_data?.user_id) || normalizeUserId(data.user_id);
    if (!res.ok || userId === undefined || userId === null) {
      throw new Error(data.errors?.error_text || data.message || `Could not verify ${this.platform} credentials`);
    }
    return {
      user_id: userId,
      name: data.user_data?.name,
      avatar: data.user_data?.avatar,
    };
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(credentials);
    const sessionCredentials = await this.resolveSessionCredentials(parsed);
    const verified = await this.verifyCredentials(sessionCredentials);
    const userId = normalizeUserId(verified.user_id) || verified.user_id.toString();
    const tokenPayload = JSON.stringify({
      accessToken: sessionCredentials.accessToken,
      serverKey: sessionCredentials.serverKey,
      userId,
    });
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(token: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(token);
    const sessionCredentials = await this.resolveSessionCredentials(parsed);
    const verified = await this.verifyCredentials(sessionCredentials);
    const userId = normalizeUserId(verified.user_id) || verified.user_id.toString();
    const tokenPayload = JSON.stringify({
      accessToken: sessionCredentials.accessToken,
      serverKey: sessionCredentials.serverKey,
      userId,
    });
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const parsed = this.parseCredentials(accessToken);
    const creds = await this.resolveSessionCredentials(parsed);
    const data = await this.verifyCredentials(creds);

    return {
      id: data.user_id.toString(),
      name: data.name || this.platform,
      avatar: data.avatar,
    };
  }

  private async ensureUserId(credentials: {
    accessToken: string;
    serverKey: string;
    userId?: string;
  }): Promise<{ accessToken: string; serverKey: string; userId: string }> {
    const userId = normalizeUserId(credentials.userId);
    if (userId) {
      return {
        accessToken: credentials.accessToken,
        serverKey: credentials.serverKey,
        userId,
      };
    }

    const verified = await this.verifyCredentials(credentials);
    return {
      accessToken: credentials.accessToken,
      serverKey: credentials.serverKey,
      userId: normalizeUserId(verified.user_id) || verified.user_id.toString(),
    };
  }

  private extractApiError(data: unknown): string | null {
    if (!isRecord(data)) return null;
    if (isRecord(data.errors) && typeof data.errors.error_text === 'string' && data.errors.error_text.trim()) {
      return data.errors.error_text.trim();
    }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
    if (typeof data.api_text === 'string' && data.api_text.trim().toLowerCase() !== 'success') {
      return data.api_text.trim();
    }
    return null;
  }

  private isApiTypeNotFoundError(errorText: string | null): boolean {
    if (!errorText) return false;
    return /api\s*type\s*not\s*found/i.test(errorText);
  }

  private buildApiUrl(pathOrType: string, credentials: {
    accessToken: string;
    serverKey: string;
    userId: string;
  }): URL {
    const isTypeBased = pathOrType.startsWith('type:');
    const resolvedPath = isTypeBased ? '/api' : `/api/${pathOrType}`;
    const url = new URL(`${this.baseUrl}${resolvedPath}`);
    if (isTypeBased) {
      url.searchParams.set('type', pathOrType.slice('type:'.length));
    }
    url.searchParams.set('access_token', credentials.accessToken);
    url.searchParams.set('server_key', credentials.serverKey);
    url.searchParams.set('user_id', credentials.userId);
    return url;
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const parsed = this.parseCredentials(accessToken);
    const creds = await this.resolveSessionCredentials(parsed);
    const credsWithUserId = await this.ensureUserId(creds);

    const text = buildPostText(post);
    const link = typeof post.link === 'string' ? post.link.trim() : '';
    const mediaUrl = post.mediaUrls?.[0]?.trim();

    const metadata = isRecord(post.metadata) ? post.metadata : {};
    const destination = normalizeMetadataString(metadata.destination)
      || normalizeMetadataString(metadata.postOn)
      || normalizeMetadataString(metadata.post_on);
    const normalizedDestination = destination.toLowerCase();
    const pageId = normalizeMetadataString(metadata.pageId)
      || normalizeMetadataString(metadata.page_id)
      || normalizeMetadataString(metadata.entreprenrsPageId)
      || normalizeMetadataString(metadata.entreprenrs_page_id);
    const groupId = normalizeMetadataString(metadata.groupId)
      || normalizeMetadataString(metadata.group_id);

    const appendCommonFields = (target: URLSearchParams | FormData) => {
      target.append('access_token', credsWithUserId.accessToken);
      target.append('server_key', credsWithUserId.serverKey);
      target.append('user_id', credsWithUserId.userId);
      target.append('postText', text || post.text);
      if (link) {
        target.append('postLink', link);
      }
      if (normalizedDestination === 'page' || pageId) {
        target.append('post_on', 'page');
        if (pageId) target.append('page_id', pageId);
      } else if (normalizedDestination === 'group' || groupId) {
        target.append('post_on', 'group');
        if (groupId) target.append('group_id', groupId);
      }
    };

    let mediaUpload: { bytes: ArrayBuffer; contentType: string; fileName: string } | null = null;
    if (mediaUrl) {
      const mediaKind = inferMediaKind(post, mediaUrl);
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) {
        throw new Error(`Failed to download media for ${this.platform} post`);
      }
      const rawContentType = mediaRes.headers.get('content-type') || '';
      const normalizedContentType = rawContentType.split(';')[0]?.trim() || '';
      const fallbackType = mediaKind === 'video' ? 'video/mp4' : 'image/jpeg';
      const contentType = normalizedContentType || fallbackType;
      const bytes = await mediaRes.arrayBuffer();
      mediaUpload = {
        bytes,
        contentType,
        fileName: inferUploadFileName(mediaUrl, mediaKind, contentType),
      };
    }

    const endpointCandidates = ['create-post', 'create_post', 'type:create_post'];
    let lastError: string | null = null;

    for (let index = 0; index < endpointCandidates.length; index += 1) {
      const endpoint = endpointCandidates[index];
      const postUrl = this.buildApiUrl(endpoint, credsWithUserId);

      let body: URLSearchParams | FormData;
      let headers: Record<string, string> | undefined;
      if (mediaUpload) {
        const multipart = new FormData();
        appendCommonFields(multipart);
        multipart.append('postFile', new Blob([mediaUpload.bytes], { type: mediaUpload.contentType }), mediaUpload.fileName);
        body = multipart;
      } else {
        const params = new URLSearchParams();
        appendCommonFields(params);
        body = params;
        headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      }

      const res = await fetch(postUrl.toString(), {
        method: 'POST',
        ...(headers ? { headers } : {}),
        body,
      });
      const data = await res.json().catch(() => ({})) as { post_id?: string | number };
      const postId = normalizeRecordId(data.post_id);
      const publishedPostUrl = extractPublishedPostUrl(data);
      const apiError = this.extractApiError(data);

      if (res.ok && postId) {
        return {
          platformPostId: postId,
          ...(publishedPostUrl ? { url: publishedPostUrl } : {}),
        };
      }

      lastError = apiError || `Failed to publish ${this.platform} post`;
      const shouldTryFallback = this.isApiTypeNotFoundError(apiError) || res.status === 404;
      if (shouldTryFallback && index < endpointCandidates.length - 1) {
        continue;
      }
      throw new Error(lastError);
    }

    throw new Error(lastError || `Failed to publish ${this.platform} post`);
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const parsed = this.parseCredentials(accessToken);
    const creds = await this.resolveSessionCredentials(parsed);
    const credsWithUserId = await this.ensureUserId(creds);

    const analyticsParams = new URLSearchParams({
      access_token: credsWithUserId.accessToken,
      server_key: credsWithUserId.serverKey,
      user_id: credsWithUserId.userId,
      post_id: platformPostId,
      fetch: 'post_data',
    });
    const requestBody = analyticsParams.toString();
    const endpointCandidates = [
      'get-post-data',
      'get_post_data',
      'type:get_post_data',
      'type:get-post-data',
      // Backward compatibility for deployments that still expose these aliases.
      'get-posts',
      'get_posts',
      'type:get_posts',
      'type:get-posts',
    ];
    let lastError: string | null = null;

    for (let index = 0; index < endpointCandidates.length; index += 1) {
      const endpoint = endpointCandidates[index];
      const analyticsUrl = this.buildApiUrl(endpoint, credsWithUserId);
      analyticsUrl.searchParams.set('post_id', platformPostId);
      analyticsUrl.searchParams.set('fetch', 'post_data');
      const res = await fetch(analyticsUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: requestBody,
      });
      const data = await res.json().catch(() => ({}));
      const apiError = this.extractApiError(data);
      if (!res.ok || apiError) {
        lastError = apiError || `Failed to fetch ${this.platform} analytics`;
        const shouldTryFallback = this.isApiTypeNotFoundError(apiError) || res.status === 404;
        if (shouldTryFallback && index < endpointCandidates.length - 1) {
          continue;
        }
        throw new Error(lastError);
      }

      const postRecord = findPostRecord(data, platformPostId);
      if (!postRecord) {
        lastError = `Could not resolve ${this.platform} analytics for post ${platformPostId}`;
        continue;
      }

      return mapAnalyticsFromPostRecord(postRecord);
    }

    throw new Error(lastError || `Failed to fetch ${this.platform} analytics`);
  }
}

// ============================================================
// Base adapter for Sngine-based platforms
// ============================================================

class SngineAdapter implements PlatformAdapter {
  readonly platform: PlatformType;
  private baseUrl: string;

  constructor(platform: PlatformType, baseUrl: string) {
    this.platform = platform;
    this.baseUrl = baseUrl;
  }

  getAuthUrl(_state: string): string {
    return `/connections/${this.platform}/setup`;
  }

  async exchangeCode(token: string): Promise<PlatformTokens> {
    return { accessToken: token };
  }

  async refreshAccessToken(token: string): Promise<PlatformTokens> {
    return { accessToken: token };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch(`${this.baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as {
      id?: string | number;
      name?: string;
      username?: string;
      avatar?: string;
      message?: string;
    };
    if (!res.ok || !data.id) {
      throw new Error(data.message || `Could not verify ${this.platform} credentials`);
    }

    return {
      id: data.id.toString(),
      name: data.name || this.platform,
      username: data.username,
      avatar: data.avatar,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const mediaUrl = post.mediaUrls?.[0]?.trim();
    const link = typeof post.link === 'string' ? post.link.trim() : '';
    const payload: Record<string, unknown> = { text: buildPostText(post) || post.text };
    if (mediaUrl) {
      payload.mediaUrl = mediaUrl;
      payload.mediaType = inferMediaKind(post, mediaUrl);
    }
    if (link) {
      payload.link = link;
    }

    const res = await fetch(`${this.baseUrl}/api/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { id?: string | number; message?: string };
    if (!res.ok || !data.id) {
      throw new Error(data.message || `Failed to publish ${this.platform} post`);
    }

    const publishedPostUrl = extractPublishedPostUrl(data);
    return {
      platformPostId: data.id.toString(),
      ...(publishedPostUrl ? { url: publishedPostUrl } : {}),
    };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const res = await fetch(`${this.baseUrl}/api/posts/${encodeURIComponent(platformPostId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as { message?: string; error?: string };
    if (!res.ok) {
      throw new Error(data.message || data.error || `Failed to fetch ${this.platform} analytics`);
    }

    const postRecord = findPostRecord(data, platformPostId);
    if (!postRecord) {
      throw new Error(`Could not resolve ${this.platform} analytics for post ${platformPostId}`);
    }

    return mapAnalyticsFromPostRecord(postRecord);
  }
}

// ============================================================
// Concrete instances
// ============================================================

export class EntreprenrsAdapter extends WoWonderAdapter {
  constructor() {
    super('entreprenrs', 'https://entreprenrs.com');
  }
}

export class ChrxstiansAdapter extends SngineAdapter {
  constructor() {
    super('chrxstians', (process.env.CHRXSTIANS_BASE_URL || 'https://chrxstians.com').trim() || 'https://chrxstians.com');
  }

  private getCredentialFormatMessage(): string {
    return 'Provide chrxstians credentials as JSON: {"accessToken":"token"} or {"accessToken":"token","apiKey":"key","apiSecret":"secret"} or {"apiKey":"key","apiSecret":"secret","usernameEmail":"email-or-username","password":"password"}';
  }

  private parseCredentials(value: string): {
    accessToken?: string;
    apiKey?: string;
    apiSecret?: string;
    usernameEmail?: string;
    password?: string;
    apiPath: string;
    apiStack: string;
    accountId?: string;
    accountName?: string;
    avatar?: string;
  } {
    const input = value.trim();
    if (!input || !input.startsWith('{')) {
      throw new Error(this.getCredentialFormatMessage());
    }

    try {
      const parsedValue = JSON.parse(input);
      if (!isRecord(parsedValue)) {
        throw new Error();
      }
      const accessToken = typeof parsedValue.accessToken === 'string'
        ? parsedValue.accessToken.trim()
        : typeof parsedValue.token === 'string'
          ? parsedValue.token.trim()
          : '';

      const apiKey = (
        typeof parsedValue.apiKey === 'string'
          ? parsedValue.apiKey
          : typeof parsedValue.api_key === 'string'
            ? parsedValue.api_key
            : typeof parsedValue.client_id === 'string'
              ? parsedValue.client_id
              : ''
      ).trim() || (process.env.CHRXSTIANS_API_KEY || '').trim();
      const apiSecret = (
        typeof parsedValue.apiSecret === 'string'
          ? parsedValue.apiSecret
          : typeof parsedValue.api_secret === 'string'
            ? parsedValue.api_secret
            : typeof parsedValue.serverKey === 'string'
              ? parsedValue.serverKey
              : typeof parsedValue.server_key === 'string'
                ? parsedValue.server_key
                : typeof parsedValue.client_secret === 'string'
                  ? parsedValue.client_secret
                  : ''
      ).trim() || (process.env.CHRXSTIANS_API_SECRET || '').trim();

      const usernameEmail = (
        typeof parsedValue.usernameEmail === 'string'
          ? parsedValue.usernameEmail
          : typeof parsedValue.username_email === 'string'
            ? parsedValue.username_email
            : typeof parsedValue.email === 'string'
              ? parsedValue.email
              : typeof parsedValue.username === 'string'
                ? parsedValue.username
                : ''
      ).trim();
      const password = typeof parsedValue.password === 'string' ? parsedValue.password.trim() : '';
      const accountId = normalizeUserId(parsedValue.accountId)
        || normalizeUserId(parsedValue.account_id)
        || normalizeUserId(parsedValue.userId)
        || normalizeUserId(parsedValue.user_id);
      const accountName = normalizeMetadataString(parsedValue.accountName)
        || normalizeMetadataString(parsedValue.account_name)
        || normalizeMetadataString(parsedValue.name);
      const avatar = normalizeMetadataString(parsedValue.avatar)
        || normalizeMetadataString(parsedValue.user_picture)
        || normalizeMetadataString(parsedValue.user_picture_full);
      const apiPathRaw = normalizeMetadataString(parsedValue.apiPath) || normalizeMetadataString(parsedValue.api_path);
      const apiStackRaw = normalizeMetadataString(parsedValue.apiStack) || normalizeMetadataString(parsedValue.api_stack);
      const apiPath = apiPathRaw.replace(/^\/+|\/+$/g, '') || 'apis';
      const apiStack = apiStackRaw.replace(/^\/+|\/+$/g, '') || 'php';

      if ((apiKey && !apiSecret) || (!apiKey && apiSecret)) {
        throw new Error();
      }

      if (apiKey && apiSecret) {
        if (!accessToken && !(usernameEmail && password)) {
          throw new Error();
        }
        return {
          ...(accessToken ? { accessToken } : {}),
          apiKey,
          apiSecret,
          ...(usernameEmail ? { usernameEmail } : {}),
          ...(password ? { password } : {}),
          apiPath,
          apiStack,
          ...(accountId ? { accountId } : {}),
          ...(accountName ? { accountName } : {}),
          ...(avatar ? { avatar } : {}),
        };
      }

      if (!accessToken) {
        throw new Error();
      }
      return {
        accessToken,
        apiPath,
        apiStack,
        ...(accountId ? { accountId } : {}),
        ...(accountName ? { accountName } : {}),
        ...(avatar ? { avatar } : {}),
      };
    } catch {
      throw new Error(this.getCredentialFormatMessage());
    }
  }

  private getApiBaseCandidates(credentials: { apiPath: string; apiStack: string }): string[] {
    const trimmedBase = (process.env.CHRXSTIANS_BASE_URL || 'https://chrxstians.com').trim().replace(/\/+$/g, '');
    const candidates = new Set<string>();

    const apiPath = credentials.apiPath.replace(/^\/+|\/+$/g, '');
    const apiStack = credentials.apiStack.replace(/^\/+|\/+$/g, '');
    if (apiPath && apiStack) {
      candidates.add(`${trimmedBase}/${apiPath}/${apiStack}`);
    } else if (apiPath) {
      candidates.add(`${trimmedBase}/${apiPath}`);
    }

    candidates.add(`${trimmedBase}/api`);
    candidates.add(`${trimmedBase}/apis/php`);
    candidates.add(`${trimmedBase}/apis/php/v1`);

    return Array.from(candidates);
  }

  private buildApiBase(credentials: { apiPath: string; apiStack: string }): string {
    const trimmedBase = (process.env.CHRXSTIANS_BASE_URL || 'https://chrxstians.com').trim().replace(/\/+$/g, '');
    const apiPath = credentials.apiPath.replace(/^\/+|\/+$/g, '') || 'apis';
    const apiStack = credentials.apiStack.replace(/^\/+|\/+$/g, '') || 'php';
    return `${trimmedBase}/${apiPath}/${apiStack}`;
  }

  private getSigninEndpointCandidates(credentials: { apiPath: string; apiStack: string }): string[] {
    // Prefer auth/signin first for Sngine instances where /signin may return
    // "You are not logged in" and never issue a token.
    const suffixes = ['/auth/signin', '/signin'];
    const urls: string[] = [];
    for (const base of this.getApiBaseCandidates(credentials)) {
      for (const suffix of suffixes) {
        urls.push(`${base}${suffix}`);
      }
    }
    return urls;
  }

  private getPingEndpointCandidates(credentials: { apiPath: string; apiStack: string }): string[] {
    const urls: string[] = [];
    for (const base of this.getApiBaseCandidates(credentials)) {
      urls.push(`${base}/ping`);
    }
    return urls;
  }

  private buildSignedHeaders(credentials: { apiKey: string; apiSecret: string }, authToken?: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', credentials.apiSecret).update(timestamp).digest('hex');
    return {
      'x-api-key': credentials.apiKey,
      'x-timestamp': timestamp,
      'x-signature': signature,
      ...(authToken ? { 'x-auth-token': authToken } : {}),
      'Content-Type': 'application/json',
    };
  }

  private decodeUserIdFromJwt(token: string): string | undefined {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return undefined;
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return normalizeUserId(payload.uid) || normalizeUserId(payload.user_id) || normalizeUserId(payload.id);
    } catch {
      return undefined;
    }
  }

  private extractChrxstiansError(payload: unknown): string | null {
    if (!isRecord(payload)) return null;

    const direct = normalizeMetadataString(payload.message) || normalizeMetadataString(payload.error);
    if (direct) return direct;

    if (isRecord(payload.data)) {
      const nestedMessage = normalizeMetadataString(payload.data.message) || normalizeMetadataString(payload.data.error);
      if (nestedMessage) return nestedMessage;
    }

    return null;
  }

  private resolvePublishPostId(payload: unknown): string | null {
    if (!isRecord(payload)) return null;

    const nestedData = isRecord(payload.data) ? payload.data : null;
    const nestedPost = isRecord(payload.post) ? payload.post : null;
    const nestedPostData = isRecord(payload.post_data) ? payload.post_data : null;
    const candidates = [
      payload.post_id,
      payload.id,
      nestedData?.post_id,
      nestedData?.id,
      nestedPost?.post_id,
      nestedPost?.id,
      nestedPostData?.post_id,
      nestedPostData?.id,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeRecordId(candidate);
      if (normalized) return normalized;
    }

    return null;
  }

  private buildSignedPostHeaders(
    credentials: { apiKey: string; apiSecret: string },
    authToken: string,
    contentType?: 'application/json' | 'application/x-www-form-urlencoded',
  ): Record<string, string> {
    const headers = this.buildSignedHeaders(credentials, authToken);
    if (!contentType) {
      delete headers['Content-Type'];
      return headers;
    }
    return {
      ...headers,
      'Content-Type': contentType,
    };
  }

  private buildStoredToken(credentials: {
    accessToken: string;
    apiKey?: string;
    apiSecret?: string;
    apiPath: string;
    apiStack: string;
    accountId?: string;
    accountName?: string;
    avatar?: string;
  }): string {
    const payload: Record<string, string> = {
      accessToken: credentials.accessToken,
      ...(credentials.apiKey ? { apiKey: credentials.apiKey } : {}),
      ...(credentials.apiSecret ? { apiSecret: credentials.apiSecret } : {}),
      ...(credentials.accountId ? { accountId: credentials.accountId } : {}),
      ...(credentials.accountName ? { accountName: credentials.accountName } : {}),
      ...(credentials.avatar ? { avatar: credentials.avatar } : {}),
    };
    if (credentials.apiPath !== 'apis') payload.apiPath = credentials.apiPath;
    if (credentials.apiStack !== 'php') payload.apiStack = credentials.apiStack;
    return JSON.stringify(payload);
  }

  private async authenticateWithPassword(credentials: {
    apiKey: string;
    apiSecret: string;
    usernameEmail: string;
    password: string;
    apiPath: string;
    apiStack: string;
  }): Promise<{ accessToken: string; accountId?: string; accountName?: string; avatar?: string }> {
    let lastError: string | null = null;

    for (const endpoint of this.getSigninEndpointCandidates(credentials)) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildSignedHeaders(credentials),
        body: JSON.stringify({
          username_email: credentials.usernameEmail,
          password: credentials.password,
          device_type: 'W',
          device_os_version: 'SMMT',
          device_name: 'SMMT',
          api_key: credentials.apiKey,
          api_secret: credentials.apiSecret,
        }),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const authData = isRecord(data.data) ? data.data : {};
      const user = isRecord(authData.user) ? authData.user : {};
      const token = normalizeMetadataString(authData.token)
        || normalizeMetadataString(data.token)
        || normalizeMetadataString(data.access_token);
      const errorText = this.extractChrxstiansError(data);

      if (response.ok && token) {
        const derivedName = normalizeMetadataString(user.user_fullname)
          || `${normalizeMetadataString(user.user_firstname)} ${normalizeMetadataString(user.user_lastname)}`.trim()
          || normalizeMetadataString(user.user_name)
          || credentials.usernameEmail;
        return {
          accessToken: token,
          accountId: normalizeUserId(user.user_id) || this.decodeUserIdFromJwt(token),
          ...(derivedName ? { accountName: derivedName } : {}),
          ...(normalizeMetadataString(user.user_picture_full) || normalizeMetadataString(user.user_picture)
            ? { avatar: normalizeMetadataString(user.user_picture_full) || normalizeMetadataString(user.user_picture) }
            : {}),
        };
      }

      lastError = errorText || `Could not authenticate ${this.platform} user`;
      if (!(response.status === 404 || /invalid parameters/i.test(lastError))) {
        break;
      }
    }

    throw new Error(lastError || `Could not authenticate ${this.platform} user`);
  }

  private async verifySignedSession(credentials: {
    accessToken: string;
    apiKey: string;
    apiSecret: string;
    apiPath: string;
    apiStack: string;
  }): Promise<void> {
    let lastError: string | null = null;

    for (const endpoint of this.getPingEndpointCandidates(credentials)) {
      const requestUrl = new URL(endpoint);
      requestUrl.searchParams.set('access_token', credentials.accessToken);
      requestUrl.searchParams.set('api_key', credentials.apiKey);

      const response = await fetch(requestUrl.toString(), {
        method: 'GET',
        headers: this.buildSignedHeaders(credentials, credentials.accessToken),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const explicitError = data.error === true;
      const status = normalizeMetadataString(data.status).toLowerCase();
      const message = normalizeMetadataString(data.message);

      if (response.ok && !explicitError && status !== 'error' && !/invalid parameters/i.test(message)) {
        return;
      }

      lastError = this.extractChrxstiansError(data) || `Could not verify ${this.platform} credentials`;
      if (!(response.status === 404 || /invalid parameters/i.test(lastError))) {
        break;
      }
    }

    throw new Error(lastError || `Could not verify ${this.platform} credentials`);
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(credentials);
    if (!parsed.apiKey || !parsed.apiSecret) {
      await super.getAccountInfo(parsed.accessToken as string);
      const tokenPayload = this.buildStoredToken({
        accessToken: parsed.accessToken as string,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
        ...(parsed.accountId ? { accountId: parsed.accountId } : {}),
        ...(parsed.accountName ? { accountName: parsed.accountName } : {}),
        ...(parsed.avatar ? { avatar: parsed.avatar } : {}),
      });
      return { accessToken: tokenPayload, refreshToken: tokenPayload };
    }

    let sessionToken = parsed.accessToken;
    let accountId = parsed.accountId;
    let accountName = parsed.accountName;
    let avatar = parsed.avatar;

    if (!sessionToken && parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      sessionToken = authenticated.accessToken;
      accountId = authenticated.accountId || accountId;
      accountName = authenticated.accountName || accountName;
      avatar = authenticated.avatar || avatar;
    } else if (sessionToken) {
      try {
        await this.verifySignedSession({
          accessToken: sessionToken,
          apiKey: parsed.apiKey,
          apiSecret: parsed.apiSecret,
          apiPath: parsed.apiPath,
          apiStack: parsed.apiStack,
        });
      } catch {
        await super.getAccountInfo(sessionToken);
      }
    }

    if (!sessionToken) {
      throw new Error(this.getCredentialFormatMessage());
    }

    const tokenPayload = this.buildStoredToken({
      accessToken: sessionToken,
      apiKey: parsed.apiKey,
      apiSecret: parsed.apiSecret,
      apiPath: parsed.apiPath,
      apiStack: parsed.apiStack,
      ...(accountId || this.decodeUserIdFromJwt(sessionToken) ? { accountId: accountId || this.decodeUserIdFromJwt(sessionToken) as string } : {}),
      ...(accountName ? { accountName } : {}),
      ...(avatar ? { avatar } : {}),
    });
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(token: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(token);
    if (!parsed.apiKey || !parsed.apiSecret) {
      await super.getAccountInfo(parsed.accessToken as string);
      const tokenPayload = this.buildStoredToken({
        accessToken: parsed.accessToken as string,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
        ...(parsed.accountId ? { accountId: parsed.accountId } : {}),
        ...(parsed.accountName ? { accountName: parsed.accountName } : {}),
        ...(parsed.avatar ? { avatar: parsed.avatar } : {}),
      });
      return { accessToken: tokenPayload, refreshToken: tokenPayload };
    }

    let currentToken = parsed.accessToken;
    let accountId = parsed.accountId;
    let accountName = parsed.accountName;
    let avatar = parsed.avatar;

    if (parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      currentToken = authenticated.accessToken;
      accountId = authenticated.accountId || accountId;
      accountName = authenticated.accountName || accountName;
      avatar = authenticated.avatar || avatar;
    } else if (currentToken) {
      try {
        await this.verifySignedSession({
          accessToken: currentToken,
          apiKey: parsed.apiKey,
          apiSecret: parsed.apiSecret,
          apiPath: parsed.apiPath,
          apiStack: parsed.apiStack,
        });
      } catch {
        await super.getAccountInfo(currentToken);
      }
    }

    if (!currentToken) {
      throw new Error(this.getCredentialFormatMessage());
    }

    const tokenPayload = this.buildStoredToken({
      accessToken: currentToken,
      apiKey: parsed.apiKey,
      apiSecret: parsed.apiSecret,
      apiPath: parsed.apiPath,
      apiStack: parsed.apiStack,
      ...(accountId || this.decodeUserIdFromJwt(currentToken) ? { accountId: accountId || this.decodeUserIdFromJwt(currentToken) as string } : {}),
      ...(accountName ? { accountName } : {}),
      ...(avatar ? { avatar } : {}),
    });
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const parsed = this.parseCredentials(accessToken);
    if (!parsed.apiKey || !parsed.apiSecret) {
      return super.getAccountInfo(parsed.accessToken as string);
    }

    let token = parsed.accessToken;
    let accountId = parsed.accountId;
    let accountName = parsed.accountName;
    let avatar = parsed.avatar;

    if (!token && parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      token = authenticated.accessToken;
      accountId = authenticated.accountId || accountId;
      accountName = authenticated.accountName || accountName;
      avatar = authenticated.avatar || avatar;
    }

    if (!token) {
      throw new Error(this.getCredentialFormatMessage());
    }

    try {
      await this.verifySignedSession({
        accessToken: token,
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
    } catch {
      const legacy = await super.getAccountInfo(token);
      return {
        id: legacy.id,
        name: accountName || legacy.name || parsed.usernameEmail || this.platform,
        username: legacy.username,
        avatar: avatar || legacy.avatar,
      };
    }

    const resolvedAccountId = accountId || this.decodeUserIdFromJwt(token);
    if (!resolvedAccountId) {
      const legacy = await super.getAccountInfo(token);
      return {
        id: legacy.id,
        name: accountName || legacy.name || parsed.usernameEmail || this.platform,
        username: legacy.username,
        avatar: avatar || legacy.avatar,
      };
    }

    return {
      id: resolvedAccountId,
      name: accountName || parsed.usernameEmail || this.platform,
      ...(avatar ? { avatar } : {}),
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const parsed = this.parseCredentials(accessToken);
    if (!parsed.apiKey || !parsed.apiSecret) {
      return super.publishPost(parsed.accessToken as string, post);
    }

    let sessionToken = parsed.accessToken;
    if (!sessionToken && parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      sessionToken = authenticated.accessToken;
    }

    if (!sessionToken) {
      throw new Error(this.getCredentialFormatMessage());
    }
    const apiKey = parsed.apiKey;
    const apiSecret = parsed.apiSecret;
    const trimmedBase = (process.env.CHRXSTIANS_BASE_URL || 'https://chrxstians.com').trim().replace(/\/+$/g, '');
    const primarySignedBase = this.buildApiBase(parsed).replace(/\/+$/g, '');
    const signedBaseCandidates = Array.from(
      new Set([
        primarySignedBase,
        ...this.getApiBaseCandidates(parsed).map((base) => base.replace(/\/+$/g, '')),
      ]),
    );

    const rawLink = typeof post.link === 'string' ? post.link.trim() : '';
    const mediaUrl = post.mediaUrls?.[0]?.trim() || '';
    const link = rawLink && mediaUrl && rawLink === mediaUrl ? '' : rawLink;
    const text = buildPostText({
      ...post,
      ...(link ? { link } : {}),
      ...(!link ? { link: undefined } : {}),
    }) || post.text;
    const mediaType = mediaUrl ? inferMediaKind(post, mediaUrl) : '';
    const metadata = isRecord(post.metadata) ? post.metadata : {};
    const destination = normalizeMetadataString(metadata.destination)
      || normalizeMetadataString(metadata.postOn)
      || normalizeMetadataString(metadata.post_on);
    const normalizedDestination = destination.toLowerCase();
    const pageId = normalizeMetadataString(metadata.pageId)
      || normalizeMetadataString(metadata.page_id);
    const groupId = normalizeMetadataString(metadata.groupId)
      || normalizeMetadataString(metadata.group_id);
    const includePageDestination = normalizedDestination === 'page' || pageId.length > 0;
    const includeGroupDestination = normalizedDestination === 'group' || groupId.length > 0;
    const resolvedUserId = parsed.accountId || this.decodeUserIdFromJwt(sessionToken) || '';
    let mediaUpload: {
      bytes: ArrayBuffer;
      contentType: string;
      fileName: string;
      mediaKind: 'image' | 'video';
    } | null = null;
    if (mediaUrl) {
      try {
        const mediaKind = inferMediaKind(post, mediaUrl);
        const mediaRes = await fetch(mediaUrl);
        if (mediaRes.ok) {
          const rawContentType = mediaRes.headers.get('content-type') || '';
          const contentType = rawContentType.split(';')[0]?.trim()
            || (mediaKind === 'video' ? 'video/mp4' : 'image/jpeg');
          const bytes = await mediaRes.arrayBuffer();
          mediaUpload = {
            bytes,
            contentType,
            fileName: inferUploadFileName(mediaUrl, mediaKind, contentType),
            mediaKind,
          };
        }
      } catch {
        mediaUpload = null;
      }
    }
    let uploadedMediaRefs: {
      src?: string;
      url?: string;
      name?: string;
      guid?: string;
    } | null = null;
    if (mediaUpload) {
      for (const uploadBase of signedBaseCandidates) {
        try {
          const uploadForm = new FormData();
          uploadForm.set('multiple', 'false');
          uploadForm.set('handle', mediaUpload.mediaKind === 'video' ? 'x-video' : 'x-image');
          uploadForm.set('type', mediaUpload.mediaKind === 'video' ? 'videos' : 'photos');
          uploadForm.append(
            'files',
            new Blob([mediaUpload.bytes], { type: mediaUpload.contentType }),
            mediaUpload.fileName,
          );
          const uploadResponse = await fetch(`${uploadBase}/data/upload`, {
            method: 'POST',
            headers: this.buildSignedPostHeaders({ apiKey, apiSecret }, sessionToken, undefined),
            body: uploadForm,
          });
          const { data: uploadData } = await parseJsonResponseSafe(uploadResponse);
          const uploadStatus = isRecord(uploadData) ? normalizeMetadataString(uploadData.status).toLowerCase() : '';
          const uploadError = this.extractChrxstiansError(uploadData);
          if (uploadResponse.ok && uploadStatus !== 'error' && !uploadError) {
            const uploadRecord = isRecord(uploadData) && isRecord(uploadData.data) ? uploadData.data : uploadData;
            if (isRecord(uploadRecord)) {
              const src = normalizeMetadataString(uploadRecord.src)
                || normalizeMetadataString(uploadRecord.media_src)
                || normalizeMetadataString(uploadRecord.upload_src)
                || normalizeMetadataString(uploadRecord.file_src);
              const url = normalizeMetadataString(uploadRecord.url)
                || normalizeMetadataString(uploadRecord.media_url)
                || normalizeMetadataString(uploadRecord.file_url);
              const name = normalizeMetadataString(uploadRecord.name);
              const guid = normalizeMetadataString(uploadRecord.guid);
              uploadedMediaRefs = {
                ...(src ? { src } : {}),
                ...(url ? { url } : {}),
                ...(name ? { name } : {}),
                ...(guid ? { guid } : {}),
              };
              break;
            }
          }
        } catch {
          uploadedMediaRefs = null;
        }
      }
    }

    const setField = (
      target: URLSearchParams | FormData | Record<string, unknown>,
      key: string,
      value: string,
    ) => {
      if (target instanceof URLSearchParams || target instanceof FormData) {
        target.set(key, value);
        return;
      }
      target[key] = value;
    };

    const appendDestinationFields = (target: URLSearchParams | FormData | Record<string, unknown>) => {
      if (includePageDestination) {
        setField(target, 'destination', 'page');
        setField(target, 'post_on', 'page');
        if (pageId) {
          setField(target, 'pageId', pageId);
          setField(target, 'page_id', pageId);
        }
        return;
      }

      if (includeGroupDestination) {
        setField(target, 'destination', 'group');
        setField(target, 'post_on', 'group');
        if (groupId) {
          setField(target, 'groupId', groupId);
          setField(target, 'group_id', groupId);
        }
      }
    };

    const appendSharedContentFields = (
      target: URLSearchParams | FormData | Record<string, unknown>,
      options?: { includeMediaUrlFields?: boolean },
    ) => {
      if (link) {
        setField(target, 'link', link);
        setField(target, 'postLink', link);
      }
      if (uploadedMediaRefs?.src) {
        setField(target, 'src', uploadedMediaRefs.src);
        setField(target, 'media_src', uploadedMediaRefs.src);
        setField(target, 'upload_src', uploadedMediaRefs.src);
        setField(target, 'file_src', uploadedMediaRefs.src);
      }
      if (uploadedMediaRefs?.name) {
        setField(target, 'name', uploadedMediaRefs.name);
      }
      if (uploadedMediaRefs?.guid) {
        setField(target, 'guid', uploadedMediaRefs.guid);
      }
      const includeMediaUrlFields = options?.includeMediaUrlFields ?? true;
      const effectiveMediaUrl = uploadedMediaRefs?.url || mediaUrl;
      if (effectiveMediaUrl && includeMediaUrlFields) {
        setField(target, 'mediaUrl', effectiveMediaUrl);
        setField(target, 'media_url', effectiveMediaUrl);
        setField(target, 'mediaType', mediaType);
        setField(target, 'media_type', mediaType);
      }
      appendDestinationFields(target);
    };

    const appendLegacyAuthFields = (target: URLSearchParams | FormData | Record<string, unknown>) => {
      setField(target, 'access_token', sessionToken);
      setField(target, 'token', sessionToken);
      setField(target, 'api_key', apiKey);
      setField(target, 'api_secret', apiSecret);
      setField(target, 'server_key', apiSecret);
      if (resolvedUserId) {
        setField(target, 'user_id', resolvedUserId);
        setField(target, 'uid', resolvedUserId);
      }
    };

    const signedMultipartPayloads: FormData[] = mediaUpload
      ? ['text', 'message', 'postText'].map((field) => {
        const form = new FormData();
        const mediaBlob = new Blob([mediaUpload.bytes], { type: mediaUpload.contentType });
        form.set(field, text);
        // Do not send raw media_url when a real multipart file is attached.
        appendSharedContentFields(form, { includeMediaUrlFields: false });
        form.append('postFile', mediaBlob, mediaUpload.fileName);
        if (mediaUpload.mediaKind === 'video') {
          form.append('postVideo', mediaBlob, mediaUpload.fileName);
        } else {
          form.append('postPhoto', mediaBlob, mediaUpload.fileName);
        }
        return form;
      })
      : [];

    const signedJsonPayloads: Record<string, unknown>[] = [
      { text },
      { message: text },
      { postText: text },
    ].map((payload) => {
      const nextPayload: Record<string, unknown> = { ...payload };
      appendSharedContentFields(nextPayload);
      return nextPayload;
    });

    const signedFormPayloads: URLSearchParams[] = ['text', 'message', 'postText'].map((field) => {
      const params = new URLSearchParams();
      params.set(field, text);
      appendSharedContentFields(params);
      return params;
    });

    const legacyTextFields = ['postText', 'text', 'message', 'status', 'post_text'];
    const legacyJsonPayloads: Record<string, unknown>[] = legacyTextFields.map((field) => {
      const payload: Record<string, unknown> = { [field]: text };
      appendSharedContentFields(payload);
      appendLegacyAuthFields(payload);
      return payload;
    });
    const legacyFormPayloads: URLSearchParams[] = legacyTextFields.map((field) => {
      const params = new URLSearchParams();
      params.set(field, text);
      appendSharedContentFields(params);
      appendLegacyAuthFields(params);
      return params;
    });

    const configuredRawEndpoints = normalizeMetadataString(process.env.CHRXSTIANS_PUBLISH_ENDPOINTS)
      || normalizeMetadataString(process.env.CHRXSTIANS_PUBLISH_ENDPOINT);
    const configuredEndpointCandidates = configuredRawEndpoints
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => {
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith('/')) return `${trimmedBase}${value}`;
        if (value.startsWith('api/') || value.startsWith('apis/')) return `${trimmedBase}/${value}`;
        return `${primarySignedBase}/${value}`;
      })
      .map((value) => value.replace(/\/+$/g, ''));
    const fallbackEndpointCandidates = signedBaseCandidates.flatMap((base) => [
      `${base}/posts/create`,
      `${base}/post/create`,
      `${base}/create-post`,
      `${base}/create_post`,
      `${base}/posts`,
    ]);
    fallbackEndpointCandidates.push(`${trimmedBase}/api/posts`);
    const endpointCandidates = Array.from(new Set(configuredEndpointCandidates.length > 0
      ? configuredEndpointCandidates
      : fallbackEndpointCandidates));

    let lastError: string | null = null;
    let totalAttempts = 0;
    let notFoundAttempts = 0;
    let invalidParametersAttempts = 0;

    for (const endpoint of endpointCandidates) {
      const normalizedEndpoint = endpoint.replace(/\/+$/g, '');
      const isLegacyEndpoint = /\/api(?:\/|$)/.test(normalizedEndpoint) && !/\/apis(?:\/|$)/.test(normalizedEndpoint);
      const attempts: Array<Record<string, unknown> | URLSearchParams | FormData> = isLegacyEndpoint
        ? [...legacyJsonPayloads, ...legacyFormPayloads]
        : [...signedMultipartPayloads, ...signedJsonPayloads, ...signedFormPayloads];

      for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex += 1) {
        const payload = attempts[attemptIndex];
        const isFormPayload = payload instanceof URLSearchParams;
        const isMultipartPayload = payload instanceof FormData;
        const headers = isLegacyEndpoint
          ? {
            Authorization: `Bearer ${sessionToken}`,
            'x-api-key': apiKey,
            'x-auth-token': sessionToken,
            ...(isMultipartPayload
              ? {}
              : { 'Content-Type': isFormPayload ? 'application/x-www-form-urlencoded' : 'application/json' }),
          }
          : this.buildSignedPostHeaders(
            { apiKey, apiSecret },
            sessionToken,
            isMultipartPayload ? undefined : (isFormPayload ? 'application/x-www-form-urlencoded' : 'application/json'),
          );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: isFormPayload
            ? payload.toString()
            : isMultipartPayload
              ? payload
              : JSON.stringify(payload),
        });
        totalAttempts += 1;
        const { data } = await parseJsonResponseSafe(response);
        const apiError = this.extractChrxstiansError(data)
          || (isRecord(data) ? normalizeMetadataString(data.api_text) : '');
        const explicitError = isRecord(data) && data.error === true;
        const status = isRecord(data) ? normalizeMetadataString(data.status).toLowerCase() : '';
        const postId = this.resolvePublishPostId(data);

        if (response.ok && !explicitError && status !== 'error' && postId) {
          const publishedPostUrl = extractPublishedPostUrl(data);
          return {
            platformPostId: postId,
            ...(publishedPostUrl ? { url: publishedPostUrl } : {}),
          };
        }

        const normalizedApiError = (apiError || '').toLowerCase();
        const isNotFound = response.status === 404 || /404\s+not\s+found/.test(normalizedApiError);
        if (isNotFound) {
          notFoundAttempts += 1;
          lastError = 'Chrxstians publish endpoint returned 404 Not Found';
          // Endpoint-level 404 usually means route mismatch; skip remaining payload permutations.
          break;
        }

        if (/invalid parameters?/.test(normalizedApiError)) {
          invalidParametersAttempts += 1;
        }
        lastError = apiError || `Failed to publish ${this.platform} post`;
      }
    }

    if (
      totalAttempts > 0
      && invalidParametersAttempts > 0
      && notFoundAttempts > 0
      && (invalidParametersAttempts + notFoundAttempts) === totalAttempts
    ) {
      throw new Error(
        'Chrxstians publish API route/payload mismatch. Configure CHRXSTIANS_PUBLISH_ENDPOINT or CHRXSTIANS_PUBLISH_ENDPOINTS to your instance post API route, then retry.',
      );
    }
    if (totalAttempts > 0 && notFoundAttempts === totalAttempts) {
      throw new Error(
        'Chrxstians publish endpoint is unavailable (404). Configure CHRXSTIANS_PUBLISH_ENDPOINT or CHRXSTIANS_PUBLISH_ENDPOINTS to your instance post API route.',
      );
    }
    if (totalAttempts > 0 && invalidParametersAttempts === totalAttempts) {
      throw new Error(
        'Chrxstians publish payload was rejected as invalid parameters. Configure CHRXSTIANS_PUBLISH_ENDPOINT(S) for your instance or contact Chrxstians API support for the required post payload contract.',
      );
    }
    throw new Error(lastError || `Failed to publish ${this.platform} post`);
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const parsed = this.parseCredentials(accessToken);
    if (!parsed.apiKey || !parsed.apiSecret) {
      try {
        return await super.getPostAnalytics(parsed.accessToken as string, platformPostId);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/unexpected token/i.test(message) || /<!doctype/i.test(message)) {
          throw new Error('Chrxstians analytics endpoint returned HTML instead of JSON');
        }
        throw error;
      }
    }

    let sessionToken = parsed.accessToken;
    if (!sessionToken && parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      sessionToken = authenticated.accessToken;
    }

    if (!sessionToken) {
      throw new Error(this.getCredentialFormatMessage());
    }

    const apiKey = parsed.apiKey;
    const apiSecret = parsed.apiSecret;
    const trimmedBase = (process.env.CHRXSTIANS_BASE_URL || 'https://chrxstians.com').trim().replace(/\/+$/g, '');
    const primarySignedBase = this.buildApiBase(parsed).replace(/\/+$/g, '');
    const signedBaseCandidates = Array.from(
      new Set([
        primarySignedBase,
        ...this.getApiBaseCandidates(parsed).map((base) => base.replace(/\/+$/g, '')),
      ]),
    );
    const encodedPostId = encodeURIComponent(platformPostId);
    const configuredRawEndpoints = normalizeMetadataString(process.env.CHRXSTIANS_ANALYTICS_ENDPOINTS)
      || normalizeMetadataString(process.env.CHRXSTIANS_ANALYTICS_ENDPOINT);
    const configuredEndpointCandidates = configuredRawEndpoints
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => value.replace(/\{postId\}/g, encodedPostId))
      .map((value) => {
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith('/')) return `${trimmedBase}${value}`;
        if (value.startsWith('api/') || value.startsWith('apis/')) return `${trimmedBase}/${value}`;
        return `${primarySignedBase}/${value}`;
      })
      .map((value) => value.replace(/\/+$/g, ''));
    const fallbackEndpointCandidates = signedBaseCandidates.flatMap((base) => [
      `${base}/posts/${encodedPostId}/analytics`,
      `${base}/posts/${encodedPostId}`,
      `${base}/posts/view/${encodedPostId}`,
      `${base}/data/load?get=post&post_id=${encodedPostId}`,
      `${base}/data/load?get=post&id=${encodedPostId}`,
      `${base}/data/load?get=posts&post_id=${encodedPostId}`,
      `${base}/data/load?get=posts&id=${encodedPostId}`,
    ]);
    fallbackEndpointCandidates.push(`${trimmedBase}/api/posts/${encodedPostId}`);
    const endpointCandidates = Array.from(new Set(configuredEndpointCandidates.length > 0
      ? configuredEndpointCandidates
      : fallbackEndpointCandidates));

    let lastError: string | null = null;

    for (const endpoint of endpointCandidates) {
      const normalizedEndpoint = endpoint.replace(/\/+$/g, '');
      const isLegacyEndpoint = /\/api(?:\/|$)/.test(normalizedEndpoint) && !/\/apis(?:\/|$)/.test(normalizedEndpoint);
      const headers = isLegacyEndpoint
        ? {
          Authorization: `Bearer ${sessionToken}`,
          'x-api-key': apiKey,
          'x-auth-token': sessionToken,
        }
        : this.buildSignedPostHeaders(
          { apiKey, apiSecret },
          sessionToken,
          undefined,
        );

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
      });
      const { data, isJson, rawText } = await parseJsonResponseSafe(response);
      if (!isJson) {
        if (response.status === 404) {
          lastError = 'Chrxstians analytics endpoint returned 404 Not Found';
          continue;
        }

        const preview = rawText.trim().slice(0, 32).toLowerCase();
        lastError = preview.startsWith('<!doctype') || preview.startsWith('<html')
          ? 'Chrxstians analytics endpoint returned HTML instead of JSON. Configure CHRXSTIANS_ANALYTICS_ENDPOINT or CHRXSTIANS_ANALYTICS_ENDPOINTS to a JSON API route.'
          : 'Chrxstians analytics endpoint returned a non-JSON response.';
        continue;
      }

      const apiError = this.extractChrxstiansError(data)
        || (isRecord(data) ? normalizeMetadataString(data.api_text) : '');
      const status = isRecord(data) ? normalizeMetadataString(data.status).toLowerCase() : '';
      if (!response.ok || status === 'error' || apiError) {
        const normalizedApiError = apiError.toLowerCase();
        const shouldTryFallback = response.status === 404
          || /404/.test(normalizedApiError)
          || /not found/.test(normalizedApiError)
          || /invalid parameters?/.test(normalizedApiError);
        if (shouldTryFallback) {
          lastError = apiError || `Failed to fetch ${this.platform} analytics`;
          continue;
        }

        throw new Error(apiError || `Failed to fetch ${this.platform} analytics`);
      }

      const postRecord = findPostRecord(data, platformPostId);
      if (!postRecord) {
        lastError = `Could not resolve ${this.platform} analytics for post ${platformPostId}`;
        continue;
      }

      return mapAnalyticsFromPostRecord(postRecord);
    }

    const normalizedLastError = (lastError || '').toLowerCase();
    if (
      normalizedLastError.includes('404')
      || normalizedLastError.includes('non-json')
      || normalizedLastError.includes('html')
      || normalizedLastError.includes('failed to fetch')
    ) {
      throw new Error(
        'Chrxstians analytics API is not implemented on this server yet. Add a JSON metrics endpoint on Chrxstians and set CHRXSTIANS_ANALYTICS_ENDPOINT or CHRXSTIANS_ANALYTICS_ENDPOINTS.',
      );
    }

    throw new Error(
      lastError
      || 'Chrxstians analytics API is unavailable for this API setup. Add a JSON metrics endpoint on Chrxstians and set CHRXSTIANS_ANALYTICS_ENDPOINT or CHRXSTIANS_ANALYTICS_ENDPOINTS.',
    );
  }
}

export class IohahAdapter extends SngineAdapter {
  constructor() {
    super('iohah', (process.env.IOHAH_BASE_URL || 'https://iohah.com').trim() || 'https://iohah.com');
  }

  private getCredentialFormatMessage(): string {
    return 'Provide iohah credentials as JSON: {"accessToken":"token","apiKey":"key","apiSecret":"secret"} or {"apiKey":"key","apiSecret":"secret","usernameEmail":"email-or-username","password":"password"}';
  }

  private parseCredentials(value: string): {
    accessToken?: string;
    apiKey?: string;
    apiSecret?: string;
    usernameEmail?: string;
    password?: string;
    apiPath: string;
    apiStack: string;
    accountId?: string;
    accountName?: string;
    avatar?: string;
  } {
    const input = value.trim();
    if (!input || !input.startsWith('{')) {
      throw new Error(this.getCredentialFormatMessage());
    }

    try {
      const parsedValue = JSON.parse(input);
      if (!isRecord(parsedValue)) {
        throw new Error();
      }
      const accessToken = typeof parsedValue.accessToken === 'string'
        ? parsedValue.accessToken.trim()
        : typeof parsedValue.token === 'string'
          ? parsedValue.token.trim()
          : '';

      const apiKey = (
        typeof parsedValue.apiKey === 'string'
          ? parsedValue.apiKey
          : typeof parsedValue.api_key === 'string'
            ? parsedValue.api_key
            : typeof parsedValue.client_id === 'string'
              ? parsedValue.client_id
              : ''
      ).trim() || (process.env.IOHAH_API_KEY || '').trim();
      const apiSecret = (
        typeof parsedValue.apiSecret === 'string'
          ? parsedValue.apiSecret
          : typeof parsedValue.api_secret === 'string'
            ? parsedValue.api_secret
            : typeof parsedValue.serverKey === 'string'
              ? parsedValue.serverKey
              : typeof parsedValue.server_key === 'string'
                ? parsedValue.server_key
                : typeof parsedValue.client_secret === 'string'
                  ? parsedValue.client_secret
                  : ''
      ).trim() || (process.env.IOHAH_API_SECRET || '').trim();

      const usernameEmail = (
        typeof parsedValue.usernameEmail === 'string'
          ? parsedValue.usernameEmail
          : typeof parsedValue.username_email === 'string'
            ? parsedValue.username_email
            : typeof parsedValue.email === 'string'
              ? parsedValue.email
              : typeof parsedValue.username === 'string'
                ? parsedValue.username
                : ''
      ).trim();
      const password = typeof parsedValue.password === 'string' ? parsedValue.password.trim() : '';
      const accountId = normalizeUserId(parsedValue.accountId)
        || normalizeUserId(parsedValue.account_id)
        || normalizeUserId(parsedValue.userId)
        || normalizeUserId(parsedValue.user_id);
      const accountName = normalizeMetadataString(parsedValue.accountName)
        || normalizeMetadataString(parsedValue.account_name)
        || normalizeMetadataString(parsedValue.name);
      const avatar = normalizeMetadataString(parsedValue.avatar)
        || normalizeMetadataString(parsedValue.user_picture)
        || normalizeMetadataString(parsedValue.user_picture_full);
      const apiPathRaw = normalizeMetadataString(parsedValue.apiPath) || normalizeMetadataString(parsedValue.api_path);
      const apiStackRaw = normalizeMetadataString(parsedValue.apiStack) || normalizeMetadataString(parsedValue.api_stack);
      const apiPath = apiPathRaw.replace(/^\/+|\/+$/g, '') || 'apis';
      const apiStack = apiStackRaw.replace(/^\/+|\/+$/g, '') || 'php';

      if ((apiKey && !apiSecret) || (!apiKey && apiSecret)) {
        throw new Error();
      }

      if (apiKey && apiSecret) {
        if (!accessToken && !(usernameEmail && password)) {
          throw new Error();
        }
        return {
          ...(accessToken ? { accessToken } : {}),
          apiKey,
          apiSecret,
          ...(usernameEmail ? { usernameEmail } : {}),
          ...(password ? { password } : {}),
          apiPath,
          apiStack,
          ...(accountId ? { accountId } : {}),
          ...(accountName ? { accountName } : {}),
          ...(avatar ? { avatar } : {}),
        };
      }

      if (!accessToken) {
        throw new Error();
      }

      // Legacy fallback mode for older deployments exposing /api/me bearer auth.
      return { accessToken, apiPath, apiStack };
    } catch {
      throw new Error(this.getCredentialFormatMessage());
    }
  }

  private buildApiBase(credentials: { apiPath: string; apiStack: string }): string {
    const trimmedBase = (process.env.IOHAH_BASE_URL || 'https://iohah.com').trim().replace(/\/+$/g, '');
    const apiPath = credentials.apiPath.replace(/^\/+|\/+$/g, '') || 'apis';
    const apiStack = credentials.apiStack.replace(/^\/+|\/+$/g, '') || 'php';
    return `${trimmedBase}/${apiPath}/${apiStack}`;
  }

  private buildSignedHeaders(credentials: { apiKey: string; apiSecret: string }, authToken?: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', credentials.apiSecret).update(timestamp).digest('hex');
    return {
      'x-api-key': credentials.apiKey,
      'x-timestamp': timestamp,
      'x-signature': signature,
      ...(authToken ? { 'x-auth-token': authToken } : {}),
      'Content-Type': 'application/json',
    };
  }

  private decodeUserIdFromJwt(token: string): string | undefined {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return undefined;
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return normalizeUserId(payload.uid) || normalizeUserId(payload.user_id) || normalizeUserId(payload.id);
    } catch {
      return undefined;
    }
  }

  private extractIohahError(payload: unknown): string | null {
    if (!isRecord(payload)) return null;

    const direct = normalizeMetadataString(payload.message) || normalizeMetadataString(payload.error);
    if (direct) return direct;

    if (isRecord(payload.data)) {
      const nestedMessage = normalizeMetadataString(payload.data.message) || normalizeMetadataString(payload.data.error);
      if (nestedMessage) return nestedMessage;
    }

    return null;
  }

  private resolvePublishPostId(payload: unknown): string | null {
    if (!isRecord(payload)) return null;

    const nestedData = isRecord(payload.data) ? payload.data : null;
    const nestedPost = isRecord(payload.post) ? payload.post : null;
    const nestedPostData = isRecord(payload.post_data) ? payload.post_data : null;
    const candidates = [
      payload.post_id,
      payload.id,
      nestedData?.post_id,
      nestedData?.id,
      nestedPost?.post_id,
      nestedPost?.id,
      nestedPostData?.post_id,
      nestedPostData?.id,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeRecordId(candidate);
      if (normalized) return normalized;
    }

    return null;
  }

  private buildSignedPostHeaders(
    credentials: { apiKey: string; apiSecret: string },
    authToken: string,
    contentType?: 'application/json' | 'application/x-www-form-urlencoded',
  ): Record<string, string> {
    const headers = this.buildSignedHeaders(credentials, authToken);
    if (!contentType) {
      delete headers['Content-Type'];
      return headers;
    }
    return {
      ...headers,
      'Content-Type': contentType,
    };
  }

  private buildStoredToken(credentials: {
    accessToken: string;
    apiKey?: string;
    apiSecret?: string;
    apiPath: string;
    apiStack: string;
    accountId?: string;
    accountName?: string;
    avatar?: string;
  }): string {
    const payload: Record<string, string> = {
      accessToken: credentials.accessToken,
      ...(credentials.apiKey ? { apiKey: credentials.apiKey } : {}),
      ...(credentials.apiSecret ? { apiSecret: credentials.apiSecret } : {}),
      ...(credentials.accountId ? { accountId: credentials.accountId } : {}),
      ...(credentials.accountName ? { accountName: credentials.accountName } : {}),
      ...(credentials.avatar ? { avatar: credentials.avatar } : {}),
    };
    if (credentials.apiPath !== 'apis') payload.apiPath = credentials.apiPath;
    if (credentials.apiStack !== 'php') payload.apiStack = credentials.apiStack;
    return JSON.stringify(payload);
  }

  private async authenticateWithPassword(credentials: {
    apiKey: string;
    apiSecret: string;
    usernameEmail: string;
    password: string;
    apiPath: string;
    apiStack: string;
  }): Promise<{ accessToken: string; accountId?: string; accountName?: string; avatar?: string }> {
    const base = this.buildApiBase(credentials);
    const response = await fetch(`${base}/auth/signin`, {
      method: 'POST',
      headers: this.buildSignedHeaders(credentials),
      body: JSON.stringify({
        username_email: credentials.usernameEmail,
        password: credentials.password,
        device_type: 'W',
        device_os_version: 'SMMT',
        device_name: 'SMMT',
      }),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const authData = isRecord(data.data) ? data.data : {};
    const token = normalizeMetadataString(authData.token);
    const user = isRecord(authData.user) ? authData.user : {};

    if (!response.ok || !token) {
      throw new Error(this.extractIohahError(data) || `Could not authenticate ${this.platform} user`);
    }

    const derivedName = normalizeMetadataString(user.user_fullname)
      || `${normalizeMetadataString(user.user_firstname)} ${normalizeMetadataString(user.user_lastname)}`.trim()
      || normalizeMetadataString(user.user_name)
      || credentials.usernameEmail;
    return {
      accessToken: token,
      accountId: normalizeUserId(user.user_id) || this.decodeUserIdFromJwt(token),
      ...(derivedName ? { accountName: derivedName } : {}),
      ...(normalizeMetadataString(user.user_picture_full) || normalizeMetadataString(user.user_picture)
        ? { avatar: normalizeMetadataString(user.user_picture_full) || normalizeMetadataString(user.user_picture) }
        : {}),
    };
  }

  private async verifySignedSession(credentials: {
    accessToken: string;
    apiKey: string;
    apiSecret: string;
    apiPath: string;
    apiStack: string;
  }): Promise<void> {
    const base = this.buildApiBase(credentials);
    const response = await fetch(`${base}/ping`, {
      method: 'GET',
      headers: this.buildSignedHeaders(credentials, credentials.accessToken),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const status = normalizeMetadataString(data.status).toLowerCase();
    if (!response.ok || status === 'error') {
      throw new Error(this.extractIohahError(data) || `Could not verify ${this.platform} credentials`);
    }
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(credentials);
    if (!parsed.apiKey || !parsed.apiSecret) {
      // Legacy fallback mode.
      await super.getAccountInfo(parsed.accessToken as string);
      const tokenPayload = this.buildStoredToken({
        accessToken: parsed.accessToken as string,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      return { accessToken: tokenPayload, refreshToken: tokenPayload };
    }

    let sessionToken = parsed.accessToken;
    let accountId = parsed.accountId;
    let accountName = parsed.accountName;
    let avatar = parsed.avatar;

    if (!sessionToken && parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      sessionToken = authenticated.accessToken;
      accountId = authenticated.accountId || accountId;
      accountName = authenticated.accountName || accountName;
      avatar = authenticated.avatar || avatar;
    } else if (sessionToken) {
      await this.verifySignedSession({
        accessToken: sessionToken,
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
    }

    if (!sessionToken) {
      throw new Error(this.getCredentialFormatMessage());
    }

    const tokenPayload = this.buildStoredToken({
      accessToken: sessionToken,
      apiKey: parsed.apiKey,
      apiSecret: parsed.apiSecret,
      apiPath: parsed.apiPath,
      apiStack: parsed.apiStack,
      ...(accountId ? { accountId } : {}),
      ...(accountName ? { accountName } : {}),
      ...(avatar ? { avatar } : {}),
    });
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(token: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(token);
    if (!parsed.apiKey || !parsed.apiSecret) {
      await super.getAccountInfo(parsed.accessToken as string);
      const tokenPayload = this.buildStoredToken({
        accessToken: parsed.accessToken as string,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      return { accessToken: tokenPayload, refreshToken: tokenPayload };
    }

    let currentToken = parsed.accessToken;
    let accountId = parsed.accountId;
    let accountName = parsed.accountName;
    let avatar = parsed.avatar;

    if (parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      currentToken = authenticated.accessToken;
      accountId = authenticated.accountId || accountId;
      accountName = authenticated.accountName || accountName;
      avatar = authenticated.avatar || avatar;
    } else if (currentToken) {
      await this.verifySignedSession({
        accessToken: currentToken,
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
    }

    if (!currentToken) {
      throw new Error(this.getCredentialFormatMessage());
    }

    const tokenPayload = this.buildStoredToken({
      accessToken: currentToken,
      apiKey: parsed.apiKey,
      apiSecret: parsed.apiSecret,
      apiPath: parsed.apiPath,
      apiStack: parsed.apiStack,
      ...(accountId ? { accountId } : {}),
      ...(accountName ? { accountName } : {}),
      ...(avatar ? { avatar } : {}),
    });
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const parsed = this.parseCredentials(accessToken);
    if (!parsed.apiKey || !parsed.apiSecret) {
      return super.getAccountInfo(parsed.accessToken as string);
    }

    let token = parsed.accessToken;
    let accountId = parsed.accountId;
    let accountName = parsed.accountName;
    let avatar = parsed.avatar;

    if (!token && parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      token = authenticated.accessToken;
      accountId = authenticated.accountId || accountId;
      accountName = authenticated.accountName || accountName;
      avatar = authenticated.avatar || avatar;
    }

    if (!token) {
      throw new Error(this.getCredentialFormatMessage());
    }

    await this.verifySignedSession({
      accessToken: token,
      apiKey: parsed.apiKey,
      apiSecret: parsed.apiSecret,
      apiPath: parsed.apiPath,
      apiStack: parsed.apiStack,
    });

    const resolvedAccountId = accountId || this.decodeUserIdFromJwt(token);
    if (!resolvedAccountId) {
      throw new Error(`Could not resolve ${this.platform} account ID from provided credentials`);
    }

    return {
      id: resolvedAccountId,
      name: accountName || parsed.usernameEmail || this.platform,
      ...(avatar ? { avatar } : {}),
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const parsed = this.parseCredentials(accessToken);
    if (!parsed.apiKey || !parsed.apiSecret) {
      return super.publishPost(parsed.accessToken as string, post);
    }

    let sessionToken = parsed.accessToken;
    if (!sessionToken && parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      sessionToken = authenticated.accessToken;
    }

    if (!sessionToken) {
      throw new Error(this.getCredentialFormatMessage());
    }
    const apiKey = parsed.apiKey;
    const apiSecret = parsed.apiSecret;
    const trimmedBase = (process.env.IOHAH_BASE_URL || 'https://iohah.com').trim().replace(/\/+$/g, '');
    const signedBase = this.buildApiBase(parsed);

    const rawLink = typeof post.link === 'string' ? post.link.trim() : '';
    const mediaUrl = post.mediaUrls?.[0]?.trim() || '';
    const link = rawLink && mediaUrl && rawLink === mediaUrl ? '' : rawLink;
    const text = buildPostText({
      ...post,
      ...(link ? { link } : {}),
      ...(!link ? { link: undefined } : {}),
    }) || post.text;
    const mediaType = mediaUrl ? inferMediaKind(post, mediaUrl) : '';
    const metadata = isRecord(post.metadata) ? post.metadata : {};
    const destination = normalizeMetadataString(metadata.destination)
      || normalizeMetadataString(metadata.postOn)
      || normalizeMetadataString(metadata.post_on);
    const normalizedDestination = destination.toLowerCase();
    const pageId = normalizeMetadataString(metadata.pageId)
      || normalizeMetadataString(metadata.page_id);
    const groupId = normalizeMetadataString(metadata.groupId)
      || normalizeMetadataString(metadata.group_id);
    const includePageDestination = normalizedDestination === 'page' || pageId.length > 0;
    const includeGroupDestination = normalizedDestination === 'group' || groupId.length > 0;
    const resolvedUserId = parsed.accountId || this.decodeUserIdFromJwt(sessionToken) || '';
    let mediaUpload: {
      bytes: ArrayBuffer;
      contentType: string;
      fileName: string;
      mediaKind: 'image' | 'video';
    } | null = null;
    if (mediaUrl) {
      try {
        const mediaKind = inferMediaKind(post, mediaUrl);
        const mediaRes = await fetch(mediaUrl);
        if (mediaRes.ok) {
          const rawContentType = mediaRes.headers.get('content-type') || '';
          const contentType = rawContentType.split(';')[0]?.trim()
            || (mediaKind === 'video' ? 'video/mp4' : 'image/jpeg');
          const bytes = await mediaRes.arrayBuffer();
          mediaUpload = {
            bytes,
            contentType,
            fileName: inferUploadFileName(mediaUrl, mediaKind, contentType),
            mediaKind,
          };
        }
      } catch {
        mediaUpload = null;
      }
    }
    let uploadedMediaRefs: {
      src?: string;
      url?: string;
      name?: string;
      guid?: string;
    } | null = null;
    if (mediaUpload) {
      try {
        const uploadForm = new FormData();
        uploadForm.set('multiple', 'false');
        uploadForm.set('handle', mediaUpload.mediaKind === 'video' ? 'x-video' : 'x-image');
        uploadForm.set('type', mediaUpload.mediaKind === 'video' ? 'videos' : 'photos');
        uploadForm.append(
          'files',
          new Blob([mediaUpload.bytes], { type: mediaUpload.contentType }),
          mediaUpload.fileName,
        );
        const uploadResponse = await fetch(`${signedBase}/data/upload`, {
          method: 'POST',
          headers: this.buildSignedPostHeaders({ apiKey, apiSecret }, sessionToken, undefined),
          body: uploadForm,
        });
        const { data: uploadData } = await parseJsonResponseSafe(uploadResponse);
        const uploadStatus = isRecord(uploadData) ? normalizeMetadataString(uploadData.status).toLowerCase() : '';
        const uploadError = this.extractIohahError(uploadData);
        if (uploadResponse.ok && uploadStatus !== 'error' && !uploadError) {
          const uploadRecord = isRecord(uploadData) && isRecord(uploadData.data) ? uploadData.data : uploadData;
          if (isRecord(uploadRecord)) {
            const src = normalizeMetadataString(uploadRecord.src)
              || normalizeMetadataString(uploadRecord.media_src)
              || normalizeMetadataString(uploadRecord.upload_src)
              || normalizeMetadataString(uploadRecord.file_src);
            const url = normalizeMetadataString(uploadRecord.url)
              || normalizeMetadataString(uploadRecord.media_url)
              || normalizeMetadataString(uploadRecord.file_url);
            const name = normalizeMetadataString(uploadRecord.name);
            const guid = normalizeMetadataString(uploadRecord.guid);
            uploadedMediaRefs = {
              ...(src ? { src } : {}),
              ...(url ? { url } : {}),
              ...(name ? { name } : {}),
              ...(guid ? { guid } : {}),
            };
          }
        }
      } catch {
        uploadedMediaRefs = null;
      }
    }

    const setField = (
      target: URLSearchParams | FormData | Record<string, unknown>,
      key: string,
      value: string,
    ) => {
      if (target instanceof URLSearchParams || target instanceof FormData) {
        target.set(key, value);
        return;
      }
      target[key] = value;
    };

    const appendDestinationFields = (target: URLSearchParams | FormData | Record<string, unknown>) => {
      if (includePageDestination) {
        setField(target, 'destination', 'page');
        setField(target, 'post_on', 'page');
        if (pageId) {
          setField(target, 'pageId', pageId);
          setField(target, 'page_id', pageId);
        }
        return;
      }

      if (includeGroupDestination) {
        setField(target, 'destination', 'group');
        setField(target, 'post_on', 'group');
        if (groupId) {
          setField(target, 'groupId', groupId);
          setField(target, 'group_id', groupId);
        }
      }
    };

    const appendSharedContentFields = (
      target: URLSearchParams | FormData | Record<string, unknown>,
      options?: { includeMediaUrlFields?: boolean },
    ) => {
      if (link) {
        setField(target, 'link', link);
        setField(target, 'postLink', link);
      }
      if (uploadedMediaRefs?.src) {
        setField(target, 'src', uploadedMediaRefs.src);
        setField(target, 'media_src', uploadedMediaRefs.src);
        setField(target, 'upload_src', uploadedMediaRefs.src);
        setField(target, 'file_src', uploadedMediaRefs.src);
      }
      if (uploadedMediaRefs?.name) {
        setField(target, 'name', uploadedMediaRefs.name);
      }
      if (uploadedMediaRefs?.guid) {
        setField(target, 'guid', uploadedMediaRefs.guid);
      }
      const includeMediaUrlFields = options?.includeMediaUrlFields ?? true;
      const effectiveMediaUrl = uploadedMediaRefs?.url || mediaUrl;
      if (effectiveMediaUrl && includeMediaUrlFields) {
        setField(target, 'mediaUrl', effectiveMediaUrl);
        setField(target, 'media_url', effectiveMediaUrl);
        setField(target, 'mediaType', mediaType);
        setField(target, 'media_type', mediaType);
      }
      appendDestinationFields(target);
    };

    const appendLegacyAuthFields = (target: URLSearchParams | FormData | Record<string, unknown>) => {
      setField(target, 'access_token', sessionToken);
      setField(target, 'token', sessionToken);
      setField(target, 'api_key', apiKey);
      setField(target, 'api_secret', apiSecret);
      setField(target, 'server_key', apiSecret);
      if (resolvedUserId) {
        setField(target, 'user_id', resolvedUserId);
        setField(target, 'uid', resolvedUserId);
      }
    };

    const signedMultipartPayloads: FormData[] = mediaUpload
      ? ['text', 'message', 'postText'].map((field) => {
        const form = new FormData();
        const mediaBlob = new Blob([mediaUpload.bytes], { type: mediaUpload.contentType });
        form.set(field, text);
        // Do not send raw media_url when a real multipart file is attached.
        appendSharedContentFields(form, { includeMediaUrlFields: false });
        form.append('postFile', mediaBlob, mediaUpload.fileName);
        if (mediaUpload.mediaKind === 'video') {
          form.append('postVideo', mediaBlob, mediaUpload.fileName);
        } else {
          form.append('postPhoto', mediaBlob, mediaUpload.fileName);
        }
        return form;
      })
      : [];

    const signedJsonPayloads: Record<string, unknown>[] = [
      { text },
      { message: text },
      { postText: text },
    ].map((payload) => {
      const nextPayload: Record<string, unknown> = { ...payload };
      appendSharedContentFields(nextPayload);
      return nextPayload;
    });

    const signedFormPayloads: URLSearchParams[] = ['text', 'message', 'postText'].map((field) => {
      const params = new URLSearchParams();
      params.set(field, text);
      appendSharedContentFields(params);
      return params;
    });

    const legacyTextFields = ['postText', 'text', 'message', 'status', 'post_text'];
    const legacyJsonPayloads: Record<string, unknown>[] = legacyTextFields.map((field) => {
      const payload: Record<string, unknown> = { [field]: text };
      appendSharedContentFields(payload);
      appendLegacyAuthFields(payload);
      return payload;
    });
    const legacyFormPayloads: URLSearchParams[] = legacyTextFields.map((field) => {
      const params = new URLSearchParams();
      params.set(field, text);
      appendSharedContentFields(params);
      appendLegacyAuthFields(params);
      return params;
    });

    const configuredRawEndpoints = normalizeMetadataString(process.env.IOHAH_PUBLISH_ENDPOINTS)
      || normalizeMetadataString(process.env.IOHAH_PUBLISH_ENDPOINT);
    const configuredEndpointCandidates = configuredRawEndpoints
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => {
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith('/')) return `${trimmedBase}${value}`;
        if (value.startsWith('api/')) return `${trimmedBase}/${value}`;
        return `${signedBase}/${value}`;
      })
      .map((value) => value.replace(/\/+$/g, ''));
    const endpointCandidates = Array.from(new Set(configuredEndpointCandidates.length > 0
      ? configuredEndpointCandidates
      : [
        `${signedBase}/posts/create`,
        `${signedBase}/post/create`,
        `${signedBase}/create-post`,
        `${signedBase}/create_post`,
        `${signedBase}/posts`,
        `${trimmedBase}/api/posts`,
      ]));

    let lastError: string | null = null;
    let totalAttempts = 0;
    let notFoundAttempts = 0;
    let invalidParametersAttempts = 0;

    for (const endpoint of endpointCandidates) {
      const normalizedEndpoint = endpoint.replace(/\/+$/g, '');
      const isLegacyEndpoint = /\/api(?:\/|$)/.test(normalizedEndpoint) && !/\/apis(?:\/|$)/.test(normalizedEndpoint);
      const attempts: Array<Record<string, unknown> | URLSearchParams | FormData> = isLegacyEndpoint
        ? [...legacyJsonPayloads, ...legacyFormPayloads]
        : [...signedMultipartPayloads, ...signedJsonPayloads, ...signedFormPayloads];

      for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex += 1) {
        const payload = attempts[attemptIndex];
        const isFormPayload = payload instanceof URLSearchParams;
        const isMultipartPayload = payload instanceof FormData;
        const headers = isLegacyEndpoint
          ? {
            Authorization: `Bearer ${sessionToken}`,
            'x-api-key': apiKey,
            'x-auth-token': sessionToken,
            ...(isMultipartPayload
              ? {}
              : { 'Content-Type': isFormPayload ? 'application/x-www-form-urlencoded' : 'application/json' }),
          }
          : this.buildSignedPostHeaders(
            { apiKey, apiSecret },
            sessionToken,
            isMultipartPayload ? undefined : (isFormPayload ? 'application/x-www-form-urlencoded' : 'application/json'),
          );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: isFormPayload
            ? payload.toString()
            : isMultipartPayload
              ? payload
              : JSON.stringify(payload),
        });
        totalAttempts += 1;
        const { data } = await parseJsonResponseSafe(response);
        const apiError = this.extractIohahError(data)
          || (isRecord(data) ? normalizeMetadataString(data.api_text) : '');
        const explicitError = isRecord(data) && data.error === true;
        const status = isRecord(data) ? normalizeMetadataString(data.status).toLowerCase() : '';
        const postId = this.resolvePublishPostId(data);

        if (response.ok && !explicitError && status !== 'error' && postId) {
          const publishedPostUrl = extractPublishedPostUrl(data);
          return {
            platformPostId: postId,
            ...(publishedPostUrl ? { url: publishedPostUrl } : {}),
          };
        }

        const normalizedApiError = (apiError || '').toLowerCase();
        const isNotFound = response.status === 404 || /404\s+not\s+found/.test(normalizedApiError);
        if (isNotFound) {
          notFoundAttempts += 1;
          lastError = 'Iohah publish endpoint returned 404 Not Found';
          // Endpoint-level 404 usually means route mismatch; skip remaining payload permutations.
          break;
        }

        if (/invalid parameters?/.test(normalizedApiError)) {
          invalidParametersAttempts += 1;
        }
        lastError = apiError || `Failed to publish ${this.platform} post`;
      }
    }

    if (
      totalAttempts > 0
      && invalidParametersAttempts > 0
      && notFoundAttempts > 0
      && (invalidParametersAttempts + notFoundAttempts) === totalAttempts
    ) {
      throw new Error(
        'Iohah publish API route/payload mismatch. Configure IOHAH_PUBLISH_ENDPOINT or IOHAH_PUBLISH_ENDPOINTS to your instance post API route, then retry.',
      );
    }
    if (totalAttempts > 0 && notFoundAttempts === totalAttempts) {
      throw new Error(
        'Iohah publish endpoint is unavailable (404). Configure IOHAH_PUBLISH_ENDPOINT or IOHAH_PUBLISH_ENDPOINTS to your instance post API route.',
      );
    }
    if (totalAttempts > 0 && invalidParametersAttempts === totalAttempts) {
      throw new Error(
        'Iohah publish payload was rejected as invalid parameters. Configure IOHAH_PUBLISH_ENDPOINT(S) for your instance or contact Iohah API support for the required post payload contract.',
      );
    }
    throw new Error(lastError || `Failed to publish ${this.platform} post`);
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const parsed = this.parseCredentials(accessToken);
    if (!parsed.apiKey || !parsed.apiSecret) {
      try {
        return await super.getPostAnalytics(parsed.accessToken as string, platformPostId);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/unexpected token/i.test(message) || /<!doctype/i.test(message)) {
          throw new Error('Iohah analytics endpoint returned HTML instead of JSON');
        }
        throw error;
      }
    }

    let sessionToken = parsed.accessToken;
    if (!sessionToken && parsed.usernameEmail && parsed.password) {
      const authenticated = await this.authenticateWithPassword({
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        usernameEmail: parsed.usernameEmail,
        password: parsed.password,
        apiPath: parsed.apiPath,
        apiStack: parsed.apiStack,
      });
      sessionToken = authenticated.accessToken;
    }

    if (!sessionToken) {
      throw new Error(this.getCredentialFormatMessage());
    }

    const apiKey = parsed.apiKey;
    const apiSecret = parsed.apiSecret;
    const signedBase = this.buildApiBase(parsed);
    const trimmedBase = (process.env.IOHAH_BASE_URL || 'https://iohah.com').trim().replace(/\/+$/g, '');
    const encodedPostId = encodeURIComponent(platformPostId);
    const configuredRawEndpoints = normalizeMetadataString(process.env.IOHAH_ANALYTICS_ENDPOINTS)
      || normalizeMetadataString(process.env.IOHAH_ANALYTICS_ENDPOINT);
    const configuredEndpointCandidates = configuredRawEndpoints
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => value.replace(/\{postId\}/g, encodedPostId))
      .map((value) => {
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith('/')) return `${trimmedBase}${value}`;
        if (value.startsWith('api/')) return `${trimmedBase}/${value}`;
        return `${signedBase}/${value}`;
      })
      .map((value) => value.replace(/\/+$/g, ''));
    const endpointCandidates = Array.from(new Set(configuredEndpointCandidates.length > 0
      ? configuredEndpointCandidates
      : [
        `${signedBase}/posts/${encodedPostId}/analytics`,
        `${signedBase}/posts/${encodedPostId}`,
        `${signedBase}/posts/view/${encodedPostId}`,
        `${signedBase}/data/load?get=post&post_id=${encodedPostId}`,
        `${signedBase}/data/load?get=post&id=${encodedPostId}`,
        `${signedBase}/data/load?get=posts&post_id=${encodedPostId}`,
        `${signedBase}/data/load?get=posts&id=${encodedPostId}`,
        `${trimmedBase}/api/posts/${encodedPostId}`,
      ]));

    let lastError: string | null = null;

    for (const endpoint of endpointCandidates) {
      const normalizedEndpoint = endpoint.replace(/\/+$/g, '');
      const isLegacyEndpoint = /\/api(?:\/|$)/.test(normalizedEndpoint) && !/\/apis(?:\/|$)/.test(normalizedEndpoint);
      const headers = isLegacyEndpoint
        ? {
          Authorization: `Bearer ${sessionToken}`,
          'x-api-key': apiKey,
          'x-auth-token': sessionToken,
        }
        : this.buildSignedPostHeaders(
          { apiKey, apiSecret },
          sessionToken,
          undefined,
        );

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
      });
      const { data, isJson, rawText } = await parseJsonResponseSafe(response);
      if (!isJson) {
        if (response.status === 404) {
          lastError = 'Iohah analytics endpoint returned 404 Not Found';
          continue;
        }

        const preview = rawText.trim().slice(0, 32).toLowerCase();
        lastError = preview.startsWith('<!doctype') || preview.startsWith('<html')
          ? 'Iohah analytics endpoint returned HTML instead of JSON. Configure IOHAH_ANALYTICS_ENDPOINT or IOHAH_ANALYTICS_ENDPOINTS to a JSON API route.'
          : 'Iohah analytics endpoint returned a non-JSON response.';
        continue;
      }

      const apiError = this.extractIohahError(data)
        || (isRecord(data) ? normalizeMetadataString(data.api_text) : '');
      const status = isRecord(data) ? normalizeMetadataString(data.status).toLowerCase() : '';
      if (!response.ok || status === 'error' || apiError) {
        const normalizedApiError = apiError.toLowerCase();
        const shouldTryFallback = response.status === 404
          || /404/.test(normalizedApiError)
          || /not found/.test(normalizedApiError)
          || /invalid parameters?/.test(normalizedApiError);
        if (shouldTryFallback) {
          lastError = apiError || `Failed to fetch ${this.platform} analytics`;
          continue;
        }

        throw new Error(apiError || `Failed to fetch ${this.platform} analytics`);
      }

      const postRecord = findPostRecord(data, platformPostId);
      if (!postRecord) {
        lastError = `Could not resolve ${this.platform} analytics for post ${platformPostId}`;
        continue;
      }

      return mapAnalyticsFromPostRecord(postRecord);
    }

    const normalizedLastError = (lastError || '').toLowerCase();
    if (
      normalizedLastError.includes('404')
      || normalizedLastError.includes('non-json')
      || normalizedLastError.includes('html')
      || normalizedLastError.includes('failed to fetch')
    ) {
      throw new Error(
        'Iohah analytics API is not implemented on this server yet. Add a JSON metrics endpoint on Iohah and set IOHAH_ANALYTICS_ENDPOINT or IOHAH_ANALYTICS_ENDPOINTS.',
      );
    }

    throw new Error(
      lastError
      || 'Iohah analytics API is unavailable for this API setup. Add a JSON metrics endpoint on Iohah and set IOHAH_ANALYTICS_ENDPOINT or IOHAH_ANALYTICS_ENDPOINTS.',
    );
  }
}
