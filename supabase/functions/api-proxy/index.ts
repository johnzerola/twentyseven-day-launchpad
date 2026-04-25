import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════
// API GATEWAY — CENTRALIZED MIDDLEWARE
// All external API calls flow through here with:
// 1. Authentication validation
// 2. Centralized rate limiting (api_config + api_usage)
// 3. Response caching (research_cache)
// 4. Usage logging (api_logs + execution_logs)
// 5. Auto-retry with exponential backoff
// 6. Credit consumption
// ═══════════════════════════════════════════════════════════

interface ProxyRequest {
  api_name: string;
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  cache_key?: string;
  cache_ttl_hours?: number;
  retry_count?: number;
  consume_credits?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const {
      api_name, method = "GET", url, headers = {}, body,
      cache_key, cache_ttl_hours = 168,
      retry_count = 2, consume_credits = 0,
    }: ProxyRequest = await req.json();

    if (!api_name || !url) {
      return new Response(JSON.stringify({ error: "api_name and url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ 1) AUTHENTICATE USER ═══
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      try {
        const { data: { user } } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        }).auth.getUser();
        userId = user?.id || null;
      } catch { /* anonymous request */ }
    }

    // ═══ 2) CREDIT CONSUMPTION CHECK ═══
    if (consume_credits > 0 && userId) {
      const { data: hasCredits } = await sb.rpc("consume_credits", {
        _user_id: userId,
        _amount: consume_credits,
      });
      if (!hasCredits) {
        await logExec(sb, "api-proxy", Date.now() - startTime, false, 0, { no_credits: true, api_name });
        return new Response(JSON.stringify({ error: "Créditos insuficientes.", credits_needed: consume_credits }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ═══ 3) CACHE CHECK ═══
    if (cache_key) {
      const { data: cached } = await sb
        .from("research_cache")
        .select("result_json, expires_at")
        .eq("cache_key", cache_key)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        await logExec(sb, "api-proxy", Date.now() - startTime, true, 0, { cache_hit: true, api_name });
        return new Response(JSON.stringify({ data: cached.result_json, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ═══ 4) CENTRALIZED RATE LIMITING ═══
    const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: api_name });

    if (!allowed) {
      await logExec(sb, "api-proxy", Date.now() - startTime, false, 0, { rate_limited: true, api_name });
      return new Response(JSON.stringify({
        error: `Limite diário excedido para ${api_name}. Tente novamente amanhã.`,
        rate_limited: true,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ 5) RESOLVE API KEY ═══
    const { data: config } = await sb.from("api_config")
      .select("env_var_key").eq("api_name", api_name).maybeSingle();

    const envKey = config?.env_var_key || `${api_name.toUpperCase()}_API_KEY`;
    const apiKey = Deno.env.get(envKey);

    // ═══ 6) BUILD REQUEST ═══
    const fetchHeaders: Record<string, string> = { "Content-Type": "application/json", ...headers };
    if (apiKey) {
      if (api_name === "brave") fetchHeaders["X-Subscription-Token"] = apiKey;
      else if (api_name !== "youtube") fetchHeaders["Authorization"] = `Bearer ${apiKey}`;
    }

    const fetchOpts: RequestInit = { method, headers: fetchHeaders };
    if (body && method !== "GET") {
      fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    // ═══ 7) EXECUTE WITH RETRY ═══
    let response: Response | null = null;
    let lastError: string = '';
    for (let attempt = 0; attempt <= retry_count; attempt++) {
      try {
        response = await fetch(url, fetchOpts);
        if (response.ok || response.status < 500) break;
        lastError = `HTTP ${response.status}`;
        if (attempt < retry_count) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'fetch failed';
        if (attempt < retry_count) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (!response) {
      await logExec(sb, "api-proxy", Date.now() - startTime, false, 1, { error: lastError, api_name });
      return new Response(JSON.stringify({ error: lastError }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseData = await response.json();

    // ═══ 8) CACHE RESPONSE ═══
    if (cache_key && response.ok) {
      const ttl = new Date(Date.now() + cache_ttl_hours * 3600000).toISOString();
      await sb.from("research_cache").upsert({
        cache_key,
        source: api_name,
        result_json: responseData,
        expires_at: ttl,
        query: cache_key,
        ttl,
      }, { onConflict: "cache_key" }).then(() => {}, () => {});
    }

    // ═══ 9) LOG USAGE ═══
    if (userId) {
      await sb.from("api_logs").insert({
        user_id: userId,
        service: api_name,
        endpoint: url.substring(0, 200),
        response_code: response.status,
        cost: 0,
        tokens_used: 0,
      }).then(() => {}, () => {});
    }

    await logExec(sb, "api-proxy", Date.now() - startTime, response.ok, 1, {
      api_name, status: response.status, userId: userId?.slice(0, 8),
    });

    return new Response(JSON.stringify({ data: responseData, cached: false, status: response.status }), {
      status: response.ok ? 200 : response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    await logExec(sb, "api-proxy", Date.now() - startTime, false, 0, { error: (e as Error).message });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function logExec(sb: any, fnName: string, durationMs: number, success: boolean, apiCalls: number, meta: any) {
  try {
    await sb.from("execution_logs").insert({
      function_name: fnName, duration_ms: durationMs, success, api_calls_made: apiCalls, metadata: meta,
    });
  } catch { /* silent */ }
}
