import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { Sparkles, ArrowLeft, Mail } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-xl text-neutral-900">SmmtAI</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-brand-600" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">
              Check your email
            </h1>
            <p className="text-neutral-500 mb-8">
              If an account exists for <strong>{email}</strong>, we've sent a password reset link.
            </p>
            <Link to="/auth/login">
              <Button variant="secondary" className="w-full">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">
              Reset your password
            </h1>
            <p className="text-neutral-500 mb-8">
              Enter your email and we'll send you a reset link.
            </p>

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
              <Button type="submit" loading={loading} className="w-full">
                Send Reset Link
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-neutral-500">
              <Link
                to="/auth/login"
                className="text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
