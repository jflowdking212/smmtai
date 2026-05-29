import type { PlatformType } from '@ee-postmind/shared';
import type { PlatformAdapter } from './base.js';
import { FacebookAdapter, InstagramAdapter, InstagramDirectAdapter, TwitterAdapter, LinkedInAdapter, TikTokAdapter, YouTubeAdapter, PinterestAdapter } from './major.js';
import { BlueskyAdapter, MastodonAdapter, TelegramAdapter } from './new.js';
import { EntreprenrsAdapter, ChrxstiansAdapter, IohahAdapter } from './custom.js';
import {
  ThreadsAdapter,
  RedditAdapter,
  TumblrAdapter,
  GoogleBusinessAdapter,
  DiscordAdapter,
  SlackAdapter,
  WordPressAdapter,
  MediumAdapter,
  BloggerAdapter,
  TruthSocialAdapter,
  LemmyAdapter,
  PleromaAdapter,
} from './additions.js';

export type { PlatformAdapter, PlatformTokens, PlatformAccount, PlatformPostPayload, PlatformPostResult, PlatformAnalytics, PlatformAccountAnalytics } from './base.js';

type AdapterFactory = () => PlatformAdapter;

const adapterFactories: Record<PlatformType, AdapterFactory> = {
  facebook: () => new FacebookAdapter(),
  instagram: () => new InstagramAdapter(),
  twitter: () => new TwitterAdapter(),
  linkedin: () => new LinkedInAdapter(),
  tiktok: () => new TikTokAdapter(),
  youtube: () => new YouTubeAdapter(),
  pinterest: () => new PinterestAdapter(),
  bluesky: () => new BlueskyAdapter(),
  mastodon: () => new MastodonAdapter(),
  telegram: () => new TelegramAdapter(),
  entreprenrs: () => new EntreprenrsAdapter(),
  chrxstians: () => new ChrxstiansAdapter(),
  iohah: () => new IohahAdapter(),
  threads: () => new ThreadsAdapter(),
  reddit: () => new RedditAdapter(),
  tumblr: () => new TumblrAdapter(),
  google_business: () => new GoogleBusinessAdapter(),
  discord: () => new DiscordAdapter(),
  slack: () => new SlackAdapter(),
  wordpress: () => new WordPressAdapter(),
  medium: () => new MediumAdapter(),
  blogger: () => new BloggerAdapter(),
  truth_social: () => new TruthSocialAdapter(),
  lemmy: () => new LemmyAdapter(),
  pleroma: () => new PleromaAdapter(),
};

export function getPlatformAdapter(platform: PlatformType, mode?: string): PlatformAdapter {
  if (platform === 'instagram' && mode === 'direct') return new InstagramDirectAdapter();
  const factory = adapterFactories[platform];
  if (!factory) throw new Error(`No adapter for platform: ${platform}`);
  return factory();
}

export function getAllAdapters(): PlatformAdapter[] {
  return Object.values(adapterFactories).map((factory) => factory());
}
