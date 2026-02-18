/**
 * Feature flags for gradual rollout.
 *
 * In production, replace with LaunchDarkly/Unleash SDK.
 * For now, uses environment variables and localStorage overrides.
 */

type FeatureFlag =
  | 'ai_image_generation'
  | 'collaborative_editing'
  | 'advanced_analytics'
  | 'white_label'
  | 'mobile_app_promo'
  | 'bulk_scheduling'
  | 'reddit_integration'
  | 'threads_integration';

const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  ai_image_generation: true,
  collaborative_editing: false,
  advanced_analytics: true,
  white_label: false,
  mobile_app_promo: false,
  bulk_scheduling: true,
  reddit_integration: false,
  threads_integration: false,
};

const STORAGE_KEY = 'postmind_feature_flags';

function getOverrides(): Partial<Record<FeatureFlag, boolean>> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {};
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const overrides = getOverrides();
  if (flag in overrides) return overrides[flag]!;
  return DEFAULT_FLAGS[flag] ?? false;
}

export function setFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  const overrides = getOverrides();
  overrides[flag] = enabled;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getAllFlags(): Record<FeatureFlag, boolean> {
  const overrides = getOverrides();
  const result = { ...DEFAULT_FLAGS };
  for (const [key, value] of Object.entries(overrides)) {
    if (key in result) {
      (result as any)[key] = value;
    }
  }
  return result;
}

export function resetFlags(): void {
  localStorage.removeItem(STORAGE_KEY);
}
