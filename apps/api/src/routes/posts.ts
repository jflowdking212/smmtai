import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkUsage, incrementUsage } from '../middleware/usage.js';
import { postService } from '../services/post.service.js';

export const postRouter = Router();

// Create post (draft or publish)
postRouter.post(
  '/',
  authenticate,
  checkUsage('posts'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId || !req.userId) {
        return res.status(400).json({ success: false, error: { code: 'NO_CONTEXT', message: 'Workspace and user required' } });
      }

      const { content, platforms, mediaUrls, isDraft, scheduledAt } = req.body;

      if (!content || !platforms?.length) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Content and at least one platform required' },
        });
      }

      const post = await postService.createPost({
        workspaceId: req.workspaceId,
        userId: req.userId,
        content,
        platforms,
        mediaUrls,
        isDraft,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      });

      if (!isDraft) {
        await incrementUsage(req.userId, 'posts');
      }

      res.status(201).json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },
);

// List posts
postRouter.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const { status, page, limit } = req.query;
      const result = await postService.listPosts(req.workspaceId, {
        status: status as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Get single post
postRouter.get(
  '/:postId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const post = await postService.getPost(req.params.postId as string, req.workspaceId);
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },
);

// Update draft
postRouter.put(
  '/:postId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const post = await postService.updatePost(
        req.params.postId as string,
        req.workspaceId,
        req.body,
      );
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },
);

// Publish a draft/scheduled post
postRouter.post(
  '/:postId/publish',
  authenticate,
  checkUsage('posts'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await postService.publishPost(req.params.postId as string);
      if (req.userId) await incrementUsage(req.userId, 'posts');
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Delete post
postRouter.delete(
  '/:postId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      await postService.deletePost(req.params.postId as string, req.workspaceId);
      res.json({ success: true, data: { message: 'Post deleted' } });
    } catch (err) {
      next(err);
    }
  },
);
