export interface LinkPreviewData {
  href: string;
  host: string;
  path: string;
  title: string;
}

export function parseHashtagsInput(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((token) => token.trim().replace(/^#+/, ''))
    .filter((token) => token.length > 0);
}

export function buildPreviewText(baseText: string, hashtagsInput: string | string[], link: string): string {
  const hashtags = Array.isArray(hashtagsInput) ? hashtagsInput : parseHashtagsInput(hashtagsInput);
  const normalizedHashtags = hashtags.map((tag) => `#${tag}`).join(' ');
  const normalizedLink = link.trim();

  return [baseText.trim(), normalizedHashtags, normalizedLink].filter((value) => value.length > 0).join(' ').trim();
}

export function buildLinkPreviewData(link: string): LinkPreviewData | null {
  const normalized = link.trim();
  if (!normalized) return null;

  const protocolPrefixed = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;

  try {
    const parsed = new URL(protocolPrefixed);
    const path = `${parsed.pathname}${parsed.search}` || '/';
    const cleanPath = path.length > 1 ? path.replace(/\/$/, '') : path;
    const title = cleanPath !== '/' ? `${parsed.hostname}${cleanPath}` : parsed.hostname;

    return {
      href: parsed.toString(),
      host: parsed.hostname,
      path: cleanPath,
      title,
    };
  } catch {
    return null;
  }
}
