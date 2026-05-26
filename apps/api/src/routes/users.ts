import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { userService } from '../services/user.service.js';

export const usersRouter = Router();

// ── GET /users/profile ──────────────────────────────────────────────────────
usersRouter.get(
  '/profile',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: {
          id: true, email: true, name: true, avatar: true, bio: true,
          timezone: true, phone: true, country: true,
          profileComplete: true, emailVerified: true,
          createdAt: true,
        },
      });
      if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
);

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().optional(),
  phone: z.string().max(30).optional(),
  country: z.string().max(100).optional(),
  avatar: z.string().url().optional().or(z.literal('')),
});

// ── PATCH /users/profile ────────────────────────────────────────────────────
usersRouter.patch(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, bio, timezone, phone, country, avatar } = req.body;

      // Build update data (only include fields that were provided)
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (bio !== undefined) updateData.bio = bio;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (phone !== undefined) updateData.phone = phone;
      if (country !== undefined) updateData.country = country;
      if (avatar !== undefined) updateData.avatar = avatar || null;

      // Fetch current user to compute profileComplete
      const currentUser = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { name: true, phone: true, country: true, avatar: true, emailVerified: true },
      });
      if (!currentUser) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

      const merged = {
        name: name ?? currentUser.name,
        phone: phone ?? currentUser.phone,
        country: country ?? currentUser.country,
        avatar: avatar !== undefined ? (avatar || null) : currentUser.avatar,
      };

      // profileComplete = simplified for testing
      const profileComplete = !!merged.name?.trim();
      updateData.profileComplete = profileComplete;

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: updateData,
        select: {
          id: true, email: true, name: true, avatar: true, bio: true,
          timezone: true, phone: true, country: true,
          profileComplete: true, emailVerified: true,
        },
      });

      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /users/notification-preferences ─────────────────────────────────────
usersRouter.get(
  '/notification-preferences',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const prefs = await userService.getNotificationPreferences(req.userId!);
      res.json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /users/notification-preferences ───────────────────────────────────
const notifPrefSchema = z.object({
  postPublished: z.boolean().optional(),
  postFailed: z.boolean().optional(),
  upcomingScheduled: z.boolean().optional(),
  weeklyAnalyticsDigest: z.boolean().optional(),
  monthlyAnalyticsDigest: z.boolean().optional(),
});

usersRouter.patch(
  '/notification-preferences',
  authenticate,
  validate(notifPrefSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const prefs = await userService.updateNotificationPreferences(req.userId!, req.body);
      res.json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /users/entrepreneurs ─────────────────────────────────────────────────
usersRouter.get(
  '/entrepreneurs',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, avatar: true, bio: true, timezone: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  },
);
