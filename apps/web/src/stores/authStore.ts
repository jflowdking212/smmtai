import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

  setAuth: (user: User, accessToken: string, workspaceId: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      workspaceId: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, workspaceId) =>
        set({ user, accessToken, workspaceId, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ user: null, accessToken: null, workspaceId: null, isAuthenticated: false }),
    }),
    {
      name: 'ee-postmind-auth',
      partialize: (state) => ({
        user: state.user,
        workspaceId: state.workspaceId,
        // Don't persist accessToken — use refresh cookie instead
      }),
    },
  ),
);
