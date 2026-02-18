import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TikTokAdapter } from '../services/platforms/major.js';

const ORIGINAL_TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const ORIGINAL_TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const ORIGINAL_TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;

describe('TikTokAdapter OAuth', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.TIKTOK_CLIENT_KEY = 'tiktok-client-key';
    process.env.TIKTOK_CLIENT_SECRET = 'tiktok-client-secret';
    process.env.TIKTOK_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/tiktok/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.TIKTOK_CLIENT_KEY = ORIGINAL_TIKTOK_CLIENT_KEY;
    process.env.TIKTOK_CLIENT_SECRET = ORIGINAL_TIKTOK_CLIENT_SECRET;
    process.env.TIKTOK_REDIRECT_URI = ORIGINAL_TIKTOK_REDIRECT_URI;
  });

  it('builds OAuth URL with configured callback URI', () => {
    const state = 'signed-state-token';
    const authUrl = new URL(new TikTokAdapter().getAuthUrl(state));

    expect(authUrl.searchParams.get('state')).toBe(state);
    expect(authUrl.searchParams.get('client_key')).toBe(process.env.TIKTOK_CLIENT_KEY);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.TIKTOK_REDIRECT_URI);
    expect(authUrl.searchParams.get('response_type')).toBe('code');
  });

  it('exchanges auth code using configured callback URI', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'tiktok-token', refresh_token: 'tiktok-refresh', expires_in: 7200 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new TikTokAdapter().exchangeCode('tiktok-auth-code');

    expect(tokens.accessToken).toBe('tiktok-token');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://open.tiktokapis.com/v2/oauth/token/');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
    const params = new URLSearchParams(requestOptions?.body || '');
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('tiktok-auth-code');
    expect(params.get('redirect_uri')).toBe(process.env.TIKTOK_REDIRECT_URI);
    expect(params.get('client_key')).toBe(process.env.TIKTOK_CLIENT_KEY);
    expect(params.get('client_secret')).toBe(process.env.TIKTOK_CLIENT_SECRET);
  });

  it('surfaces OAuth exchange errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'invalid authorization code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(new TikTokAdapter().exchangeCode('bad-code')).rejects.toThrow(
      'invalid authorization code',
    );
  });
});
