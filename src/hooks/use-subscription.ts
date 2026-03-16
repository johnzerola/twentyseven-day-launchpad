import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionTier = 'starter' | 'pro' | 'full';

interface Subscription {
  tier: SubscriptionTier;
  credits_remaining: number;
  credits_monthly_limit: number;
  max_devices: number;
  active_devices: number;
}

const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  starter: 0,
  pro: 1,
  full: 2,
};

// MVP MODE: All features unlocked for testing
const FEATURE_TIERS: Record<string, SubscriptionTier> = {
  '/dashboard': 'starter',
  '/search': 'starter',
  '/branding': 'starter',
  '/niches': 'starter',
  '/titles': 'starter',
  '/channels': 'starter',
  '/scripts': 'starter',
  '/workflow': 'starter',
  '/viral-db': 'starter',
  '/multichannel': 'starter',
};

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription>({
    tier: 'starter',
    credits_remaining: 0,
    credits_monthly_limit: 100,
    max_devices: 1,
    active_devices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSub = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setSubscription({
          tier: data.tier as SubscriptionTier,
          credits_remaining: data.credits_remaining,
          credits_monthly_limit: data.credits_monthly_limit,
          max_devices: data.max_devices,
          active_devices: data.active_devices,
        });
      }
      setLoading(false);
    };

    fetchSub();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      fetchSub();
    });
    return () => authSub.unsubscribe();
  }, []);

  const hasAccess = (path: string): boolean => {
    const requiredTier = FEATURE_TIERS[path] || 'starter';
    return TIER_HIERARCHY[subscription.tier] >= TIER_HIERARCHY[requiredTier];
  };

  const getRequiredTier = (path: string): SubscriptionTier => {
    return FEATURE_TIERS[path] || 'starter';
  };

  const tierLabel = (tier: SubscriptionTier): string => {
    const labels: Record<SubscriptionTier, string> = {
      starter: 'Starter',
      pro: 'Pro',
      full: 'Full',
    };
    return labels[tier];
  };

  return {
    subscription,
    loading,
    hasAccess,
    getRequiredTier,
    tierLabel,
  };
}
