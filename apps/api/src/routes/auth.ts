import { Router, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { validate } from '../middleware/validate.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validators.js';
import { config } from '../config/index.js';

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !config.isDev,
  sameSite: config.isDev ? 'lax' as const : 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// Register
authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          workspaceId: result.workspaceId,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// Login
authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
      res.json({
        success: true,
        data: {
          user: result.user,
          workspaceId: result.workspaceId,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// Refresh tokens
authRouter.post('/refresh', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' },
      });
    }

    const tokens = await authService.refreshTokens(refreshToken);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);
    res.json({ success: true, data: { accessToken: tokens.accessToken } });
  } catch (err) {
    next(err);
  }
});

// Logout
authRouter.post('/logout', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
});

// Get current user
authRouter.get(
  '/me',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { prisma } = await import('../config/database.js');
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          bio: true,
          timezone: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      res.json({ success: true, data: { user, workspaceId: req.workspaceId } });
    } catch (err) {
      next(err);
    }
  },
);

// Forgot password
authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await authService.forgotPassword(req.body.email);
      // Always success to prevent email enumeration
      res.json({
        success: true,
        data: { message: 'If an account exists, a password reset link has been sent.' },
      });
    } catch (err) {
      next(err);
    }
  },
);

// Reset password
authRouter.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      res.json({ success: true, data: { message: 'Password has been reset.' } });
    } catch (err) {
      next(err);
    }
  },
);
