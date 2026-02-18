import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueskyAdapter, MastodonAdapter } from '../services/platforms/new.js';
import { EntreprenrsAdapter, ChrxstiansAdapter } from '../services/platforms/custom.js';

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
          data: [
            {
              post_id: 'post_1',
              post_views: '150',
              post_likes: '13',
              post_comments: '4',
              post_shares: '2',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const adapter = new EntreprenrsAdapter();
    const analytics = await adapter.getPostAnalytics(
      JSON.stringify({ accessToken: 'token', serverKey: 'server-key' }),
      'post_1',
    );

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
});
