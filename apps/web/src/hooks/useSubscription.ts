import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import {
  hasFeatureAccess,
  SUBSCRIPTION_LIMITS,
  type AppFeature,
  type SubscriptionTier,
  type WorkspaceRole,
} from '@ee-postmind/shared';

export function useSubscription() {
  const tier = useAuthStore((s) => s.tier) as SubscriptionTier;
  const role = useAuthStore((s) => s.role) as WorkspaceRole;
  const usage = useAuthStore((s) => s.usage);
  const setSubscription = useAuthStore((s) => s.setSubscription);

  const [limits, setLimits] = useState(SUBSCRIPTION_LIMITS[tier]);

  // Refresh tier from billing status so admin plan changes take effect immediately
  useEffect(() => {
    api.billing.status()
      .then((res) => {
        if (res.data?.tier && res.data.tier !== tier) {
          setSubscription(res.data.tier as SubscriptionTier, role, usage);
        }
      })
      .catch(() => { /* keep cached tier */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.billing.getLimits()
      .then((res) => {
        if (res.data) setLimits(res.data);
      })
      .catch(() => {
        // Fallback to hardcoded limits
        setLimits(SUBSCRIPTION_LIMITS[tier]);
      });
  }, [tier]);

  const isOwner = role === 'owner';
  const isAdmin = role === 'owner' || role === 'manager';

  function canAccess(feature: AppFeature): boolean {
    return hasFeatureAccess(tier, feature);
  }

  return { tier, role, usage, limits, isOwner, isAdmin, canAccess };
}
