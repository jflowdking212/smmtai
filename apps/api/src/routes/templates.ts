import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkUsage, incrementUsage } from '../middleware/usage.js';
import { prisma } from '../config/database.js';
import { cacheResponse } from '../middleware/cache.js';

export const templateRouter = Router();

// List templates (system + workspace custom)
templateRouter.get(
  '/',
  authenticate,
  cacheResponse({ ttl: 600, keyPrefix: 'templates' }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { category } = req.query;
      const where: any = {
        OR: [
          { isSystem: true },
          { workspaceId: req.workspaceId },
        ],
      };
      if (category) where.category = category as string;

      const templates = await prisma.template.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  },
);

// Create custom template
templateRouter.post(
  '/',
  authenticate,
  checkUsage('templates'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, category, designData, platforms } = req.body;

      if (!name || !category || !designData) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'name, category, and designData are required' },
        });
      }

      const template = await prisma.template.create({
        data: {
          workspaceId: req.workspaceId || null,
          name,
          category,
          designData: typeof designData === 'string' ? JSON.parse(designData) : designData,
          platforms: platforms || [],
          isSystem: false,
          isPremium: false,
        },
      });

      if (req.workspaceId) {
        await incrementUsage(req.workspaceId, 'templates');
      }

      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  },
);

// Delete custom template (only workspace-owned)
templateRouter.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const template = await prisma.template.findUnique({
        where: { id },
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
        });
      }

      if (template.isSystem || template.workspaceId !== req.workspaceId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot delete this template' },
        });
      }

      await prisma.template.delete({ where: { id } });
      res.json({ success: true, data: { message: 'Template deleted' } });
    } catch (err) {
      next(err);
    }
  },
);
