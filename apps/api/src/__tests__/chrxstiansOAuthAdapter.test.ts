import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { ChrxstiansAdapter } from '../services/platforms/custom.js';

describe('ChrxstiansAdapter auth flow', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new ChrxstiansAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses manual setup URL instead of OAuth authorize endpoint', () => {
    expect(adapter.getAuthUrl('ignored-state')).toBe('/connections/chrxstians/setup');
  });

  it('supports legacy access-token verification mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'acct_1',
          name: 'Chrxstians Account',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.exchangeCode(
      JSON.stringify({
        accessToken: ' bearer-token ',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chrxstians.com/api/me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer bearer-token' },
      }),
    );
    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'bearer-token',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('authenticates with api key/secret + username/password and stores normalized payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            token: 'jwt-token',
            user: {
              user_id: '42',
              user_fullname: 'Chrx Account',
              user_picture_full: 'https://chrxstians.com/avatar.jpg',
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.exchangeCode(
      JSON.stringify({
        apiKey: ' api-key ',
        apiSecret: ' api-secret ',
        usernameEmail: ' user@example.com ',
        password: 'secret',
      }),
    );

    const expectedTimestamp = Math.floor(new Date('2026-03-12T00:00:00.000Z').getTime() / 1000).toString();
    const expectedSignature = createHmac('sha256', 'api-secret').update(expectedTimestamp).digest('hex');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chrxstians.com/apis/php/auth/signin',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'api-key',
          'x-timestamp': expectedTimestamp,
          'x-signature': expectedSignature,
        }),
      }),
    );
    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'jwt-token',
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      accountId: '42',
      accountName: 'Chrx Account',
      avatar: 'https://chrxstians.com/avatar.jpg',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('verifies signed token mode via ping endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: false,
          message: 'pong',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const account = await adapter.getAccountInfo(
      JSON.stringify({
        accessToken: 'jwt-token',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        accountId: '101',
        accountName: 'Richard Jude',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://chrxstians.com/apis/php/ping'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-api-key': 'api-key',
          'x-auth-token': 'jwt-token',
        }),
      }),
    );
    expect(account).toEqual({
      id: '101',
      name: 'Richard Jude',
    });
  });

  it('surfaces chrxstians credential verification errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Invalid token',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      adapter.exchangeCode(
        JSON.stringify({
          accessToken: 'bad-token',
        }),
      ),
    ).rejects.toThrow('Invalid token');
  });

  it('revalidates refresh payload and returns normalized credentials', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 101,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.refreshAccessToken(
      JSON.stringify({
        token: ' bearer-token ',
      }),
    );

    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'bearer-token',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('rejects malformed credential payloads before API calls', async () => {
    await expect(adapter.exchangeCode('bearer-token')).rejects.toThrow(
      'Provide chrxstians credentials as JSON: {"accessToken":"token"} or {"accessToken":"token","apiKey":"key","apiSecret":"secret"} or {"apiKey":"key","apiSecret":"secret","usernameEmail":"email-or-username","password":"password"}',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
