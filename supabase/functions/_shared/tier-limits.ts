// Shared tier-based access control for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type SubscriptionTier = "starter" | "pro" | "studio";

export interface PlanLimits {
  maxChannels: number;
  videosPerDay: number;
  videosPerMonth: number;
  maxDurationMinutes: number;
  searchesPerDay: number;
  tubebotChats: number; // -1 = unlimited
  maxNarrationMinutes: number;
  maxVideoDurationMinutes: number;
  ttsQuality: "standard" | "neural2";
  multilingual: boolean;
  competitorAnalysis: boolean;
  deepResearch: boolean;
  webdocStyle: boolean;
  veo3Prompts: boolean;
  apiAccess: boolean;
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
    ttsQuality: "neural2",
    multilingual: false,
    competitorAnalysis: false,
    deepResearch: false,
    webdocStyle: false,
    veo3Prompts: false,
    apiAccess: false,
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
    ttsQuality: "neural2",
    multilingual: false,
    competitorAnalysis: true,
    deepResearch: false,
    webdocStyle: true,
    veo3Prompts: true,
    apiAccess: false,
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
    ttsQuality: "neural2",
    multilingual: true,
    competitorAnalysis: true,
    deepResearch: true,
    webdocStyle: true,
    veo3Prompts: true,
    apiAccess: false,
    elevenLabs: false,
    dubspy: true,
    growthTools: true,
    claudeDeepAnalysis: true,
  },
};

/**
 * Get the user's subscription tier from the database.
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await sb.rpc("get_user_tier", { _user_id: userId });
  return (data as SubscriptionTier) || "starter";
}

/**
 * Get plan limits for a given tier.
 */
export function getLimitsForTier(tier: SubscriptionTier): PlanLimits {
  return PLAN_LIMITS[tier];
}

/**
 * Check if a tier has a specific boolean feature enabled.
 */
export function tierHasFeature(
  tier: SubscriptionTier,
  feature: keyof PlanLimits
): boolean {
  return !!PLAN_LIMITS[tier][feature];
}
