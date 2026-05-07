import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwitterAdapter } from '../services/platforms/major.js';

describe('XAdapter publishing', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new TwitterAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes normalized text with hashtags and link', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { id: 'tweet_1' } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await adapter.publishPost('x-access-token', {
      text: 'Launch update',
      hashtags: ['growth'],
      link: 'https://example.com/story',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.x.com/2/tweets',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer x-access-token',
          'Content-Type': 'application/json',
        },
      }),
    );
    const payload = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body?: string })?.body || '{}');
    expect(payload).toEqual({
      text: 'Launch update #growth https://example.com/story',
    });
    expect(result).toEqual({
      platformPostId: 'tweet_1',
      url: 'https://x.com/i/status/tweet_1',
    });
  });

  it('rejects posts longer than 280 characters', async () => {
    await expect(
      adapter.publishPost('x-access-token', { text: 'x'.repeat(281) }),
    ).rejects.toThrow('X posts are limited to 280 characters');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires pre-uploaded media ids when media urls are present', async () => {
    await expect(
      adapter.publishPost('x-access-token', {
        text: 'Media post',
        mediaUrls: ['https://cdn.example.com/photo.jpg'],
      }),
    ).rejects.toThrow('X media URLs require metadata.mediaIds for pre-uploaded assets');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes metadata media ids to X publish payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { id: 'tweet_2' } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await adapter.publishPost('x-access-token', {
      text: 'Media post',
      metadata: { mediaIds: ['media_1', 'media_2'] },
    });

    const payload = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body?: string })?.body || '{}');
    expect(payload).toEqual({
      text: 'Media post',
      media: { media_ids: ['media_1', 'media_2'] },
    });
  });
});
