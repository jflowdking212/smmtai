import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FacebookAdapter, InstagramAdapter } from '../services/platforms/major.js';

const ORIGINAL_FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const ORIGINAL_FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const ORIGINAL_FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI;
const ORIGINAL_INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;

describe('Facebook and Instagram OAuth adapters', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-app-secret';
    process.env.FACEBOOK_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/facebook/callback';
    process.env.INSTAGRAM_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/instagram/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.FACEBOOK_APP_ID = ORIGINAL_FACEBOOK_APP_ID;
    process.env.FACEBOOK_APP_SECRET = ORIGINAL_FACEBOOK_APP_SECRET;
    process.env.FACEBOOK_REDIRECT_URI = ORIGINAL_FACEBOOK_REDIRECT_URI;
    process.env.INSTAGRAM_REDIRECT_URI = ORIGINAL_INSTAGRAM_REDIRECT_URI;
  });

  it('builds OAuth URLs with platform-specific callback URIs', () => {
    const state = 'signed-state-token';
    const facebookUrl = new URL(new FacebookAdapter().getAuthUrl(state));
    const instagramUrl = new URL(new InstagramAdapter().getAuthUrl(state));

    expect(facebookUrl.searchParams.get('state')).toBe(state);
    expect(instagramUrl.searchParams.get('state')).toBe(state);
    expect(facebookUrl.searchParams.get('redirect_uri')).toBe(process.env.FACEBOOK_REDIRECT_URI);
    expect(instagramUrl.searchParams.get('redirect_uri')).toBe(process.env.INSTAGRAM_REDIRECT_URI);
  });

  it('exchanges Facebook auth code using Facebook callback URI', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'facebook-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new FacebookAdapter().exchangeCode('facebook-code');

    expect(tokens.accessToken).toBe('facebook-token');
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.searchParams.get('code')).toBe('facebook-code');
    expect(requestUrl.searchParams.get('redirect_uri')).toBe(process.env.FACEBOOK_REDIRECT_URI);
  });

  it('exchanges Instagram auth code using Instagram callback URI', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'instagram-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new InstagramAdapter().exchangeCode('instagram-code');

    expect(tokens.accessToken).toBe('instagram-token');
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.searchParams.get('code')).toBe('instagram-code');
    expect(requestUrl.searchParams.get('redirect_uri')).toBe(process.env.INSTAGRAM_REDIRECT_URI);
  });
});
