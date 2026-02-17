import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { connectionService } from './connection.service.js';
import { getPlatformAdapter } from './platforms/index.js';
import type { PlatformType } from '@ee-postmind/shared';

export interface CreatePostInput {
  workspaceId: string;
  userId: string;
  content: string;
  platforms: { connectionId: string; platform: PlatformType; caption?: string }[];
  mediaUrls?: string[];
  isDraft?: boolean;
  scheduledAt?: Date;
}

export class PostService {
  // Create a post (draft or publish)
  async createPost(input: CreatePostInput) {
    const { workspaceId, userId, content, platforms, mediaUrls, isDraft, scheduledAt } = input;

    const post = await prisma.post.create({
      data: {
        workspaceId,
        authorId: userId,
        content,
        status: isDraft ? 'draft' : scheduledAt ? 'scheduled' : 'pending',
        scheduledAt: scheduledAt || null,
        media: mediaUrls?.length ? {
          create: mediaUrls.map((url, i) => ({
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

    const results = await Promise.allSettled(
      post.platformPosts.map(async (pp: any) => {
        try {
          const accessToken = await connectionService.getAccessToken(pp.socialConnectionId);
          const adapter = getPlatformAdapter(pp.platform as PlatformType);

          const result = await adapter.publishPost(accessToken, {
            text: post.content,
            mediaUrls: post.media.map((m: any) => m.url),
          });

          await prisma.platformPost.update({
            where: { id: pp.id },
            data: {
              status: 'published',
              platformPostId: result.platformPostId,
              publishedAt: new Date(),
            },
          });

          return { platform: pp.platform, status: 'published', platformPostId: result.platformPostId };
        } catch (err: any) {
          await prisma.platformPost.update({
            where: { id: pp.id },
            data: {
              status: 'failed',
              error: err.message || 'Unknown error',
            },
          });
          return { platform: pp.platform, status: 'failed', error: err.message };
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

    return results.map((r) => r.status === 'fulfilled' ? r.value : { status: 'error' });
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
  }) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId, status: 'draft' },
    });

    if (!post) throw new AppError('Draft not found or already published', 404, 'DRAFT_NOT_FOUND');

    return prisma.post.update({
      where: { id: postId },
      data: {
        content: data.content,
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
