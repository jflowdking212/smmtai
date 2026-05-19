import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }

    api.auth.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified. You can now sign in.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Verification failed.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-xl text-neutral-900">SmmtAI</span>
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 mx-auto mb-4 text-brand-500 animate-spin" />
            <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">Verifying email</h1>
            <p className="text-neutral-500">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-600" />
            <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">Email verified</h1>
            <p className="text-neutral-500 mb-8">{message}</p>
            <Link to="/auth/login">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-600" />
            <h1 className="text-2xl font-heading font-bold text-neutral-900 mb-2">Verification failed</h1>
            <p className="text-neutral-500 mb-8">{message}</p>
            <Link to="/auth/login">
              <Button variant="secondary" className="w-full">Back to sign in</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
