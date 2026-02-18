import { describe, expect, it } from 'vitest';
import { resolveRateLimitSettings } from '../middleware/rateLimiter.js';

describe('rateLimiter settings resolution', () => {
  it('defaults to in-memory limiter in test env', () => {
    const settings = resolveRateLimitSettings({}, 'test');

    expect(settings).toEqual({
      useRedisStore: false,
      authWindowMs: 15 * 60 * 1000,
      authMax: 20,
      apiWindowMs: 60 * 1000,
      apiMax: 100,
    });
  });

  it('parses explicit environment values', () => {
    const settings = resolveRateLimitSettings(
      {
        RATE_LIMIT_USE_REDIS: 'true',
        RATE_LIMIT_AUTH_WINDOW_MS: '1200000',
        RATE_LIMIT_AUTH_MAX: '30',
        RATE_LIMIT_API_WINDOW_MS: '45000',
        RATE_LIMIT_API_MAX: '250',
      },
      'production',
    );

    expect(settings).toEqual({
      useRedisStore: true,
      authWindowMs: 1200000,
      authMax: 30,
      apiWindowMs: 45000,
      apiMax: 250,
    });
  });

  it('falls back for invalid numeric values', () => {
    const settings = resolveRateLimitSettings(
      {
        RATE_LIMIT_USE_REDIS: 'false',
        RATE_LIMIT_AUTH_WINDOW_MS: '-1',
        RATE_LIMIT_AUTH_MAX: '0',
        RATE_LIMIT_API_WINDOW_MS: 'bad',
        RATE_LIMIT_API_MAX: 'NaN',
      },
      'production',
    );

    expect(settings).toEqual({
      useRedisStore: false,
      authWindowMs: 15 * 60 * 1000,
      authMax: 20,
      apiWindowMs: 60 * 1000,
      apiMax: 100,
    });
  });
});
