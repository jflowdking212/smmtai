import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastodonAdapter } from '../services/platforms/new.js';

const ORIGINAL_MASTODON_INSTANCE_URL = process.env.MASTODON_INSTANCE_URL;
const ORIGINAL_MASTODON_CLIENT_ID = process.env.MASTODON_CLIENT_ID;
const ORIGINAL_MASTODON_REDIRECT_URI = process.env.MASTODON_REDIRECT_URI;

describe('MastodonAdapter auth flow', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.MASTODON_INSTANCE_URL = 'https://mastodon.example';
    process.env.MASTODON_CLIENT_ID = 'mastodon-client-id';
    process.env.MASTODON_REDIRECT_URI = 'http://localhost:4016/api/v1/connections/mastodon/callback';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.MASTODON_INSTANCE_URL = ORIGINAL_MASTODON_INSTANCE_URL;
    process.env.MASTODON_CLIENT_ID = ORIGINAL_MASTODON_CLIENT_ID;
    process.env.MASTODON_REDIRECT_URI = ORIGINAL_MASTODON_REDIRECT_URI;
  });

  it('builds OAuth URL with configured instance and callback URI', () => {
    const state = 'signed-state-token';
    const authUrl = new URL(new MastodonAdapter().getAuthUrl(state));

    expect(`${authUrl.origin}${authUrl.pathname}`).toBe('https://mastodon.example/oauth/authorize');
    expect(authUrl.searchParams.get('state')).toBe(state);
    expect(authUrl.searchParams.get('client_id')).toBe(process.env.MASTODON_CLIENT_ID);
    expect(authUrl.searchParams.get('redirect_uri')).toBe(process.env.MASTODON_REDIRECT_URI);
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('scope')).toBe('read write push');
  });

  it('verifies credentials during exchange and stores normalized payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'acct_1', username: 'mastodon-user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new MastodonAdapter().exchangeCode(
      JSON.stringify({
        accessToken: ' mastodon-access-token ',
        instanceUrl: 'https://mastodon.example/',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mastodon.example/api/v1/accounts/verify_credentials',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mastodon-access-token' },
      }),
    );
    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'mastodon-access-token',
      instanceUrl: 'https://mastodon.example',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('surfaces Mastodon credential verification errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'The access token is invalid' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      new MastodonAdapter().exchangeCode(
        JSON.stringify({
          accessToken: 'bad-token',
          instanceUrl: 'https://mastodon.example',
        }),
      ),
    ).rejects.toThrow('The access token is invalid');
  });

  it('revalidates refresh payload and returns normalized credentials', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'acct_1', username: 'mastodon-user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await new MastodonAdapter().refreshAccessToken(
      JSON.stringify({
        token: ' mastodon-access-token ',
        instanceUrl: 'https://mastodon.example/',
      }),
    );

    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'mastodon-access-token',
      instanceUrl: 'https://mastodon.example',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('rejects malformed JSON credential payloads before API calls', async () => {
    await expect(
      new MastodonAdapter().exchangeCode('{"instanceUrl":"https://mastodon.example"}'),
    ).rejects.toThrow(
      'Provide Mastodon credentials as JSON: {"instanceUrl":"https://mastodon.social","accessToken":"token"}',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
