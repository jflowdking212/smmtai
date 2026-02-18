import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkUsage, incrementUsage } from '../middleware/usage.js';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

export const aiRouter = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8016';
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || 'dev-key';

async function proxyToAI(path: string, body: any): Promise<any> {
  const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_SERVICE_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new AppError(err.detail || 'AI service error', res.status, 'AI_SERVICE_ERROR');
  }
  return res.json();
}

// All AI endpoints require auth + usage check
const aiMiddleware = [authenticate, checkUsage('ai_generations')];

aiRouter.post(
  '/caption',
  ...aiMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await proxyToAI('/caption', req.body);
      await incrementUsage(req.workspaceId!, 'ai_generations');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

aiRouter.post(
  '/hashtags',
  ...aiMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await proxyToAI('/hashtags', req.body);
      await incrementUsage(req.workspaceId!, 'ai_generations');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

aiRouter.post(
  '/image-prompt',
  ...aiMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await proxyToAI('/image-prompt', req.body);
      await incrementUsage(req.workspaceId!, 'ai_generations');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

aiRouter.post(
  '/rewrite',
  ...aiMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await proxyToAI('/rewrite', req.body);
      await incrementUsage(req.workspaceId!, 'ai_generations');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

aiRouter.post(
  '/translate',
  ...aiMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await proxyToAI('/translate', req.body);
      await incrementUsage(req.workspaceId!, 'ai_generations');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

aiRouter.post(
  '/compliance',
  ...aiMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await proxyToAI('/compliance', req.body);
      await incrementUsage(req.workspaceId!, 'ai_generations');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

aiRouter.post(
  '/best-times',
  ...aiMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await proxyToAI('/best-times', req.body);
      await incrementUsage(req.workspaceId!, 'ai_generations');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

aiRouter.post(
  '/trending',
  ...aiMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await proxyToAI('/trending', req.body);
      await incrementUsage(req.workspaceId!, 'ai_generations');
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);
