import type { PlatformType } from '@ee-postmind/shared';
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

function findPostRecord(payload: unknown, platformPostId: string): JsonRecord | null {
  if (!isRecord(payload)) return null;

  const candidates: JsonRecord[] = [payload];
  if (isRecord(payload.post)) candidates.push(payload.post);
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
    return `Provide ${this.platform} credentials as JSON: {"accessToken":"token","serverKey":"server-key"}`;
  }

  private parseCredentials(value: string): { accessToken: string; serverKey: string } {
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
      if (!accessToken || !serverKey) {
        throw new Error();
      }
      return { accessToken, serverKey };
    } catch {
      throw new Error(this.getCredentialFormatMessage());
    }
  }

  private async verifyCredentials(credentials: { accessToken: string; serverKey: string }): Promise<{
    user_id: string | number;
    name?: string;
    avatar?: string;
  }> {
    const params = new URLSearchParams({
      access_token: credentials.accessToken,
      server_key: credentials.serverKey,
      fetch: 'user_data',
    });
    const res = await fetch(`${this.baseUrl}/api/get-user-data?${params.toString()}`);
    const data = await res.json().catch(() => ({})) as {
      user_data?: { user_id?: string | number; name?: string; avatar?: string };
      errors?: { error_text?: string };
      message?: string;
    };
    const userId = data.user_data?.user_id;
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
    await this.verifyCredentials(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(token: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(token);
    await this.verifyCredentials(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const creds = this.parseCredentials(accessToken);
    const data = await this.verifyCredentials(creds);

    return {
      id: data.user_id.toString(),
      name: data.name || this.platform,
      avatar: data.avatar,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const creds = this.parseCredentials(accessToken);

    const formData = new URLSearchParams();
    formData.append('access_token', creds.accessToken);
    formData.append('server_key', creds.serverKey);
    const text = buildPostText(post);
    formData.append('postText', text || post.text);

    const link = typeof post.link === 'string' ? post.link.trim() : '';
    if (link) {
      formData.append('postLink', link);
    }

    const mediaUrl = post.mediaUrls?.[0]?.trim();
    if (mediaUrl) {
      const mediaKind = inferMediaKind(post, mediaUrl);
      formData.append(mediaKind === 'video' ? 'postVideo' : 'postPhoto', mediaUrl);
    }

    const res = await fetch(`${this.baseUrl}/api/create-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    const data = await res.json() as { post_id?: string | number; errors?: { error_text?: string } };
    if (!res.ok || !data.post_id) {
      throw new Error(data.errors?.error_text || `Failed to publish ${this.platform} post`);
    }

    return { platformPostId: data.post_id.toString() };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const creds = this.parseCredentials(accessToken);

    const res = await fetch(
      `${this.baseUrl}/api/get-posts?access_token=${creds.accessToken}&server_key=${creds.serverKey}&post_id=${encodeURIComponent(platformPostId)}`,
    );
    const data = await res.json() as { errors?: { error_text?: string }; message?: string };
    if (!res.ok) {
      throw new Error(data.errors?.error_text || data.message || `Failed to fetch ${this.platform} analytics`);
    }

    const postRecord = findPostRecord(data, platformPostId);
    if (!postRecord) {
      throw new Error(`Could not resolve ${this.platform} analytics for post ${platformPostId}`);
    }

    return mapAnalyticsFromPostRecord(postRecord);
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

    return { platformPostId: data.id.toString() };
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
    super('chrxstians', 'https://chrxstians.com');
  }

  private getCredentialFormatMessage(): string {
    return 'Provide chrxstians credentials as JSON: {"accessToken":"token"}';
  }

  private parseCredentials(value: string): { accessToken: string } {
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
      if (!accessToken) {
        throw new Error();
      }
      return { accessToken };
    } catch {
      throw new Error(this.getCredentialFormatMessage());
    }
  }

  private async verifyCredentials(credentials: { accessToken: string }): Promise<void> {
    await super.getAccountInfo(credentials.accessToken);
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(credentials);
    await this.verifyCredentials(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(token: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(token);
    await this.verifyCredentials(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const parsed = this.parseCredentials(accessToken);
    return super.getAccountInfo(parsed.accessToken);
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const parsed = this.parseCredentials(accessToken);
    return super.publishPost(parsed.accessToken, post);
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const parsed = this.parseCredentials(accessToken);
    return super.getPostAnalytics(parsed.accessToken, platformPostId);
  }
}

export class IohahAdapter extends SngineAdapter {
  constructor() {
    super('iohah', 'https://iohah.com');
  }

  private getCredentialFormatMessage(): string {
    return 'Provide iohah credentials as JSON: {"accessToken":"token"}';
  }

  private parseCredentials(value: string): { accessToken: string } {
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
      if (!accessToken) {
        throw new Error();
      }
      return { accessToken };
    } catch {
      throw new Error(this.getCredentialFormatMessage());
    }
  }

  private async verifyCredentials(credentials: { accessToken: string }): Promise<void> {
    await super.getAccountInfo(credentials.accessToken);
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(credentials);
    await this.verifyCredentials(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(token: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(token);
    await this.verifyCredentials(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const parsed = this.parseCredentials(accessToken);
    return super.getAccountInfo(parsed.accessToken);
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const parsed = this.parseCredentials(accessToken);
    return super.publishPost(parsed.accessToken, post);
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const parsed = this.parseCredentials(accessToken);
    return super.getPostAnalytics(parsed.accessToken, platformPostId);
  }
}
