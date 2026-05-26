import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/ThemeProvider';
import {
  CheckCircle, ArrowRight, ArrowLeft,
  Link2, FileText, Sparkles, BarChart3, X,
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Link2;
  actionLabel: string;
  route: string;
  color: string;
  bg: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'connect',
    title: 'Connect your first account',
    description: 'Link a social media platform to start managing your content from one place.',
    icon: Link2,
    actionLabel: 'Connect Account',
    route: '/connections',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    id: 'create',
    title: 'Create your first post',
    description: 'Write a post and select which platforms to publish to — all from one composer.',
    icon: FileText,
    actionLabel: 'Create Post',
    route: '/compose',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    id: 'ai',
    title: 'Try AI content generation',
    description: 'Let AI help you write captions, generate hashtags, and suggest optimal posting times.',
    icon: Sparkles,
    actionLabel: 'Open AI Assistant',
    route: '/ai',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    id: 'analytics',
    title: 'Explore your analytics',
    description: 'Track engagement, reach, and performance across all your connected platforms.',
    icon: BarChart3,
    actionLabel: 'View Analytics',
    route: '/analytics',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
];

const STORAGE_KEY = 'smmtai_onboarding';

function getCompletedSteps(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set();
}

function saveCompletedSteps(steps: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...steps]));
}

export function OnboardingWizard({ onDismiss }: { onDismiss: () => void }) {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<Set<string>>(getCompletedSteps);
  const [currentStep, setCurrentStep] = useState(0);

  const markComplete = useCallback((stepId: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(stepId);
      saveCompletedSteps(next);
      return next;
    });
  }, []);

  const handleAction = useCallback((step: OnboardingStep) => {
    markComplete(step.id);
    navigate(step.route);
  }, [markComplete, navigate]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY + '_dismissed', 'true');
    onDismiss();
  }, [onDismiss]);

  const handleNext = useCallback(() => {
    markComplete(STEPS[currentStep].id);
    setCurrentStep((p) => p + 1);
  }, [currentStep, markComplete]);

  const allDone = STEPS.every((s) => completed.has(s.id));
  const completedCount = STEPS.filter((s) => completed.has(s.id)).length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  // All done state
  if (allDone) {
    return (
      <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">You&apos;re all set! 🎉</h3>
            <p className="text-xs text-neutral-500 mt-0.5">All onboarding steps complete. Happy posting!</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const step = STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold tracking-wide">
            Getting Started
          </span>
          <span className="text-xs text-neutral-400 font-medium">
            {completedCount} of {STEPS.length} done
          </span>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss onboarding"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-neutral-100">
        <div
          className="h-1 bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step dot indicators */}
      <div className="flex items-center gap-0 px-4 pt-4 pb-1">
        {STEPS.map((s, i) => {
          const isDone = completed.has(s.id);
          const isActive = i === currentStep;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <button
                onClick={() => setCurrentStep(i)}
                className="flex items-center gap-1.5 group"
                aria-label={`Go to step ${i + 1}: ${s.title}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200'
                  }`}
                >
                  {isDone ? <CheckCircle className="w-4 h-4" /> : <span>{i + 1}</span>}
                </div>
              </button>
              {/* Connector line between dots */}
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded transition-colors duration-300 ${
                  completed.has(s.id) ? 'bg-green-400' : 'bg-neutral-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step label row — hidden on very small, shown on sm+ */}
      <div className="hidden sm:flex items-center gap-0 px-4 pb-3">
        {STEPS.map((s, i) => {
          const isDone = completed.has(s.id);
          const isActive = i === currentStep;
          return (
            <div key={s.id} className="flex-1 pr-2">
              <p className={`text-[10px] font-medium leading-tight transition-colors ${
                isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-neutral-400'
              }`}>
                {s.title.split(' ').slice(0, 3).join(' ')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Current step content */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center shrink-0 ${step.color}`}>
            <StepIcon className="w-6 h-6" />
          </div>

          {/* Text + Actions */}
          <div className="flex-1 min-w-0 w-full">
            <h3 className="text-sm font-semibold text-neutral-800 leading-snug">{step.title}</h3>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{step.description}</p>

            {/* Action buttons — stacked on mobile, row on sm+ */}
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <button
                onClick={() => handleAction(step)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all active:scale-95 shadow-sm shadow-blue-600/20"
              >
                {step.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={() => setCurrentStep((p) => p - 1)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-medium transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                )}
                {currentStep < STEPS.length - 1 && (
                  <button
                    onClick={handleNext}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-500 text-xs font-medium transition-colors"
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function shouldShowOnboarding(): boolean {
  const dismissed = localStorage.getItem(STORAGE_KEY + '_dismissed');
  if (dismissed === 'true') return false;
  const completed = getCompletedSteps();
  return !STEPS.every((s) => completed.has(s.id));
}
