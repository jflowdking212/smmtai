import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueskyAdapter } from '../services/platforms/new.js';

describe('BlueskyAdapter publishing', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new BlueskyAdapter();
  const credentials = JSON.stringify({
    identifier: 'user.bsky.social',
    password: 'app-password',
  });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes text-only posts without embeds', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessJwt: 'jwt-token',
            did: 'did:plc:user123',
            handle: 'user.bsky.social',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ uri: 'at://did:plc:user123/app.bsky.feed.post/abc123' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const result = await adapter.publishPost(credentials, { text: 'Hello Bluesky!' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://bsky.social/xrpc/com.atproto.repo.createRecord');
    const payload = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body || '{}');
    expect(payload.record).toEqual(
      expect.objectContaining({
        text: 'Hello Bluesky!',
        $type: 'app.bsky.feed.post',
      }),
    );
    expect(payload.record.embed).toBeUndefined();
    expect(result.platformPostId).toBe('at://did:plc:user123/app.bsky.feed.post/abc123');
  });

  it('uploads images and publishes with Bluesky image embed', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessJwt: 'jwt-token',
            did: 'did:plc:user123',
            handle: 'user.bsky.social',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response('image-bytes', {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            blob: {
              $type: 'blob',
              ref: { $link: 'bafkreigh2akiscaildc' },
              mimeType: 'image/png',
              size: 1024,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ uri: 'at://did:plc:user123/app.bsky.feed.post/with-image' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await adapter.publishPost(credentials, {
      text: 'Post with image',
      mediaUrls: ['https://cdn.example.com/photo.png'],
      metadata: { altTexts: ['Team celebrating milestone'] },
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://cdn.example.com/photo.png');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://bsky.social/xrpc/com.atproto.repo.uploadBlob');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('https://bsky.social/xrpc/com.atproto.repo.createRecord');
    const createPayload = JSON.parse((fetchMock.mock.calls[3]?.[1] as { body?: string })?.body || '{}');
    expect(createPayload.record.embed).toEqual(
      expect.objectContaining({
        $type: 'app.bsky.embed.images',
        images: [
          expect.objectContaining({
            alt: 'Team celebrating milestone',
            image: expect.objectContaining({ $type: 'blob' }),
          }),
        ],
      }),
    );
  });

  it('rejects non-image media uploads', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessJwt: 'jwt-token',
            did: 'did:plc:user123',
            handle: 'user.bsky.social',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response('video-bytes', {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      );

    await expect(
      adapter.publishPost(credentials, {
        text: 'Video post',
        mediaUrls: ['https://cdn.example.com/video.mp4'],
      }),
    ).rejects.toThrow('Bluesky currently supports image attachments only');
  });
});
