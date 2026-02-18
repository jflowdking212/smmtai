import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkedInAdapter } from '../services/platforms/major.js';

const ORIGINAL_LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const ORIGINAL_LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const ORIGINAL_LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;

describe('LinkedInAdapter OAuth', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.LINKEDIN_CLIENT_ID = 'linkedin-client-id';
    process.env.LINKEDIN_CLIENT_SECRET = 'linkedin-client-secret';
    process.env.LINKEDIN_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/linkedin/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.LINKEDIN_CLIENT_ID = ORIGINAL_LINKEDIN_CLIENT_ID;
    process.env.LINKEDIN_CLIENT_SECRET = ORIGINAL_LINKEDIN_CLIENT_SECRET;
    process.env.LINKEDIN_REDIRECT_URI = ORIGINAL_LINKEDIN_REDIRECT_URI;
  });

  it('builds OAuth URL with configured callback URI', () => {
    const state = 'signed-state-token';
    const authUrl = new URL(new LinkedInAdapter().getAuthUrl(state));

    expect(authUrl.searchParams.get('state')).toBe(state);
    expect(authUrl.searchParams.get('client_id')).toBe(process.env.LINKEDIN_CLIENT_ID);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.LINKEDIN_REDIRECT_URI);
  });

  it('exchanges auth code using configured callback URI', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'linkedin-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new LinkedInAdapter().exchangeCode('linkedin-auth-code');

    expect(tokens.accessToken).toBe('linkedin-token');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://www.linkedin.com/oauth/v2/accessToken');
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined;
    const params = new URLSearchParams(requestOptions?.body || '');
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('linkedin-auth-code');
    expect(params.get('redirect_uri')).toBe(process.env.LINKEDIN_REDIRECT_URI);
    expect(params.get('client_id')).toBe(process.env.LINKEDIN_CLIENT_ID);
    expect(params.get('client_secret')).toBe(process.env.LINKEDIN_CLIENT_SECRET);
  });

  it('surfaces OAuth exchange errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error_description: 'invalid authorization code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(new LinkedInAdapter().exchangeCode('bad-code')).rejects.toThrow(
      'invalid authorization code',
    );
  });
});
