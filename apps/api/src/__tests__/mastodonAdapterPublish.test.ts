import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastodonAdapter } from '../services/platforms/new.js';

describe('MastodonAdapter publishing', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new MastodonAdapter();
  const credentials = JSON.stringify({
    accessToken: 'mastodon-access-token',
    instanceUrl: 'https://mastodon.example',
  });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes text-only status posts', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'status_1', url: 'https://mastodon.example/@user/123' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await adapter.publishPost(credentials, { text: 'Hello Mastodon!' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mastodon.example/api/v1/statuses',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer mastodon-access-token',
          'Content-Type': 'application/json',
        },
      }),
    );
    const requestBody = JSON.parse((fetchMock.mock.calls[0][1] as { body?: string }).body || '{}');
    expect(requestBody).toEqual({ status: 'Hello Mastodon!' });
    expect(result).toEqual({
      platformPostId: 'status_1',
      url: 'https://mastodon.example/@user/123',
    });
  });

  it('uploads media and publishes with media_ids', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('binary-image', {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'media_1' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'status_2', url: 'https://mastodon.example/@user/456' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await adapter.publishPost(credentials, {
      text: 'Post with media',
      mediaUrls: ['https://cdn.example.com/cat.png'],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://cdn.example.com/cat.png');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://mastodon.example/api/v2/media',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer mastodon-access-token' },
      }),
    );
    const uploadBody = (fetchMock.mock.calls[1][1] as { body?: FormData }).body;
    expect(uploadBody).toBeInstanceOf(FormData);
    expect(uploadBody?.get('file')).toBeTruthy();

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://mastodon.example/api/v1/statuses',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const publishBody = JSON.parse((fetchMock.mock.calls[2][1] as { body?: string }).body || '{}');
    expect(publishBody).toEqual({
      status: 'Post with media',
      media_ids: ['media_1'],
    });
  });

  it('fails when Mastodon media upload fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('binary-video', {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Invalid media type' }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(
      adapter.publishPost(credentials, {
        text: 'Video upload test',
        mediaUrls: ['https://cdn.example.com/clip.mp4'],
      }),
    ).rejects.toThrow('Invalid media type');
  });
});
