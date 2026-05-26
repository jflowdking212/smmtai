import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { PLATFORMS, type PlatformType } from '@ee-postmind/shared';
import {
  CheckCircle, Circle, ArrowRight, ArrowLeft,
  Link2, FileText, Sparkles, BarChart3, X,
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel: string;
  route: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'connect',
    title: 'Connect your first account',
    description: 'Link a social media platform to start managing your content from one place.',
    icon: <Link2 className="w-6 h-6" />,
    actionLabel: 'Connect Account',
    route: '/connections',
  },
  {
    id: 'create',
    title: 'Create your first post',
    description: 'Write a post and select which platforms to publish to — all from one composer.',
    icon: <FileText className="w-6 h-6" />,
    actionLabel: 'Create Post',
    route: '/compose',
  },
  {
    id: 'ai',
    title: 'Try AI content generation',
    description: 'Let AI help you write captions, generate hashtags, and suggest optimal posting times.',
    icon: <Sparkles className="w-6 h-6" />,
    actionLabel: 'Open AI Assistant',
    route: '/ai',
  },
  {
    id: 'analytics',
    title: 'Explore analytics',
    description: 'Track engagement, reach, and performance across all your connected platforms.',
    icon: <BarChart3 className="w-6 h-6" />,
    actionLabel: 'View Analytics',
    route: '/analytics',
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

  const allDone = STEPS.every((s) => completed.has(s.id));

  if (allDone) {
    return (
      <Card className="p-6 border-brand-blue/30 bg-brand-blue/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">You&apos;re all set!</h3>
              <p className="text-xs text-neutral-500">You&apos;ve completed all onboarding steps. Happy posting!</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleDismiss}>Dismiss</Button>
        </div>
      </Card>
    );
  }

  const step = STEPS[currentStep];

  return (
    <Card className="p-6 border-brand-blue/30 bg-gradient-to-r from-brand-blue/5 to-transparent">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="brand">Getting Started</Badge>
          <span className="text-xs text-neutral-400">Step {currentStep + 1} of {STEPS.length}</span>
        </div>
        <button onClick={handleDismiss} className="p-1 rounded hover:bg-neutral-100">
          <X className="w-4 h-4 text-neutral-400" />
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 mb-4">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(i)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all
              ${i === currentStep ? 'bg-brand-blue text-white' : completed.has(s.id) ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}
          >
            {completed.has(s.id) ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {s.title.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {/* Current step content */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0 text-brand-blue">
          {step.icon}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-neutral-800">{step.title}</h3>
          <p className="text-sm text-neutral-500 mt-1">{step.description}</p>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={() => handleAction(step)}>
              {step.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            {currentStep > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setCurrentStep((p) => p - 1)}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
            )}
            {currentStep < STEPS.length - 1 && (
              <Button variant="secondary" size="sm" onClick={() => { markComplete(step.id); setCurrentStep((p) => p + 1); }}>
                Skip
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function shouldShowOnboarding(): boolean {
  const dismissed = localStorage.getItem(STORAGE_KEY + '_dismissed');
  if (dismissed === 'true') return false;
  const completed = getCompletedSteps();
  return !STEPS.every((s) => completed.has(s.id));
}
