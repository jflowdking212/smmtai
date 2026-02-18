import type { PlatformType } from '@ee-postmind/shared';

/**
 * Platform adapter interface — all 13 platform connectors implement this.
 * This abstraction layer ensures uniform behavior across all platforms.
 */
export interface PlatformAdapter {
  readonly platform: PlatformType;

  /** Get the OAuth authorization URL to initiate connection */
  getAuthUrl(state: string): string;

  /** Exchange authorization code for tokens */
  exchangeCode(code: string, context?: PlatformOAuthContext): Promise<PlatformTokens>;

  /** Refresh expired access token */
  refreshAccessToken(refreshToken: string): Promise<PlatformTokens>;

  /** Get connected account info (name, ID, avatar) */
  getAccountInfo(accessToken: string): Promise<PlatformAccount>;

  /** Publish a post to this platform */
  publishPost(accessToken: string, post: PlatformPostPayload): Promise<PlatformPostResult>;

  /** Delete a published post */
  deletePost?(accessToken: string, platformPostId: string): Promise<void>;

  /** Fetch analytics for a post */
  getPostAnalytics?(accessToken: string, platformPostId: string): Promise<PlatformAnalytics>;

  /** Fetch account-level analytics */
  getAccountAnalytics?(accessToken: string, accountId: string): Promise<PlatformAccountAnalytics>;
}

export interface PlatformTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export interface PlatformOAuthContext {
  state?: string;
}

export interface PlatformAccount {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface PlatformPostPayload {
  text: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video' | 'carousel';
  link?: string;
  hashtags?: string[];
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PlatformPostResult {
  platformPostId: string;
  url?: string;
}

export interface PlatformAnalytics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
  metadata?: Record<string, unknown>;
}

export interface PlatformAccountAnalytics {
  followers: number;
  following?: number;
  postsCount?: number;
  engagementRate?: number;
  demographics?: {
    age?: Record<string, number>;
    gender?: Record<string, number>;
    location?: Record<string, number>;
  };
}
