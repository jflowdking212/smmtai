import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YouTubeAdapter } from '../services/platforms/major.js';

const ORIGINAL_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ORIGINAL_GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ORIGINAL_YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const ORIGINAL_YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const ORIGINAL_YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const ORIGINAL_YOUTUBE_CALLBACK_URL = process.env.YOUTUBE_CALLBACK_URL;

describe('YouTubeAdapter OAuth', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.YOUTUBE_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/youtube/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.GOOGLE_CLIENT_ID = ORIGINAL_GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = ORIGINAL_GOOGLE_CLIENT_SECRET;
    process.env.YOUTUBE_REDIRECT_URI = ORIGINAL_YOUTUBE_REDIRECT_URI;
    process.env.YOUTUBE_CLIENT_ID = ORIGINAL_YOUTUBE_CLIENT_ID;
    process.env.YOUTUBE_CLIENT_SECRET = ORIGINAL_YOUTUBE_CLIENT_SECRET;
    process.env.YOUTUBE_CALLBACK_URL = ORIGINAL_YOUTUBE_CALLBACK_URL;
  });

  it('builds OAuth URL with configured callback URI', () => {
    const state = 'signed-state-token';
    const authUrl = new URL(new YouTubeAdapter().getAuthUrl(state));

    expect(authUrl.searchParams.get('state')).toBe(state);
    expect(authUrl.searchParams.get('client_id')).toBe(process.env.GOOGLE_CLIENT_ID);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.YOUTUBE_REDIRECT_URI);
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.upload');
  });

  it('supports legacy YouTube OAuth env aliases', () => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.YOUTUBE_CLIENT_ID = 'youtube-client-id';
    process.env.YOUTUBE_CLIENT_SECRET = 'youtube-client-secret';
    process.env.YOUTUBE_REDIRECT_URI = '';
    process.env.YOUTUBE_CALLBACK_URL = 'https://example.com/connections/youtube/callback';

    const authUrl = new URL(new YouTubeAdapter().getAuthUrl('signed-state-token'));

    expect(authUrl.searchParams.get('client_id')).toBe(process.env.YOUTUBE_CLIENT_ID);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.YOUTUBE_CALLBACK_URL);
  });

  it('exchanges auth code using configured callback URI', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'youtube-token', refresh_token: 'youtube-refresh', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new YouTubeAdapter().exchangeCode('youtube-auth-code');

    expect(tokens.accessToken).toBe('youtube-token');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
    const params = new URLSearchParams(requestOptions?.body || '');
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('youtube-auth-code');
    expect(params.get('redirect_uri')).toBe(process.env.YOUTUBE_REDIRECT_URI);
    expect(params.get('client_id')).toBe(process.env.GOOGLE_CLIENT_ID);
    expect(params.get('client_secret')).toBe(process.env.GOOGLE_CLIENT_SECRET);
  });

  it('surfaces OAuth exchange errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error_description: 'invalid_grant' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(new YouTubeAdapter().exchangeCode('bad-code')).rejects.toThrow('invalid_grant');
  });

  it('refreshes access token with OAuth refresh endpoint payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'new-youtube-token', expires_in: 1800 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new YouTubeAdapter().refreshAccessToken('youtube-refresh-token');

    expect(tokens.accessToken).toBe('new-youtube-token');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
    const params = new URLSearchParams(requestOptions?.body || '');
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('youtube-refresh-token');
    expect(params.get('client_id')).toBe(process.env.GOOGLE_CLIENT_ID);
    expect(params.get('client_secret')).toBe(process.env.GOOGLE_CLIENT_SECRET);
  });
});
