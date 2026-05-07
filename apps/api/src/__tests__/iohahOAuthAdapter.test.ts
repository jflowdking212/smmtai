import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { IohahAdapter } from '../services/platforms/custom.js';

describe('IohahAdapter auth flow', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new IohahAdapter();

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
    expect(adapter.getAuthUrl('ignored-state')).toBe('/connections/iohah/setup');
  });

  it('verifies credentials during exchange and stores normalized payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          data: {
            token: 'jwt-token',
            user: {
              user_id: '7',
              user_fullname: 'Iohah Account',
              user_picture_full: 'https://iohah.com/avatar.png',
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
        usernameEmail: ' judeobidozie@gmail.com ',
        password: '@Jflowdking212',
      }),
    );

    const expectedTimestamp = Math.floor(new Date('2026-03-12T00:00:00.000Z').getTime() / 1000).toString();
    const expectedSignature = createHmac('sha256', 'api-secret').update(expectedTimestamp).digest('hex');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://iohah.com/apis/php/auth/signin',
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
      accountId: '7',
      accountName: 'Iohah Account',
      avatar: 'https://iohah.com/avatar.png',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('surfaces iohah credential verification errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid login',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      adapter.exchangeCode(
        JSON.stringify({
          apiKey: 'api-key',
          apiSecret: 'api-secret',
          usernameEmail: 'user@example.com',
          password: 'bad-pass',
        }),
      ),
    ).rejects.toThrow('Invalid login');
  });

  it('validates signed session on getAccountInfo using ping endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
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
      'https://iohah.com/apis/php/ping',
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

  it('rejects malformed credential payloads before API calls', async () => {
    await expect(adapter.exchangeCode('bearer-token')).rejects.toThrow(
      'Provide iohah credentials as JSON: {"accessToken":"token","apiKey":"key","apiSecret":"secret"} or {"apiKey":"key","apiSecret":"secret","usernameEmail":"email-or-username","password":"password"}',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
