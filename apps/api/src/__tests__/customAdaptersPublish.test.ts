import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChrxstiansAdapter, EntreprenrsAdapter, IohahAdapter } from '../services/platforms/custom.js';

const fetchMock = vi.fn();

describe('Custom platform adapters publish', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('includes link, hashtags, and image media for WoWonder publish payload', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('image-bytes', {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            post_id: 12345,
            post_data: { url: 'https://entreprenrs.com/post/12345_example.html' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const adapter = new EntreprenrsAdapter();
    const result = await adapter.publishPost(
      JSON.stringify({ accessToken: 'access-token', serverKey: 'server-key', userId: '42' }),
      {
        text: 'Launch update',
        link: 'https://example.com/post',
        hashtags: ['growth', '#Launch'],
        mediaUrls: ['https://cdn.example.com/image.jpg'],
      },
    );

    expect(result).toEqual({
      platformPostId: '12345',
      url: 'https://entreprenrs.com/post/12345_example.html',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://cdn.example.com/image.jpg');
    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe('https://entreprenrs.com/api/create-post');
    expect(parsedUrl.searchParams.get('access_token')).toBe('access-token');
    expect(parsedUrl.searchParams.get('server_key')).toBe('server-key');
    expect(parsedUrl.searchParams.get('user_id')).toBe('42');
    const params = options.body as FormData;

    expect(params.get('user_id')).toBe('42');
    expect(params.get('postText')).toContain('Launch update');
    expect(params.get('postText')).toContain('#growth');
    expect(params.get('postText')).toContain('#Launch');
    expect(params.get('postLink')).toBe('https://example.com/post');
    expect(params.get('postFile')).toBeTruthy();
    expect(params.get('postPhoto')).toBeNull();
    expect(params.get('postVideo')).toBeNull();
  });

  it('uploads WoWonder media via multipart postFile for video posts', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('video-bytes', {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ post_id: 'video-1' }),
      });

    const adapter = new EntreprenrsAdapter();
    await adapter.publishPost(
      JSON.stringify({ accessToken: 'access-token', serverKey: 'server-key', userId: '42' }),
      {
        text: 'Video drop',
        mediaType: 'video',
        mediaUrls: ['https://cdn.example.com/video.mp4'],
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://cdn.example.com/video.mp4');
    const [, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    const params = options.body as FormData;
    expect(params.get('postFile')).toBeTruthy();
    expect(params.get('postVideo')).toBeNull();
    expect(params.get('postPhoto')).toBeNull();
  });

  it('adds Entreprenrs page destination fields when page metadata is provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ post_id: 'page-1' }),
    });

    const adapter = new EntreprenrsAdapter();
    await adapter.publishPost(
      JSON.stringify({ accessToken: 'access-token', serverKey: 'server-key', userId: '42' }),
      {
        text: 'Page update',
        metadata: {
          destination: 'page',
          pageId: '123456',
        },
      },
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const params = new URLSearchParams(options.body as string);
    expect(params.get('post_on')).toBe('page');
    expect(params.get('page_id')).toBe('123456');
  });

  it('normalizes numeric Entreprenrs destination metadata values', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ post_id: 'page-2' }),
    });

    const adapter = new EntreprenrsAdapter();
    await adapter.publishPost(
      JSON.stringify({ accessToken: 'access-token', serverKey: 'server-key', userId: '42' }),
      {
        text: 'Numeric page destination',
        metadata: {
          post_on: 'PAGE',
          page_id: 987654,
        },
      },
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const params = new URLSearchParams(options.body as string);
    expect(params.get('post_on')).toBe('page');
    expect(params.get('page_id')).toBe('987654');
  });

  it('auto-resolves Entreprenrs user_id for legacy token payloads', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user_data: {
            user_id: 99,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ post_id: 'legacy-1' }),
    });

    const adapter = new EntreprenrsAdapter();
    await adapter.publishPost(
      JSON.stringify({ accessToken: 'access-token', serverKey: 'server-key' }),
      { text: 'Legacy payload still publishes' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const verifyUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    const [createPostUrl, createPostOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    const parsedCreatePostUrl = new URL(createPostUrl);
    const bodyParams = new URLSearchParams(createPostOptions.body as string);

    expect(`${verifyUrl.origin}${verifyUrl.pathname}`).toBe('https://entreprenrs.com/api/get-user-data');
    expect(parsedCreatePostUrl.searchParams.get('user_id')).toBe('99');
    expect(bodyParams.get('user_id')).toBe('99');
  });

  it('falls back to alternate Entreprenrs create-post endpoint format when API type is not found', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          api_status: '400',
          api_text: 'failed',
          errors: { error_text: 'Error: 404 API Type Not Found' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ post_id: 'fallback-1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new EntreprenrsAdapter();
    const result = await adapter.publishPost(
      JSON.stringify({ accessToken: 'access-token', serverKey: 'server-key', userId: '42' }),
      { text: 'Fallback publish works' },
    );

    expect(result.platformPostId).toBe('fallback-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    const secondUrl = new URL(fetchMock.mock.calls[1]?.[0] as string);
    expect(`${firstUrl.origin}${firstUrl.pathname}`).toBe('https://entreprenrs.com/api/create-post');
    expect(`${secondUrl.origin}${secondUrl.pathname}`).toBe('https://entreprenrs.com/api/create_post');
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

  it('uploads Chrxstians media as multipart payload so images are attached on publish', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('image-bytes', {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              src: 'photos/2026/03/probe.png',
              url: 'https://chrxstians.sfo3.digitaloceanspaces.com/uploads/photos/2026/03/probe.png',
              name: 'probe.png',
              guid: 'probe-guid',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              id: 'chrx-media-post-1',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const adapter = new ChrxstiansAdapter();
    const result = await adapter.publishPost(
      JSON.stringify({
        accessToken: 'jwt-token',
        apiKey: 'chrx-key',
        apiSecret: 'chrx-secret',
      }),
      {
        text: 'Image publish payload',
        mediaUrls: ['https://cdn.example.com/launch-image.png'],
        metadata: {
          destination: 'page',
          pageId: '321',
        },
      },
    );

    expect(result.platformPostId).toBe('chrx-media-post-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://cdn.example.com/launch-image.png');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://chrxstians.com/apis/php/data/upload');
    const uploadOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(uploadOptions.body).toBeInstanceOf(FormData);

    const [publishUrl, publishOptions] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(publishUrl).toBe('https://chrxstians.com/apis/php/posts/create');
    expect(publishOptions.headers).toMatchObject({
      'x-api-key': 'chrx-key',
      'x-auth-token': 'jwt-token',
    });
    expect((publishOptions.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(publishOptions.body).toBeInstanceOf(FormData);

    const form = publishOptions.body as FormData;
    expect(form.get('text')).toBe('Image publish payload');
    expect(form.get('post_on')).toBe('page');
    expect(form.get('page_id')).toBe('321');
    expect(form.get('media_url')).toBeNull();
    expect(form.get('postFile')).toBeTruthy();
    expect(form.get('postPhoto')).toBeTruthy();
  });

  it('uploads Iohah media as multipart payload so images are attached on publish', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('image-bytes', {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              src: 'photos/2026/03/probe.png',
              url: 'https://iohah.sfo3.digitaloceanspaces.com/uploads/photos/2026/03/probe.png',
              name: 'probe.png',
              guid: 'probe-guid',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              id: 'iohah-media-post-1',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const adapter = new IohahAdapter();
    const result = await adapter.publishPost(
      JSON.stringify({
        accessToken: 'jwt-token',
        apiKey: 'iohah-key',
        apiSecret: 'iohah-secret',
      }),
      {
        text: 'Image publish payload',
        mediaUrls: ['https://cdn.example.com/launch-image.png'],
        metadata: {
          destination: 'group',
          groupId: '456',
        },
      },
    );

    expect(result.platformPostId).toBe('iohah-media-post-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://cdn.example.com/launch-image.png');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://iohah.com/apis/php/data/upload');
    const uploadOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(uploadOptions.body).toBeInstanceOf(FormData);

    const [publishUrl, publishOptions] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(publishUrl).toBe('https://iohah.com/apis/php/posts/create');
    expect(publishOptions.headers).toMatchObject({
      'x-api-key': 'iohah-key',
      'x-auth-token': 'jwt-token',
    });
    expect((publishOptions.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(publishOptions.body).toBeInstanceOf(FormData);

    const form = publishOptions.body as FormData;
    expect(form.get('text')).toBe('Image publish payload');
    expect(form.get('post_on')).toBe('group');
    expect(form.get('group_id')).toBe('456');
    expect(form.get('media_url')).toBeNull();
    expect(form.get('postFile')).toBeTruthy();
    expect(form.get('postPhoto')).toBeTruthy();
  });

  it('does not append media URL into Iohah caption text when link equals media URL', async () => {
    const mediaUrl = 'https://cdn.example.com/dup-image.png';
    fetchMock
      .mockResolvedValueOnce(
        new Response('image-bytes', {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              src: 'photos/2026/03/dup-image.png',
              url: 'https://iohah.sfo3.digitaloceanspaces.com/uploads/photos/2026/03/dup-image.png',
              name: 'dup-image.png',
              guid: 'dup-guid',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { id: 'iohah-media-post-2' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const adapter = new IohahAdapter();
    await adapter.publishPost(
      JSON.stringify({
        accessToken: 'jwt-token',
        apiKey: 'iohah-key',
        apiSecret: 'iohah-secret',
      }),
      {
        text: 'Caption only',
        link: mediaUrl,
        mediaUrls: [mediaUrl],
      },
    );

    const [, publishOptions] = fetchMock.mock.calls[2] as [string, RequestInit];
    const form = publishOptions.body as FormData;
    expect(form.get('text')).toBe('Caption only');
  });

  it('publishes Iohah posts using signed payload fallbacks and includes destination metadata', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'error',
            message: 'Bad Request, invalid parameters',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              id: 'iohah-post-42',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const adapter = new IohahAdapter();
    const result = await adapter.publishPost(
      JSON.stringify({
        accessToken: 'jwt-token',
        apiKey: 'iohah-key',
        apiSecret: 'iohah-secret',
      }),
      {
        text: 'Signed publish payload',
        metadata: {
          destination: 'page',
          pageId: '789',
        },
      },
    );

    expect(result.platformPostId).toBe('iohah-post-42');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [firstUrl, firstOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstUrl).toBe('https://iohah.com/apis/php/posts/create');
    expect(firstOptions.headers).toMatchObject({
      'x-api-key': 'iohah-key',
      'x-auth-token': 'jwt-token',
      'Content-Type': 'application/json',
    });
    const firstPayload = JSON.parse(firstOptions.body as string) as Record<string, unknown>;
    expect(firstPayload.text).toBe('Signed publish payload');
    expect(firstPayload.post_on).toBe('page');
    expect(firstPayload.page_id).toBe('789');

    const [, secondOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    const secondPayload = JSON.parse(secondOptions.body as string) as Record<string, unknown>;
    expect(secondPayload.message).toBe('Signed publish payload');
    expect(secondPayload.post_on).toBe('page');
    expect(secondPayload.page_id).toBe('789');
  });

  it('surfaces actionable error when configured Iohah publish endpoint returns 404', async () => {
    const previousEndpoint = process.env.IOHAH_PUBLISH_ENDPOINT;
    process.env.IOHAH_PUBLISH_ENDPOINT = '/api/custom-publish';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'error',
          message: '404 Not Found',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new IohahAdapter();
    try {
      await expect(
        adapter.publishPost(
          JSON.stringify({
            accessToken: 'jwt-token',
            apiKey: 'iohah-key',
            apiSecret: 'iohah-secret',
          }),
          { text: 'Signed publish payload' },
        ),
      ).rejects.toThrow(
        'Iohah publish endpoint is unavailable (404). Configure IOHAH_PUBLISH_ENDPOINT or IOHAH_PUBLISH_ENDPOINTS to your instance post API route.',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [firstUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(firstUrl).toBe('https://iohah.com/api/custom-publish');
    } finally {
      if (previousEndpoint === undefined) {
        delete process.env.IOHAH_PUBLISH_ENDPOINT;
      } else {
        process.env.IOHAH_PUBLISH_ENDPOINT = previousEndpoint;
      }
    }
  });
});
