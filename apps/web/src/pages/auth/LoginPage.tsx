import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Sparkles } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.auth.login({ email, password });
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
            Manage all your social media in one place
          </h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Create, design, schedule, and analyze posts across 13 platforms — powered by AI.
          </p>
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

          <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">Welcome back</h1>
          <p className="text-neutral-500 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
          )}

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
