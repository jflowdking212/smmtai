import { useState } from 'react';
import { Sparkles, Check, X, Loader2, Zap } from 'lucide-react';
import { api } from '@/lib/api';

interface TrialActivationModalProps {
  onClose: () => void;
  onActivated: (trialEndsAt: string) => void;
}

const PRO_FEATURES = [
  '100 AI content generations/month',
  '8 social accounts',
  '200 scheduled posts/month',
  '50 visual templates/month',
  '5 team members',
  'Visual Design Studio (Canvas)',
  '30-day analytics history',
  'AI Humanizer & Rewriter',
];

export function TrialActivationModal({ onClose, onActivated }: TrialActivationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleActivate() {
    setLoading(true);
    setError('');
    try {
      const res = await api.billing.activateTrial();
      onActivated(res.data.trialEndsAt);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to activate trial.';
      if (msg.includes('TRIAL_ALREADY_USED')) {
        setError('A free trial has already been activated on this account.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white dark:bg-[#14141f] rounded-2xl shadow-2xl border border-neutral-100 dark:border-white/10 overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">14-Day Free Trial</h2>
                <p className="text-blue-100 text-xs mt-0.5">No credit card required</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              Get instant access to everything in the Pro plan ??? free for 14 days!
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-1.5 mb-5">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                <div className="w-4 h-4 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                </div>
                {feature}
              </li>
            ))}
          </ul>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Activating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Activate My Free Trial Now</>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            I'll decide later
          </button>
        </div>
      </div>
    </div>
  );
}
