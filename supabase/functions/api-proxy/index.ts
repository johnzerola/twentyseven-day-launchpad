import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProxyRequest {
  api_name: string;
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  cache_key?: string;
  cache_ttl_hours?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { api_name, method = "GET", url, headers = {}, body, cache_key, cache_ttl_hours = 168 }: ProxyRequest = await req.json();

    if (!api_name || !url) {
      return new Response(JSON.stringify({ error: "api_name and url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Check cache first
    if (cache_key) {
      const { data: cached } = await sb
        .from("research_cache")
        .select("result_json, expires_at")
        .eq("cache_key", cache_key)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        await logExecution(sb, "api-proxy", Date.now() - startTime, true, 0, { cache_hit: true, api_name });
        return new Response(JSON.stringify({ data: cached.result_json, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2) Check API usage limits
    const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: api_name });

    if (!allowed) {
      await logExecution(sb, "api-proxy", Date.now() - startTime, false, 0, { rate_limited: true, api_name });
      return new Response(JSON.stringify({
        error: `Daily limit exceeded for ${api_name}. Try again tomorrow.`,
        rate_limited: true,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Resolve API key from env
    const { data: config } = await sb
      .from("api_config")
      .select("env_var_key")
      .eq("api_name", api_name)
      .maybeSingle();

    const envKey = config?.env_var_key || `${api_name.toUpperCase()}_API_KEY`;
    const apiKey = Deno.env.get(envKey);

    // 4) Execute external call
    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    // Auto-inject auth headers based on api_name
    if (apiKey) {
      if (api_name === "brave") {
        fetchHeaders["X-Subscription-Token"] = apiKey;
      } else if (api_name === "perplexity") {
        fetchHeaders["Authorization"] = `Bearer ${apiKey}`;
      } else if (api_name === "youtube") {
        // YouTube uses query param, handled by caller
      } else {
        fetchHeaders["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    const fetchOpts: RequestInit = { method, headers: fetchHeaders };
    if (body && method !== "GET") {
      fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOpts);
    const responseData = await response.json();

    // 5) Cache result if cache_key provided
    if (cache_key && response.ok) {
      const ttl = new Date(Date.now() + cache_ttl_hours * 3600000).toISOString();
      await sb.from("research_cache").upsert({
        cache_key,
        source: api_name,
        result_json: responseData,
        expires_at: ttl,
        query: cache_key,
        ttl: ttl,
      }, { onConflict: "cache_key" });
    }

    // 6) Log the call in api_logs
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      }).auth.getUser();
      userId = user?.id || null;
    }

    if (userId) {
      await sb.from("api_logs").insert({
        user_id: userId,
        service: api_name,
        endpoint: url.substring(0, 200),
        response_code: response.status,
        cost: 0,
        tokens_used: 0,
      });
    }

    await logExecution(sb, "api-proxy", Date.now() - startTime, response.ok, 1, {
      api_name, status: response.status,
    });

    return new Response(JSON.stringify({ data: responseData, cached: false, status: response.status }), {
      status: response.ok ? 200 : response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    await logExecution(sb, "api-proxy", Date.now() - startTime, false, 0, { error: e.message });
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function logExecution(sb: any, fnName: string, durationMs: number, success: boolean, apiCalls: number, meta: any) {
  try {
    await sb.from("execution_logs").insert({
      function_name: fnName,
      duration_ms: durationMs,
      success,
      api_calls_made: apiCalls,
      metadata: meta,
    });
  } catch { /* silent */ }
}
