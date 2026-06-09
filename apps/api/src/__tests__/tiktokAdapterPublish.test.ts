import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TikTokAdapter } from '../services/platforms/major.js';

describe('TikTokAdapter publishing', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const previousFallbackMode = process.env.TIKTOK_ENABLE_MEDIA_UPLOAD_FALLBACK;
  const previousProxyEnabled = process.env.TIKTOK_MEDIA_PROXY_ENABLED;
  const previousProxyBaseUrl = process.env.TIKTOK_MEDIA_PROXY_BASE_URL;
  const previousProxySecret = process.env.TIKTOK_MEDIA_PROXY_SECRET;
  const previousProxyTtl = process.env.TIKTOK_MEDIA_PROXY_TTL_SECONDS;
  const previousStatusPollAttempts = process.env.TIKTOK_PUBLISH_STATUS_POLL_ATTEMPTS;
  const previousStatusPollDelayMs = process.env.TIKTOK_PUBLISH_STATUS_POLL_DELAY_MS;
  const createAdapter = () => new TikTokAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.TIKTOK_ENABLE_MEDIA_UPLOAD_FALLBACK;
    delete process.env.TIKTOK_MEDIA_PROXY_ENABLED;
    delete process.env.TIKTOK_MEDIA_PROXY_BASE_URL;
    delete process.env.TIKTOK_MEDIA_PROXY_SECRET;
    delete process.env.TIKTOK_MEDIA_PROXY_TTL_SECONDS;
    process.env.TIKTOK_PUBLISH_STATUS_POLL_ATTEMPTS = '1';
    process.env.TIKTOK_PUBLISH_STATUS_POLL_DELAY_MS = '1';
  });

  afterEach(() => {
    if (previousFallbackMode === undefined) {
      delete process.env.TIKTOK_ENABLE_MEDIA_UPLOAD_FALLBACK;
    } else {
      process.env.TIKTOK_ENABLE_MEDIA_UPLOAD_FALLBACK = previousFallbackMode;
    }

    if (previousProxyEnabled === undefined) {
      delete process.env.TIKTOK_MEDIA_PROXY_ENABLED;
    } else {
      process.env.TIKTOK_MEDIA_PROXY_ENABLED = previousProxyEnabled;
    }
    if (previousProxyBaseUrl === undefined) {
      delete process.env.TIKTOK_MEDIA_PROXY_BASE_URL;
    } else {
      process.env.TIKTOK_MEDIA_PROXY_BASE_URL = previousProxyBaseUrl;
    }
    if (previousProxySecret === undefined) {
      delete process.env.TIKTOK_MEDIA_PROXY_SECRET;
    } else {
      process.env.TIKTOK_MEDIA_PROXY_SECRET = previousProxySecret;
    }
    if (previousProxyTtl === undefined) {
      delete process.env.TIKTOK_MEDIA_PROXY_TTL_SECONDS;
    } else {
      process.env.TIKTOK_MEDIA_PROXY_TTL_SECONDS = previousProxyTtl;
    }
    if (previousStatusPollAttempts === undefined) {
      delete process.env.TIKTOK_PUBLISH_STATUS_POLL_ATTEMPTS;
    } else {
      process.env.TIKTOK_PUBLISH_STATUS_POLL_ATTEMPTS = previousStatusPollAttempts;
    }
    if (previousStatusPollDelayMs === undefined) {
      delete process.env.TIKTOK_PUBLISH_STATUS_POLL_DELAY_MS;
    } else {
      process.env.TIKTOK_PUBLISH_STATUS_POLL_DELAY_MS = previousStatusPollDelayMs;
    }

    vi.unstubAllGlobals();
  });

  it('publishes video posts through the video init endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'],
              comment_disabled: false,
              duet_disabled: false,
              stitch_disabled: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { publish_id: 'video_publish_1' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: '7619271234567890000' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const result = await createAdapter().publishPost('tiktok-access-token', {
      text: 'Launching with #video',
      mediaType: 'video',
      mediaUrls: ['https://cdn.example.com/reel.mp4'],
      metadata: { privacyLevel: 'SELF_ONLY', disableComment: true },
    });

    expect(result.platformPostId).toBe('video_publish_1');
    expect(result.url).toBe('https://www.tiktok.com/video/7619271234567890000');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/creator_info/query/');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/video/init/');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/status/fetch/');
    const payload = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body || '{}');
    expect(payload).toEqual(
      expect.objectContaining({
        post_info: expect.objectContaining({
          privacy_level: 'SELF_ONLY',
          disable_comment: true,
        }),
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: 'https://cdn.example.com/reel.mp4',
        },
      }),
    );
  });

  it('publishes photo posts through the content init endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              privacy_level_options: ['PUBLIC_TO_EVERYONE'],
              comment_disabled: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { publish_id: 'photo_publish_1' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: '7619272234567890000' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const result = await createAdapter().publishPost('tiktok-access-token', {
      text: 'Carousel style photo post',
      mediaType: 'image',
      mediaUrls: [
        'https://cdn.example.com/photo-1.png',
        'https://cdn.example.com/photo-2.jpg',
      ],
      metadata: {
        photoCoverIndex: 1,
        autoAddMusic: true,
        brandContentToggle: false,
        brandOrganicToggle: true,
      },
    });

    expect(result.platformPostId).toBe('photo_publish_1');
    expect(result.url).toBe('https://www.tiktok.com/video/7619272234567890000');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/creator_info/query/');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/content/init/');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/status/fetch/');
    const payload = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body || '{}');
    expect(payload).toEqual(
      expect.objectContaining({
        media_type: 'PHOTO',
        post_mode: 'DIRECT_POST',
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 1,
          photo_images: ['https://cdn.example.com/photo-1.png', 'https://cdn.example.com/photo-2.jpg'],
        },
      }),
    );
    expect(payload.post_info).toEqual(
      expect.objectContaining({
        title: 'Carousel style photo post',
        description: 'Carousel style photo post',
        auto_add_music: true,
        brand_content_toggle: false,
        brand_organic_toggle: true,
      }),
    );
  });

  it('fails in browser-only mode without MEDIA_UPLOAD fallback when direct photo init fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              privacy_level_options: ['PUBLIC_TO_EVERYONE'],
              comment_disabled: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'unaudited_client_can_only_post_to_private_accounts',
              message: 'client unaudited',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(
      createAdapter().publishPost('tiktok-access-token', {
        text: 'Fallback photo post',
        mediaType: 'image',
        mediaUrls: ['https://cdn.example.com/photo-1.png'],
      }),
    ).rejects.toThrow('MEDIA_UPLOAD fallback is disabled because this workspace is configured for browser-only publishing');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/content/init/');
  });

  it('falls back to MEDIA_UPLOAD photo mode when explicitly enabled', async () => {
    process.env.TIKTOK_ENABLE_MEDIA_UPLOAD_FALLBACK = 'true';
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              privacy_level_options: ['PUBLIC_TO_EVERYONE'],
              comment_disabled: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'unaudited_client_can_only_post_to_private_accounts',
              message: 'client unaudited',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { publish_id: 'photo_upload_1' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { status: 'PUBLISH_COMPLETE' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const result = await createAdapter().publishPost('tiktok-access-token', {
      text: 'Fallback photo post',
      mediaType: 'image',
      mediaUrls: ['https://cdn.example.com/photo-1.png'],
    });

    expect(result.platformPostId).toBe('photo_upload_1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/content/init/');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://open.tiktokapis.com/v2/post/publish/content/init/');
    const fallbackPayload = JSON.parse((fetchMock.mock.calls[2]?.[1] as { body?: string })?.body || '{}');
    expect(fallbackPayload).toEqual(
      expect.objectContaining({
        post_mode: 'MEDIA_UPLOAD',
        media_type: 'PHOTO',
      }),
    );
  });

  it('wraps media URLs through the TikTok proxy endpoint when enabled', async () => {
    process.env.TIKTOK_MEDIA_PROXY_ENABLED = 'true';
    process.env.TIKTOK_MEDIA_PROXY_BASE_URL = 'https://smmtai.com';
    process.env.TIKTOK_MEDIA_PROXY_SECRET = 'proxy-test-secret';
    process.env.TIKTOK_MEDIA_PROXY_TTL_SECONDS = '3600';

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              privacy_level_options: ['PUBLIC_TO_EVERYONE'],
              comment_disabled: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { publish_id: 'photo_publish_proxy' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { status: 'PUBLISH_COMPLETE' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const result = await createAdapter().publishPost('tiktok-access-token', {
      text: 'Proxy photo post',
      mediaType: 'image',
      mediaUrls: ['https://ee-smmt.sfo3.digitaloceanspaces.com/example.png'],
    });

    expect(result.platformPostId).toBe('photo_publish_proxy');
    const payload = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body || '{}');
    const proxiedUrl = payload?.source_info?.photo_images?.[0];
    expect(typeof proxiedUrl).toBe('string');
    expect(proxiedUrl).toContain('https://smmtai.com/api/v1/posts/media/tiktok-proxy?');
    expect(proxiedUrl).toContain('url=https%3A%2F%2Fee-smmt.sfo3.digitaloceanspaces.com%2Fexample.png');
    expect(proxiedUrl).toContain('expires=');
    expect(proxiedUrl).toContain('sig=');
  });

  it('fails when TikTok publish status reports FAILED', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              privacy_level_options: ['SELF_ONLY'],
              comment_disabled: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { publish_id: 'photo_publish_failed' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { status: 'FAILED', fail_reason: 'file_format_check_failed' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(
      createAdapter().publishPost('tiktok-access-token', {
        text: 'Bad media test',
        mediaType: 'image',
        mediaUrls: ['https://cdn.example.com/photo.png'],
      }),
    ).rejects.toThrow('TikTok publish failed (file_format_check_failed)');
  });

  it('rejects text-only posts because TikTok requires media', async () => {
    await expect(
      createAdapter().publishPost('tiktok-access-token', {
        text: 'Text only',
      }),
    ).rejects.toThrow('Text-only posts are not supported');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects mixed image and video attachments', async () => {
    await expect(
      createAdapter().publishPost('tiktok-access-token', {
        text: 'Mixed media',
        mediaUrls: ['https://cdn.example.com/photo.png', 'https://cdn.example.com/clip.mp4'],
      }),
    ).rejects.toThrow('does not support mixed photo and video');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
