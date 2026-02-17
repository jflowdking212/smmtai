import type { PlatformType } from '@ee-postmind/shared';
import type {
  PlatformAdapter,
  PlatformTokens,
  PlatformAccount,
  PlatformPostPayload,
  PlatformPostResult,
  PlatformAnalytics,
} from './base.js';

// ============================================================
// Facebook / Instagram (Graph API)
// ============================================================

export class FacebookAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'facebook';
  private clientId = process.env.FACEBOOK_APP_ID || '';
  private clientSecret = process.env.FACEBOOK_APP_SECRET || '';
  private redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:4000/api/v1/connections/facebook/callback';

  getAuthUrl(state: string): string {
    const scopes = 'pages_manage_posts,pages_read_engagement,pages_show_list,read_insights,instagram_basic,instagram_content_publish';
    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${encodeURIComponent(this.redirectUri)}&code=${code}`);
    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${this.clientId}&client_secret=${this.clientSecret}&fb_exchange_token=${refreshToken}`);
    const data = await res.json() as any;
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name,picture&access_token=${accessToken}`);
    const data = await res.json() as any;
    return { id: data.id, name: data.name, avatar: data.picture?.data?.url };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: post.text, link: post.link, access_token: accessToken }),
    });
    const data = await res.json() as any;
    return { platformPostId: data.id, url: `https://facebook.com/${data.id}` };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const res = await fetch(`https://graph.facebook.com/v18.0/${platformPostId}?fields=insights.metric(post_impressions,post_engaged_users,post_reactions_by_type_total)&access_token=${accessToken}`);
    const data = await res.json() as any;
    return { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0, metadata: data };
  }
}

export class InstagramAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'instagram';

  getAuthUrl(state: string): string {
    // Instagram uses the same Facebook OAuth flow
    const fb = new FacebookAdapter();
    return fb.getAuthUrl(state);
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const fb = new FacebookAdapter();
    return fb.exchangeCode(code);
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const fb = new FacebookAdapter();
    return fb.refreshAccessToken(refreshToken);
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    const pages = await res.json() as any;
    const pageId = pages.data?.[0]?.id;
    if (!pageId) return { id: '', name: 'Instagram' };

    const igRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`);
    const igData = await igRes.json() as any;
    const igId = igData.instagram_business_account?.id;

    const profileRes = await fetch(`https://graph.facebook.com/v18.0/${igId}?fields=id,username,profile_picture_url&access_token=${accessToken}`);
    const profile = await profileRes.json() as any;
    return { id: profile.id, name: profile.username, avatar: profile.profile_picture_url };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    // Instagram Content Publishing API requires a 2-step process
    // Step 1: Create media container, Step 2: Publish
    // This is simplified — full impl handles image upload containers
    return { platformPostId: 'pending', url: '' };
  }
}

// ============================================================
// X (Twitter) — API v2
// ============================================================

export class TwitterAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'twitter';
  private clientId = process.env.TWITTER_CLIENT_ID || '';
  private clientSecret = process.env.TWITTER_CLIENT_SECRET || '';
  private redirectUri = process.env.TWITTER_REDIRECT_URI || 'http://localhost:4000/api/v1/connections/twitter/callback';

  getAuthUrl(state: string): string {
    const codeChallenge = state; // Simplified — real impl uses PKCE
    return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=plain`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: `code=${code}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(this.redirectUri)}&code_verifier=challenge`,
    });
    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: `refresh_token=${refreshToken}&grant_type=refresh_token`,
    });
    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return { id: data.data.id, name: data.data.name, username: data.data.username, avatar: data.data.profile_image_url };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: post.text }),
    });
    const data = await res.json() as any;
    return { platformPostId: data.data.id, url: `https://x.com/i/status/${data.data.id}` };
  }
}

// ============================================================
// LinkedIn — Marketing API
// ============================================================

export class LinkedInAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'linkedin';
  private clientId = process.env.LINKEDIN_CLIENT_ID || '';
  private clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
  private redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:4000/api/v1/connections/linkedin/callback';

  getAuthUrl(state: string): string {
    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=openid%20profile%20w_member_social&state=${state}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(this.redirectUri)}&client_id=${this.clientId}&client_secret=${this.clientSecret}`,
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
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

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const userInfo = await this.getAccountInfo(accessToken);
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: `urn:li:person:${userInfo.id}`,
        lifecycleState: 'PUBLISHED',
        specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: post.text }, shareMediaCategory: 'NONE' } },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });
    const data = await res.json() as any;
    return { platformPostId: data.id };
  }
}

// ============================================================
// TikTok — Content Posting API
// ============================================================

export class TikTokAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'tiktok';
  private clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  private clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
  private redirectUri = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:4000/api/v1/connections/tiktok/callback';

  getAuthUrl(state: string): string {
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${this.clientKey}&response_type=code&scope=user.info.basic,video.publish,video.list&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_key=${this.clientKey}&client_secret=${this.clientSecret}&code=${code}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(this.redirectUri)}`,
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_key=${this.clientKey}&client_secret=${this.clientSecret}&grant_type=refresh_token&refresh_token=${refreshToken}`,
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return { id: data.data?.user?.open_id, name: data.data?.user?.display_name, avatar: data.data?.user?.avatar_url };
  }

  async publishPost(_accessToken: string, _post: PlatformPostPayload): Promise<PlatformPostResult> {
    // TikTok Content Posting API uses a multi-step upload flow
    return { platformPostId: 'pending' };
  }
}

// ============================================================
// YouTube — Data API v3
// ============================================================

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'youtube';
  private clientId = process.env.GOOGLE_CLIENT_ID || '';
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  private redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:4000/api/v1/connections/youtube/callback';

  getAuthUrl(state: string): string {
    const scopes = 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&state=${state}&prompt=consent`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `code=${code}&client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${encodeURIComponent(this.redirectUri)}&grant_type=authorization_code`,
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `refresh_token=${refreshToken}&client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=refresh_token`,
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    const channel = data.items?.[0];
    return { id: channel?.id, name: channel?.snippet?.title, avatar: channel?.snippet?.thumbnails?.default?.url };
  }

  async publishPost(_accessToken: string, _post: PlatformPostPayload): Promise<PlatformPostResult> {
    // YouTube upload requires multipart/resumable upload — complex flow
    return { platformPostId: 'pending' };
  }
}

// ============================================================
// Pinterest — API v5
// ============================================================

export class PinterestAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'pinterest';
  private clientId = process.env.PINTEREST_CLIENT_ID || '';
  private clientSecret = process.env.PINTEREST_CLIENT_SECRET || '';
  private redirectUri = process.env.PINTEREST_REDIRECT_URI || 'http://localhost:4000/api/v1/connections/pinterest/callback';

  getAuthUrl(state: string): string {
    return `https://www.pinterest.com/oauth/?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&scope=boards:read,pins:read,pins:write&state=${state}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(this.redirectUri)}`,
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformTokens> {
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    });
    const data = await res.json() as any;
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccount> {
    const res = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return { id: data.username, name: data.username, avatar: data.profile_image };
  }

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const res = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: post.text.slice(0, 100),
        description: post.text,
        link: post.link,
        media_source: post.mediaUrls?.[0] ? { source_type: 'image_url', url: post.mediaUrls[0] } : undefined,
      }),
    });
    const data = await res.json() as any;
    return { platformPostId: data.id };
  }
}
