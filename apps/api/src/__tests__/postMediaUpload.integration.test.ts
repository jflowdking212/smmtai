import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { basename, join, resolve } from 'path';
import { rm } from 'fs/promises';
import { createTestApp } from './helpers/testApp.js';

const uploadedFiles: string[] = [];

vi.mock('../middleware/auth.js', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'user_test';
    req.workspaceId = 'workspace_test';
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/usage.js', () => ({
  checkUsage: () => (_req: any, _res: any, next: any) => next(),
  incrementUsage: vi.fn(),
}));

vi.mock('../services/post.service.js', () => ({
  postService: {
    createPost: vi.fn(),
    listPosts: vi.fn(),
    getPost: vi.fn(),
    updatePost: vi.fn(),
    submitForApproval: vi.fn(),
    approvePost: vi.fn(),
    rejectPost: vi.fn(),
    publishPost: vi.fn(),
    deletePost: vi.fn(),
  },
}));

vi.mock('../jobs/scheduler.js', () => ({
  schedulePost: vi.fn(),
}));

import { postRouter } from '../routes/posts.js';

const app = createTestApp('/posts', postRouter);
const uploadDir = resolve(process.env.MEDIA_UPLOAD_DIR || 'uploads');

describe('Post media upload route integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await Promise.all(uploadedFiles.map(async (filePath) => rm(filePath, { force: true })));
    uploadedFiles.length = 0;
  });

  it('uploads an image and returns a hosted media URL', async () => {
    const res = await request(app)
      .post('/posts/media/upload')
      .attach('file', Buffer.from('image-bytes'), {
        filename: 'post-image.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        type: 'image',
        mimeType: 'image/png',
        fileName: 'post-image.png',
      }),
    );
    expect(res.body.data.url).toMatch(/\/uploads\/.+\.png$/);

    const uploadedPath = basename(new URL(res.body.data.url).pathname);
    uploadedFiles.push(join(uploadDir, uploadedPath));
  });

  it('rejects unsupported media types', async () => {
    const res = await request(app)
      .post('/posts/media/upload')
      .attach('file', Buffer.from('plain-text'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_MEDIA_TYPE');
  });

  it('requires a file payload', async () => {
    const res = await request(app).post('/posts/media/upload').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});
