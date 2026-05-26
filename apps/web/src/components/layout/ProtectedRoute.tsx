import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Sparkles } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, setAuth, logout } = useAuthStore();
  const [checking, setChecking] = useState(!isAuthenticated);
  const location = useLocation();
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (isAuthenticated) {
      setChecking(false);
      return;
    }

    // Try to restore session via refresh token cookie.
    // api.auth.me() will automatically use the refresh cookie to get a new access token if needed.
    // IMPORTANT: Read the accessToken AFTER .me() resolves - not before - to avoid stale closure bugs.
    api.auth
      .me()
      .then((res) => {
        const freshToken = useAuthStore.getState().accessToken;
        setAuth(
          res.data.user,
          freshToken ?? '',
          res.data.workspaceId,
          res.data.role || 'viewer',
          res.data.tier || 'basic',
          res.data.usage || {}
        );
      })
      .catch(() => {
        logout();
      })
      .finally(() => setChecking(false));
  }, [isAuthenticated, setAuth, logout]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            {settings.site_logo ? (
              <img src={settings.site_logo} alt="" className="w-12 h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          <p className="text-sm text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
