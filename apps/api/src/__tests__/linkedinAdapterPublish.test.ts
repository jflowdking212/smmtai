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
});
