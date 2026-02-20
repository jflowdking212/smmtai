import { useSubscription } from '@/hooks/useSubscription';
import { Card, Button } from '@/components/ui';
import { Lock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLAN_FEATURES, type AppFeature } from '@ee-postmind/shared';

interface UpgradeGateProps {
  feature: AppFeature;
  children: React.ReactNode;
}

export function UpgradeGate({ feature, children }: UpgradeGateProps) {
  const { canAccess } = useSubscription();
  const navigate = useNavigate();

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  const requiredTier = PLAN_FEATURES[feature];

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-heading font-bold text-neutral-900">
          Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
        </h2>
        <p className="text-sm text-neutral-500">
          This feature is available on the <strong>{requiredTier}</strong> plan and above.
          Upgrade your subscription to unlock it.
        </p>
        <Button onClick={() => navigate('/billing')} className="mx-auto">
          <Zap className="w-4 h-4" /> View Plans
        </Button>
      </Card>
    </div>
  );
}
