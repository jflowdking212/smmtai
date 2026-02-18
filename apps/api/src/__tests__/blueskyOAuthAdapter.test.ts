import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueskyAdapter } from '../services/platforms/new.js';

describe('BlueskyAdapter auth flow', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new BlueskyAdapter();
  const credentials = JSON.stringify({
    identifier: 'user.bsky.social',
    password: 'app-password',
  });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses manual setup URL instead of OAuth authorize endpoint', () => {
    expect(adapter.getAuthUrl('ignored-state')).toBe('/connections/bluesky/setup');
  });

  it('verifies credentials during exchange and stores normalized credential payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          accessJwt: 'access-jwt',
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.exchangeCode(credentials);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://bsky.social/xrpc/com.atproto.server.createSession');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { method?: string; body?: string } | undefined;
    expect(requestOptions?.method).toBe('POST');
    expect(JSON.parse(requestOptions?.body || '{}')).toEqual({
      identifier: 'user.bsky.social',
      password: 'app-password',
    });
    expect(JSON.parse(tokens.accessToken)).toEqual({
      identifier: 'user.bsky.social',
      password: 'app-password',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('surfaces Bluesky credential verification errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Invalid identifier or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(adapter.exchangeCode(credentials)).rejects.toThrow('Invalid identifier or password');
  });

  it('revalidates credentials during refresh and returns normalized payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          accessJwt: 'access-jwt',
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const refreshed = await adapter.refreshAccessToken(
      JSON.stringify({
        identifier: ' user.bsky.social ',
        password: ' app-password ',
      }),
    );

    expect(JSON.parse(refreshed.accessToken)).toEqual({
      identifier: 'user.bsky.social',
      password: 'app-password',
    });
    expect(refreshed.refreshToken).toBe(refreshed.accessToken);
  });

  it('rejects malformed credential payloads before making API calls', async () => {
    await expect(adapter.exchangeCode('bad-credentials')).rejects.toThrow(
      'Provide Bluesky credentials as JSON: {"identifier":"you.bsky.social","password":"app-password"}',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
