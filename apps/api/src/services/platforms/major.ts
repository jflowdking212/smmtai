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

function isVideoPost(post: PlatformPostPayload, mediaUrl: string): boolean {
  if (post.mediaType) {
    return post.mediaType === 'video';
  }
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

const FACEBOOK_GRAPH_OAUTH_SCOPES = 'pages_manage_posts,pages_read_engagement,pages_show_list,read_insights,instagram_basic,instagram_content_publish';

export class FacebookAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'facebook';
  private clientId = process.env.FACEBOOK_APP_ID || '';
  private clientSecret = process.env.FACEBOOK_APP_SECRET || '';
  private redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:4016/api/v1/connections/facebook/callback';

  getAuthUrl(state: string): string {
    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${FACEBOOK_GRAPH_OAUTH_SCOPES}&state=${state}&response_type=code`;
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
    const params = new URLSearchParams({
      fields: 'insights.metric(post_impressions,post_engaged_users,post_reactions_by_type_total),shares,comments.summary(true),reactions.summary(true)',
      access_token: accessToken,
    });
    const res = await fetch(`https://graph.facebook.com/v18.0/${platformPostId}?${params.toString()}`);
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(resolveErrorMessage(data) || 'Failed to fetch Facebook analytics');
    }

    const impressions = getGraphInsightMetric(data, 'post_impressions');
    const reach = getGraphInsightMetric(data, 'post_engaged_users');
    const insightLikes = getGraphInsightMetric(data, 'post_reactions_by_type_total');
    const likes = Math.max(insightLikes, toNumber(data?.reactions?.summary?.total_count));
    const comments = toNumber(data?.comments?.summary?.total_count);
    const shares = toNumber(data?.shares?.count);

    return {
      impressions,
      reach,
      likes,
      comments,
      shares,
      clicks: 0,
      saves: 0,
      metadata: data,
    };
  }
}

export class InstagramAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'instagram';
  private clientId = process.env.FACEBOOK_APP_ID || '';
  private clientSecret = process.env.FACEBOOK_APP_SECRET || '';
  private redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:4016/api/v1/connections/instagram/callback';

  getAuthUrl(state: string): string {
    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${FACEBOOK_GRAPH_OAUTH_SCOPES}&state=${state}&response_type=code`;
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

    const createRes = await fetch(`https://graph.facebook.com/v18.0/${account.id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: createBody.toString(),
    });
    const createData = await readJson(createRes);
    if (!createRes.ok || !createData.id) {
      throw new Error(resolveErrorMessage(createData) || 'Failed to create Instagram media');
    }

    const publishBody = new URLSearchParams({
      access_token: accessToken,
      creation_id: createData.id,
    });
    const publishRes = await fetch(`https://graph.facebook.com/v18.0/${account.id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishBody.toString(),
    });
    const publishData = await readJson(publishRes);
    if (!publishRes.ok || !publishData.id) {
      throw new Error(resolveErrorMessage(publishData) || 'Failed to publish Instagram media');
    }

    return { platformPostId: publishData.id.toString() };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const params = new URLSearchParams({
      metric: 'impressions,reach,likes,comments,shares,saved',
      access_token: accessToken,
    });
    const res = await fetch(`https://graph.facebook.com/v18.0/${platformPostId}/insights?${params.toString()}`);
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
}

// ============================================================
// X (Twitter) — API v2
// ============================================================

export class TwitterAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'twitter';
  private clientId = process.env.TWITTER_CLIENT_ID || '';
  private clientSecret = process.env.TWITTER_CLIENT_SECRET || '';
  private redirectUri = process.env.TWITTER_REDIRECT_URI || 'http://localhost:4016/api/v1/connections/twitter/callback';

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
    return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  }

  async exchangeCode(code: string, context?: PlatformOAuthContext): Promise<PlatformTokens> {
    if (!context?.state) {
      throw new Error('Missing OAuth state for Twitter token exchange');
    }
    const codeVerifier = this.buildPkceCodeVerifier(context.state);
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
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

    const res = await fetch('https://api.twitter.com/2/tweets', {
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
      `https://api.twitter.com/2/tweets/${platformPostId}?tweet.fields=public_metrics,organic_metrics,non_public_metrics`,
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
  private clientId = process.env.LINKEDIN_CLIENT_ID || '';
  private clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
  private redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:4016/api/v1/connections/linkedin/callback';

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

    return { platformPostId: data.id.toString() };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const urn = resolveLinkedInUrn(platformPostId);
    const res = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urn)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(resolveErrorMessage(data) || 'Failed to fetch LinkedIn analytics');
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
  private clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  private clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
  private redirectUri = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:4016/api/v1/connections/tiktok/callback';

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_key: this.clientKey,
      response_type: 'code',
      scope: 'user.info.basic,video.publish,video.list',
      redirect_uri: this.redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<PlatformTokens> {
    const body = new URLSearchParams({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
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

  async publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult> {
    const mediaUrl = requirePrimaryMediaUrl(post, 'TikTok');
    if (!isVideoPost(post, mediaUrl)) {
      throw new Error('TikTok publishing requires video media');
    }

    const metadata = post.metadata as {
      privacyLevel?: string;
      disableComment?: boolean;
      disableDuet?: boolean;
      disableStitch?: boolean;
    } | undefined;

    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_info: {
          title: buildPostText(post).slice(0, 2200),
          privacy_level: metadata?.privacyLevel || 'PUBLIC_TO_EVERYONE',
          disable_comment: Boolean(metadata?.disableComment),
          disable_duet: Boolean(metadata?.disableDuet),
          disable_stitch: Boolean(metadata?.disableStitch),
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: mediaUrl,
        },
      }),
    });
    const data = await readJson(res);
    const publishId = data.data?.publish_id || data.publish_id;
    if (!res.ok || !publishId) {
      throw new Error(resolveErrorMessage(data) || 'Failed to initialize TikTok publish');
    }

    return { platformPostId: publishId.toString() };
  }

  async getPostAnalytics(accessToken: string, platformPostId: string): Promise<PlatformAnalytics> {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish_id: platformPostId }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(resolveErrorMessage(data) || 'Failed to fetch TikTok analytics');
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
  private clientId = process.env.GOOGLE_CLIENT_ID || '';
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  private redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:4016/api/v1/connections/youtube/callback';

  getAuthUrl(state: string): string {
    const scopes = 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly';
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
    const data = await res.json() as any;
    const channel = data.items?.[0];
    return { id: channel?.id, name: channel?.snippet?.title, avatar: channel?.snippet?.thumbnails?.default?.url };
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
  private clientId = process.env.PINTEREST_CLIENT_ID || '';
  private clientSecret = process.env.PINTEREST_CLIENT_SECRET || '';
  private redirectUri = process.env.PINTEREST_REDIRECT_URI || 'http://localhost:4016/api/v1/connections/pinterest/callback';

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'boards:read,pins:read,pins:write',
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
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: body.toString(),
    });
    const data = await readJson(res);
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
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: body.toString(),
    });
    const data = await readJson(res);
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
    const res = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any;
    return { id: data.username, name: data.username, avatar: data.profile_image };
  }

  private async resolveBoardId(accessToken: string, post: PlatformPostPayload): Promise<string> {
    const metadata = post.metadata as { boardId?: string; board_id?: string } | undefined;
    const explicitBoardId = metadata?.boardId || metadata?.board_id;
    if (explicitBoardId) {
      return explicitBoardId;
    }

    const boardsRes = await fetch('https://api.pinterest.com/v5/boards?page_size=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const boardsData = await readJson(boardsRes);
    const firstBoardId = boardsData?.items?.[0]?.id || boardsData?.data?.[0]?.id;
    if (!boardsRes.ok || !firstBoardId) {
      throw new Error(resolveErrorMessage(boardsData) || 'Pinterest publish requires a destination board');
    }

    return firstBoardId.toString();
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

    const res = await fetch('https://api.pinterest.com/v5/pins', {
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
    const data = await readJson(res);
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

    const res = await fetch(
      `https://api.pinterest.com/v5/pins/${encodeURIComponent(platformPostId)}/analytics?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const data = await readJson(res);
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
