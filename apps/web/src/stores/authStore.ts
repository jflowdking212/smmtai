import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubscriptionTier, WorkspaceRole } from '@ee-postmind/shared';

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  bio?: string;
  timezone: string;
  emailVerified: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  workspaceId: string | null;
  isAuthenticated: boolean;
  role: WorkspaceRole;
  tier: SubscriptionTier;
  usage: Record<string, number>;

  setAuth: (user: User, accessToken: string, workspaceId: string, role?: WorkspaceRole, tier?: SubscriptionTier, usage?: Record<string, number>) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  setSubscription: (tier: SubscriptionTier, role: WorkspaceRole, usage: Record<string, number>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      workspaceId: null,
      isAuthenticated: false,
      role: 'viewer' as WorkspaceRole,
      tier: 'basic' as SubscriptionTier,
      usage: {},

      setAuth: (user, accessToken, workspaceId, role = 'viewer', tier = 'basic', usage = {}) =>
        set({ user, accessToken, workspaceId, isAuthenticated: true, role, tier, usage }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setUser: (user) => set({ user }),

      setSubscription: (tier, role, usage) => set({ tier, role, usage }),

      logout: () =>
        set({ user: null, accessToken: null, workspaceId: null, isAuthenticated: false, role: 'viewer', tier: 'basic', usage: {} }),
    }),
    {
      name: 'ee-postmind-auth',
      partialize: (state) => ({
        user: state.user,
        workspaceId: state.workspaceId,
        role: state.role,
        tier: state.tier,
        // Don't persist accessToken — use refresh cookie instead
      }),
    },
  ),
);
