import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramAdapter } from '../services/platforms/new.js';

describe('TelegramAdapter auth flow', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new TelegramAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses manual setup URL instead of OAuth authorize endpoint', () => {
    expect(adapter.getAuthUrl('ignored-state')).toBe('/connections/telegram/setup');
  });

  it('surfaces Telegram bot verification errors during exchange', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          description: 'Unauthorized',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      adapter.exchangeCode(JSON.stringify({ botToken: 'bad-bot-token', chatId: '@channel' })),
    ).rejects.toThrow('Unauthorized');
  });

  it('revalidates refresh payload and returns normalized credentials', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: { id: 9001 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.refreshAccessToken(
      JSON.stringify({
        token: ' bot-token-7 ',
        channelUsername: ' @updates ',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/botbot-token-7/getMe');
    expect(JSON.parse(tokens.accessToken)).toEqual({
      botToken: 'bot-token-7',
      chatId: '@updates',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('rejects malformed JSON payloads before Telegram API calls', async () => {
    await expect(
      adapter.exchangeCode('{"chatId":"@channel"}'),
    ).rejects.toThrow(
      'Provide Telegram credentials as JSON: {"botToken":"123456:ABC","chatId":"@mychannel"}',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
