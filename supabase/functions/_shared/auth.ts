// Shared auth utility for edge functions
// Verifies JWT and returns userId, or throws with proper error response

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface AuthResult {
  userId: string;
  email?: string;
}

/**
 * Verify the Authorization Bearer token from the request.
 * Returns userId on success, or a Response to return on failure.
 */
export async function verifyAuth(req: Request): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return {
    userId: data.claims.sub as string,
    email: data.claims.email as string | undefined,
  };
}

/**
 * Helper: if verifyAuth returned a Response, it's an error — return it.
 * Otherwise it's the AuthResult.
 */
export function isAuthError(result: AuthResult | Response): result is Response {
  return result instanceof Response;
}
