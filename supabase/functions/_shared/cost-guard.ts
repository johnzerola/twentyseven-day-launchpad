// Budget guard — blocks expensive AI calls when daily/monthly thresholds are hit
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type Provider = "gemini" | "perplexity" | "openai" | "elevenlabs" | "anthropic";

// Approximate cost-per-call estimates ($USD)
export const COST_ESTIMATES: Record<string, number> = {
  "perplexity-sonar": 0.005,
  "perplexity-sonar-pro": 0.015,
  "gemini-flash": 0.0002,
  "gemini-flash-lite": 0.00005,
  "gemini-pro": 0.003,
  "openai-gpt5-mini": 0.001,
  "openai-gpt5": 0.01,
  "elevenlabs-tts": 0.03,
  "claude-sonnet": 0.005,
};

let _client: ReturnType<typeof createClient> | null = null;
function sbAdmin() {
  if (!_client) {
    _client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _client;
}

/**
 * Check budget BEFORE making an expensive call.
 * Returns null if allowed, or a 429 Response if blocked.
 */
export async function assertBudget(provider: Provider): Promise<Response | null> {
  try {
    const { data, error } = await sbAdmin().rpc("check_budget", { _provider: provider });
    if (error) {
      console.error(`[BUDGET] check failed:`, error.message);
      return null; // fail open
    }
    const result = data as any;
    if (!result.allowed) {
      console.error(`[BUDGET] BLOCKED ${provider}:`, result);
      return new Response(
        JSON.stringify({
          error: "Budget threshold exceeded",
          provider,
          reason: result.reason,
          daily_spend: result.daily_spend,
          daily_limit: result.daily_limit,
          retry_after: "24h",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (result.alert) {
      console.warn(`[BUDGET] ${provider} approaching limit: $${result.daily_spend}/$${result.daily_limit}`);
    }
    return null;
  } catch (e) {
    console.error(`[BUDGET] exception:`, e);
    return null;
  }
}

/**
 * Log a cost AFTER a successful AI call. Fire-and-forget.
 */
export async function logCost(opts: {
  provider: Provider;
  functionName: string;
  costUsd?: number;
  estimateKey?: string;
  tokens?: number;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const cost = opts.costUsd ?? (opts.estimateKey ? COST_ESTIMATES[opts.estimateKey] ?? 0 : 0);
    await sbAdmin().from("ai_cost_ledger").insert({
      provider: opts.provider,
      function_name: opts.functionName,
      cost_usd: cost,
      tokens: opts.tokens ?? 0,
      user_id: opts.userId ?? null,
      metadata: opts.metadata ?? {},
    });
  } catch (e) {
    console.error(`[BUDGET] logCost failed:`, e);
  }
}
