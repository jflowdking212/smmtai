import type { PlatformType } from '@ee-postmind/shared';
import type { PlatformAdapter } from './base.js';
import { FacebookAdapter, InstagramAdapter, TwitterAdapter, LinkedInAdapter, TikTokAdapter, YouTubeAdapter, PinterestAdapter } from './major.js';
import { BlueskyAdapter, MastodonAdapter, TelegramAdapter } from './new.js';
import { EntreprenrsAdapter, ChrxstiansAdapter, IohahAdapter } from './custom.js';

export type { PlatformAdapter, PlatformTokens, PlatformAccount, PlatformPostPayload, PlatformPostResult, PlatformAnalytics, PlatformAccountAnalytics } from './base.js';

const adapters: Record<PlatformType, PlatformAdapter> = {
  facebook: new FacebookAdapter(),
  instagram: new InstagramAdapter(),
  twitter: new TwitterAdapter(),
  linkedin: new LinkedInAdapter(),
  tiktok: new TikTokAdapter(),
  youtube: new YouTubeAdapter(),
  pinterest: new PinterestAdapter(),
  bluesky: new BlueskyAdapter(),
  mastodon: new MastodonAdapter(),
  telegram: new TelegramAdapter(),
  entreprenrs: new EntreprenrsAdapter(),
  chrxstians: new ChrxstiansAdapter(),
  iohah: new IohahAdapter(),
};

export function getPlatformAdapter(platform: PlatformType): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`No adapter for platform: ${platform}`);
  return adapter;
}

export function getAllAdapters(): PlatformAdapter[] {
  return Object.values(adapters);
}
