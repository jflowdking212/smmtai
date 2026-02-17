import { describe, it, expect } from 'vitest';
import { PLATFORMS, SUBSCRIPTION_LIMITS } from '@ee-postmind/shared';

describe('Shared constants', () => {
  it('should have 13 platforms defined', () => {
    expect(Object.keys(PLATFORMS)).toHaveLength(13);
  });

  it('should have all required platform properties', () => {
    Object.values(PLATFORMS).forEach((p) => {
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('color');
      expect(p).toHaveProperty('maxCharacters');
    });
  });

  it('should have 4 subscription tiers', () => {
    expect(Object.keys(SUBSCRIPTION_LIMITS)).toHaveLength(4);
    expect(SUBSCRIPTION_LIMITS).toHaveProperty('free');
    expect(SUBSCRIPTION_LIMITS).toHaveProperty('pro');
    expect(SUBSCRIPTION_LIMITS).toHaveProperty('business');
    expect(SUBSCRIPTION_LIMITS).toHaveProperty('enterprise');
  });

  it('should enforce free tier limits', () => {
    const free = SUBSCRIPTION_LIMITS.free;
    expect(free.socialAccounts).toBe(3);
    expect(free.postsPerMonth).toBe(30);
    expect(free.aiGenerationsPerMonth).toBe(10);
  });
});
