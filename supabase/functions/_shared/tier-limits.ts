// Shared tier-based access control for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type SubscriptionTier = "starter" | "pro" | "full";

export interface PlanLimits {
  maxChannels: number;
  videosPerDay: number;
  videosPerMonth: number;
  searchesPerDay: number;
  tubebotChats: number; // -1 = unlimited
  maxNarrationMinutes: number;
  maxVideoDurationMinutes: number;
  multilingual: boolean;
  competitorAnalysis: boolean;
  apiAccess: boolean;
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
    apiAccess: false,
  },
  pro: {
    maxChannels: 5,
    videosPerDay: 5,
    videosPerMonth: 150,
    searchesPerDay: 10,
    tubebotChats: -1,
    maxNarrationMinutes: 60,
    maxVideoDurationMinutes: 60,
    multilingual: true,
    competitorAnalysis: true,
    apiAccess: false,
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
    apiAccess: true,
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
  feature: keyof Pick<PlanLimits, "multilingual" | "competitorAnalysis" | "apiAccess">
): boolean {
  return PLAN_LIMITS[tier][feature];
}
