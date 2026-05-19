import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card } from '@/components/ui';
import { Sparkles, CheckCircle2, Mail } from 'lucide-react';

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-xl text-neutral-900">SmmtAI</span>
        </div>

        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-success-600" />
          <h1 className="text-2xl font-heading font-bold text-neutral-900">Payment confirmed</h1>
          <p className="text-sm text-neutral-500">
            Your subscription is now processing. We&apos;ve created your account and sent a welcome email with instructions to set your password and sign in.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
            <Mail className="w-4 h-4" />
            Check your inbox (and spam folder) for the setup email.
          </div>
          {sessionId && (
            <p className="text-[11px] text-neutral-400 break-all">Session: {sessionId}</p>
          )}
          <div className="pt-2">
            <Link to="/auth/login">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </div>
          <div>
            <Link to="/" className="text-xs text-neutral-500 hover:underline">
              Back to home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

