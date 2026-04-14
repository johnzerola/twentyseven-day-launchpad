// Credit enforcement guard for expensive edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface CreditCheck {
  allowed: boolean;
  remaining: number;
  cost: number;
  tier: string;
}

/**
 * Enforce credits before running an expensive operation.
 * Returns null if allowed, or a 402 Response if denied.
 */
export async function enforceCreditGuard(
  userId: string,
  operation: string,
): Promise<Response | null> {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await sb.rpc("enforce_credits", {
      _user_id: userId,
      _operation: operation,
    });

    if (error) {
      console.error(`[CREDIT-GUARD] ${operation} error:`, error.message);
      // Fail open on DB error — don't block user if credits check fails
      return null;
    }

    const result = data as CreditCheck;
    if (!result.allowed) {
      console.warn(`[CREDIT-GUARD] ${operation} BLOCKED for user=${userId} tier=${result.tier} remaining=${result.remaining} cost=${result.cost}`);
      return new Response(
        JSON.stringify({
          error: "Créditos insuficientes",
          credits_remaining: result.remaining,
          credits_cost: result.cost,
          tier: result.tier,
          upgrade_message: result.tier === "starter"
            ? "Faça upgrade para o plano Pro para mais créditos."
            : "Seus créditos mensais foram consumidos. Eles renovam todo mês.",
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`[CREDIT-GUARD] ${operation} ALLOWED user=${userId} tier=${result.tier} remaining=${result.remaining} cost=${result.cost}`);
    return null;
  } catch (err) {
    console.error(`[CREDIT-GUARD] ${operation} exception:`, err);
    // Fail open
    return null;
  }
}
