import { Router, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { oauthService, isOAuthProvider } from '../services/oauth.service.js';
import { validate } from '../middleware/validate.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../utils/validators.js';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !config.isDev,
  sameSite: config.isDev ? 'lax' as const : 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

function redirectOAuthError(res: Response, code: string) {
  const redirectUrl = new URL('/auth/login', config.frontend.url);
  redirectUrl.searchParams.set('oauth_error', code);
  return res.redirect(redirectUrl.toString());
}

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

// OAuth login redirect
authRouter.get(
  '/oauth/:provider',
  authLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const providerParam = req.params.provider as string;
      if (!isOAuthProvider(providerParam)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_OAUTH_PROVIDER', message: 'Unsupported OAuth provider' },
        });
      }

      const nextPath = typeof req.query.next === 'string' ? req.query.next : '/';
      const url = oauthService.getAuthorizationUrl(providerParam, nextPath);
      return res.redirect(url);
    } catch (err) {
      next(err);
    }
  },
);

// OAuth callback
authRouter.get(
  '/oauth/:provider/callback',
  async (req: AuthRequest, res: Response) => {
    const providerParam = req.params.provider as string;
    if (!isOAuthProvider(providerParam)) {
      return redirectOAuthError(res, 'invalid_oauth_provider');
    }

    if (typeof req.query.error === 'string') {
      return redirectOAuthError(res, req.query.error);
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      return redirectOAuthError(res, 'missing_oauth_params');
    }

    try {
      const { identity, nextPath } = await oauthService.exchangeCodeForIdentity(
        providerParam,
        code,
        state,
      );
      const result = await authService.loginWithOAuth(identity);
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

      const redirectUrl = new URL('/auth/oauth/callback', config.frontend.url);
      redirectUrl.searchParams.set('accessToken', result.accessToken);
      redirectUrl.searchParams.set('next', nextPath);
      return res.redirect(redirectUrl.toString());
    } catch (err) {
      const errorCode = err instanceof AppError ? err.code.toLowerCase() : 'oauth_failed';
      return redirectOAuthError(res, errorCode);
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

// Verify email (API)
authRouter.post(
  '/verify-email',
  authLimiter,
  validate(verifyEmailSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await authService.verifyEmail(req.body.token);
      res.json({ success: true, data: { message: 'Email verified successfully.' } });
    } catch (err) {
      next(err);
    }
  },
);

// Verify email (link redirect)
authRouter.get(
  '/verify-email',
  async (req: AuthRequest, res: Response) => {
    const token = req.query.token as string | undefined;
    if (!token) {
      return res.redirect(`${config.frontend.url}/auth/login?verified=0`);
    }

    try {
      await authService.verifyEmail(token);
      return res.redirect(`${config.frontend.url}/auth/login?verified=1`);
    } catch {
      return res.redirect(`${config.frontend.url}/auth/login?verified=0`);
    }
  },
);
