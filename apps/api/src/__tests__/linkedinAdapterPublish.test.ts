import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkedInAdapter } from '../services/platforms/major.js';

describe('LinkedInAdapter publishing', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new LinkedInAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes text-only posts with explicit LinkedIn payload mapping', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sub: 'person-123', name: 'Casey' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'urn:li:ugcPost:111' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const result = await adapter.publishPost('linkedin-access-token', {
      text: 'Shipping update',
      hashtags: ['growth'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.linkedin.com/v2/userinfo');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.linkedin.com/v2/ugcPosts');
    const publishPayload = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body || '{}');
    expect(publishPayload).toEqual(
      expect.objectContaining({
        author: 'urn:li:person:person-123',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: 'Shipping update #growth' },
            shareMediaCategory: 'NONE',
          },
        },
      }),
    );
    expect(result.platformPostId).toBe('urn:li:ugcPost:111');
  });

  it('uploads image media and publishes LinkedIn IMAGE share posts', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sub: 'person-999', name: 'Jordan' }),
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
            value: {
              asset: 'urn:li:digitalmediaAsset:C12345',
              uploadMechanism: {
                'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                  uploadUrl: 'https://upload.linkedin.example/media',
                },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'urn:li:ugcPost:222' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await adapter.publishPost('linkedin-access-token', {
      text: 'Image update',
      mediaUrls: ['https://cdn.example.com/photo.png'],
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://cdn.example.com/photo.png');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://api.linkedin.com/v2/assets?action=registerUpload');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('https://upload.linkedin.example/media');
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
      }),
    );
    const publishPayload = JSON.parse((fetchMock.mock.calls[4]?.[1] as { body?: string })?.body || '{}');
    expect(publishPayload.specificContent['com.linkedin.ugc.ShareContent']).toEqual(
      expect.objectContaining({
        shareMediaCategory: 'IMAGE',
        media: [
          expect.objectContaining({
            media: 'urn:li:digitalmediaAsset:C12345',
            originalUrl: 'https://cdn.example.com/photo.png',
            status: 'READY',
          }),
        ],
      }),
    );
  });

  it('rejects non-image LinkedIn media uploads', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sub: 'person-777', name: 'Riley' }),
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
      adapter.publishPost('linkedin-access-token', {
        text: 'Video update',
        mediaUrls: ['https://cdn.example.com/video.mp4'],
      }),
    ).rejects.toThrow('LinkedIn currently supports image attachments only');
  });

  it('fetches analytics via LinkedIn REST socialActions endpoint with version header', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          impressionSummary: { impressionCount: 42 },
          likesSummary: { totalLikes: 8 },
          commentsSummary: { totalFirstLevelComments: 3 },
          sharesSummary: { count: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const analytics = await adapter.getPostAnalytics('linkedin-access-token', 'urn:li:ugcPost:999');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.linkedin.com/rest/socialActions/urn%3Ali%3AugcPost%3A999',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer linkedin-access-token',
          'Linkedin-Version': expect.any(String),
          'X-Restli-Protocol-Version': '2.0.0',
        }),
      }),
    );
    expect(analytics).toEqual(
      expect.objectContaining({
        impressions: 42,
        reach: 42,
        likes: 8,
        comments: 3,
        shares: 2,
      }),
    );
  });

  it('returns zero analytics when LinkedIn denies socialActions permissions', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Not enough permissions to access: socialActions.GET.NO_VERSION',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const analytics = await adapter.getPostAnalytics('linkedin-access-token', 'urn:li:ugcPost:1000');

    expect(analytics).toEqual(
      expect.objectContaining({
        impressions: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      }),
    );
    expect(analytics.metadata).toEqual(
      expect.objectContaining({
        warning: expect.stringContaining('Not enough permissions'),
      }),
    );
  });

  it('returns zero analytics when LinkedIn analytics fetch fails at network layer', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const analytics = await adapter.getPostAnalytics('linkedin-access-token', 'urn:li:ugcPost:1001');

    expect(analytics).toEqual(
      expect.objectContaining({
        impressions: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      }),
    );
    expect(analytics.metadata).toEqual(
      expect.objectContaining({
        warning: expect.stringContaining('temporarily unavailable'),
      }),
    );
  });
});
