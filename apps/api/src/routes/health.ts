import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      app: 'EE PostMind API',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
  });
});
