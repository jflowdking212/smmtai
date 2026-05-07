import type { PlatformType } from '@ee-postmind/shared';
import type {
  PlatformAdapter,
  PlatformTokens,
  PlatformAccount,
  PlatformPostPayload,
  PlatformPostResult,
  PlatformAnalytics,
} from './base.js';

function toMetricNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

// ============================================================
// Bluesky — AT Protocol
// ============================================================

export class BlueskyAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'bluesky';

  private parseCredentials(value: string): { identifier: string; password: string } {
    try {
      const parsed = JSON.parse(value) as { identifier?: string; password?: string };
      const identifier = typeof parsed.identifier === 'string' ? parsed.identifier.trim() : '';
      const password = typeof parsed.password === 'string' ? parsed.password.trim() : '';
      if (!identifier || !password) {
        throw new Error();
      }
      return { identifier, password };
    } catch {
      throw new Error('Provide Bluesky credentials as JSON: {"identifier":"you.bsky.social","password":"app-password"}');
    }
  }

  private async createSession(credentials: { identifier: string; password: string }): Promise<{
    accessJwt: string;
    did: string;
    handle?: string;
    avatar?: string;
  }> {
    const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: credentials.identifier, password: credentials.password }),
    });
    const data = await res.json().catch(() => ({})) as {
      accessJwt?: string;
      did?: string;
      handle?: string;
      avatar?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok || !data.accessJwt || !data.did) {
      throw new Error(data.message || data.error || 'Could not verify Bluesky credentials');
    }
    return {
      accessJwt: data.accessJwt,
      did: data.did,
      handle: data.handle,
      avatar: data.avatar,
    };
  }

  private async uploadImageBlob(
    accessJwt: string,
    mediaUrl: string,
  ): Promise<Record<string, unknown>> {
    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) {
      throw new Error(`Unable to fetch media for Bluesky upload (${mediaRes.status})`);
    }

    const contentType = (mediaRes.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      throw new Error('Bluesky currently supports image attachments only');
    }

    const mediaBuffer = await mediaRes.arrayBuffer();
    const uploadRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        'Content-Type': contentType || 'application/octet-stream',
      },
      body: mediaBuffer,
    });
    const uploadData = await uploadRes.json() as {
      blob?: Record<string, unknown>;
      message?: string;
      error?: string;
    };
    if (!uploadRes.ok || !uploadData.blob) {
      throw new Error(uploadData.message || uploadData.error || 'Failed to upload Bluesky media');
    }

    return uploadData.blob;
  }

  getAuthUrl(_state: string): string {
    // Bluesky uses app passwords, not OAuth — redirect to settings page
    return '/connections/bluesky/setup';
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(credentials);
    await this.createSession(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(refreshToken);
    await this.createSession(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const creds = this.parseCredentials(accessToken);
    const session = await this.createSession(creds);
    return { id: session.did, name: session.handle || creds.identifier, avatar: session.avatar };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const creds = this.parseCredentials(accessToken);
    const mediaUrls = (post.mediaUrls || [])
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      .slice(0, 4);
    if (post.mediaType === 'video' && mediaUrls.length > 0) {
      throw new Error('Bluesky currently supports image attachments only');
    }
    const altTexts = Array.isArray(post.metadata?.altTexts) ? post.metadata.altTexts : [];

    const session = await this.createSession(creds);

    const uploadedImages: Array<{ image: Record<string, unknown>; alt: string }> = [];
    for (let i = 0; i < mediaUrls.length; i += 1) {
      const blob = await this.uploadImageBlob(session.accessJwt, mediaUrls[i]);
      uploadedImages.push({
        image: blob,
        alt: typeof altTexts[i] === 'string' ? altTexts[i] : '',
      });
    }

    const record: Record<string, unknown> = {
      text: post.text,
      createdAt: new Date().toISOString(),
      $type: 'app.bsky.feed.post',
    };
    if (uploadedImages.length > 0) {
      record.embed = {
        $type: 'app.bsky.embed.images',
        images: uploadedImages,
      };
    }

    // Create post
    const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });
    const data = await res.json() as { uri?: string; message?: string };
    if (!res.ok || !data.uri) {
      throw new Error(data.message || 'Failed to publish Bluesky post');
    }

    return {
      platformPostId: data.uri,
      url: `https://bsky.app/profile/${session.handle || creds.identifier}/post/${data.uri.split('/').pop()}`,
    };
  }

  async getPostAnalytics(_accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(platformPostId)}`,
    );
    const data = await res.json() as {
      posts?: Array<{
        uri?: string;
        likeCount?: number;
        replyCount?: number;
        repostCount?: number;
        quoteCount?: number;
      }>;
      message?: string;
      error?: string;
    };

    const post = data.posts?.[0];
    if (!res.ok || !post?.uri) {
      throw new Error(data.message || data.error || 'Failed to fetch Bluesky analytics');
    }

    const reposts = toMetricNumber(post.repostCount);
    const quotes = toMetricNumber(post.quoteCount);
    return {
      impressions: 0,
      reach: 0,
      likes: toMetricNumber(post.likeCount),
      comments: toMetricNumber(post.replyCount),
      shares: reposts + quotes,
      clicks: 0,
      saves: 0,
      metadata: {
        reposts,
        quotes,
      },
    };
  }
}

// ============================================================
// Mastodon — REST API + OAuth2
// ============================================================

export class MastodonAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'mastodon';

  private normalizeInstanceUrl(value?: string): string {
    const fallback = process.env.MASTODON_INSTANCE_URL || 'https://mastodon.social';
    const candidate = value?.trim() || fallback;
    return candidate.replace(/\/+$/, '');
  }

  private parseCredentialPayload(value: string): { accessToken: string; instanceUrl: string } {
    const token = value.trim();
    if (!token) {
      throw new Error('Provide a Mastodon access token');
    }
    if (!token.startsWith('{')) {
      return { accessToken: token, instanceUrl: this.normalizeInstanceUrl() };
    }

    try {
      const parsed = JSON.parse(token) as { accessToken?: string; token?: string; instanceUrl?: string };
      const accessToken = (parsed.accessToken || parsed.token || '').trim();
      if (!accessToken) {
        throw new Error();
      }
      return {
        accessToken,
        instanceUrl: this.normalizeInstanceUrl(parsed.instanceUrl),
      };
    } catch {
      throw new Error('Provide Mastodon credentials as JSON: {"instanceUrl":"https://mastodon.social","accessToken":"token"}');
    }
  }

  private async verifyCredentials(
    credentials: { accessToken: string; instanceUrl: string },
  ): Promise<{
    id: string;
    display_name?: string;
    username?: string;
    acct?: string;
    avatar?: string;
  }> {
    const res = await fetch(`${credentials.instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    const data = await res.json().catch(() => ({})) as {
      id?: string;
      display_name?: string;
      username?: string;
      acct?: string;
      avatar?: string;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.id) {
      throw new Error(data.error || data.error_description || 'Could not verify Mastodon credentials');
    }

    return {
      id: data.id,
      display_name: data.display_name,
      username: data.username,
      acct: data.acct,
      avatar: data.avatar,
    };
  }

  private inferMediaFilename(mediaUrl: string, index: number, contentType: string): string {
    try {
      const pathname = new URL(mediaUrl).pathname;
      const candidate = pathname.split('/').pop();
      if (candidate && candidate.includes('.')) return candidate;
    } catch {
      // ignore and fallback
    }

    if (contentType.includes('image/')) {
      const extension = contentType.split('/')[1]?.split(';')[0] || 'jpg';
      return `mastodon-image-${index + 1}.${extension}`;
    }
    if (contentType.includes('video/')) {
      const extension = contentType.split('/')[1]?.split(';')[0] || 'mp4';
      return `mastodon-video-${index + 1}.${extension}`;
    }
    return `mastodon-media-${index + 1}.bin`;
  }

  private async uploadMedia(
    instanceUrl: string,
    accessToken: string,
    mediaUrl: string,
    index: number,
  ): Promise<string> {
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Unable to fetch Mastodon media (${mediaResponse.status})`);
    }
    const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';
    const mediaBuffer = await mediaResponse.arrayBuffer();
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([mediaBuffer], { type: contentType }),
      this.inferMediaFilename(mediaUrl, index, contentType),
    );

    const uploadRes = await fetch(`${instanceUrl}/api/v2/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const uploadData = await uploadRes.json() as { id?: string; error?: string };
    if (!uploadRes.ok || !uploadData.id) {
      throw new Error(uploadData.error || 'Failed to upload Mastodon media');
    }

    return uploadData.id;
  }

  getAuthUrl(state: string): string {
    const instanceUrl = this.normalizeInstanceUrl();
    const params = new URLSearchParams({
      client_id: process.env.MASTODON_CLIENT_ID || '',
      redirect_uri: process.env.MASTODON_REDIRECT_URI || '',
      response_type: 'code',
      scope: 'read write push',
      state,
    });
    return `${instanceUrl}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentialPayload(credentials);
    await this.verifyCredentials(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentialPayload(refreshToken);
    await this.verifyCredentials(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const creds = this.parseCredentialPayload(accessToken);
    const data = await this.verifyCredentials(creds);

    return {
      id: data.id,
      name: data.display_name || data.username || data.acct || 'Mastodon',
      username: data.acct,
      avatar: data.avatar,
      metadata: { instanceUrl: creds.instanceUrl },
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const creds = this.parseCredentialPayload(accessToken);
    const instanceUrl = creds.instanceUrl;
    const mediaUrls = (post.mediaUrls || []).filter((url) => typeof url === 'string' && url.trim().length > 0).slice(0, 4);
    const mediaIds: string[] = [];
    for (let i = 0; i < mediaUrls.length; i += 1) {
      mediaIds.push(await this.uploadMedia(instanceUrl, creds.accessToken, mediaUrls[i], i));
    }

    const payload: Record<string, unknown> = { status: post.text };
    if (mediaIds.length > 0) {
      payload.media_ids = mediaIds;
    }
    const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { id?: string; url?: string; error?: string };
    if (!res.ok || !data.id) {
      throw new Error(data.error || 'Failed to publish Mastodon post');
    }

    return { platformPostId: data.id, url: data.url };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const creds = this.parseCredentialPayload(accessToken);
    const instanceUrl = creds.instanceUrl;
    const res = await fetch(`${instanceUrl}/api/v1/statuses/${encodeURIComponent(platformPostId)}`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    const data = await res.json() as {
      id?: string;
      replies_count?: number;
      reblogs_count?: number;
      favourites_count?: number;
      error?: string;
    };
    if (!res.ok || !data.id) {
      throw new Error(data.error || 'Failed to fetch Mastodon analytics');
    }

    return {
      impressions: 0,
      reach: 0,
      likes: toMetricNumber(data.favourites_count),
      comments: toMetricNumber(data.replies_count),
      shares: toMetricNumber(data.reblogs_count),
      clicks: 0,
      saves: 0,
    };
  }
}

// ============================================================
// Telegram — Bot API
// ============================================================

export class TelegramAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'telegram';

  private parseCredentials(value: string): { botToken: string; chatId?: string } {
    const token = value.trim();
    if (!token) {
      throw new Error('Provide a Telegram bot token');
    }
    if (!token.startsWith('{')) {
      return { botToken: token };
    }

    try {
      const parsed = JSON.parse(token) as {
        botToken?: string;
        accessToken?: string;
        token?: string;
        chatId?: string | number;
        channelId?: string | number;
        channelUsername?: string;
      };
      const botToken = (parsed.botToken || parsed.accessToken || parsed.token || '').trim();
      if (!botToken) {
        throw new Error();
      }
      const rawChatId = parsed.chatId ?? parsed.channelId ?? parsed.channelUsername;
      const chatId = rawChatId === undefined || rawChatId === null
        ? undefined
        : String(rawChatId).trim();

      return chatId ? { botToken, chatId } : { botToken };
    } catch {
      throw new Error('Provide Telegram credentials as JSON: {"botToken":"123456:ABC","chatId":"@mychannel"}');
    }
  }

  private async verifyBotToken(
    credentials: { botToken: string },
  ): Promise<{ id: number; first_name?: string; username?: string }> {
    const res = await fetch(`https://api.telegram.org/bot${credentials.botToken}/getMe`);
    const data = await res.json().catch(() => ({})) as {
      ok?: boolean;
      result?: { id?: number; first_name?: string; username?: string };
      description?: string;
    };
    if (!res.ok || !data.ok || !data.result?.id) {
      throw new Error(data.description || 'Could not verify Telegram bot token');
    }
    return {
      id: data.result.id,
      first_name: data.result.first_name,
      username: data.result.username,
    };
  }

  private resolveMediaMethod(mediaUrl: string, explicitType?: PlatformPostPayload['mediaType']): 'sendPhoto' | 'sendVideo' {
    if (explicitType === 'video') return 'sendVideo';
    if (explicitType === 'image') return 'sendPhoto';
    const normalized = mediaUrl.split('?')[0].toLowerCase();
    if (/\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv)$/i.test(normalized)) {
      return 'sendVideo';
    }
    return 'sendPhoto';
  }

  getAuthUrl(_state: string): string {
    return '/connections/telegram/setup';
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(credentials);
    await this.verifyBotToken(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const parsed = this.parseCredentials(refreshToken);
    await this.verifyBotToken(parsed);
    const tokenPayload = JSON.stringify(parsed);
    return { accessToken: tokenPayload, refreshToken: tokenPayload };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const creds = this.parseCredentials(accessToken);
    const data = await this.verifyBotToken(creds);

    return {
      id: data.id.toString(),
      name: data.first_name || data.username || 'Telegram Bot',
      username: data.username,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const creds = this.parseCredentials(accessToken);
    const postChatId = post.metadata?.chatId;
    const chatId = (
      (typeof postChatId === 'string' && postChatId.trim())
        ? postChatId.trim()
        : typeof postChatId === 'number' && Number.isFinite(postChatId)
          ? postChatId.toString()
        : creds.chatId || ''
    );
    if (!chatId) {
      throw new Error('Telegram publish requires a chat ID or channel username');
    }

    const mediaUrl = post.mediaUrls?.[0];
    const postText = typeof post.text === 'string' ? post.text : '';
    const method = mediaUrl ? this.resolveMediaMethod(mediaUrl, post.mediaType) : 'sendMessage';
    const requestBody = method === 'sendMessage'
      ? {
        chat_id: chatId,
        text: postText,
        parse_mode: 'HTML',
      }
      : method === 'sendVideo'
        ? {
          chat_id: chatId,
          video: mediaUrl,
          caption: postText,
          parse_mode: 'HTML',
        }
        : {
          chat_id: chatId,
          photo: mediaUrl,
          caption: postText,
          parse_mode: 'HTML',
        };

    const res = await fetch(`https://api.telegram.org/bot${creds.botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const data = await res.json() as {
      ok?: boolean;
      result?: { message_id?: number | string };
      description?: string;
    };
    const messageId = data.result?.message_id;
    if (!res.ok || !data.ok || messageId === undefined || messageId === null) {
      const description = data.description || 'Failed to send Telegram message';
      const isMediaUrlFetchError = !!mediaUrl && /(failed to get http url content|wrong type of the web page content)/i.test(description);

      if (isMediaUrlFetchError) {
        const fallbackText = [postText.trim(), mediaUrl]
          .filter((value) => value.length > 0)
          .join('\n\n');
        const fallbackRes = await fetch(`https://api.telegram.org/bot${creds.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: fallbackText,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
        });
        const fallbackData = await fallbackRes.json().catch(() => ({})) as {
          ok?: boolean;
          result?: { message_id?: number | string };
          description?: string;
        };
        const fallbackMessageId = fallbackData.result?.message_id;
        if (fallbackRes.ok && fallbackData.ok && fallbackMessageId !== undefined && fallbackMessageId !== null) {
          return { platformPostId: fallbackMessageId.toString() };
        }

        const fallbackDescription = fallbackData.description || 'Failed to send Telegram message';
        throw new Error(`${description}; text fallback failed (${fallbackDescription})`);
      }

      throw new Error(description);
    }

    return { platformPostId: messageId.toString() };
  }
}
