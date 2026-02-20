import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PinterestAdapter } from '../services/platforms/major.js';

const ORIGINAL_PINTEREST_CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const ORIGINAL_PINTEREST_CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
const ORIGINAL_PINTEREST_REDIRECT_URI = process.env.PINTEREST_REDIRECT_URI;
const ORIGINAL_PINTEREST_APP_ID = process.env.PINTEREST_APP_ID;
const ORIGINAL_PINTEREST_APP_SECRET = process.env.PINTEREST_APP_SECRET;
const ORIGINAL_PINTEREST_CALLBACK_URL = process.env.PINTEREST_CALLBACK_URL;

describe('PinterestAdapter OAuth', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.PINTEREST_CLIENT_ID = 'pinterest-client-id';
    process.env.PINTEREST_CLIENT_SECRET = 'pinterest-client-secret';
    process.env.PINTEREST_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/pinterest/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.PINTEREST_CLIENT_ID = ORIGINAL_PINTEREST_CLIENT_ID;
    process.env.PINTEREST_CLIENT_SECRET = ORIGINAL_PINTEREST_CLIENT_SECRET;
    process.env.PINTEREST_REDIRECT_URI = ORIGINAL_PINTEREST_REDIRECT_URI;
    process.env.PINTEREST_APP_ID = ORIGINAL_PINTEREST_APP_ID;
    process.env.PINTEREST_APP_SECRET = ORIGINAL_PINTEREST_APP_SECRET;
    process.env.PINTEREST_CALLBACK_URL = ORIGINAL_PINTEREST_CALLBACK_URL;
  });

  it('builds OAuth URL with configured callback URI', () => {
    const state = 'signed-state-token';
    const authUrl = new URL(new PinterestAdapter().getAuthUrl(state));

    expect(authUrl.searchParams.get('state')).toBe(state);
    expect(authUrl.searchParams.get('client_id')).toBe(process.env.PINTEREST_CLIENT_ID);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.PINTEREST_REDIRECT_URI);
    expect(authUrl.searchParams.get('response_type')).toBe('code');
  });

  it('supports legacy Pinterest OAuth env aliases', () => {
    process.env.PINTEREST_CLIENT_ID = '';
    process.env.PINTEREST_CLIENT_SECRET = '';
    process.env.PINTEREST_APP_ID = 'pinterest-app-id';
    process.env.PINTEREST_APP_SECRET = 'pinterest-app-secret';
    process.env.PINTEREST_REDIRECT_URI = '';
    process.env.PINTEREST_CALLBACK_URL = 'https://example.com/connections/pinterest/callback';

    const authUrl = new URL(new PinterestAdapter().getAuthUrl('signed-state-token'));

    expect(authUrl.searchParams.get('client_id')).toBe(process.env.PINTEREST_APP_ID);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.PINTEREST_CALLBACK_URL);
  });

  it('exchanges auth code using configured callback URI', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'pinterest-token', refresh_token: 'pinterest-refresh', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new PinterestAdapter().exchangeCode('pinterest-auth-code');

    expect(tokens.accessToken).toBe('pinterest-token');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.pinterest.com/v5/oauth/token');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body?: string; headers?: Record<string, string> } | undefined;
    const params = new URLSearchParams(requestOptions?.body || '');
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('pinterest-auth-code');
    expect(params.get('redirect_uri')).toBe(process.env.PINTEREST_REDIRECT_URI);
    const expectedAuthorization = `Basic ${Buffer.from(`${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`).toString('base64')}`;
    expect(requestOptions?.headers?.Authorization).toBe(expectedAuthorization);
  });

  it('surfaces OAuth exchange errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'invalid_grant' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(new PinterestAdapter().exchangeCode('bad-code')).rejects.toThrow('invalid_grant');
  });

  it('refreshes access token with OAuth refresh endpoint payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'new-pinterest-token', refresh_token: 'new-pinterest-refresh', expires_in: 1800 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new PinterestAdapter().refreshAccessToken('pinterest-refresh-token');

    expect(tokens.accessToken).toBe('new-pinterest-token');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body?: string; headers?: Record<string, string> } | undefined;
    const params = new URLSearchParams(requestOptions?.body || '');
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('pinterest-refresh-token');
    const expectedAuthorization = `Basic ${Buffer.from(`${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`).toString('base64')}`;
    expect(requestOptions?.headers?.Authorization).toBe(expectedAuthorization);
  });
});
