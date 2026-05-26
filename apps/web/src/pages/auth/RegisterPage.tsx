import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Sparkles, Check, Chrome, Github, Facebook } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteNotice, setInviteNotice] = useState('');
  const inviteToken = searchParams.get('invite_token');
  const inviteAction = searchParams.get('invite_action');

  const passwordChecks = [
    { label: '8+ characters', valid: password.length >= 8 },
    { label: 'Uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'Number', valid: /[0-9]/.test(password) },
  ];

  function startOAuth(provider: 'google' | 'github' | 'facebook') {
    window.location.href = api.auth.oauthUrl(provider);
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
      const res = await api.auth.register({ name, email, password });
      setAuth(res.data.user, res.data.accessToken, res.data.workspaceId, res.data.role || 'owner', res.data.tier || 'basic');

      if (inviteToken && inviteAction !== 'decline') {
        try {
          const inviteRes = await api.workspaces.acceptInvite(inviteToken);
          const workspaceName = inviteRes?.data?.workspace?.name;
          setInviteNotice(`You've joined${workspaceName ? ' ' + workspaceName : ' the workspace'}! Welcome to the team.`);
        } catch (invErr) {
          const msg = invErr instanceof ApiError ? invErr.message : 'Could not process invitation';
          setInviteNotice(`Note: ${msg}`);
        }
      }

      navigate('/profile/complete');
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
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading font-bold text-2xl">SmmtAI</span>
          </div>
          <h2 className="text-3xl font-heading font-bold leading-tight mb-4">
            Start managing your social media like a pro
          </h2>
          <ul className="space-y-3 text-white/80">
            <li className="flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-300" /> 13 platforms supported
            </li>
            <li className="flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-300" /> AI-powered content generation
            </li>
            <li className="flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-300" /> Advanced scheduling & analytics
            </li>
            <li className="flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-300" /> Free plan — no credit card required
            </li>
          </ul>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-neutral-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-neutral-900">SmmtAI</span>
          </div>

          <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">
            Create your account
          </h1>
          <p className="text-neutral-500 mb-8">Get started for free — upgrade anytime</p>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
          )}

          {inviteNotice && (
            <div className="mb-6 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{inviteNotice}</div>
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
              <span className="bg-neutral-50 px-2 text-neutral-400">Or create with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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

            {/* Password strength */}
            {password.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {passwordChecks.map((check) => (
                  <span
                    key={check.label}
                    className={`text-xs px-2 py-1 rounded-full ${
                      check.valid
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-neutral-100 text-neutral-400'
                    }`}
                  >
                    {check.valid && <Check className="w-3 h-3 inline mr-1" />}
                    {check.label}
                  </span>
                ))}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              disabled={!passwordChecks.every((c) => c.valid)}
            >
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-neutral-400">
            By creating an account, you agree to our <Link to="/terms" className="text-brand-600 hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>.
          </p>

          <p className="mt-4 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
