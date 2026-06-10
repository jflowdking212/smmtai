// SmmtAI — Shared Types & Utilities

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
  | 'iohah'
  | 'threads'
  | 'reddit'
  | 'tumblr'
  | 'google_business'
  | 'discord'
  | 'slack'
  | 'wordpress'
  | 'medium'
  | 'blogger'
  | 'truth_social'
  | 'lemmy'
  | 'pleroma';

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
  threads: {
    id: 'threads',
    name: 'Threads',
    icon: 'threads',
    color: '#000000',
    maxCharacters: 500,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    icon: 'reddit',
    color: '#FF4500',
    maxCharacters: 40000,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  tumblr: {
    id: 'tumblr',
    name: 'Tumblr',
    icon: 'tumblr',
    color: '#36465D',
    maxCharacters: null,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  google_business: {
    id: 'google_business',
    name: 'Google Business Profile',
    icon: 'google',
    color: '#4285F4',
    maxCharacters: 1500,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    icon: 'discord',
    color: '#5865F2',
    maxCharacters: 2000,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: false,
    supportsAds: false,
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    icon: 'slack',
    color: '#4A154B',
    maxCharacters: 4000,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: false,
    supportsAds: false,
  },
  wordpress: {
    id: 'wordpress',
    name: 'WordPress',
    icon: 'wordpress',
    color: '#21759B',
    maxCharacters: null,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: false,
    supportsAds: false,
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    icon: 'medium',
    color: '#000000',
    maxCharacters: null,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: false,
    supportsAds: false,
  },
  blogger: {
    id: 'blogger',
    name: 'Blogger',
    icon: 'blogger',
    color: '#FF9900',
    maxCharacters: null,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: false,
    supportsAds: false,
  },
  truth_social: {
    id: 'truth_social',
    name: 'Truth Social',
    icon: 'truth',
    color: '#1F82C0',
    maxCharacters: 500,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: true,
    supportsAds: false,
  },
  lemmy: {
    id: 'lemmy',
    name: 'Lemmy',
    icon: 'lemmy',
    color: '#0C5A30',
    maxCharacters: null,
    supportsStories: false,
    supportsReels: false,
    supportsAnalytics: false,
    supportsAds: false,
  },
  pleroma: {
    id: 'pleroma',
    name: 'Pleroma',
    icon: 'pleroma',
    color: '#FBA857',
    maxCharacters: 500,
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
  'threads',
  'reddit',
  'tumblr',
  'google_business',
  'blogger',
];

export const MANUAL_CONNECTION_PLATFORMS: PlatformType[] = [
  'bluesky',
  'mastodon',
  'telegram',
  'entreprenrs',
  'chrxstians',
  'iohah',
  'discord',
  'slack',
  'wordpress',
  'medium',
  'truth_social',
  'lemmy',
  'pleroma',
];

// Custom platforms that support owner-configured global credentials
export const GLOBAL_CREDENTIAL_PLATFORMS: PlatformType[] = [
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'twitter',
  'youtube',
  'pinterest',
  'bluesky',
  'mastodon',
  'telegram',
  'entreprenrs',
  'chrxstians',
  'iohah',
  'threads',
  'reddit',
  'tumblr',
  'google_business',
  'discord',
  'slack',
  'wordpress',
  'medium',
  'blogger',
  'truth_social',
  'lemmy',
  'pleroma',
];

export function isPlatformType(value: string): value is PlatformType {
  return value in PLATFORMS;
}

// ============================================================
// User & Auth Types
// ============================================================

export type SubscriptionTier = 'basic' | 'pro' | 'business' | 'enterprise';

export type WorkspaceRole = 'owner' | 'manager' | 'creator' | 'viewer';

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
// User Intelligence & Engagement Loop Types
// ============================================================

export interface UserIntelligenceProfile {
  id: string;
  userId: string;
  niche: string | null;
  targetAudience: {
    demographics?: string;
    painPoints?: string[];
    aspirations?: string[];
  } | null;
  contentPillars: string[];
  tonePreference: string | null;
  avoidedTopics: string[];
  goals: {
    primary?: string;
    secondary?: string;
    metrics?: string[];
  } | null;
  postingPreferences: {
    preferredDays?: number[];
    preferredTimes?: string[];
    frequency?: string;
  } | null;
  brandKeywords: string[];
  completenessScore: number;
}

export interface UserVoiceModel {
  id: string;
  userId: string;
  formalityScore: number;
  energyScore: number;
  avgSentenceLength: number | null;
  vocabularySamples: {
    preferredWords?: string[];
    avoidedWords?: string[];
  } | null;
  emojiUsageRate: number;
  ctaStyle: string | null;
  hashtagPatterns: {
    avgCount?: number;
    preferred?: string[];
  } | null;
  confidenceScore: number;
  samplesAnalyzed: number;
}

export interface UserEngagementRecord {
  id: string;
  userId: string;
  postId: string | null;
  platform: string;
  contentType: string | null;
  topic: string | null;
  postingHour: number | null;
  postingDay: number | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  clickThroughs: number;
  engagementRate: number;
  snapshotType: string;
  collectedAt: Date;
}

export interface StrategyRecommendation {
  id: string;
  userId: string;
  type: 'timing' | 'content_type' | 'topic' | 'audience' | 'profile_nudge' | 'ab_test' | 'growth';
  title: string;
  body: string;
  priority: number;
  status: 'pending' | 'acted' | 'dismissed';
  actionedAt: Date | null;
  expiresAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CompetitorAccountData {
  id: string;
  userId: string;
  platform: string;
  handle: string;
  displayName: string | null;
  followerCount: number | null;
  avgEngRate: number | null;
  lastCheckedAt: Date | null;
}

/** The context block injected into every AI prompt when intelligence is available */
export interface AIUserContextBlock {
  profile: UserIntelligenceProfile | null;
  voice: UserVoiceModel | null;
  topPerformingContent?: {
    contentType: string;
    topic: string;
    engagementRate: number;
  }[];
  recommendations?: string[];
  competitorBenchmark?: {
    avgEngRate: number;
    userEngRate: number;
  } | null;
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
    templatesPerMonth: number;
    teamMembers: number;
    analyticsDays: number;
  }
> = {
  basic: {
    socialAccounts: 5,
    postsPerMonth: 35,
    aiGenerationsPerMonth: 25,
    templatesPerMonth: 20,
    teamMembers: 1,
    analyticsDays: 15,
  },
  pro: {
    socialAccounts: 8,
    postsPerMonth: 200,
    aiGenerationsPerMonth: 100,
    templatesPerMonth: 50,
    teamMembers: 5,
    analyticsDays: 30,
  },
  business: {
    socialAccounts: 15,
    postsPerMonth: Infinity,
    aiGenerationsPerMonth: 500,
    templatesPerMonth: Infinity,
    teamMembers: 10,
    analyticsDays: 90,
  },
  enterprise: {
    socialAccounts: Infinity,
    postsPerMonth: Infinity,
    aiGenerationsPerMonth: Infinity,
    templatesPerMonth: Infinity,
    teamMembers: 20,
    analyticsDays: Infinity,
  },
};

// Features gated by minimum subscription tier
export type AppFeature =
  | 'dashboard'
  | 'compose'
  | 'post_history'
  | 'calendar'
  | 'analytics'
  | 'connections'
  | 'templates'
  | 'ai_assistant'
  | 'conversations'
  | 'knowledge_base'
  | 'team'
  | 'billing'
  | 'settings'
  | 'editor'
  | 'admin_dashboard'
  // User Intelligence & Engagement Loop features
  | 'ai_intelligence_basic'
  | 'ai_voice_model'
  | 'ai_engagement_monitor'
  | 'ai_pattern_analysis'
  | 'ai_strategy_recommendations'
  | 'ai_performance_dashboard';

export const PLAN_FEATURES: Record<AppFeature, SubscriptionTier> = {
  dashboard: 'basic',
  compose: 'basic',
  post_history: 'basic',
  calendar: 'basic',
  connections: 'basic',
  templates: 'basic',
  ai_assistant: 'basic',
  editor: 'basic',
  billing: 'basic',
  settings: 'basic',
  conversations: 'pro',
  analytics: 'pro',
  knowledge_base: 'pro',
  team: 'pro',
  admin_dashboard: 'basic',
  // User Intelligence & Engagement Loop defaults
  ai_intelligence_basic: 'basic',         // All plans
  ai_voice_model: 'business',            // Business + Enterprise
  ai_engagement_monitor: 'business',     // Business + Enterprise
  ai_pattern_analysis: 'enterprise',     // Enterprise only
  ai_strategy_recommendations: 'enterprise', // Enterprise only
  ai_performance_dashboard: 'business',  // Business + Enterprise
};

const TIER_ORDER: Record<SubscriptionTier, number> = { basic: 0, pro: 1, business: 2, enterprise: 3 };

export function hasFeatureAccess(userTier: SubscriptionTier, feature: AppFeature): boolean {
  const requiredTier = PLAN_FEATURES[feature];
  return TIER_ORDER[userTier] >= TIER_ORDER[requiredTier];
}

// Platforms available per subscription tier (each tier includes all platforms from tiers below it)
export const TIER_PLATFORMS: Record<SubscriptionTier, PlatformType[]> = {
  basic: ['entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram'],
  pro: ['entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram', 'twitter', 'youtube', 'pinterest', 'threads', 'reddit'],
  business: [
    'entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram', 'twitter', 'youtube',
    'tiktok', 'linkedin', 'pinterest', 'bluesky', 'mastodon', 'telegram',
    'threads', 'reddit', 'tumblr', 'google_business', 'discord', 'slack',
    'wordpress', 'medium', 'blogger',
  ],
  enterprise: [
    'entreprenrs', 'chrxstians', 'iohah', 'facebook', 'instagram', 'twitter', 'youtube',
    'tiktok', 'linkedin', 'pinterest', 'bluesky', 'mastodon', 'telegram',
    'threads', 'reddit', 'tumblr', 'google_business', 'discord', 'slack',
    'wordpress', 'medium', 'blogger', 'truth_social', 'lemmy', 'pleroma',
  ],
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
  threads: [{ label: 'Post', width: 1080, height: 1080 }],
  reddit: [{ label: 'Post', width: 1200, height: 630 }],
  tumblr: [{ label: 'Post', width: 1200, height: 630 }],
  google_business: [{ label: 'Post', width: 1200, height: 630 }],
  discord: [{ label: 'Post', width: 1200, height: 630 }],
  slack: [{ label: 'Post', width: 1200, height: 630 }],
  wordpress: [{ label: 'Post', width: 1200, height: 630 }],
  medium: [{ label: 'Post', width: 1200, height: 630 }],
  blogger: [{ label: 'Post', width: 1200, height: 630 }],
  truth_social: [{ label: 'Post', width: 1200, height: 630 }],
  lemmy: [{ label: 'Post', width: 1200, height: 630 }],
  pleroma: [{ label: 'Post', width: 1200, height: 630 }],
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
