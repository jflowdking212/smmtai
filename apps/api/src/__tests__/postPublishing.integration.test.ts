import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrisma,
  connectionServiceMock,
  platformAdapters,
  getPlatformAdapterMock,
  notificationServiceMock,
} = vi.hoisted(() => {
  const platformAdapters = {
    facebook: { publishPost: vi.fn() },
    twitter: { publishPost: vi.fn() },
    linkedin: { publishPost: vi.fn() },
  } as const;

  return {
    mockPrisma: {
      post: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      platformPost: {
        update: vi.fn(),
      },
    },
    connectionServiceMock: {
      getAccessToken: vi.fn(),
    },
    notificationServiceMock: {
      notifyPostPublished: vi.fn(),
      notifyPostFailed: vi.fn(),
    },
    platformAdapters,
    getPlatformAdapterMock: vi.fn((platform: keyof typeof platformAdapters) => platformAdapters[platform]),
  };
});

vi.mock('../config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/connection.service.js', () => ({
  connectionService: connectionServiceMock,
}));

vi.mock('../services/platforms/index.js', () => ({
  getPlatformAdapter: getPlatformAdapterMock,
}));

vi.mock('../services/notification.service.js', () => ({
  notificationService: notificationServiceMock,
}));

import { postService } from '../services/post.service.js';

function buildPost(platforms: Array<keyof typeof platformAdapters>) {
  return {
    id: 'post_1',
    content: 'Publish integration test',
    designData: null as Record<string, unknown> | null,
    media: [{ url: 'https://cdn.example.com/media.png', type: 'image' }],
    platformPosts: platforms.map((platform, index) => ({
      id: `platform_post_${index + 1}`,
      platform,
      socialConnectionId: `social_connection_${index + 1}`,
    })),
  };
}

describe('PostService publish status integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionServiceMock.getAccessToken.mockResolvedValue('access-token');
    mockPrisma.platformPost.update.mockResolvedValue(undefined);
    mockPrisma.post.update.mockResolvedValue(undefined);
    mockPrisma.post.create.mockResolvedValue({
      id: 'post_1',
      content: 'Draft content',
      status: 'scheduled',
      media: [],
      platformPosts: [],
    });
    notificationServiceMock.notifyPostPublished.mockResolvedValue(undefined);
    notificationServiceMock.notifyPostFailed.mockResolvedValue(undefined);
  });

  it('marks post as published when all platform publishes succeed', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(buildPost(['facebook', 'twitter']));
    platformAdapters.facebook.publishPost.mockResolvedValue({ platformPostId: 'fb_1' });
    platformAdapters.twitter.publishPost.mockResolvedValue({ platformPostId: 'tw_1' });

    const results = await postService.publishPost('post_1');

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === 'published')).toBe(true);
    expect(platformAdapters.facebook.publishPost).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({
        mediaUrls: ['https://cdn.example.com/media.png'],
      }),
    );
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post_1' },
        data: expect.objectContaining({
          status: 'published',
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(notificationServiceMock.notifyPostPublished).toHaveBeenCalledWith('post_1');
    expect(notificationServiceMock.notifyPostFailed).not.toHaveBeenCalled();
  });

  it('marks post as partial when only some platform publishes succeed', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(buildPost(['facebook', 'twitter']));
    platformAdapters.facebook.publishPost.mockResolvedValue({ platformPostId: 'fb_1' });
    platformAdapters.twitter.publishPost.mockRejectedValue(new Error('Twitter publish failed'));

    const results = await postService.publishPost('post_1');

    expect(results).toHaveLength(2);
    expect(results.some((result) => result.status === 'published')).toBe(true);
    expect(results.some((result) => result.status === 'failed')).toBe(true);
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post_1' },
        data: expect.objectContaining({
          status: 'partial',
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(mockPrisma.platformPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'platform_post_2' },
        data: expect.objectContaining({
          status: 'failed',
        }),
      }),
    );
    expect(notificationServiceMock.notifyPostPublished).not.toHaveBeenCalled();
    expect(notificationServiceMock.notifyPostFailed).toHaveBeenCalledWith(
      'post_1',
      expect.stringContaining('Publishing partially failed on'),
    );
  });

  it('marks post as failed when all platform publishes fail', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(buildPost(['facebook', 'linkedin']));
    platformAdapters.facebook.publishPost.mockRejectedValue(new Error('Facebook publish failed'));
    platformAdapters.linkedin.publishPost.mockRejectedValue(new Error('LinkedIn publish failed'));

    const results = await postService.publishPost('post_1');

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === 'failed')).toBe(true);
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post_1' },
        data: {
          status: 'failed',
          publishedAt: null,
        },
      }),
    );
    expect(notificationServiceMock.notifyPostPublished).not.toHaveBeenCalled();
    expect(notificationServiceMock.notifyPostFailed).toHaveBeenCalledWith(
      'post_1',
      'Publishing failed on all target platforms',
    );
  });

  it('uses per-connection caption overrides when publishing', async () => {
    const post = buildPost(['facebook', 'twitter']);
    post.designData = {
      __postmindPlatformCaptions: {
        'twitter:social_connection_2': 'Custom X caption',
      },
    };

    mockPrisma.post.findUnique.mockResolvedValue(post);
    platformAdapters.facebook.publishPost.mockResolvedValue({ platformPostId: 'fb_1' });
    platformAdapters.twitter.publishPost.mockResolvedValue({ platformPostId: 'tw_1' });

    await postService.publishPost('post_1');

    expect(platformAdapters.facebook.publishPost).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({ text: 'Publish integration test' }),
    );
    expect(platformAdapters.twitter.publishPost).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({ text: 'Custom X caption' }),
    );
  });

  it('rejects createPost when selected platform content exceeds limits', async () => {
    await expect(
      postService.createPost({
        workspaceId: 'workspace_1',
        userId: 'user_1',
        content: 'Main caption',
        platforms: [{
          connectionId: 'social_connection_2',
          platform: 'twitter',
          caption: 'x'.repeat(281),
        }],
        isDraft: false,
        scheduledAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({
      code: 'PLATFORM_CONTENT_LIMIT_EXCEEDED',
    });

    expect(mockPrisma.post.create).not.toHaveBeenCalled();
  });

  it('rejects createPost when platform media requirements are not met', async () => {
    await expect(
      postService.createPost({
        workspaceId: 'workspace_1',
        userId: 'user_1',
        content: 'Video expected',
        platforms: [{
          connectionId: 'social_connection_2',
          platform: 'tiktok',
        }],
        mediaUrls: ['https://cdn.example.com/post-image.png'],
        isDraft: false,
        scheduledAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({
      code: 'PLATFORM_MEDIA_TYPE_INVALID',
    });
  });

  it('rejects createPost when platform hashtag limits are exceeded', async () => {
    await expect(
      postService.createPost({
        workspaceId: 'workspace_1',
        userId: 'user_1',
        content: 'LinkedIn hashtags',
        platforms: [{
          connectionId: 'social_connection_3',
          platform: 'linkedin',
        }],
        hashtags: ['one', 'two', 'three', 'four', 'five', 'six'],
        isDraft: false,
        scheduledAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({
      code: 'PLATFORM_HASHTAG_LIMIT_EXCEEDED',
    });
  });

  it('passes structured publish payload fields to platform adapters', async () => {
    const post = buildPost(['twitter']);
    post.designData = {
      __postmindPublishPayload: {
        link: 'https://example.com/story',
        hashtags: ['growth'],
        platformMetadata: {
          social_connection_1: { mediaIds: ['media_1'] },
        },
      },
    };

    mockPrisma.post.findUnique.mockResolvedValue(post);
    platformAdapters.twitter.publishPost.mockResolvedValue({ platformPostId: 'tw_3' });

    await postService.publishPost('post_1');

    expect(platformAdapters.twitter.publishPost).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({
        text: 'Publish integration test',
        link: 'https://example.com/story',
        hashtags: ['growth'],
        metadata: { mediaIds: ['media_1'] },
      }),
    );
  });

  it('persists link, hashtags, and platform metadata on create', async () => {
    await postService.createPost({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      content: 'Launch content',
      platforms: [{ connectionId: 'social_connection_1', platform: 'twitter' }],
      link: 'https://example.com/story',
      hashtags: ['growth', '#launch'],
      platformMetadata: {
        social_connection_1: { mediaIds: ['media_1', 'media_2'] },
      },
      isDraft: true,
    });

    expect(mockPrisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designData: expect.objectContaining({
            __postmindPublishPayload: expect.objectContaining({
              link: 'https://example.com/story',
              hashtags: ['growth', 'launch'],
              platformMetadata: {
                social_connection_1: { mediaIds: ['media_1', 'media_2'] },
              },
            }),
          }),
        }),
      }),
    );
  });
});
