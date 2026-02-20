import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { config } from '../config/index.js';

const RATE_LIMIT_MESSAGE = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
};

const DEFAULTS = {
  authWindowMs: 15 * 60 * 1000,
  authMax: 20,
  apiWindowMs: 60 * 1000,
  apiMax: 100,
};

export interface RateLimitSettings {
  useRedisStore: boolean;
  authWindowMs: number;
  authMax: number;
  apiWindowMs: number;
  apiMax: number;
}

function parsePositiveInteger(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (!rawValue) return fallback;
  const normalized = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function resolveRateLimitSettings(
  env: NodeJS.ProcessEnv,
  nodeEnv = process.env.NODE_ENV || 'development',
): RateLimitSettings {
  const defaultRedisMode = nodeEnv !== 'test';
  return {
    useRedisStore: parseBoolean(env.RATE_LIMIT_USE_REDIS, defaultRedisMode),
    authWindowMs: parsePositiveInteger(env.RATE_LIMIT_AUTH_WINDOW_MS, DEFAULTS.authWindowMs),
    authMax: parsePositiveInteger(env.RATE_LIMIT_AUTH_MAX, DEFAULTS.authMax),
    apiWindowMs: parsePositiveInteger(env.RATE_LIMIT_API_WINDOW_MS, DEFAULTS.apiWindowMs),
    apiMax: parsePositiveInteger(env.RATE_LIMIT_API_MAX, DEFAULTS.apiMax),
  };
}

function isValidRedisUrl(redisUrl: string): boolean {
  try {
    const parsed = new URL(redisUrl);
    return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
  } catch {
    return false;
  }
}

const settings = resolveRateLimitSettings(process.env, config.nodeEnv);
const redisUrl = process.env.REDIS_URL || config.redis.url;
const shouldUseRedisStore = settings.useRedisStore && isValidRedisUrl(redisUrl);

if (settings.useRedisStore && !shouldUseRedisStore) {
  console.warn('[RATE LIMITER] Invalid REDIS_URL provided; falling back to in-memory rate limiting');
}

const redisClient = shouldUseRedisStore
  ? new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
  })
  : null;

if (redisClient) {
  redisClient.on('error', (error) => {
    console.error('[RATE LIMITER] Redis store error:', error instanceof Error ? error.message : error);
  });
}

function createRedisStore(prefix: string) {
  if (!redisClient) return undefined;

  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
  });
}

function createLimiter({
  windowMs,
  max,
  prefix,
}: {
  windowMs: number;
  max: number;
  prefix: string;
}) {
  return rateLimit({
    windowMs,
    max,
    message: RATE_LIMIT_MESSAGE,
    standardHeaders: true,
    legacyHeaders: false,
    ...(redisClient ? { store: createRedisStore(prefix) } : {}),
  });
}

export const authLimiter = createLimiter({
  windowMs: settings.authWindowMs,
  max: settings.authMax,
  prefix: 'rl:auth:',
});

export const apiLimiter = createLimiter({
  windowMs: settings.apiWindowMs,
  max: settings.apiMax,
  prefix: 'rl:api:',
});
