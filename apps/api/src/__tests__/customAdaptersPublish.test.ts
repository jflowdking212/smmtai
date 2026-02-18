import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChrxstiansAdapter, EntreprenrsAdapter } from '../services/platforms/custom.js';

const fetchMock = vi.fn();

describe('Custom platform adapters publish', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('includes link, hashtags, and image media for WoWonder publish payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ post_id: 12345 }),
    });

    const adapter = new EntreprenrsAdapter();
    await adapter.publishPost(
      JSON.stringify({ accessToken: 'access-token', serverKey: 'server-key' }),
      {
        text: 'Launch update',
        link: 'https://example.com/post',
        hashtags: ['growth', '#Launch'],
        mediaUrls: ['https://cdn.example.com/image.jpg'],
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://entreprenrs.com/api/create-post');
    const params = new URLSearchParams(options.body as string);

    expect(params.get('postText')).toContain('Launch update');
    expect(params.get('postText')).toContain('#growth');
    expect(params.get('postText')).toContain('#Launch');
    expect(params.get('postLink')).toBe('https://example.com/post');
    expect(params.get('postPhoto')).toBe('https://cdn.example.com/image.jpg');
    expect(params.get('postVideo')).toBeNull();
  });

  it('uses video media field for WoWonder video posts', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ post_id: 'video-1' }),
    });

    const adapter = new EntreprenrsAdapter();
    await adapter.publishPost(
      JSON.stringify({ accessToken: 'access-token', serverKey: 'server-key' }),
      {
        text: 'Video drop',
        mediaType: 'video',
        mediaUrls: ['https://cdn.example.com/video.mp4'],
      },
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const params = new URLSearchParams(options.body as string);
    expect(params.get('postVideo')).toBe('https://cdn.example.com/video.mp4');
    expect(params.get('postPhoto')).toBeNull();
  });

  it('includes media metadata payload for Sngine publish requests', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'post-42' }),
    });

    const adapter = new ChrxstiansAdapter();
    await adapter.publishPost(JSON.stringify({ accessToken: 'sngine-token' }), {
      text: 'Community update',
      link: 'https://example.com/news',
      hashtags: ['faith'],
      mediaUrls: ['https://cdn.example.com/clip.mp4'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://chrxstians.com/api/posts');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer sngine-token' });

    const payload = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(payload.text).toBe('Community update\n#faith\nhttps://example.com/news');
    expect(payload.link).toBe('https://example.com/news');
    expect(payload.mediaUrl).toBe('https://cdn.example.com/clip.mp4');
    expect(payload.mediaType).toBe('video');
  });
});
