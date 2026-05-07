import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TikTokAdapter } from '../services/platforms/major.js';
import crypto from 'crypto';

const ORIGINAL_TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const ORIGINAL_TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const ORIGINAL_TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;
const ORIGINAL_TIKTOK_CLIENT_ID = process.env.TIKTOK_CLIENT_ID;
const ORIGINAL_TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET;
const ORIGINAL_TIKTOK_CALLBACK_URL = process.env.TIKTOK_CALLBACK_URL;
const ORIGINAL_TIKTOK_AUTH_SCOPE = process.env.TIKTOK_AUTH_SCOPE;
const ORIGINAL_TIKTOK_SCOPES = process.env.TIKTOK_SCOPES;

function buildPkceCodeVerifier(state: string, clientSecret: string, clientKey: string): string {
  return crypto
    .createHash('sha256')
    .update(`${state}:${clientSecret || clientKey}`)
    .digest('base64url');
}

function buildPkceCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}

describe('TikTokAdapter OAuth', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.TIKTOK_CLIENT_KEY = 'tiktok-client-key';
    process.env.TIKTOK_CLIENT_SECRET = 'tiktok-client-secret';
    process.env.TIKTOK_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/tiktok/callback';
    process.env.TIKTOK_AUTH_SCOPE = '';
    process.env.TIKTOK_SCOPES = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.TIKTOK_CLIENT_KEY = ORIGINAL_TIKTOK_CLIENT_KEY;
    process.env.TIKTOK_CLIENT_SECRET = ORIGINAL_TIKTOK_CLIENT_SECRET;
    process.env.TIKTOK_REDIRECT_URI = ORIGINAL_TIKTOK_REDIRECT_URI;
    process.env.TIKTOK_CLIENT_ID = ORIGINAL_TIKTOK_CLIENT_ID;
    process.env.TIKTOK_APP_SECRET = ORIGINAL_TIKTOK_APP_SECRET;
    process.env.TIKTOK_CALLBACK_URL = ORIGINAL_TIKTOK_CALLBACK_URL;
    process.env.TIKTOK_AUTH_SCOPE = ORIGINAL_TIKTOK_AUTH_SCOPE;
    process.env.TIKTOK_SCOPES = ORIGINAL_TIKTOK_SCOPES;
  });

  it('builds OAuth URL with configured callback URI', () => {
    const state = 'signed-state-token';
    const authUrl = new URL(new TikTokAdapter().getAuthUrl(state));
    const expectedVerifier = buildPkceCodeVerifier(
      state,
      process.env.TIKTOK_CLIENT_SECRET || '',
      process.env.TIKTOK_CLIENT_KEY || '',
    );

    expect(authUrl.searchParams.get('state')).toBe(state);
    expect(authUrl.searchParams.get('client_key')).toBe(process.env.TIKTOK_CLIENT_KEY);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.TIKTOK_REDIRECT_URI);
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('scope')).toBe('user.info.profile,user.info.stats,video.list,video.publish');
    expect(authUrl.searchParams.get('disable_auto_auth')).toBe('1');
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('code_challenge')).toBe(buildPkceCodeChallenge(expectedVerifier));
  });

  it('supports legacy TikTok OAuth env aliases', () => {
    process.env.TIKTOK_CLIENT_KEY = '';
    process.env.TIKTOK_CLIENT_SECRET = '';
    process.env.TIKTOK_CLIENT_ID = 'legacy-tiktok-client-id';
    process.env.TIKTOK_APP_SECRET = 'legacy-tiktok-app-secret';
    process.env.TIKTOK_REDIRECT_URI = '';
    process.env.TIKTOK_CALLBACK_URL = 'https://example.com/connections/tiktok/callback';

    const authUrl = new URL(new TikTokAdapter().getAuthUrl('signed-state-token'));

    expect(authUrl.searchParams.get('client_key')).toBe(process.env.TIKTOK_CLIENT_ID);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.TIKTOK_CALLBACK_URL);
  });

  it('accepts custom OAuth scopes from environment', () => {
    process.env.TIKTOK_AUTH_SCOPE = 'user.info.profile video.list  video.list';
    const authUrl = new URL(new TikTokAdapter().getAuthUrl('signed-state-token'));
    expect(authUrl.searchParams.get('scope')).toBe('user.info.profile,video.list');
  });

  it('exchanges auth code using configured callback URI', async () => {
    const state = 'signed-state-token';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'tiktok-token', refresh_token: 'tiktok-refresh', expires_in: 7200 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new TikTokAdapter().exchangeCode('tiktok-auth-code', { state });

    expect(tokens.accessToken).toBe('tiktok-token');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://open.tiktokapis.com/v2/oauth/token/');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
    const params = new URLSearchParams(requestOptions?.body || '');
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('tiktok-auth-code');
    expect(params.get('redirect_uri')).toBe(process.env.TIKTOK_REDIRECT_URI);
    expect(params.get('client_key')).toBe(process.env.TIKTOK_CLIENT_KEY);
    expect(params.get('client_secret')).toBe(process.env.TIKTOK_CLIENT_SECRET);
    const expectedVerifier = buildPkceCodeVerifier(
      state,
      process.env.TIKTOK_CLIENT_SECRET || '',
      process.env.TIKTOK_CLIENT_KEY || '',
    );
    expect(params.get('code_verifier')).toBe(expectedVerifier);
  });

  it('requires OAuth state for PKCE token exchange', async () => {
    await expect(new TikTokAdapter().exchangeCode('tiktok-auth-code')).rejects.toThrow(
      'Missing OAuth state for TikTok token exchange',
    );
  });

  it('surfaces OAuth exchange errors', async () => {
    const state = 'signed-state-token';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'invalid authorization code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(new TikTokAdapter().exchangeCode('bad-code', { state })).rejects.toThrow(
      'invalid authorization code',
    );
  });
});
