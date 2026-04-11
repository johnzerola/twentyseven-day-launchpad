import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionTier = 'starter' | 'pro' | 'studio';

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
  studio: 2,
};

// ─── Plan Limits Configuration (aligned with pricing V3) ──────
export interface PlanLimits {
  maxChannels: number;
  videosPerDay: number;
  videosPerMonth: number;
  maxDurationMinutes: number;
  searchesPerDay: number;
  tubebotChats: number;       // -1 = unlimited
  maxNarrationMinutes: number;
  maxVideoDurationMinutes: number;
  ttsQuality: 'standard' | 'neural2';
  multilingual: boolean;
  competitorAnalysis: boolean;
  deepResearch: boolean;
  webdocStyle: boolean;
  veo3Prompts: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  whiteLabel: boolean;
  viralDatabase: boolean;
  unlimitedScripts: boolean;
  unlimitedSearches: boolean;
  elevenLabs: boolean;
  dubspy: boolean;
  growthTools: boolean;
  claudeDeepAnalysis: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  starter: {
    maxChannels: 1,
    videosPerDay: 1,
    videosPerMonth: 30,
    maxDurationMinutes: 60,
    searchesPerDay: 3,
    tubebotChats: 20,
    maxNarrationMinutes: 60,
    maxVideoDurationMinutes: 60,
    ttsQuality: 'neural2',
    multilingual: false,
    competitorAnalysis: false,
    deepResearch: false,
    webdocStyle: false,
    veo3Prompts: false,
    apiAccess: false,
    prioritySupport: false,
    whiteLabel: false,
    viralDatabase: true,
    unlimitedScripts: false,
    unlimitedSearches: false,
    elevenLabs: false,
    dubspy: false,
    growthTools: false,
    claudeDeepAnalysis: false,
  },
  pro: {
    maxChannels: 2,
    videosPerDay: 2,
    videosPerMonth: 60,
    maxDurationMinutes: 60,
    searchesPerDay: 10,
    tubebotChats: -1,
    maxNarrationMinutes: 60,
    maxVideoDurationMinutes: 60,
    ttsQuality: 'neural2',
    multilingual: false,
    competitorAnalysis: true,
    deepResearch: false,
    webdocStyle: true,
    veo3Prompts: true,
    apiAccess: false,
    prioritySupport: false,
    whiteLabel: false,
    viralDatabase: true,
    unlimitedScripts: false,
    unlimitedSearches: false,
    elevenLabs: false,
    dubspy: true,
    growthTools: true,
    claudeDeepAnalysis: false,
  },
  studio: {
    maxChannels: 5,
    videosPerDay: 3,
    videosPerMonth: 90,
    maxDurationMinutes: 60,
    searchesPerDay: 50,
    tubebotChats: -1,
    maxNarrationMinutes: 60,
    maxVideoDurationMinutes: 60,
    ttsQuality: 'neural2',
    multilingual: true,
    competitorAnalysis: true,
    deepResearch: true,
    webdocStyle: true,
    veo3Prompts: true,
    apiAccess: false,
    prioritySupport: true,
    whiteLabel: false,
    viralDatabase: true,
    unlimitedScripts: true,
    unlimitedSearches: true,
    elevenLabs: false,
    dubspy: true,
    growthTools: true,
    claudeDeepAnalysis: true,
  },
};

// ─── Route-based Feature Gating ────────────────────────────────
const FEATURE_TIERS: Record<string, SubscriptionTier> = {
  '/dashboard': 'starter',
  '/tracker': 'starter',
  '/scripts': 'starter',
  '/titles': 'starter',
  '/search': 'starter',
  '/channels': 'starter',
  '/viral-db': 'starter',
  '/branding': 'starter',
  '/niches': 'starter',
  '/workflow': 'starter',
  '/growth-tools': 'pro',
  '/multichannel': 'pro',
};

// ─── Feature-level Gating (granular) ───────────────────────────
export type FeatureKey =
  | 'multilingual'
  | 'competitorAnalysis'
  | 'viralDatabase'
  | 'apiAccess'
  | 'whiteLabel'
  | 'prioritySupport'
  | 'veo3Prompts'
  | 'unlimitedScripts'
  | 'unlimitedSearches'
  | 'deepResearch'
  | 'webdocStyle'
  | 'elevenLabs'
  | 'dubspy'
  | 'growthTools'
  | 'claudeDeepAnalysis';

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

  const hasFeature = (feature: FeatureKey): boolean => {
    const limits = PLAN_LIMITS[subscription.tier];
    return !!limits[feature];
  };

  const getLimits = (): PlanLimits => {
    return PLAN_LIMITS[subscription.tier];
  };

  const tierLabel = (tier: SubscriptionTier): string => {
    const labels: Record<SubscriptionTier, string> = {
      starter: 'Starter',
      pro: 'Creator Pro',
      studio: 'Studio',
    };
    return labels[tier];
  };

  const getUpgradeTier = (feature: FeatureKey): SubscriptionTier => {
    for (const tier of ['starter', 'pro', 'studio'] as SubscriptionTier[]) {
      if (PLAN_LIMITS[tier][feature]) return tier;
    }
    return 'studio';
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
