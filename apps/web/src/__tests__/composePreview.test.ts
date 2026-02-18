import { describe, expect, it } from 'vitest';
import { buildLinkPreviewData, buildPreviewText, parseHashtagsInput } from '../lib/composePreview';

describe('composePreview helpers', () => {
  it('parses hashtags from mixed delimiters', () => {
    expect(parseHashtagsInput('launch, #growth product  #news')).toEqual(['launch', 'growth', 'product', 'news']);
  });

  it('builds preview text with hashtags and link', () => {
    const preview = buildPreviewText('New release', ['launch', 'growth'], 'https://example.com/post');
    expect(preview).toBe('New release #launch #growth https://example.com/post');
  });

  it('builds link preview metadata from urls without protocol', () => {
    expect(buildLinkPreviewData('example.com/blog/post')).toEqual({
      href: 'https://example.com/blog/post',
      host: 'example.com',
      path: '/blog/post',
      title: 'example.com/blog/post',
    });
  });

  it('returns null for invalid links', () => {
    expect(buildLinkPreviewData('not a url value')).toBeNull();
  });
});
