import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntreprenrsAdapter } from '../services/platforms/custom.js';

describe('EntreprenrsAdapter auth flow', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new EntreprenrsAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses manual setup URL instead of OAuth authorize endpoint', () => {
    expect(adapter.getAuthUrl('ignored-state')).toBe('/connections/entreprenrs/setup');
  });

  it('verifies credentials during exchange and stores normalized payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          user_data: {
            user_id: 'acct_1',
            name: 'Entreprenrs Account',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.exchangeCode(
      JSON.stringify({
        accessToken: ' access-token ',
        serverKey: ' server-key ',
      }),
    );

    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://entreprenrs.com/api/get-user-data');
    expect(requestUrl.searchParams.get('access_token')).toBe('access-token');
    expect(requestUrl.searchParams.get('server_key')).toBe('server-key');
    expect(requestUrl.searchParams.get('fetch')).toBe('user_data');
    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'access-token',
      serverKey: 'server-key',
      userId: 'acct_1',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('surfaces entreprenrs credential verification errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: {
            error_text: 'Invalid access token',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      adapter.exchangeCode(
        JSON.stringify({
          accessToken: 'bad-token',
          serverKey: 'server-key',
        }),
      ),
    ).rejects.toThrow('Invalid access token');
  });

  it('revalidates refresh payload and returns normalized credentials', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          user_data: {
            user_id: 101,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.refreshAccessToken(
      JSON.stringify({
        token: ' access-token ',
        server_key: ' server-key ',
      }),
    );

    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'access-token',
      serverKey: 'server-key',
      userId: '101',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('rejects malformed credential payloads before API calls', async () => {
    await expect(adapter.exchangeCode('access-token-only')).rejects.toThrow(
      'Provide entreprenrs credentials as JSON: {"accessToken":"token","serverKey":"server-key"} or {"username":"user","password":"pass","serverKey":"server-key"}',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects server-key-only payloads', async () => {
    await expect(
      adapter.exchangeCode(
        JSON.stringify({
          serverKey: 'server-key',
        }),
      ),
    ).rejects.toThrow(
      'Provide entreprenrs credentials as JSON: {"accessToken":"token","serverKey":"server-key"} or {"username":"user","password":"pass","serverKey":"server-key"}',
    );
  });

  it('exchanges username/password credentials through /api/auth', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'fresh-access-token',
          user_id: 101,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user_data: {
            user_id: 101,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.exchangeCode(
      JSON.stringify({
        username: ' founder ',
        password: ' password123 ',
        serverKey: ' server-key ',
      }),
    );

    const authRequestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    const verifyRequestUrl = new URL(fetchMock.mock.calls[1]?.[0] as string);
    expect(`${authRequestUrl.origin}${authRequestUrl.pathname}`).toBe('https://entreprenrs.com/api/auth');
    expect(authRequestUrl.searchParams.get('server_key')).toBe('server-key');
    expect(verifyRequestUrl.searchParams.get('access_token')).toBe('fresh-access-token');
    expect(verifyRequestUrl.searchParams.get('server_key')).toBe('server-key');
    expect(verifyRequestUrl.searchParams.get('user_id')).toBe('101');
    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'fresh-access-token',
      serverKey: 'server-key',
      userId: '101',
    });
  });
});
