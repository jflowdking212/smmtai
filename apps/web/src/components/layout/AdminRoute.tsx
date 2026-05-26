import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Sparkles } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();
  const [checking, setChecking] = useState(!isAuthenticated);
  const location = useLocation();
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (isAuthenticated) { setChecking(false); return; }

    api.auth
      .me()
      .then((res) => {
        const freshToken = useAuthStore.getState().accessToken;
        setAuth(res.data.user, freshToken ?? '', res.data.workspaceId, res.data.role || 'viewer', res.data.tier || 'basic', res.data.usage || {});
      })
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [isAuthenticated, setAuth, logout]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            {settings.site_logo ? (
              <img src={settings.site_logo} alt="" className="w-12 h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
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

  if (user?.email !== 'judeobidozie@gmail.com') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
