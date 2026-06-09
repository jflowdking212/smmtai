import type { PlatformType } from '@ee-postmind/shared';
import type {
  PlatformAdapter,
  PlatformTokens,
  PlatformAccount,
  PlatformPostPayload,
  PlatformPostResult,
  PlatformAnalytics,
} from './base.js';
import { MastodonAdapter } from './new.js';

// ============================================================
// 1. Threads (by Meta) — Graph API
// ============================================================
// Helper to poll Threads container processing status (required for video posts)
async function waitForThreadsContainer(containerId: string, accessToken: string, maxRetries = 15): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 3000)); // wait 3s between checks
    const res = await fetch(`https://graph.threads.net/v1.0/${containerId}?fields=status_code,error_message&access_token=${accessToken}`);
    const data = await res.json() as any;
    const status = data.status_code;
    console.log(`[Threads] container ${containerId} status: ${status} (attempt ${i + 1})`);
    if (status === 'FINISHED') return;
    if (status === 'ERROR') {
      throw new Error(`Threads media container failed: ${data.error_message || 'Unknown processing error'}`);
    }
  }
  throw new Error('Threads media container processing timed out');
}

export class ThreadsAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'threads';

  getAuthUrl(state: string): string {
    const clientId = process.env.THREADS_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(process.env.THREADS_REDIRECT_URI || 'https://smmtai.com/api/v1/connections/threads/callback');
    return `https://threads.net/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=threads_basic,threads_content_publish,threads_manage_insights&response_type=code&state=${state}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const clientId = process.env.THREADS_CLIENT_ID || '';
    const clientSecret = process.env.THREADS_CLIENT_SECRET || '';
    const redirectUri = process.env.THREADS_REDIRECT_URI || 'https://smmtai.com/api/v1/connections/threads/callback';
    
    const res = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error_message || 'Threads token exchange failed');
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return { accessToken: refreshToken };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch(`https://graph.threads.net/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`);
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch Threads account info');
    return {
      id: data.id,
      name: data.username,
      username: data.username,
      avatar: data.threads_profile_picture_url,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const mediaUrl = post.mediaUrls?.[0]?.trim();
    const hasMedia = !!mediaUrl;
    const isVideo = hasMedia && (post.mediaType === 'video' || /\.(mp4|mov|avi|webm|m4v|mkv)(\?.*)?$/i.test(mediaUrl));

    const body = new URLSearchParams();
    if (hasMedia) {
      if (isVideo) {
        body.set('media_type', 'VIDEO');
        body.set('video_url', mediaUrl);
      } else {
        body.set('media_type', 'IMAGE');
        body.set('image_url', mediaUrl);
      }
      if (post.text) {
        body.set('text', post.text);
      }
    } else {
      body.set('media_type', 'TEXT');
      body.set('text', post.text || '');
    }

    const createRes = await fetch(`https://graph.threads.net/v1.0/me/threads?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const createData = await createRes.json() as any;
    if (!createRes.ok || !createData.id) {
      throw new Error(createData.error?.message || 'Failed to create Threads media container');
    }

    // Wait for container processing if media is attached (crucial for video encoding)
    if (hasMedia) {
      await waitForThreadsContainer(createData.id, accessToken);
    }

    const publishRes = await fetch(`https://graph.threads.net/v1.0/me/threads_publish?creation_id=${createData.id}&access_token=${accessToken}`, {
      method: 'POST',
    });
    const publishData = await publishRes.json() as any;
    if (!publishRes.ok || !publishData.id) {
      throw new Error(publishData.error?.message || 'Failed to publish Threads container');
    }

    return {
      platformPostId: publishData.id,
      url: `https://threads.net/@placeholder/post/${publishData.id}`,
    };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    try {
      const res = await fetch(`https://graph.threads.net/v1.0/${platformPostId}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${accessToken}`);
      const data = await res.json() as any;
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to fetch Threads post insights');
      }

      const getMetric = (metricName: string): number => {
        const metric = data?.data?.find((item: any) => item?.name === metricName);
        const rawValue = metric?.values?.[0]?.value ?? metric?.value ?? 0;
        return typeof rawValue === 'number' ? rawValue : 0;
      };

      const views = getMetric('views');
      const likes = getMetric('likes');
      const replies = getMetric('replies');
      const reposts = getMetric('reposts');
      const quotes = getMetric('quotes');
      const shares = getMetric('shares');

      return {
        impressions: views,
        reach: views,
        likes,
        comments: replies,
        shares: reposts + shares,
        clicks: 0,
        saves: 0,
        metadata: data,
      };
    } catch (error: any) {
      console.error(`[Threads] getPostAnalytics error:`, error);
      return {
        impressions: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        saves: 0,
        metadata: { error: error.message },
      };
    }
  }
}

// ============================================================
// 2. Reddit — Reddit API
// ============================================================
export class RedditAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'reddit';

  getAuthUrl(state: string): string {
    const clientId = process.env.REDDIT_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(process.env.REDDIT_REDIRECT_URI || '');
    return `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${redirectUri}&duration=permanent&scope=identity,submit,read`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const clientId = process.env.REDDIT_CLIENT_ID || '';
    const clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    const redirectUri = process.env.REDDIT_REDIRECT_URI || '';
    
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SmmtAI/1.0.0',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok || data.error) throw new Error(data.error || 'Reddit token exchange failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const clientId = process.env.REDDIT_CLIENT_ID || '';
    const clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SmmtAI/1.0.0',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok || data.error) throw new Error(data.error || 'Reddit token refresh failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'SmmtAI/1.0.0',
      },
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.message || 'Failed to fetch Reddit user info');
    return {
      id: data.id || data.name,
      name: data.name,
      username: data.name,
      avatar: data.icon_img,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const subreddit = typeof post.metadata?.subreddit === 'string' ? post.metadata.subreddit : 'test';
    const title = typeof post.metadata?.title === 'string' ? post.metadata.title : (post.text.substring(0, 100) || 'Untitled Post');
    
    const params: Record<string, string> = {
      sr: subreddit,
      kind: post.link ? 'link' : 'self',
      title,
      api_type: 'json',
    };
    if (post.link) {
      params.url = post.link;
    } else {
      params.text = post.text;
    }

    const res = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SmmtAI/1.0.0',
      },
      body: new URLSearchParams(params),
    });
    const data = await res.json() as any;
    if (!res.ok || data.json?.errors?.length > 0) {
      const errorMsg = data.json?.errors?.[0]?.join(': ') || 'Failed to submit Reddit post';
      throw new Error(errorMsg);
    }
    const postId = data.json?.data?.id;
    const postUrl = data.json?.data?.url;
    return {
      platformPostId: postId || 'unknown',
      url: postUrl || `https://reddit.com${data.json?.data?.name}`,
    };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };
  }
}

// ============================================================
// 3. Tumblr — Tumblr API
// ============================================================
export class TumblrAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'tumblr';

  getAuthUrl(state: string): string {
    const clientId = process.env.TUMBLR_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(process.env.TUMBLR_REDIRECT_URI || '');
    return `https://www.tumblr.com/oauth2/authorize?client_id=${clientId}&response_type=code&scope=basic+write&state=${state}&redirect_uri=${redirectUri}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const clientId = process.env.TUMBLR_CLIENT_ID || '';
    const clientSecret = process.env.TUMBLR_CLIENT_SECRET || '';
    const redirectUri = process.env.TUMBLR_REDIRECT_URI || '';
    
    const res = await fetch('https://api.tumblr.com/v2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error_description || 'Tumblr token exchange failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const clientId = process.env.TUMBLR_CLIENT_ID || '';
    const clientSecret = process.env.TUMBLR_CLIENT_SECRET || '';
    
    const res = await fetch('https://api.tumblr.com/v2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error_description || 'Tumblr token refresh failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://api.tumblr.com/v2/user/info', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.meta?.msg || 'Failed to fetch Tumblr account info');
    const user = data.response.user;
    return {
      id: user.name,
      name: user.name,
      username: user.name,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const info = await this.getAccountInfo(accessToken);
    const blogIdentifier = post.metadata?.blogName || info.name;
    
    const res = await fetch(`https://api.tumblr.com/v2/blog/${blogIdentifier}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'text',
        body: post.text,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.meta?.msg || 'Tumblr publishing failed');
    return {
      platformPostId: data.response.id.toString(),
      url: `https://${blogIdentifier}.tumblr.com/post/${data.response.id}`,
    };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };
  }
}

// ============================================================
// 4. Google Business Profile — Google Business API
// ============================================================
export class GoogleBusinessAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'google_business';

  getAuthUrl(state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || '');
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/business.manage&state=${state}&access_type=offline&prompt=consent`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
    
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error_description || 'Google Business token exchange failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error_description || 'Google Business token refresh failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch Google Business accounts');
    const account = data.accounts?.[0] || { name: 'Google Business Account', accountName: 'unknown' };
    return {
      id: account.name,
      name: account.accountName || 'Google Business Profile',
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const locationId = post.metadata?.locationId || 'locations/primary';
    
    const res = await fetch(`https://mybusinesslocalpost.googleapis.com/v1/${locationId}/localPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        languageCode: 'en-US',
        summary: post.text,
        topicType: 'STANDARD',
        ...(post.link ? {
          callToAction: {
            actionType: 'LEARN_MORE',
            url: post.link,
          }
        } : {}),
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || 'Google Business post creation failed');
    return {
      platformPostId: data.name,
      url: data.searchUrl || 'https://business.google.com',
    };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };
  }
}

// ============================================================
// 5. Discord — Webhook / Bot
// ============================================================
export class DiscordAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'discord';

  getAuthUrl(state: string): string {
    return '/connections/discord/setup';
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    return { accessToken: credentials };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return { accessToken: refreshToken };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    if (accessToken.startsWith('http')) {
      return { id: 'webhook', name: 'Discord Webhook' };
    }
    return { id: 'discord-bot', name: 'Discord Bot' };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const url = accessToken.startsWith('http') ? accessToken : process.env.DISCORD_WEBHOOK_URL || '';
    if (!url) throw new Error('No Discord Webhook URL provided');
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: post.text,
        embeds: post.link ? [{ url: post.link, title: post.link }] : undefined,
      }),
    });
    if (!res.ok) throw new Error(`Discord post failed: ${res.statusText}`);
    return { platformPostId: 'webhook-post' };
  }
}

// ============================================================
// 6. Slack — Webhook / Bot
// ============================================================
export class SlackAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'slack';

  getAuthUrl(state: string): string {
    return '/connections/slack/setup';
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    return { accessToken: credentials };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return { accessToken: refreshToken };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    if (accessToken.startsWith('http')) {
      return { id: 'webhook', name: 'Slack Webhook' };
    }
    return { id: 'slack-bot', name: 'Slack Workspace' };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const url = accessToken.startsWith('http') ? accessToken : process.env.SLACK_WEBHOOK_URL || '';
    if (!url) throw new Error('No Slack Webhook URL provided');
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: post.text,
      }),
    });
    if (!res.ok) throw new Error(`Slack post failed: ${res.statusText}`);
    return { platformPostId: 'webhook-post' };
  }
}

// ============================================================
// 7. WordPress — Self-Hosted REST API
// ============================================================
export class WordPressAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'wordpress';

  getAuthUrl(state: string): string {
    return '/connections/wordpress/setup';
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    return { accessToken: credentials };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return { accessToken: refreshToken };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    try {
      const parsed = JSON.parse(accessToken);
      return { id: parsed.url, name: `WordPress Site: ${parsed.url}` };
    } catch {
      return { id: 'wordpress', name: 'WordPress Site' };
    }
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    let siteUrl = '';
    let username = '';
    let appPassword = '';
    
    try {
      const parsed = JSON.parse(accessToken);
      siteUrl = parsed.url;
      username = parsed.username;
      appPassword = parsed.password;
    } catch {
      throw new Error('Provide WordPress credentials as JSON: {"url":"https://example.com","username":"admin","password":"app-pass-word"}');
    }
    
    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
    const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: post.metadata?.title || post.text.substring(0, 50) || 'New Post',
        content: post.text,
        status: 'publish',
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.message || 'WordPress post creation failed');
    return {
      platformPostId: data.id.toString(),
      url: data.link,
    };
  }
}

// ============================================================
// 8. Medium — Medium API
// ============================================================
export class MediumAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'medium';

  getAuthUrl(state: string): string {
    return '/connections/medium/setup';
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    return { accessToken: credentials };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return { accessToken: refreshToken };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://api.medium.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.errors?.[0]?.message || 'Medium verify failed');
    return {
      id: data.data.id,
      name: data.data.name,
      username: data.data.username,
      avatar: data.data.imageUrl,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const me = await this.getAccountInfo(accessToken);
    const res = await fetch(`https://api.medium.com/v1/users/${me.id}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: post.metadata?.title || post.text.substring(0, 50) || 'New Post',
        contentFormat: 'html',
        content: `<p>${post.text.replace(/\n/g, '<br>')}</p>`,
        publishStatus: 'public',
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.errors?.[0]?.message || 'Medium publishing failed');
    return {
      platformPostId: data.data.id,
      url: data.data.url,
    };
  }
}

// ============================================================
// 9. Blogger — Blogger API
// ============================================================
export class BloggerAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'blogger';

  getAuthUrl(state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || '');
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/blogger&state=${state}&access_type=offline&prompt=consent`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
    
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error_description || 'Blogger token exchange failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error_description || 'Blogger token refresh failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://www.googleapis.com/blogger/v3/users/self', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch Blogger user info');
    return {
      id: data.id,
      name: data.displayName,
      username: data.displayName,
      avatar: data.url,
    };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const blogId = post.metadata?.blogId;
    if (!blogId) throw new Error('Blogger publishing requires blogId in post metadata');
    
    const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'blogger#post',
        title: post.metadata?.title || post.text.substring(0, 50) || 'New Blogger Post',
        content: `<p>${post.text.replace(/\n/g, '<br>')}</p>`,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || 'Blogger post creation failed');
    return {
      platformPostId: data.id,
      url: data.url,
    };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };
  }
}

// ============================================================
// 10. Truth Social — Mastodon-compatible API
// ============================================================
export class TruthSocialAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'truth_social';
  private delegate = new MastodonAdapter();

  getAuthUrl(state: string): string {
    return this.delegate.getAuthUrl(state);
  }

  async exchangeCode(code: string, context?: any): Promise<PlatformTokens> {
    return this.delegate.exchangeCode(code);
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return this.delegate.refreshAccessToken(refreshToken);
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const info = await this.delegate.getAccountInfo(accessToken);
    return { ...info, id: info.id, name: info.name };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    return this.delegate.publishPost(accessToken, post);
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    if (this.delegate.getPostAnalytics) {
      return this.delegate.getPostAnalytics(accessToken, platformPostId);
    }
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };
  }
}

// ============================================================
// 11. Lemmy — REST API / JSON-RPC
// ============================================================
export class LemmyAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'lemmy';

  getAuthUrl(state: string): string {
    return '/connections/lemmy/setup';
  }

  async exchangeCode(credentials: string): Promise<PlatformTokens> {
    return { accessToken: credentials };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return { accessToken: refreshToken };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    try {
      const parsed = JSON.parse(accessToken);
      return { id: parsed.username, name: `Lemmy User: ${parsed.username}` };
    } catch {
      return { id: 'lemmy', name: 'Lemmy Account' };
    }
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    let instanceUrl = '';
    let username = '';
    let password = '';
    
    try {
      const parsed = JSON.parse(accessToken);
      instanceUrl = parsed.instanceUrl.replace(/\/+$/, '');
      username = parsed.username;
      password = parsed.password;
    } catch {
      throw new Error('Provide Lemmy credentials as JSON: {"instanceUrl":"https://lemmy.ml","username":"myuser","password":"mypassword"}');
    }
    
    // 1. Auth / Login to get JWT
    const loginRes = await fetch(`${instanceUrl}/api/v3/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_or_email: username, password }),
    });
    const loginData = await loginRes.json() as any;
    if (!loginRes.ok || !loginData.jwt) {
      throw new Error(loginData.error || 'Lemmy login failed');
    }
    const jwt = loginData.jwt;
    
    // 2. Publish post (Lemmy community target)
    const communityId = post.metadata?.communityId || 1; // Default/Test community
    const title = post.metadata?.title || post.text.substring(0, 50) || 'New Lemmy Post';
    
    const postRes = await fetch(`${instanceUrl}/api/v3/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        name: title,
        community_id: communityId,
        body: post.text,
        url: post.link || undefined,
        auth: jwt,
      }),
    });
    const postData = await postRes.json() as any;
    if (!postRes.ok) throw new Error(postData.error || 'Lemmy post creation failed');
    return {
      platformPostId: postData.post_view.post.id.toString(),
      url: postData.post_view.post.ap_id,
    };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };
  }
}

// ============================================================
// 12. Pleroma — Mastodon-compatible API
// ============================================================
export class PleromaAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'pleroma';
  private delegate = new MastodonAdapter();

  getAuthUrl(state: string): string {
    return this.delegate.getAuthUrl(state);
  }

  async exchangeCode(code: string, context?: any): Promise<PlatformTokens> {
    return this.delegate.exchangeCode(code);
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    return this.delegate.refreshAccessToken(refreshToken);
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const info = await this.delegate.getAccountInfo(accessToken);
    return { ...info, id: info.id, name: info.name };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    return this.delegate.publishPost(accessToken, post);
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    if (this.delegate.getPostAnalytics) {
      return this.delegate.getPostAnalytics(accessToken, platformPostId);
    }
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };
  }
}
