import { describe, it, expect, beforeEach } from 'vitest';
import { isFeatureEnabled, setFeatureFlag, getAllFlags, resetFlags } from '../lib/featureFlags';

describe('Feature Flags', () => {
  beforeEach(() => {
    resetFlags();
  });

  it('returns default values when no overrides set', () => {
    expect(isFeatureEnabled('ai_image_generation')).toBe(true);
    expect(isFeatureEnabled('collaborative_editing')).toBe(false);
    expect(isFeatureEnabled('bulk_scheduling')).toBe(true);
  });

  it('allows overriding a flag', () => {
    expect(isFeatureEnabled('collaborative_editing')).toBe(false);
    setFeatureFlag('collaborative_editing', true);
    expect(isFeatureEnabled('collaborative_editing')).toBe(true);
  });

  it('persists overrides in localStorage', () => {
    setFeatureFlag('white_label', true);
    const stored = JSON.parse(localStorage.getItem('postmind_feature_flags')!);
    expect(stored.white_label).toBe(true);
  });

  it('getAllFlags merges defaults with overrides', () => {
    setFeatureFlag('reddit_integration', true);
    const flags = getAllFlags();
    expect(flags.reddit_integration).toBe(true);
    expect(flags.ai_image_generation).toBe(true);
    expect(flags.collaborative_editing).toBe(false);
  });

  it('resetFlags clears all overrides', () => {
    setFeatureFlag('white_label', true);
    resetFlags();
    expect(isFeatureEnabled('white_label')).toBe(false);
  });
});
