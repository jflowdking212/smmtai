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
