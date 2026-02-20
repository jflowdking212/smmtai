import { useAuthStore } from '@/stores/authStore';
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

  const limits = SUBSCRIPTION_LIMITS[tier];
  const isOwner = role === 'owner';
  const isAdmin = role === 'owner' || role === 'admin';

  function canAccess(feature: AppFeature): boolean {
    return hasFeatureAccess(tier, feature);
  }

  return { tier, role, usage, limits, isOwner, isAdmin, canAccess };
}
