import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';

interface TokenPayload {
  userId: string;
  workspaceId?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
}

export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
