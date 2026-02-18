import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramAdapter } from '../services/platforms/new.js';

describe('TelegramAdapter', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new TelegramAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores normalized bot token and chat id payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: { id: 1000 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.exchangeCode(JSON.stringify({
      botToken: ' bot-token-1 ',
      chatId: ' @channel_name ',
    }));

    expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/botbot-token-1/getMe');

    expect(tokens.accessToken).toBe(JSON.stringify({
      botToken: 'bot-token-1',
      chatId: '@channel_name',
    }));
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('verifies account info using bot token from credential payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            id: 1001,
            first_name: 'My Bot',
            username: 'my_bot',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const account = await adapter.getAccountInfo(JSON.stringify({
      botToken: 'bot-token-2',
      chatId: '@channel',
    }));

    expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/botbot-token-2/getMe');
    expect(account).toEqual(
      expect.objectContaining({
        id: '1001',
        name: 'My Bot',
        username: 'my_bot',
      }),
    );
  });

  it('publishes text messages using default chat id from stored credentials', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: { message_id: 55 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await adapter.publishPost(
      JSON.stringify({ botToken: 'bot-token-3', chatId: '@channel' }),
      { text: 'Hello Telegram!' },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token-3/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const sentPayload = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body?: string })?.body || '{}');
    expect(sentPayload).toEqual(expect.objectContaining({
      chat_id: '@channel',
      text: 'Hello Telegram!',
    }));
    expect(result.platformPostId).toBe('55');
  });

  it('publishes media posts using appropriate Telegram endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: { message_id: 77 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await adapter.publishPost(
      JSON.stringify({ botToken: 'bot-token-4', chatId: '-1009876543210' }),
      { text: 'Image caption', mediaUrls: ['https://cdn.example.com/post-image.png'] },
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.telegram.org/botbot-token-4/sendPhoto');

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: { message_id: 88 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await adapter.publishPost(
      JSON.stringify({ botToken: 'bot-token-4', chatId: '-1009876543210' }),
      { text: 'Video caption', mediaUrls: ['https://cdn.example.com/video.mp4'] },
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.telegram.org/botbot-token-4/sendVideo');
  });

  it('requires chat id for publishing', async () => {
    await expect(
      adapter.publishPost(JSON.stringify({ botToken: 'bot-token-5' }), { text: 'No chat id' }),
    ).rejects.toThrow('Telegram publish requires a chat ID or channel username');
  });
});
