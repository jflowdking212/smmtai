import type { PlatformType } from '@ee-postmind/shared';
import type { CanvasSize } from '@/hooks/useCanvas';

export type PostType = 'post' | 'story' | 'cover' | 'ad';

export const CANVAS_SIZES: Record<string, Record<string, CanvasSize>> = {
  facebook: {
    post: { width: 1200, height: 630, label: 'Facebook Post' },
    story: { width: 1080, height: 1920, label: 'Facebook Story' },
    cover: { width: 820, height: 312, label: 'Facebook Cover' },
    ad: { width: 1200, height: 628, label: 'Facebook Ad' },
  },
  instagram: {
    post: { width: 1080, height: 1080, label: 'Instagram Post' },
    story: { width: 1080, height: 1920, label: 'Instagram Story' },
    ad: { width: 1080, height: 1080, label: 'Instagram Ad' },
  },
  tiktok: {
    post: { width: 1080, height: 1920, label: 'TikTok Post' },
    story: { width: 1080, height: 1920, label: 'TikTok Story' },
  },
  linkedin: {
    post: { width: 1200, height: 627, label: 'LinkedIn Post' },
    cover: { width: 1128, height: 191, label: 'LinkedIn Cover' },
    ad: { width: 1200, height: 627, label: 'LinkedIn Ad' },
  },
  twitter: {
    post: { width: 1600, height: 900, label: 'X Post' },
    cover: { width: 1500, height: 500, label: 'X Cover' },
    ad: { width: 800, height: 418, label: 'X Ad' },
  },
  youtube: {
    post: { width: 1280, height: 720, label: 'YouTube Thumbnail' },
    story: { width: 1080, height: 1920, label: 'YouTube Short' },
    cover: { width: 2560, height: 1440, label: 'YouTube Banner' },
  },
  pinterest: {
    post: { width: 1000, height: 1500, label: 'Pinterest Pin' },
    story: { width: 1080, height: 1920, label: 'Pinterest Story' },
    ad: { width: 1000, height: 1500, label: 'Pinterest Ad' },
  },
  bluesky: {
    post: { width: 1200, height: 630, label: 'Bluesky Post' },
  },
  mastodon: {
    post: { width: 1200, height: 630, label: 'Mastodon Post' },
  },
  telegram: {
    post: { width: 1280, height: 720, label: 'Telegram Post' },
  },
  entreprenrs: {
    post: { width: 1200, height: 630, label: 'Entreprenrs Post' },
  },
  chrxstians: {
    post: { width: 1200, height: 630, label: 'Chrxstians Post' },
  },
  iohah: {
    post: { width: 1200, height: 630, label: 'Iohah Post' },
  },
};

export function getCanvasSize(platform: string, postType: string): CanvasSize {
  return CANVAS_SIZES[platform]?.[postType] || { width: 1200, height: 630, label: 'Custom' };
}

export function getAvailablePostTypes(platform: string): string[] {
  return Object.keys(CANVAS_SIZES[platform] || { post: true });
}
