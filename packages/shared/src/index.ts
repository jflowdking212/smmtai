// EE PostMind — Shared Types & Utilities

// ============================================================
// Platform Types
// ============================================================

export type PlatformType =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'twitter'
  | 'youtube'
  | 'pinterest'
  | 'bluesky'
  | 'mastodon'
  | 'telegram'
  | 'entreprenrs'
  | 'chrxstians'
  | 'iohah';

export interface Platform {
  id: PlatformType;
  name: string;
  icon: string;
  color: string;
  maxCharacters: number | null;
  supportsStories: boolean;
  supportsReels: boolean;
  supportsAnalytics: boolean;
  supportsAds: boolean;
}

export const PLATFORMS: Record<PlatformType, Platform> = {
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: 'facebook',
    color: '#1877F2',
    maxCharacters: 63206,
    supportsStories: true,
    supportsReels: true,
    supportsAnalytics: true,
    supportsAds: true,
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: 'instagram',
    color: '#E4405F',
    maxCharacters: 2200,
    supportsStories: true,
    supportsReels: true,
    supportsAnalytics: true,
    supportsAds: true,
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'tiktok',
    color: '#000000',
    maxCharacters: 4000,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: true,
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'linkedin',
    color: '#0A66C2',
    maxCharacters: 3000,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: true,
  },
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'twitter',
    color: '#000000',
    maxCharacters: 280,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: true,
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: 'youtube',
    color: '#FF0000',
    maxCharacters: 5000,
    supportsStories: true,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: true,
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    icon: 'pinterest',
    color: '#E60023',
    maxCharacters: 500,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: true,
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    icon: 'bluesky',
    color: '#0085FF',
    maxCharacters: 300,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  mastodon: {
    id: 'mastodon',
    name: 'Mastodon',
    icon: 'mastodon',
    color: '#6364FF',
    maxCharacters: 500,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    icon: 'telegram',
    color: '#26A5E4',
    maxCharacters: 4096,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: false,
    supportsAds: false,
  },
  entreprenrs: {
    id: 'entreprenrs',
    name: 'Entreprenrs',
    icon: 'entreprenrs',
    color: '#FF6B00',
    maxCharacters: null,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  chrxstians: {
    id: 'chrxstians',
    name: 'Chrxstians',
    icon: 'chrxstians',
    color: '#7C3AED',
    maxCharacters: null,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  iohah: {
    id: 'iohah',
    name: 'Iohah',
    icon: 'iohah',
    color: '#059669',
    maxCharacters: null,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
};

export const OAUTH_PLATFORMS: PlatformType[] = [
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'twitter',
  'youtube',
  'pinterest',
];

export const MANUAL_CONNECTION_PLATFORMS: PlatformType[] = [
  'bluesky',
  'mastodon',
  'telegram',
  'entreprenrs',
  'chrxstians',
  'iohah',
];

export function isPlatformType(value: string): value is PlatformType {
  return value in PLATFORMS;
}

// ============================================================
// User & Auth Types
// ============================================================

export type SubscriptionTier = 'free' | 'pro' | 'business' | 'enterprise';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  subscription: SubscriptionTier;
  createdAt: Date;
}

export interface WorkspaceMember {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

// ============================================================
// Post Types
// ============================================================

export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'pending'
  | 'publishing'
  | 'partial'
  | 'published'
  | 'failed';

export interface Post {
  id: string;
  workspaceId: string;
  authorId: string;
  content: string;
  mediaUrls: string[];
  platforms: PlatformType[];
  status: PostStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformPost {
  id: string;
  postId: string;
  platform: PlatformType;
  platformPostId: string | null;
  status: PostStatus;
  error: string | null;
  publishedAt: Date | null;
}

// ============================================================
// Analytics Types
// ============================================================

export interface AnalyticsSnapshot {
  id: string;
  platformPostId: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
  capturedAt: Date;
}

export interface DashboardMetrics {
  totalFollowers: number;
  totalEngagement: number;
  engagementRate: number;
  postsThisPeriod: number;
  topPlatform: PlatformType;
  growthPercentage: number;
}

// ============================================================
// Subscription Limits
// ============================================================

export const SUBSCRIPTION_LIMITS: Record<
  SubscriptionTier,
  {
    socialAccounts: number;
    postsPerMonth: number;
    aiGenerationsPerMonth: number;
    teamMembers: number;
    analyticsDays: number;
  }
> = {
  free: {
    socialAccounts: 3,
    postsPerMonth: 30,
    aiGenerationsPerMonth: 10,
    teamMembers: 1,
    analyticsDays: 7,
  },
  pro: {
    socialAccounts: 10,
    postsPerMonth: 300,
    aiGenerationsPerMonth: 100,
    teamMembers: 3,
    analyticsDays: 30,
  },
  business: {
    socialAccounts: 25,
    postsPerMonth: Infinity,
    aiGenerationsPerMonth: 500,
    teamMembers: 10,
    analyticsDays: 90,
  },
  enterprise: {
    socialAccounts: Infinity,
    postsPerMonth: Infinity,
    aiGenerationsPerMonth: Infinity,
    teamMembers: Infinity,
    analyticsDays: Infinity,
  },
};

// ============================================================
// Canvas Sizes per Platform
// ============================================================

export interface CanvasSize {
  label: string;
  width: number;
  height: number;
}

export const PLATFORM_CANVAS_SIZES: Record<PlatformType, CanvasSize[]> = {
  facebook: [
    { label: 'Post', width: 1200, height: 630 },
    { label: 'Story', width: 1080, height: 1920 },
    { label: 'Cover', width: 820, height: 312 },
    { label: 'Ad', width: 1200, height: 628 },
  ],
  instagram: [
    { label: 'Post', width: 1080, height: 1080 },
    { label: 'Story/Reel', width: 1080, height: 1920 },
    { label: 'Ad', width: 1080, height: 1080 },
  ],
  tiktok: [{ label: 'Video', width: 1080, height: 1920 }],
  linkedin: [
    { label: 'Post', width: 1200, height: 627 },
    { label: 'Cover', width: 1128, height: 191 },
    { label: 'Ad', width: 1200, height: 627 },
  ],
  twitter: [
    { label: 'Post', width: 1600, height: 900 },
    { label: 'Header', width: 1500, height: 500 },
    { label: 'Ad', width: 800, height: 418 },
  ],
  youtube: [
    { label: 'Thumbnail', width: 1280, height: 720 },
    { label: 'Shorts', width: 1080, height: 1920 },
    { label: 'Banner', width: 2560, height: 1440 },
  ],
  pinterest: [
    { label: 'Pin', width: 1000, height: 1500 },
    { label: 'Story', width: 1080, height: 1920 },
  ],
  bluesky: [{ label: 'Post', width: 1200, height: 630 }],
  mastodon: [{ label: 'Post', width: 1200, height: 630 }],
  telegram: [{ label: 'Post', width: 1280, height: 720 }],
  entreprenrs: [{ label: 'Post', width: 1200, height: 630 }],
  chrxstians: [{ label: 'Post', width: 1200, height: 630 }],
  iohah: [{ label: 'Post', width: 1200, height: 630 }],
};

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page: number;
    perPage: number;
    total: number;
  };
}
