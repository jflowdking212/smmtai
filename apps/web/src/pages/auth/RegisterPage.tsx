import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Sparkles, Check } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordChecks = [
    { label: '8+ characters', valid: password.length >= 8 },
    { label: 'Uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'Number', valid: /[0-9]/.test(password) },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.auth.register({ name, email, password });
      setAuth(res.data.user, res.data.accessToken, res.data.workspaceId);
      navigate('/');
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
            <span className="font-heading font-bold text-2xl">EE PostMind</span>
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
            <span className="font-heading font-bold text-xl text-neutral-900">EE PostMind</span>
          </div>

          <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">
            Create your account
          </h1>
          <p className="text-neutral-500 mb-8">Get started for free — upgrade anytime</p>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
          )}

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
            By creating an account, you agree to our Terms of Service and Privacy Policy.
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
