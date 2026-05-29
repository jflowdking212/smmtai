import { useEffect, useMemo, useState } from 'react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { TrialActivationModal } from '@/components/TrialActivationModal';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';

function normalizeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/';
  }
  return nextPath;
}

export function OAuthCallbackPage() {
  const { settings } = useSiteSettings();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const logout = useAuthStore((state) => state.logout);
  const [error, setError] = useState('');
  const [showTrial, setShowTrial] = useState(false);
  const [pendingNav, setPendingNav] = useState('');

  const accessToken = useMemo(
    () => searchParams.get('accessToken') || '',
    [searchParams],
  );
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get('next')),
    [searchParams],
  );

  useEffect(() => {
    if (!accessToken) {
      setError('Missing OAuth session token. Please try signing in again.');
      return;
    }

    setAccessToken(accessToken);

    api.auth
      .me()
      .then((res) => {
        setAuth(res.data.user, accessToken, res.data.workspaceId, res.data.role || 'viewer', res.data.tier || 'basic', res.data.usage || {});
        // Check if a free trial is available for this new OAuth user
        return api.billing.getTrialStatus().then((trialRes) => {
          if (trialRes.data?.available) {
            setPendingNav(nextPath);
            setShowTrial(true);
          } else {
            navigate(nextPath, { replace: true });
          }
        }).catch(() => {
          // Trial status check failed — navigate normally
          navigate(nextPath, { replace: true });
        });
      })
      .catch((err) => {
        logout();
        setError(err instanceof ApiError ? err.message : 'Unable to complete social sign-in.');
      });
  }, [accessToken, logout, navigate, nextPath, setAccessToken, setAuth]);

  if (showTrial) {
    return (
      <TrialActivationModal
        onClose={() => { setShowTrial(false); navigate(pendingNav, { replace: true }); }}
        onActivated={() => { setShowTrial(false); navigate(pendingNav, { replace: true }); }}
      />
    );
  }

  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-neutral-900">{settings?.site_title || 'SmmtAI'}</span>
          </div>
          <Loader2 className="w-10 h-10 mx-auto mb-4 text-brand-500 animate-spin" />
          <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">
            Completing sign in
          </h1>
          <p className="text-neutral-500">Please wait while we finish your OAuth login.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-xl text-neutral-900">{settings?.site_title || 'SmmtAI'}</span>
        </div>
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-600" />
        <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">
          Social sign-in failed
        </h1>
        <p className="text-neutral-500 mb-8">{error}</p>
        <Link to="/auth/login">
          <Button variant="secondary" className="w-full">Back to sign in</Button>
        </Link>
      </div>
    </div>
  );
}
