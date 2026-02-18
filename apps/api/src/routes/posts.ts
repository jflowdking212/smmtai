import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { checkUsage, incrementUsage } from '../middleware/usage.js';
import { postService } from '../services/post.service.js';
import { schedulePost } from '../jobs/scheduler.js';

export const postRouter = Router();
const MEDIA_UPLOAD_DIR = resolve(process.env.MEDIA_UPLOAD_DIR || 'uploads');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function inferFileExtension(mimeType: string, originalName: string): string {
  const fromName = extname(originalName || '').toLowerCase();
  if (fromName) return fromName;

  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/quicktime') return '.mov';
  if (mimeType === 'video/webm') return '.webm';
  return '';
}

postRouter.post(
  '/media/upload',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    upload.single('file')(req as any, res as any, (err: any) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'Media upload size limit is 25MB' },
        });
      }
      if (err) return next(err);
      return next();
    });
  },
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Media file is required' },
        });
      }
      if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_MEDIA_TYPE', message: 'Only image and video uploads are supported' },
        });
      }

      await mkdir(MEDIA_UPLOAD_DIR, { recursive: true });
      const extension = inferFileExtension(file.mimetype, file.originalname);
      const filename = `${Date.now()}-${randomUUID()}${extension}`;
      await writeFile(join(MEDIA_UPLOAD_DIR, filename), file.buffer);

      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      res.status(201).json({
        success: true,
        data: {
          url: `${baseUrl}/uploads/${filename}`,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          type: mediaType,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

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

      const {
        content,
        platforms,
        mediaUrls,
        link,
        hashtags,
        platformMetadata,
        isDraft,
        scheduledAt,
      } = req.body;

      if (!content || !platforms?.length) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Content and at least one platform required' },
        });
      }
      if (mediaUrls !== undefined && (!Array.isArray(mediaUrls) || mediaUrls.some((url: unknown) => typeof url !== 'string'))) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Media URLs must be an array of strings' },
        });
      }
      if (link !== undefined && typeof link !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Link must be a string' },
        });
      }
      if (hashtags !== undefined && (!Array.isArray(hashtags) || hashtags.some((tag: unknown) => typeof tag !== 'string'))) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Hashtags must be an array of strings' },
        });
      }
      if (
        platformMetadata !== undefined
        && (typeof platformMetadata !== 'object' || platformMetadata === null || Array.isArray(platformMetadata))
      ) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Platform metadata must be an object keyed by connection ID' },
        });
      }

      const scheduledDate = scheduledAt ? new Date(scheduledAt) : undefined;

      const post = await postService.createPost({
        workspaceId: req.workspaceId,
        userId: req.userId,
        content,
        platforms,
        mediaUrls,
        link,
        hashtags,
        platformMetadata,
        isDraft,
        scheduledAt: scheduledDate,
      });

      if (!isDraft && scheduledDate) {
        await schedulePost(post.id, scheduledDate);
      }

      if (!isDraft) {
        await incrementUsage(req.workspaceId, 'posts');
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
  '/:postId/submit-approval',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId || !req.userId) {
        return res.status(400).json({ success: false, error: { code: 'NO_CONTEXT', message: 'Workspace and user required' } });
      }

      const post = await postService.submitForApproval(req.params.postId as string, req.workspaceId, req.userId);
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },
);

postRouter.post(
  '/:postId/approve',
  authenticate,
  requireRole('owner', 'admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const post = await postService.approvePost(req.params.postId as string, req.workspaceId);
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },
);

postRouter.post(
  '/:postId/reject',
  authenticate,
  requireRole('owner', 'admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const post = await postService.rejectPost(req.params.postId as string, req.workspaceId);
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },
);

postRouter.post(
  '/:postId/publish',
  authenticate,
  checkUsage('posts'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await postService.publishPost(req.params.postId as string);
      if (req.workspaceId) await incrementUsage(req.workspaceId, 'posts');
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
