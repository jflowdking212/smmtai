import { useState, FormEvent, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Sparkles, Chrome, Github, Facebook } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

function normalizeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/';
  }
  return nextPath;
}

function getOAuthErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) return null;

  switch (errorCode) {
    case 'access_denied':
      return 'You cancelled the social login request.';
    case 'oauth_not_configured':
      return 'This social login provider is not configured yet.';
    case 'oauth_email_required':
      return 'Your social account must provide an email address to continue.';
    case 'invalid_oauth_state':
      return 'Your social login session expired. Please try again.';
    case 'oauth_failed':
      return 'Social login failed. Please try again.';
    default:
      return 'Unable to complete social login.';
  }
}

export function LoginPage() {
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteNotice, setInviteNotice] = useState('');
  const verified = searchParams.get('verified');
  const inviteToken = searchParams.get('invite_token');
  const inviteAction = searchParams.get('invite_action');
  const oauthError = getOAuthErrorMessage(searchParams.get('oauth_error'));
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get('next')),
    [searchParams],
  );

  function startOAuth(provider: 'google' | 'github' | 'facebook') {
    window.location.href = api.auth.oauthUrl(provider, nextPath);
  }

  useEffect(() => {
    if (!inviteToken || inviteAction !== 'decline') return;
    api.workspaces
      .declineInvite(inviteToken)
      .then(() => setInviteNotice('Invitation declined.'))
      .catch(() => setInviteNotice('We could not decline this invitation.'));
  }, [inviteAction, inviteToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.auth.login({ email, password });
      setAuth(res.data.user, res.data.accessToken, res.data.workspaceId, res.data.role || 'viewer', res.data.tier || 'basic');

      if (inviteToken && inviteAction !== 'decline') {
        try {
          const inviteRes = await api.workspaces.acceptInvite(inviteToken);
          const workspaceName = inviteRes?.data?.workspace?.name;
          setInviteNotice(`You've successfully joined${workspaceName ? ' ' + workspaceName : ' the workspace'}! Welcome to the team.`);
          // Give the user a moment to see the success message before redirecting
          await new Promise(r => setTimeout(r, 1800));
        } catch (invErr) {
          const msg = invErr instanceof ApiError ? invErr.message : 'Could not process invitation';
          setInviteNotice(`Note: ${msg}`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-500 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            {settings.site_logo ? (
              <img src={settings.site_logo} alt="Logo" className="w-12 h-12 object-contain rounded-xl" />
            ) : (
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            )}
            <span className="font-heading font-bold text-2xl">{settings.site_title || 'SmmtAI'}</span>
          </div>
          <h2 className="text-3xl font-heading font-bold leading-tight mb-4">
            Manage all your social media in one place
          </h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Create, design, schedule, and analyze posts across 25 platforms — powered by AI.
          </p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-neutral-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            {settings.site_logo ? (
              <img src={settings.site_logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
            ) : (
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            )}
            <span className="font-heading font-bold text-xl text-neutral-900">{settings.site_title || 'SmmtAI'}</span>
          </div>

          <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">Welcome back</h1>
          <p className="text-neutral-500 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
          )}

          {oauthError && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{oauthError}</div>
          )}

          {inviteNotice && (
            <div className="mb-6 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{inviteNotice}</div>
          )}

          {verified === '1' && (
            <div className="mb-6 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">
              Email verified successfully. You can sign in now.
            </div>
          )}

          <div className="space-y-2 mb-5">
            <Button type="button" variant="secondary" className="w-full" onClick={() => startOAuth('google')}>
              <Chrome className="w-4 h-4" /> Continue with Google
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => startOAuth('github')}>
              <Github className="w-4 h-4" /> Continue with GitHub
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => startOAuth('facebook')}>
              <Facebook className="w-4 h-4" /> Continue with Facebook
            </Button>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-neutral-50 px-2 text-neutral-400">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input type="checkbox" className="rounded border-neutral-300" />
                Remember me
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-neutral-500">
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-brand-600 hover:text-brand-700 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
