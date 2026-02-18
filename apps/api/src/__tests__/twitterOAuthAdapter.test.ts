import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { TwitterAdapter } from '../services/platforms/major.js';

const ORIGINAL_TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const ORIGINAL_TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const ORIGINAL_TWITTER_REDIRECT_URI = process.env.TWITTER_REDIRECT_URI;

describe('TwitterAdapter OAuth PKCE', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.TWITTER_CLIENT_ID = 'twitter-client-id';
    process.env.TWITTER_CLIENT_SECRET = 'twitter-client-secret';
    process.env.TWITTER_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/twitter/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.TWITTER_CLIENT_ID = ORIGINAL_TWITTER_CLIENT_ID;
    process.env.TWITTER_CLIENT_SECRET = ORIGINAL_TWITTER_CLIENT_SECRET;
    process.env.TWITTER_REDIRECT_URI = ORIGINAL_TWITTER_REDIRECT_URI;
  });

  it('builds OAuth URL with S256 PKCE challenge', () => {
    const state = 'signed-state-token';
    const authUrl = new URL(new TwitterAdapter().getAuthUrl(state));

    expect(authUrl.searchParams.get('state')).toBe(state);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.TWITTER_REDIRECT_URI);
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('code_challenge')).toBeTruthy();
  });

  it('uses matching PKCE code_verifier during token exchange', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'twitter-token', refresh_token: 'twitter-refresh', expires_in: 7200 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const state = 'signed-state-token';
    const adapter = new TwitterAdapter();
    const challengeFromAuth = new URL(adapter.getAuthUrl(state)).searchParams.get('code_challenge');
    const tokens = await adapter.exchangeCode('twitter-auth-code', { state });

    expect(tokens.accessToken).toBe('twitter-token');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
    const params = new URLSearchParams(requestOptions?.body || '');
    const codeVerifier = params.get('code_verifier');
    expect(codeVerifier).toBeTruthy();
    const derivedChallenge = codeVerifier
      ? crypto.createHash('sha256').update(codeVerifier).digest('base64url')
      : null;
    expect(derivedChallenge).toBe(challengeFromAuth);
    expect(params.get('redirect_uri')).toBe(process.env.TWITTER_REDIRECT_URI);
    expect(params.get('code')).toBe('twitter-auth-code');
  });

  it('requires callback state for token exchange', async () => {
    await expect(new TwitterAdapter().exchangeCode('twitter-auth-code')).rejects.toThrow(
      'Missing OAuth state for Twitter token exchange',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
