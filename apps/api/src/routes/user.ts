import { prisma } from '../config/database.js';
import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  updateProfileSchema,
  updateNotificationPreferencesSchema,
} from '../utils/validators.js';
import { userService } from '../services/user.service.js';

export const userRouter = Router();

// Get profile
userRouter.get(
  '/profile',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getProfile(req.userId!);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
);

// Update profile
userRouter.patch(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await userService.updateProfile(req.userId!, req.body);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
);

userRouter.get(
  '/notifications/preferences',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const preferences = await userService.getNotificationPreferences(req.userId!);
      res.json({ success: true, data: preferences });
    } catch (err) {
      next(err);
    }
  },
);

userRouter.patch(
  '/notifications/preferences',
  authenticate,
  validate(updateNotificationPreferencesSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const preferences = await userService.updateNotificationPreferences(req.userId!, req.body);
      res.json({ success: true, data: preferences });
    } catch (err) {
      next(err);
    }
  },
);

userRouter.get(
  '/entrepreneurs',
  authenticate,
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const profiles = await userService.listEntrepreneurs();
      res.json({ success: true, data: profiles });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /users/preferences ────────────────────────────────────────────────────
userRouter.get('/preferences', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const record = await prisma.systemConfig.findUnique({
      where: { key: `user_prefs_${userId}` }
    });
    const prefs = record?.value ? JSON.parse(record.value) : {};
    res.json({ success: true, data: prefs });
  } catch (err) { next(err); }
});

// ── PATCH /users/preferences ──────────────────────────────────────────────────
userRouter.patch('/preferences', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const allowed = ['aiName', 'favoriteColor', 'platforms', 'contentType',
                     'birthday', 'goal', 'food', 'onboardingComplete', 'onboardingStep'];
    const incoming = req.body.preferences || req.body;

    const existing = await prisma.systemConfig.findUnique({
      where: { key: `user_prefs_${userId}` }
    });
    const current: Record<string, any> = existing?.value ? JSON.parse(existing.value) : {};
    const merged: Record<string, any> = { ...current };
    for (const key of allowed) {
      if (incoming[key] !== undefined) merged[key] = incoming[key];
    }

    await prisma.systemConfig.upsert({
      where: { key: `user_prefs_${userId}` },
      create: { key: `user_prefs_${userId}`, value: JSON.stringify(merged) },
      update: { value: JSON.stringify(merged) },
    });

    res.json({ success: true, data: merged });
  } catch (err) { next(err); }
});

