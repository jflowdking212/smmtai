import { afterEach, describe, expect, it } from 'vitest';
import { oauthService } from '../services/oauth.service.js';

const ORIGINAL_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ORIGINAL_GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ORIGINAL_GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const ORIGINAL_YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const ORIGINAL_YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;

describe('OAuthService provider config', () => {
  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = ORIGINAL_GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = ORIGINAL_GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CALLBACK_URL = ORIGINAL_GOOGLE_CALLBACK_URL;
    process.env.YOUTUBE_CLIENT_ID = ORIGINAL_YOUTUBE_CLIENT_ID;
    process.env.YOUTUBE_CLIENT_SECRET = ORIGINAL_YOUTUBE_CLIENT_SECRET;
  });

  it('uses Google OAuth credentials when explicitly configured', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'https://example.com/api/v1/auth/oauth/google/callback';
    process.env.YOUTUBE_CLIENT_ID = 'youtube-client-id';
    process.env.YOUTUBE_CLIENT_SECRET = 'youtube-client-secret';

    const authUrl = new URL(oauthService.getAuthorizationUrl('google', '/compose'));
    expect(authUrl.searchParams.get('client_id')).toBe('google-client-id');
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://example.com/api/v1/auth/oauth/google/callback');
  });

  it('falls back to YouTube OAuth aliases for Google sign-in', () => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.GOOGLE_CALLBACK_URL = 'https://example.com/api/v1/auth/oauth/google/callback';
    process.env.YOUTUBE_CLIENT_ID = 'youtube-client-id';
    process.env.YOUTUBE_CLIENT_SECRET = 'youtube-client-secret';

    const authUrl = new URL(oauthService.getAuthorizationUrl('google', '/compose'));
    expect(authUrl.searchParams.get('client_id')).toBe('youtube-client-id');
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://example.com/api/v1/auth/oauth/google/callback');
  });

  it('throws when Google credentials are not configured', () => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.YOUTUBE_CLIENT_ID = '';
    process.env.YOUTUBE_CLIENT_SECRET = '';

    expect(() => oauthService.getAuthorizationUrl('google', '/')).toThrowError(/google OAuth is not configured/i);
  });
});
