import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { connectionService } from './connection.service.js';
import { getPlatformAdapter } from './platforms/index.js';
import { notificationService } from './notification.service.js';
import type { Prisma } from '@prisma/client';
import type { PlatformType } from '@ee-postmind/shared';

export interface CreatePostInput {
  workspaceId: string;
  userId: string;
  content: string;
  platforms: { connectionId: string; platform: PlatformType; caption?: string }[];
  mediaUrls?: string[];
  link?: string;
  hashtags?: string[];
  platformMetadata?: Record<string, Record<string, unknown>>;
  isDraft?: boolean;
  scheduledAt?: Date;
}

const PLATFORM_CAPTION_MAP_KEY = '__smmtaiPlatformCaptions';
const PUBLISH_PAYLOAD_MAP_KEY = '__smmtaiPublishPayload';
const VIDEO_MEDIA_URL_REGEX = /\.(mp4|mov|avi|webm|m4v|mkv)(\?.*)?$/i;
const PLATFORM_CHAR_LIMITS: Partial<Record<PlatformType, number>> = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 500,
  bluesky: 300,
  mastodon: 500,
  telegram: 4096,
  entreprenrs: 5000,
  chrxstians: 5000,
  iohah: 5000,
};
const PLATFORM_HASHTAG_LIMITS: Partial<Record<PlatformType, number>> = {
  instagram: 30,
  linkedin: 5,
};

type PlatformCaptionMap = Record<string, string>;
type PlatformMetadataMap = Record<string, Prisma.InputJsonObject>;
interface PublishPayloadMap {
  link?: string;
  hashtags?: string[];
  platformMetadata?: PlatformMetadataMap;
}

interface ConnectionMeta {
  token: string;
  mode?: string;
  profileUnverified?: boolean;
  profileError?: string;
}

function buildCaptionMap(
  platforms: Array<{ connectionId: string; platform: PlatformType; caption?: string }>,
): PlatformCaptionMap {
  const captions: PlatformCaptionMap = {};

  platforms.forEach((platformEntry) => {
    const caption = platformEntry.caption?.trim();
    if (!caption) return;
    captions[`${platformEntry.platform}:${platformEntry.connectionId}`] = caption;
  });

  return captions;
}

function extractCaptionMap(designData: unknown): PlatformCaptionMap {
  if (!designData || typeof designData !== 'object') return {};
  const map = (designData as Record<string, unknown>)[PLATFORM_CAPTION_MAP_KEY];
  if (!map || typeof map !== 'object') return {};

  return Object.entries(map as Record<string, unknown>).reduce<PlatformCaptionMap>((acc, [key, value]) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      acc[key] = value.trim();
    }
    return acc;
  }, {});
}

function normalizeHashtags(hashtags: string[] | undefined): string[] {
  if (!Array.isArray(hashtags)) return [];
  return hashtags
    .map((tag) => tag.trim().replace(/^#+/, ''))
    .filter((tag) => tag.length > 0);
}

function normalizeMediaUrls(mediaUrls: string[] | undefined): string[] {
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

function normalizePlatformMetadata(platformMetadata: unknown): PlatformMetadataMap {
  if (!platformMetadata || typeof platformMetadata !== 'object' || Array.isArray(platformMetadata)) {
    return {};
  }

  return Object.entries(platformMetadata as Record<string, unknown>).reduce<PlatformMetadataMap>((acc, [key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      acc[key] = value as Prisma.InputJsonObject;
    }
    return acc;
  }, {});
}

function buildPublishPayloadMap(
  link: string | undefined,
  hashtags: string[] | undefined,
  platformMetadata: unknown,
): PublishPayloadMap | undefined {
  const normalizedLink = typeof link === 'string' ? link.trim() : '';
  const normalizedHashtags = normalizeHashtags(hashtags);
  const normalizedPlatformMetadata = normalizePlatformMetadata(platformMetadata);

  if (!normalizedLink && normalizedHashtags.length === 0 && Object.keys(normalizedPlatformMetadata).length === 0) {
    return undefined;
  }

  return {
    ...(normalizedLink ? { link: normalizedLink } : {}),
    ...(normalizedHashtags.length > 0 ? { hashtags: normalizedHashtags } : {}),
    ...(Object.keys(normalizedPlatformMetadata).length > 0 ? { platformMetadata: normalizedPlatformMetadata } : {}),
  };
}

function extractPublishPayloadMap(designData: unknown): PublishPayloadMap {
  if (!designData || typeof designData !== 'object') return {};
  const payload = (designData as Record<string, unknown>)[PUBLISH_PAYLOAD_MAP_KEY];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};

  const payloadRecord = payload as Record<string, unknown>;
  return buildPublishPayloadMap(
    typeof payloadRecord.link === 'string' ? payloadRecord.link : undefined,
    Array.isArray(payloadRecord.hashtags)
      ? payloadRecord.hashtags.filter((value): value is string => typeof value === 'string')
      : undefined,
    payloadRecord.platformMetadata,
  ) || {};
}

function mergeCaptionMapIntoDesignData(
  designData: unknown,
  captionMap: PlatformCaptionMap,
): Prisma.InputJsonValue | undefined {
  if (Object.keys(captionMap).length === 0) return undefined;

  const baseDesignData = designData && typeof designData === 'object' && !Array.isArray(designData)
    ? designData as Record<string, Prisma.InputJsonValue>
    : {};

  return {
    ...baseDesignData,
    [PLATFORM_CAPTION_MAP_KEY]: captionMap,
  } as Prisma.InputJsonValue;
}

function mergePublishPayloadIntoDesignData(
  designData: unknown,
  publishPayloadMap: PublishPayloadMap | undefined,
): Prisma.InputJsonValue | undefined {
  const baseDesignData = designData && typeof designData === 'object' && !Array.isArray(designData)
    ? designData as Record<string, Prisma.InputJsonValue>
    : {};

  if (!publishPayloadMap) {
    if (!(PUBLISH_PAYLOAD_MAP_KEY in baseDesignData)) {
      return designData as Prisma.InputJsonValue | undefined;
    }

    const nextDesignData = { ...baseDesignData };
    delete nextDesignData[PUBLISH_PAYLOAD_MAP_KEY];
    if (Object.keys(nextDesignData).length === 0) return undefined;
    return nextDesignData as Prisma.InputJsonValue;
  }

  const publishPayloadJson: Prisma.InputJsonObject = {
    ...(publishPayloadMap.link ? { link: publishPayloadMap.link } : {}),
    ...(publishPayloadMap.hashtags ? { hashtags: publishPayloadMap.hashtags } : {}),
    ...(publishPayloadMap.platformMetadata ? { platformMetadata: publishPayloadMap.platformMetadata } : {}),
  };

  return {
    ...baseDesignData,
    [PUBLISH_PAYLOAD_MAP_KEY]: publishPayloadJson,
  } as Prisma.InputJsonValue;
}

function resolvePostText(
  baseContent: string,
  platform: PlatformType,
  connectionId: string,
  captionMap: PlatformCaptionMap,
): string {
  return captionMap[`${platform}:${connectionId}`] || baseContent;
}

function normalizePlatformPublishError(
  platform: PlatformType,
  rawError: unknown,
  connectionMeta?: ConnectionMeta,
): string {
  const message = typeof rawError === 'string'
    ? rawError.trim()
    : rawError instanceof Error && rawError.message
      ? rawError.message.trim()
      : 'Unknown error';

  if (platform !== 'twitter') return message;

  const normalized = message.toLowerCase();
  if (normalized.includes('service unavailable')) {
    const base = 'X API returned Service Unavailable. This usually means your X API app lacks active API credits or current plan access for this endpoint.';
    if (connectionMeta?.profileUnverified) {
      return `${base} This connection is also unverified in X (profile lookup blocked by project/app entitlement).`;
    }
    return base;
  }

  if (connectionMeta?.profileUnverified) {
    const detail = connectionMeta.profileError ? ` (${connectionMeta.profileError})` : '';
    return `X connection is unverified; posting can fail until X app entitlements are fully enabled${detail}`;
  }

  return message;
}

function buildValidationText(text: string, hashtags: string[] | undefined, link: string | undefined): string {
  const normalizedText = text.trim();
  const normalizedHashtags = normalizeHashtags(hashtags).map((tag) => `#${tag}`).join(' ');
  const normalizedLink = typeof link === 'string' ? link.trim() : '';

  return [normalizedText, normalizedHashtags, normalizedLink]
    .filter((value) => value.length > 0)
    .join(' ')
    .trim();
}

function resolvePlatformMetadata(
  platformMetadata: PlatformMetadataMap | undefined,
  platform: PlatformType,
  connectionId: string,
): Record<string, unknown> | undefined {
  if (!platformMetadata) return undefined;
  return platformMetadata[`${platform}:${connectionId}`]
    || platformMetadata[connectionId]
    || platformMetadata[platform];
}

function isVideoMediaUrl(mediaUrl: string): boolean {
  return VIDEO_MEDIA_URL_REGEX.test(mediaUrl);
}

function validatePlatformHashtagLimit(platform: PlatformType, hashtags: string[] | undefined) {
  const limit = PLATFORM_HASHTAG_LIMITS[platform];
  if (!limit) return;

  const count = normalizeHashtags(hashtags).length;
  if (count <= limit) return;
  throw new AppError(
    `${platform} supports up to ${limit} hashtags`,
    400,
    'PLATFORM_HASHTAG_LIMIT_EXCEEDED',
  );
}

function validatePlatformMediaRules(platform: PlatformType, mediaUrls: string[]) {
  const hasMedia = mediaUrls.length > 0;
  const hasVideo = mediaUrls.some((url) => isVideoMediaUrl(url));
  const hasImage = mediaUrls.some((url) => !isVideoMediaUrl(url));

  if (platform === 'instagram' && !hasMedia) {
    throw new AppError('instagram posts require at least one media attachment', 400, 'PLATFORM_MEDIA_REQUIRED');
  }
  if (platform === 'tiktok') {
    if (!hasMedia) {
      throw new AppError('tiktok posts require at least one media attachment', 400, 'PLATFORM_MEDIA_REQUIRED');
    }
    if (hasVideo && hasImage) {
      throw new AppError('tiktok posts cannot mix image and video media', 400, 'PLATFORM_MEDIA_TYPE_INVALID');
    }
    if (hasVideo && mediaUrls.length > 1) {
      throw new AppError('tiktok video posts support one video attachment', 400, 'PLATFORM_MEDIA_LIMIT_EXCEEDED');
    }
  }
  if (platform === 'youtube') {
    if (!hasMedia) {
      throw new AppError('youtube posts require at least one media attachment', 400, 'PLATFORM_MEDIA_REQUIRED');
    }
    if (!hasVideo) {
      throw new AppError('youtube posts require video media', 400, 'PLATFORM_MEDIA_TYPE_INVALID');
    }
  }
  if (platform === 'pinterest' && !hasMedia) {
    throw new AppError('pinterest posts require at least one media attachment', 400, 'PLATFORM_MEDIA_REQUIRED');
  }
  if (platform === 'linkedin' && hasVideo) {
    throw new AppError('linkedin currently supports image attachments only', 400, 'PLATFORM_MEDIA_TYPE_INVALID');
  }
  if (platform === 'bluesky' && hasVideo) {
    throw new AppError('bluesky currently supports image attachments only', 400, 'PLATFORM_MEDIA_TYPE_INVALID');
  }
  if (platform === 'twitter' && mediaUrls.length > 4) {
    throw new AppError('twitter supports up to 4 media attachments', 400, 'PLATFORM_MEDIA_LIMIT_EXCEEDED');
  }
}

function validatePlatformContentLength(platform: PlatformType, text: string) {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  if (!limit) return;
  if (text.length <= limit) return;

  throw new AppError(
    `${platform} captions are limited to ${limit} characters`,
    400,
    'PLATFORM_CONTENT_LIMIT_EXCEEDED',
  );
}

export class PostService {
  // Create a post (draft or publish)
  async createPost(input: CreatePostInput) {
    const {
      workspaceId,
      userId,
      content,
      platforms,
      mediaUrls,
      link,
      hashtags,
      platformMetadata,
      isDraft,
      scheduledAt,
    } = input;
    const captionMap = buildCaptionMap(platforms);
    const publishPayloadMap = buildPublishPayloadMap(link, hashtags, platformMetadata);
    const normalizedMediaUrls = normalizeMediaUrls(mediaUrls);
    const captionDesignData = mergeCaptionMapIntoDesignData(undefined, captionMap);
    const designData = mergePublishPayloadIntoDesignData(captionDesignData, publishPayloadMap);

    if (!isDraft) {
      platforms.forEach((platformEntry) => {
        const resolvedText = resolvePostText(content, platformEntry.platform, platformEntry.connectionId, captionMap);
        const validationText = buildValidationText(
          resolvedText,
          publishPayloadMap?.hashtags,
          publishPayloadMap?.link,
        );
        validatePlatformContentLength(platformEntry.platform, validationText);
        validatePlatformHashtagLimit(platformEntry.platform, publishPayloadMap?.hashtags);
        validatePlatformMediaRules(platformEntry.platform, normalizedMediaUrls);
      });
    }

    const post = await prisma.post.create({
      data: {
        workspaceId,
        authorId: userId,
        content,
        designData,
        status: isDraft ? 'draft' : scheduledAt ? 'scheduled' : 'pending',
        scheduledAt: scheduledAt || null,
        media: mediaUrls?.length ? {
          create: normalizedMediaUrls.map((url, i) => ({
            url,
            type: url.match(/\.(mp4|mov|avi|webm)$/i) ? 'video' : 'image',
            order: i,
          })),
        } : undefined,
        platformPosts: {
          create: platforms.map((p) => ({
            socialConnectionId: p.connectionId,
            platform: p.platform,
            status: isDraft ? 'draft' : scheduledAt ? 'scheduled' : 'pending',
          })),
        },
      },
      include: {
        media: true,
        platformPosts: true,
      },
    });

    // If not draft and not scheduled, publish immediately
    if (!isDraft && !scheduledAt) {
      await this.publishPost(post.id);
    }

    return post;
  }

  // Publish a post to all target platforms
  async publishPost(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { platformPosts: true, media: true },
    });

    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    if (post.status === 'pending_approval') {
      throw new AppError('Post must be approved before publishing', 409, 'APPROVAL_REQUIRED');
    }
    if (post.status === 'rejected') {
      throw new AppError('Rejected posts cannot be published', 409, 'POST_REJECTED');
    }
    const captionMap = extractCaptionMap(post.designData);
    const publishPayloadMap = extractPublishPayloadMap(post.designData);
    const mediaUrls = normalizeMediaUrls(post.media.map((m: any) => m.url));

    const results = await Promise.allSettled(
      post.platformPosts.map(async (pp: any) => {
        let connectionMeta: ConnectionMeta | undefined;
        try {
          connectionMeta = await connectionService.getConnectionMeta(pp.socialConnectionId);
          const { token: accessToken, mode } = connectionMeta;
          const adapter = getPlatformAdapter(pp.platform as PlatformType, mode);
          const text = resolvePostText(
            post.content,
            pp.platform as PlatformType,
            pp.socialConnectionId,
            captionMap,
          );
          const validationText = buildValidationText(text, publishPayloadMap.hashtags, publishPayloadMap.link);
          validatePlatformContentLength(pp.platform as PlatformType, validationText);
          validatePlatformHashtagLimit(pp.platform as PlatformType, publishPayloadMap.hashtags);
          validatePlatformMediaRules(pp.platform as PlatformType, mediaUrls);
          const metadata = resolvePlatformMetadata(
            publishPayloadMap.platformMetadata,
            pp.platform as PlatformType,
            pp.socialConnectionId,
          );

          const result = await adapter.publishPost(accessToken, {
            text,
            mediaUrls,
            link: publishPayloadMap.link,
            hashtags: publishPayloadMap.hashtags,
            metadata,
          });

          await prisma.platformPost.update({
            where: { id: pp.id },
            data: {
              status: 'published',
              platformPostId: result.platformPostId,
              url: result.url || null,
              publishedAt: new Date(),
              error: null,
            },
          });

          return { platform: pp.platform, status: 'published', platformPostId: result.platformPostId, url: result.url };
        } catch (err: any) {
          const normalizedError = normalizePlatformPublishError(
            pp.platform as PlatformType,
            err,
            connectionMeta,
          );
          await prisma.platformPost.update({
            where: { id: pp.id },
            data: {
              status: 'failed',
              error: normalizedError,
            },
          });
          return { platform: pp.platform, status: 'failed', error: normalizedError };
        }
      }),
    );

    // Update main post status
    const allPublished = results.every(
      (r) => r.status === 'fulfilled' && (r.value as any).status === 'published',
    );
    const anyPublished = results.some(
      (r) => r.status === 'fulfilled' && (r.value as any).status === 'published',
    );

    await prisma.post.update({
      where: { id: postId },
      data: {
        status: allPublished ? 'published' : anyPublished ? 'partial' : 'failed',
        publishedAt: anyPublished ? new Date() : null,
      },
    });

    try {
      if (allPublished) {
        await notificationService.notifyPostPublished(postId);
      } else if (!anyPublished) {
        await notificationService.notifyPostFailed(postId, 'Publishing failed on all target platforms');
      } else {
        const failures = results
          .filter((result) => result.status === 'fulfilled' && result.value.status === 'failed')
          .map((result) => (result.status === 'fulfilled' ? result.value.platform : 'unknown'))
          .join(', ');
        await notificationService.notifyPostFailed(
          postId,
          `Publishing partially failed on: ${failures || 'unknown platforms'}`,
        );
      }
    } catch (error) {
      console.error('[NOTIFY ERROR] Unable to send post publish notifications', error);
    }

    return results.map((r) => r.status === 'fulfilled' ? r.value : { status: 'error' });
  }

  async submitForApproval(postId: string, workspaceId: string, userId: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      select: { id: true, authorId: true, status: true },
    });

    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    if (post.authorId !== userId) {
      throw new AppError('Only the post author can submit for approval', 403, 'FORBIDDEN');
    }
    if (!['draft', 'rejected'].includes(post.status)) {
      throw new AppError('Only draft or rejected posts can be submitted', 409, 'INVALID_APPROVAL_STATE');
    }

    return prisma.post.update({
      where: { id: postId },
      data: {
        status: 'pending_approval',
        scheduledAt: null,
      },
      include: { media: true, platformPosts: true },
    });
  }

  async approvePost(postId: string, workspaceId: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      select: { id: true, status: true },
    });

    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    if (post.status !== 'pending_approval') {
      throw new AppError('Only pending approval posts can be approved', 409, 'INVALID_APPROVAL_STATE');
    }

    return prisma.post.update({
      where: { id: postId },
      data: { status: 'approved' },
      include: { media: true, platformPosts: true },
    });
  }

  async rejectPost(postId: string, workspaceId: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      select: { id: true, status: true },
    });

    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    if (post.status !== 'pending_approval') {
      throw new AppError('Only pending approval posts can be rejected', 409, 'INVALID_APPROVAL_STATE');
    }

    return prisma.post.update({
      where: { id: postId },
      data: {
        status: 'rejected',
        scheduledAt: null,
      },
      include: { media: true, platformPosts: true },
    });
  }

  // List posts for a workspace
  async listPosts(workspaceId: string, options: {
    status?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, page = 1, limit = 20 } = options;

    const where: any = { workspaceId };
    if (status) where.status = status;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          media: true,
          platformPosts: {
            select: {
              id: true,
              platform: true,
              status: true,
              platformPostId: true,
              url: true,
              publishedAt: true,
              error: true,
            },
          },
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return { posts, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // Get a single post
  async getPost(postId: string, workspaceId: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: {
        media: true,
        platformPosts: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });

    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    return post;
  }

  // Update a draft
  async updatePost(postId: string, workspaceId: string, data: {
    content?: string;
    platforms?: { connectionId: string; platform: PlatformType; caption?: string }[];
    mediaUrls?: string[];
    link?: string;
    hashtags?: string[];
    platformMetadata?: Record<string, Record<string, unknown>>;
  }) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId, status: { in: ['draft', 'rejected'] } },
    });

    if (!post) throw new AppError('Draft not found or cannot be edited', 404, 'DRAFT_NOT_FOUND');
    const nextCaptionMap = data.platforms ? buildCaptionMap(data.platforms) : null;
    const hasLinkUpdate = Object.prototype.hasOwnProperty.call(data, 'link');
    const hasHashtagUpdate = Object.prototype.hasOwnProperty.call(data, 'hashtags');
    const hasPlatformMetadataUpdate = Object.prototype.hasOwnProperty.call(data, 'platformMetadata');
    const hasPublishPayloadUpdate = hasLinkUpdate || hasHashtagUpdate || hasPlatformMetadataUpdate;
    const currentPublishPayload = extractPublishPayloadMap(post.designData);
    const nextPublishPayload = hasPublishPayloadUpdate
      ? buildPublishPayloadMap(
        hasLinkUpdate ? data.link : currentPublishPayload.link,
        hasHashtagUpdate ? data.hashtags : currentPublishPayload.hashtags,
        hasPlatformMetadataUpdate ? data.platformMetadata : currentPublishPayload.platformMetadata,
      )
      : undefined;

    const captionDesignData = nextCaptionMap ? mergeCaptionMapIntoDesignData(post.designData, nextCaptionMap) : undefined;
    const nextDesignData = hasPublishPayloadUpdate
      ? mergePublishPayloadIntoDesignData(captionDesignData || post.designData, nextPublishPayload)
      : captionDesignData;
    const nextMedia = data.mediaUrls
      ? {
        deleteMany: {},
        create: data.mediaUrls.map((url, index) => ({
          url,
          type: url.match(/\.(mp4|mov|avi|webm)$/i) ? 'video' : 'image',
          order: index,
        })),
      }
      : undefined;
    const nextPlatforms = data.platforms
      ? {
        deleteMany: {},
        create: data.platforms.map((platformEntry) => ({
          socialConnectionId: platformEntry.connectionId,
          platform: platformEntry.platform,
          status: 'draft',
        })),
      }
      : undefined;

    return prisma.post.update({
      where: { id: postId },
      data: {
        content: data.content,
        designData: nextDesignData,
        media: nextMedia,
        platformPosts: nextPlatforms,
        status: 'draft',
        updatedAt: new Date(),
      },
      include: { media: true, platformPosts: true },
    });
  }

  // Delete a post
  async deletePost(postId: string, workspaceId: string) {
    const post = await prisma.post.findFirst({ where: { id: postId, workspaceId } });
    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');

    await prisma.post.delete({ where: { id: postId } });
  }
}

export const postService = new PostService();
