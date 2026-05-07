import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { extname, resolve } from 'path';
import { Readable } from 'stream';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { checkUsage, incrementUsage } from '../middleware/usage.js';
import { postService } from '../services/post.service.js';
import { schedulePost } from '../jobs/scheduler.js';
import { uploadPublicFile } from '../services/storage.service.js';

export const postRouter = Router();
const MEDIA_UPLOAD_DIR = resolve(process.env.MEDIA_UPLOAD_DIR || 'uploads');
const MEDIA_UPLOAD_LIMIT_MB = Number.parseInt(process.env.MEDIA_UPLOAD_LIMIT_MB || '250', 10);
const MEDIA_UPLOAD_MAX_BYTES = (Number.isFinite(MEDIA_UPLOAD_LIMIT_MB) && MEDIA_UPLOAD_LIMIT_MB > 0 ? MEDIA_UPLOAD_LIMIT_MB : 250) * 1024 * 1024;
const TIKTOK_MEDIA_PROXY_SECRET = process.env.TIKTOK_MEDIA_PROXY_SECRET || process.env.JWT_SECRET || 'ee-postmind-tiktok-media-proxy';
const TIKTOK_MEDIA_PROXY_MAX_TTL_SECONDS = Math.max(
  60,
  Number.parseInt(process.env.TIKTOK_MEDIA_PROXY_MAX_TTL_SECONDS || '86400', 10) || 86400,
);
const TIKTOK_MEDIA_PROXY_FETCH_TIMEOUT_MS = Math.max(
  2000,
  Number.parseInt(process.env.TIKTOK_MEDIA_PROXY_FETCH_TIMEOUT_MS || '20000', 10) || 20000,
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_UPLOAD_MAX_BYTES },
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

function buildTikTokMediaProxySignature(url: string, expiresAt: number): string {
  return createHmac('sha256', TIKTOK_MEDIA_PROXY_SECRET)
    .update(`${url}|${expiresAt}`)
    .digest('hex');
}

function isValidTikTokMediaProxySignature(url: string, expiresAt: number, signature: string): boolean {
  const normalizedSignature = signature.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalizedSignature)) return false;
  const expected = buildTikTokMediaProxySignature(url, expiresAt);
  return timingSafeEqual(Buffer.from(normalizedSignature), Buffer.from(expected));
}

postRouter.get(
  '/media/tiktok-proxy',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      const rawExpires = typeof req.query.expires === 'string' ? req.query.expires.trim() : '';
      const rawSignature = typeof req.query.sig === 'string' ? req.query.sig.trim() : '';

      if (!rawUrl || !rawExpires || !rawSignature) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'url, expires and sig are required' },
        });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'url must be a valid absolute URL' },
        });
      }

      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'url must use https' },
        });
      }

      const expiresAt = Number.parseInt(rawExpires, 10);
      const now = Math.floor(Date.now() / 1000);
      if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + TIKTOK_MEDIA_PROXY_MAX_TTL_SECONDS) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'expires is invalid or out of range' },
        });
      }

      if (!isValidTikTokMediaProxySignature(rawUrl, expiresAt, rawSignature)) {
        return res.status(403).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid media proxy signature' },
        });
      }

      const abortController = new AbortController();
      const timeoutHandle = setTimeout(() => abortController.abort(), TIKTOK_MEDIA_PROXY_FETCH_TIMEOUT_MS);
      const upstream = await fetch(rawUrl, {
        method: 'GET',
        signal: abortController.signal,
      }).finally(() => {
        clearTimeout(timeoutHandle);
      });

      if (!upstream.ok || !upstream.body) {
        return res.status(502).json({
          success: false,
          error: { code: 'UPSTREAM_FETCH_FAILED', message: `Upstream media fetch failed (${upstream.status})` },
        });
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
        return res.status(415).json({
          success: false,
          error: { code: 'INVALID_MEDIA_TYPE', message: 'Upstream media must be image or video content' },
        });
      }

      const contentLength = upstream.headers.get('content-length');
      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Cache-Control', 'public, max-age=300');

      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch (err) {
      next(err);
    }
  },
);

postRouter.post(
  '/media/upload',
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    upload.single('file')(req as any, res as any, (err: any) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: `Media upload size limit is ${Math.round(MEDIA_UPLOAD_MAX_BYTES / 1024 / 1024)}MB` },
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

      const extension = inferFileExtension(file.mimetype, file.originalname);
      const filename = `${Date.now()}-${randomUUID()}${extension}`;

      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const uploaded = await uploadPublicFile({
        buffer: file.buffer,
        key: filename,
        contentType: file.mimetype,
        baseUrl,
        localUploadDir: MEDIA_UPLOAD_DIR,
      });

      res.status(201).json({
        success: true,
        data: {
          url: uploaded.url,
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
      if (scheduledAt && (!scheduledDate || Number.isNaN(scheduledDate.getTime()))) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE', message: 'scheduledAt must be a valid datetime' },
        });
      }
      if (!isDraft && scheduledDate && scheduledDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: { code: 'PAST_DATE', message: 'scheduledAt must be in the future' },
        });
      }

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

// Per-post analytics (live fetch from platforms)
postRouter.get(
  '/:postId/analytics',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }

      const data = await (await import('../services/analytics.service.js')).analyticsService.getPostAnalytics(
        req.params.postId as string,
        req.workspaceId,
      );
      res.json({ success: true, data });
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
