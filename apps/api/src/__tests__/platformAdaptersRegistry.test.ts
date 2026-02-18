import { describe, expect, it } from 'vitest';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import { getAllAdapters, getPlatformAdapter } from '../services/platforms/index.js';

const platformIds = Object.keys(PLATFORMS) as PlatformType[];

describe('platform adapter registry', () => {
  it('resolves adapters for every supported platform', () => {
    for (const platform of platformIds) {
      expect(getPlatformAdapter(platform).platform).toBe(platform);
    }
  });

  it('exposes one adapter per platform from getAllAdapters', () => {
    const adapters = getAllAdapters();
    expect(adapters).toHaveLength(platformIds.length);
    expect(new Set(adapters.map((adapter) => adapter.platform)).size).toBe(platformIds.length);
  });
});
