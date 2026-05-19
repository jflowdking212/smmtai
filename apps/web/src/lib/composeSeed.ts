export const COMPOSE_SEED_KEY = '__smmtaiComposeSeed';

type ComposeSeedSource = 'ai' | 'editor';

export interface ComposeSeedMedia {
  url: string;
  type: 'image' | 'video';
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ComposeSeedPayload {
  source: ComposeSeedSource;
  content?: string;
  hashtags?: string[];
  link?: string;
  media?: ComposeSeedMedia[];
}

export function saveComposeSeed(payload: ComposeSeedPayload) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(COMPOSE_SEED_KEY, JSON.stringify(payload));
}

export function consumeComposeSeed(): ComposeSeedPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(COMPOSE_SEED_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(COMPOSE_SEED_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<ComposeSeedPayload>;
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      source: parsed.source === 'editor' ? 'editor' : 'ai',
      content: typeof parsed.content === 'string' ? parsed.content : undefined,
      link: typeof parsed.link === 'string' ? parsed.link : undefined,
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.filter((value): value is string => typeof value === 'string')
        : undefined,
      media: Array.isArray(parsed.media)
        ? parsed.media.filter((item): item is ComposeSeedMedia => (
          Boolean(item)
          && typeof item.url === 'string'
          && (item.type === 'image' || item.type === 'video')
          && typeof item.fileName === 'string'
          && typeof item.mimeType === 'string'
          && typeof item.size === 'number'
        ))
        : undefined,
    };
  } catch {
    return null;
  }
}
