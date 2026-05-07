import type { PlatformType } from '@ee-postmind/shared';
import type { PlatformAdapter } from './base.js';
import { FacebookAdapter, InstagramAdapter, InstagramDirectAdapter, TwitterAdapter, LinkedInAdapter, TikTokAdapter, YouTubeAdapter, PinterestAdapter } from './major.js';
import { BlueskyAdapter, MastodonAdapter, TelegramAdapter } from './new.js';
import { EntreprenrsAdapter, ChrxstiansAdapter, IohahAdapter } from './custom.js';

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
