import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PinterestAdapter } from '../services/platforms/major.js';

describe('PinterestAdapter publishing', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new PinterestAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes image pins with board id from metadata', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'pin_1', url: 'https://pinterest.com/pin/1' }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await adapter.publishPost('pinterest-token', {
      text: 'Launch day',
      hashtags: ['growth'],
      mediaUrls: ['https://cdn.example.com/pin.jpg'],
      metadata: { boardId: 'board_123', altText: 'Launch visual' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.pinterest.com/v5/pins');
    const payload = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body?: string })?.body || '{}');
    expect(payload).toEqual(
      expect.objectContaining({
        board_id: 'board_123',
        title: 'Launch day #growth',
        description: 'Launch day #growth',
        media_source: { source_type: 'image_url', url: 'https://cdn.example.com/pin.jpg' },
        alt_text: 'Launch visual',
      }),
    );
    expect(result).toEqual({
      platformPostId: 'pin_1',
      url: 'https://pinterest.com/pin/1',
    });
  });

  it('resolves board automatically and publishes video pins', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [{ id: 'board_auto' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'pin_2' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await adapter.publishPost('pinterest-token', {
      text: 'Video launch',
      mediaType: 'video',
      mediaUrls: ['https://cdn.example.com/video.mp4'],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.pinterest.com/v5/boards?page_size=1');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.pinterest.com/v5/pins');
    const payload = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body || '{}');
    expect(payload.board_id).toBe('board_auto');
    expect(payload.media_source).toEqual({
      source_type: 'video_url',
      url: 'https://cdn.example.com/video.mp4',
    });
  });

  it('throws API error messages when publish fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Invalid board selection' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      adapter.publishPost('pinterest-token', {
        text: 'Bad request',
        mediaUrls: ['https://cdn.example.com/pin.jpg'],
        metadata: { boardId: 'bad-board' },
      }),
    ).rejects.toThrow('Invalid board selection');
  });
});
