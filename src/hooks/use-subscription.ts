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

// ─── Plan Limits Configuration ─────────────────────────────────────
export interface PlanLimits {
  maxChannels: number;
  videosPerDay: number;
  videosPerMonth: number;
  searchesPerDay: number;
  tubebotChats: number;       // -1 = unlimited
  maxNarrationMinutes: number;
  maxVideoDurationMinutes: number;
  multilingual: boolean;
  competitorAnalysis: boolean;
  veo3Prompts: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  whiteLabel: boolean;
  viralDatabase: boolean;
  unlimitedScripts: boolean;
  unlimitedSearches: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  starter: {
    maxChannels: 1,
    videosPerDay: 1,
    videosPerMonth: 12,
    searchesPerDay: 1,
    tubebotChats: 20,
    maxNarrationMinutes: 30,
    maxVideoDurationMinutes: 30,
    multilingual: false,
    competitorAnalysis: false,
    veo3Prompts: true,
    apiAccess: false,
    prioritySupport: false,
    whiteLabel: false,
    viralDatabase: false,
    unlimitedScripts: false,
    unlimitedSearches: false,
  },
  pro: {
    maxChannels: 5,
    videosPerDay: 5,
    videosPerMonth: 150,
    searchesPerDay: 10,
    tubebotChats: -1, // unlimited
    maxNarrationMinutes: 60,
    maxVideoDurationMinutes: 60,
    multilingual: true,
    competitorAnalysis: true,
    veo3Prompts: true,
    apiAccess: false,
    prioritySupport: false,
    whiteLabel: false,
    viralDatabase: true,
    unlimitedScripts: false,
    unlimitedSearches: false,
  },
  full: {
    maxChannels: 20,
    videosPerDay: 20,
    videosPerMonth: 600,
    searchesPerDay: 50,
    tubebotChats: -1,
    maxNarrationMinutes: 90,
    maxVideoDurationMinutes: 90,
    multilingual: true,
    competitorAnalysis: true,
    veo3Prompts: true,
    apiAccess: true,
    prioritySupport: true,
    whiteLabel: true,
    viralDatabase: true,
    unlimitedScripts: true,
    unlimitedSearches: true,
  },
};

// ─── Route-based Feature Gating ────────────────────────────────────
// Maps routes to the MINIMUM tier required to access them
const FEATURE_TIERS: Record<string, SubscriptionTier> = {
  '/dashboard': 'starter',
  '/tracker': 'starter',
  '/scripts': 'starter',
  '/titles': 'starter',
  '/search': 'starter',
  '/channels': 'starter',
  '/viral-db': 'pro',        // Competitor analysis = Pro+
  '/growth-tools': 'pro',    // Advanced tools = Pro+
  '/multichannel': 'pro',    // Multiple channels = Pro+
  '/branding': 'starter',
  '/niches': 'starter',
  '/workflow': 'starter',
};

// ─── Feature-level Gating (granular) ───────────────────────────────
export type FeatureKey =
  | 'multilingual'
  | 'competitorAnalysis'
  | 'viralDatabase'
  | 'apiAccess'
  | 'whiteLabel'
  | 'prioritySupport'
  | 'veo3Prompts'
  | 'unlimitedScripts'
  | 'unlimitedSearches';

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

  /** Check if user's tier can access a given route */
  const hasAccess = (path: string): boolean => {
    const requiredTier = FEATURE_TIERS[path] || 'starter';
    return TIER_HIERARCHY[subscription.tier] >= TIER_HIERARCHY[requiredTier];
  };

  /** Get the minimum tier required for a route */
  const getRequiredTier = (path: string): SubscriptionTier => {
    return FEATURE_TIERS[path] || 'starter';
  };

  /** Check if a specific feature is available in the user's plan */
  const hasFeature = (feature: FeatureKey): boolean => {
    const limits = PLAN_LIMITS[subscription.tier];
    return !!limits[feature];
  };

  /** Get the plan limits for the current tier */
  const getLimits = (): PlanLimits => {
    return PLAN_LIMITS[subscription.tier];
  };

  const tierLabel = (tier: SubscriptionTier): string => {
    const labels: Record<SubscriptionTier, string> = {
      starter: 'Starter',
      pro: 'Pro',
      full: 'Full',
    };
    return labels[tier];
  };

  /** Get the upgrade tier name for a locked feature */
  const getUpgradeTier = (feature: FeatureKey): SubscriptionTier => {
    for (const tier of ['starter', 'pro', 'full'] as SubscriptionTier[]) {
      if (PLAN_LIMITS[tier][feature]) return tier;
    }
    return 'full';
  };

  return {
    subscription,
    loading,
    hasAccess,
    getRequiredTier,
    hasFeature,
    getLimits,
    getUpgradeTier,
    tierLabel,
  };
}
