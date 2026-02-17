import type { PlatformType } from '@ee-postmind/shared';
import type {
  PlatformAdapter,
  PlatformTokens,
  PlatformAccount,
  PlatformPostPayload,
  PlatformPostResult,
} from './base.js';

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

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    // credentials = JSON.stringify({ accessToken, serverKey })
    return { accessToken: credentials };
  }

  async refreshAccessToken(token: string): Promise<PlatformTokens> {
    return { accessToken: token };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    let creds: { accessToken: string; serverKey: string };
    try {
      creds = JSON.parse(accessToken);
    } catch {
      return { id: '', name: this.platform };
    }

    const res = await fetch(`${this.baseUrl}/api/get-user-data?access_token=${creds.accessToken}&server_key=${creds.serverKey}&fetch=user_data`);
    const data = await res.json() as any;
    return {
      id: data.user_data?.user_id || '',
      name: data.user_data?.name || this.platform,
      avatar: data.user_data?.avatar,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    let creds: { accessToken: string; serverKey: string };
    try {
      creds = JSON.parse(accessToken);
    } catch {
      return { platformPostId: '' };
    }

    const formData = new URLSearchParams();
    formData.append('access_token', creds.accessToken);
    formData.append('server_key', creds.serverKey);
    formData.append('postText', post.text);

    const res = await fetch(`${this.baseUrl}/api/create-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    const data = await res.json() as any;
    return { platformPostId: data.post_id?.toString() || '' };
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
    const data = await res.json() as any;
    return {
      id: data.id?.toString() || '',
      name: data.name || this.platform,
      username: data.username,
      avatar: data.avatar,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const res = await fetch(`${this.baseUrl}/api/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: post.text }),
    });
    const data = await res.json() as any;
    return { platformPostId: data.id?.toString() || '' };
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
}

export class IohahAdapter extends SngineAdapter {
  constructor() {
    super('iohah', 'https://iohah.com');
  }
}
