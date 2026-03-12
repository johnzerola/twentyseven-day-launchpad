import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, count = 10, freshness, country, language } = await req.json();
    if (!query?.trim()) throw new Error("Query is required");

    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    if (!BRAVE_API_KEY) throw new Error("BRAVE_API_KEY not configured. Add it in Settings.");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check cache first
    const cacheKey = `brave:${query}:${count}:${country || ''}:${language || ''}`;
    const { data: cached } = await sb
      .from("research_cache")
      .select("result_json")
      .eq("cache_key", cacheKey)
      .eq("source", "brave")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      console.log("Cache hit:", cacheKey);
      return new Response(JSON.stringify({ ...cached.result_json as any, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Brave Search API
    const params = new URLSearchParams({
      q: query,
      count: String(count),
    });
    if (freshness) params.set("freshness", freshness); // pd (past day), pw (past week), pm (past month)
    if (country) params.set("country", country.toLowerCase());
    if (language) params.set("search_lang", language);

    console.log("Brave Search:", query);
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Brave API error:", res.status, errText);
      if (res.status === 429) throw new Error("Rate limit. Tente novamente.");
      if (res.status === 402) throw new Error("Brave Search: créditos insuficientes.");
      throw new Error(`Brave Search error: ${res.status}`);
    }

    const data = await res.json();

    // Extract clean results
    const results = (data.web?.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age,
      language: r.language,
      extra_snippets: r.extra_snippets?.slice(0, 2),
    }));

    const result = {
      query,
      results,
      total: data.web?.totalEstimatedMatches || results.length,
      cached: false,
    };

    // Cache for 48h (validation mode: stretch budget)
    await sb.from("research_cache").upsert({
      cache_key: cacheKey,
      source: "brave",
      result_json: result,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "cache_key,source" });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("brave-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: e instanceof Error && e.message.includes("429") ? 429 : e instanceof Error && e.message.includes("402") ? 402 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
