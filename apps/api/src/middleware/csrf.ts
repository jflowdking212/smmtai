import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureCsrfCookie(req: Request, res: Response): string {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }

  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: !config.isDev,
    sameSite: config.isDev ? 'lax' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return token;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const csrfToken = ensureCsrfCookie(req, res);

  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  if (req.originalUrl.startsWith('/api/v1/billing/webhook')) {
    return next();
  }

  if (!req.cookies?.refreshToken) {
    return next();
  }

  const headerToken = req.header(CSRF_HEADER);
  if (!headerToken || headerToken !== csrfToken) {
    return next(new AppError('Invalid CSRF token', 403, 'INVALID_CSRF_TOKEN'));
  }

  return next();
}
