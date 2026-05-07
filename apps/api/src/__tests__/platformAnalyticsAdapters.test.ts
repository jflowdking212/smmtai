import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueskyAdapter, MastodonAdapter } from '../services/platforms/new.js';
import { EntreprenrsAdapter, ChrxstiansAdapter, IohahAdapter } from '../services/platforms/custom.js';

describe('Platform analytics adapters', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps Bluesky post analytics counts', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          posts: [
            {
              uri: 'at://did:plc:user/app.bsky.feed.post/abc',
              likeCount: 12,
              replyCount: 3,
              repostCount: 4,
              quoteCount: 2,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new BlueskyAdapter();
    const analytics = await adapter.getPostAnalytics('unused', 'at://did:plc:user/app.bsky.feed.post/abc');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('app.bsky.feed.getPosts?uris=at%3A%2F%2Fdid%3Aplc%3Auser%2Fapp.bsky.feed.post%2Fabc'),
    );
    expect(analytics).toEqual(
      expect.objectContaining({
        likes: 12,
        comments: 3,
        shares: 6,
      }),
    );
  });

  it('maps Mastodon post analytics counts', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '12345',
          replies_count: 5,
          reblogs_count: 7,
          favourites_count: 19,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new MastodonAdapter();
    const analytics = await adapter.getPostAnalytics(
      JSON.stringify({ accessToken: 'mastodon-token', instanceUrl: 'https://mastodon.example' }),
      '12345',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mastodon.example/api/v1/statuses/12345',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mastodon-token' },
      }),
    );
    expect(analytics).toEqual(
      expect.objectContaining({
        likes: 19,
        comments: 5,
        shares: 7,
      }),
    );
  });

  it('maps Entreprenrs post analytics counts', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          api_status: 200,
          post_data: {
            post_id: 'post_1',
            post_views: '150',
            post_likes: '13',
            post_comments: '4',
            post_shares: '2',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new EntreprenrsAdapter();
    const analytics = await adapter.getPostAnalytics(
      JSON.stringify({ accessToken: 'token', serverKey: 'server-key', userId: '42' }),
      'post_1',
    );

    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(requestUrl);
    const bodyParams = new URLSearchParams(requestOptions.body as string);
    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe('https://entreprenrs.com/api/get-post-data');
    expect(parsedUrl.searchParams.get('user_id')).toBe('42');
    expect(parsedUrl.searchParams.get('fetch')).toBe('post_data');
    expect(bodyParams.get('user_id')).toBe('42');
    expect(bodyParams.get('fetch')).toBe('post_data');

    expect(analytics).toEqual(
      expect.objectContaining({
        impressions: 150,
        reach: 150,
        likes: 13,
        comments: 4,
        shares: 2,
      }),
    );
  });

  it('falls back to alternate Entreprenrs analytics endpoint format when API type is not found', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          api_status: '400',
          api_text: 'failed',
          errors: { error_text: 'Error: 404 API Type Not Found' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          api_status: 200,
          post_data: {
            post_id: 'post_2',
            post_views: '7',
            post_likes: '2',
            post_comments: '1',
            post_shares: '0',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new EntreprenrsAdapter();
    const analytics = await adapter.getPostAnalytics(
      JSON.stringify({ accessToken: 'token', serverKey: 'server-key', userId: '42' }),
      'post_2',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    const secondUrl = new URL(fetchMock.mock.calls[1]?.[0] as string);
    expect(`${firstUrl.origin}${firstUrl.pathname}`).toBe('https://entreprenrs.com/api/get-post-data');
    expect(`${secondUrl.origin}${secondUrl.pathname}`).toBe('https://entreprenrs.com/api/get_post_data');

    expect(analytics).toEqual(
      expect.objectContaining({
        impressions: 7,
        reach: 7,
        likes: 2,
        comments: 1,
        shares: 0,
      }),
    );
  });

  it('maps Chrxstians post analytics counts', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'sngine_1',
          views: 88,
          likes_count: 11,
          comments_count: 6,
          shares_count: 3,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new ChrxstiansAdapter();
    const analytics = await adapter.getPostAnalytics(
      JSON.stringify({ accessToken: 'jwt-token' }),
      'sngine_1',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chrxstians.com/api/posts/sngine_1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer jwt-token' },
      }),
    );
    expect(analytics).toEqual(
      expect.objectContaining({
        impressions: 88,
        likes: 11,
        comments: 6,
        shares: 3,
      }),
    );
  });

  it('maps Chrxstians post analytics counts from signed JSON endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          data: {
            id: 'chrx_2',
            views: 44,
            likes_count: 7,
            comments_count: 2,
            shares_count: 1,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new ChrxstiansAdapter();
    const analytics = await adapter.getPostAnalytics(
      JSON.stringify({ accessToken: 'jwt-token', apiKey: 'chrx-key', apiSecret: 'chrx-secret' }),
      'chrx_2',
    );

    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('https://chrxstians.com/apis/php/posts/chrx_2/analytics');
    expect(requestOptions.headers).toMatchObject({
      'x-api-key': 'chrx-key',
      'x-auth-token': 'jwt-token',
    });

    expect(analytics).toEqual(
      expect.objectContaining({
        impressions: 44,
        reach: 44,
        likes: 7,
        comments: 2,
        shares: 1,
      }),
    );
  });

  it('maps Iohah post analytics counts from signed JSON endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          data: {
            id: 'iohah_1',
            views: 64,
            likes_count: 9,
            comments_count: 4,
            shares_count: 2,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new IohahAdapter();
    const analytics = await adapter.getPostAnalytics(
      JSON.stringify({ accessToken: 'jwt-token', apiKey: 'iohah-key', apiSecret: 'iohah-secret' }),
      'iohah_1',
    );

    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('https://iohah.com/apis/php/posts/iohah_1/analytics');
    expect(requestOptions.headers).toMatchObject({
      'x-api-key': 'iohah-key',
      'x-auth-token': 'jwt-token',
    });

    expect(analytics).toEqual(
      expect.objectContaining({
        impressions: 64,
        reach: 64,
        likes: 9,
        comments: 4,
        shares: 2,
      }),
    );
  });

  it('surfaces a clear error when Iohah analytics endpoint returns HTML', async () => {
    fetchMock.mockImplementation(async () => new Response(
        '<!doctype html><html><body>not json</body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      ));

    const adapter = new IohahAdapter();
    await expect(
      adapter.getPostAnalytics(
        JSON.stringify({ accessToken: 'jwt-token', apiKey: 'iohah-key', apiSecret: 'iohah-secret' }),
        'iohah_2',
      ),
    ).rejects.toThrow(
      'Iohah analytics API is not implemented on this server yet. Add a JSON metrics endpoint on Iohah and set IOHAH_ANALYTICS_ENDPOINT or IOHAH_ANALYTICS_ENDPOINTS.',
    );
  });
});
