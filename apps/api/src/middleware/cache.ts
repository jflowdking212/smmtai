import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (!process.env.REDIS_URL && !process.env.RATE_LIMIT_USE_REDIS) return null;
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.connect().catch(() => { redis = null; });
    return redis;
  } catch {
    return null;
  }
}

interface CacheOptions {
  ttl?: number; // seconds, default 300 (5 min)
  keyPrefix?: string;
}

export function cacheResponse(options: CacheOptions = {}) {
  const { ttl = 300, keyPrefix = 'cache' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const client = getRedis();
    if (!client) return next();

    const key = `${keyPrefix}:${req.originalUrl}`;

    try {
      const cached = await client.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        res.setHeader('X-Cache', 'HIT');
        return res.json(data);
      }
    } catch {
      return next();
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        client.setex(key, ttl, JSON.stringify(body)).catch(() => {});
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

export async function invalidateCache(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch { /* ignore */ }
}
