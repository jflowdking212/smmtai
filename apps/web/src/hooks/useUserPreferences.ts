import { useCallback } from 'react';

const PREFS_KEY = 'smmtai_user_prefs_v1';
const ONBOARDING_KEY = 'smmtai_onboarding_v2';

export interface UserPreferences {
  aiName?: string;
  favoriteColor?: string;
  platforms?: string[];
  contentType?: string;
  birthday?: string;
  goal?: string;
  food?: string;
  onboardingComplete?: boolean;
  onboardingStep?: number;
}

export function getLocalPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveLocalPreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const current = getLocalPreferences();
  const merged = { ...current, ...prefs };
  localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  return merged;
}

export function getAiName(): string {
  return getLocalPreferences().aiName || '';
}

export function isOnboardingComplete(): boolean {
  try {
    // Check new v2 system
    const prefs = getLocalPreferences();
    if (prefs.onboardingComplete === true) return true;
    // Check old v1 system (OnboardingWizard.tsx uses 'smmtai_onboarding_dismissed')
    const dismissed = localStorage.getItem('smmtai_onboarding_dismissed');
    if (dismissed === 'true') return true;
    return false;
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  saveLocalPreferences({ onboardingComplete: true });
  localStorage.setItem('smmtai_onboarding_dismissed', 'true');
}

export function useUserPreferences() {
  const getPrefs = useCallback(() => getLocalPreferences(), []);

  const savePrefs = useCallback(async (
    prefs: Partial<UserPreferences>,
    userId?: string
  ): Promise<UserPreferences> => {
    const merged = saveLocalPreferences(prefs);

    // Sync to server if user is authenticated
    if (userId) {
      try {
        await fetch('/api/v1/users/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(prefs),
        });
      } catch {
        // Non-critical: localStorage is the source of truth
      }
    }

    return merged;
  }, []);

  const loadFromServer = useCallback(async (userId?: string): Promise<UserPreferences> => {
    if (!userId) return getLocalPreferences();
    try {
      const res = await fetch('/api/v1/users/preferences', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          // Merge server prefs into localStorage (server wins for aiName)
          const merged = saveLocalPreferences(data.data);
          return merged;
        }
      }
    } catch {
      // Fall back to local
    }
    return getLocalPreferences();
  }, []);

  return { getPrefs, savePrefs, loadFromServer };
}
