import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { AppError } from './errorHandler.js';
import { prisma } from '../config/database.js';

export interface AuthRequest extends Request {
  userId?: string;
  workspaceId?: string;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.workspaceId = payload.workspaceId;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
  }
}

export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      const payload = verifyAccessToken(token);
      req.userId = payload.userId;
      req.workspaceId = payload.workspaceId;
    }
  } catch (err) {
    // Ignore invalid tokens for optional auth
  }
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.userId || !req.workspaceId) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: req.userId, workspaceId: req.workspaceId },
        },
      });

      if (!membership || !roles.includes(membership.role)) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
