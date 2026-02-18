import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/database.js';

export const feedbackRouter = Router();

feedbackRouter.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, message, rating } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Message is required' } });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: req.userId!,
        type: type || 'general',
        message: message.trim(),
        rating: typeof rating === 'number' ? rating : null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    return res.status(201).json({ success: true, data: { id: feedback.id } });
  } catch (err) {
    next(err);
  }
});

feedbackRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({ success: true, data: feedbacks });
  } catch (err) {
    next(err);
  }
});
