import type { PlatformType } from '@ee-postmind/shared';
import type {
  PlatformAdapter,
  PlatformTokens,
  PlatformAccount,
  PlatformPostPayload,
  PlatformPostResult,
} from './base.js';

// ============================================================
// Bluesky — AT Protocol
// ============================================================

export class BlueskyAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'bluesky';

  getAuthUrl(_state: string): string {
    // Bluesky uses app passwords, not OAuth — redirect to settings page
    return '/connections/bluesky/setup';
  }

  async exchangeCode(appPassword: string): Promise<PlatformTokens> {
    // For Bluesky, "code" is actually the app password
    // We create a session with identifier + app password
    return { accessToken: appPassword };
  }

  async refreshAccessToken(_refreshToken: string): Promise<PlatformTokens> {
    // Bluesky sessions can be refreshed
    return { accessToken: '' };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    // accessToken contains JSON: { identifier, password }
    let creds: { identifier: string; password: string };
    try {
      creds = JSON.parse(accessToken);
    } catch {
      return { id: '', name: 'Bluesky' };
    }

    const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: creds.identifier, password: creds.password }),
    });
    const data = await res.json() as any;
    return { id: data.did, name: data.handle, avatar: data.avatar };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    let creds: { identifier: string; password: string };
    try {
      creds = JSON.parse(accessToken);
    } catch {
      return { platformPostId: '' };
    }

    // Create session
    const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: creds.identifier, password: creds.password }),
    });
    const session = await sessionRes.json() as any;

    // Create post
    const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record: { text: post.text, createdAt: new Date().toISOString(), $type: 'app.bsky.feed.post' },
      }),
    });
    const data = await res.json() as any;
    return { platformPostId: data.uri, url: `https://bsky.app/profile/${session.handle}/post/${data.uri?.split('/').pop()}` };
  }
}

// ============================================================
// Mastodon — REST API + OAuth2
// ============================================================

export class MastodonAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'mastodon';

  // Mastodon requires the instance URL — stored in connection metadata
  private getInstanceUrl(metadata?: Record<string, unknown>): string {
    return (metadata?.instanceUrl as string) || 'https://mastodon.social';
  }

  getAuthUrl(state: string): string {
    // Instance URL is passed via state as JSON
    let instanceUrl = 'https://mastodon.social';
    try {
      const parsed = JSON.parse(state);
      instanceUrl = parsed.instanceUrl || instanceUrl;
    } catch { /* use default */ }

    return `${instanceUrl}/oauth/authorize?client_id=${process.env.MASTODON_CLIENT_ID || ''}&redirect_uri=${encodeURIComponent(process.env.MASTODON_REDIRECT_URI || '')}&response_type=code&scope=read+write+push&state=${state}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const instanceUrl = 'https://mastodon.social'; // Will be dynamic per connection
    const res = await fetch(`${instanceUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MASTODON_CLIENT_ID,
        client_secret: process.env.MASTODON_CLIENT_SECRET,
        redirect_uri: process.env.MASTODON_REDIRECT_URI,
        grant_type: 'authorization_code',
        code,
      }),
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token };
  }

  async refreshAccessToken(_refreshToken: string): Promise<PlatformTokens> {
    // Mastodon tokens don't expire by default
    return { accessToken: _refreshToken };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const instanceUrl = 'https://mastodon.social';
    const res = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return { id: data.id, name: data.display_name || data.username, username: data.acct, avatar: data.avatar };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const instanceUrl = 'https://mastodon.social';
    const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: post.text }),
    });
    const data = await res.json() as any;
    return { platformPostId: data.id, url: data.url };
  }
}

// ============================================================
// Telegram — Bot API
// ============================================================

export class TelegramAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'telegram';

  getAuthUrl(_state: string): string {
    return '/connections/telegram/setup';
  }

  async exchangeCode(botToken: string): Promise<PlatformTokens> {
    return { accessToken: botToken };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return { accessToken: refreshToken };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch(`https://api.telegram.org/bot${accessToken}/getMe`);
    const data = await res.json() as any;
    return { id: data.result?.id?.toString(), name: data.result?.first_name, username: data.result?.username };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const chatId = (post.metadata?.chatId as string) || '';
    const res = await fetch(`https://api.telegram.org/bot${accessToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: post.text, parse_mode: 'HTML' }),
    });
    const data = await res.json() as any;
    return { platformPostId: data.result?.message_id?.toString() };
  }
}
