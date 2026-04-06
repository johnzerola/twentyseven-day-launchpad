import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResearchQuery {
  query: string;
  category?: string;
  model?: string;
  searchRecency?: string;
  storeInKnowledge?: boolean;
  storageCategory?: string;
  storageTitle?: string;
}

async function queryPerplexity(
  apiKey: string,
  query: string,
  model = "sonar-pro",
  searchRecency?: string,
): Promise<{ content: string; citations: string[] }> {
  const body: any = {
    model,
    messages: [
      {
        role: "system",
        content: `Pesquisador expert em YouTube e monetização. Responda em português brasileiro com dados específicos, números, exemplos e estratégias acionáveis. Cite canais reais e métricas. Markdown. Seja conciso e direto.`,
      },
      { role: "user", content: query },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  };

  if (searchRecency) {
    body.search_recency_filter = searchRecency;
  }

  const resp = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Perplexity API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { queries, singleQuery, storeResults } = await req.json();

    // Single query mode (for TubeBot tool calling)
    if (singleQuery) {
      const result = await queryPerplexity(
        PERPLEXITY_API_KEY,
        singleQuery.query,
        singleQuery.model || "sonar-pro",
        singleQuery.searchRecency,
      );

      // Optionally store in knowledge base
      if (singleQuery.storeInKnowledge) {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        await sb.from("youtube_knowledge").insert({
          title: singleQuery.storageTitle || singleQuery.query.slice(0, 100),
          content: result.content,
          category: singleQuery.storageCategory || "perplexity_research",
          priority: 9,
          source: "perplexity",
          tags: ["perplexity", "research", "2025"],
        });
      }

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Batch query mode (for mass research)
    if (queries && Array.isArray(queries)) {
      const results: any[] = [];

      for (const q of queries) {
        try {
          console.log(`Researching: ${q.query.slice(0, 60)}...`);
          const result = await queryPerplexity(
            PERPLEXITY_API_KEY,
            q.query,
            q.model || "sonar-pro",
            q.searchRecency,
          );
          results.push({
            query: q.query,
            category: q.category,
            ...result,
          });
          // Small delay between queries to avoid rate limits
          await new Promise((r) => setTimeout(r, 800));
        } catch (e: any) {
          console.error(`Query failed: ${q.query.slice(0, 40)}`, e.message);
          results.push({
            query: q.query,
            category: q.category,
            content: `Error: ${e.message}`,
            citations: [],
          });
        }
      }

      // Store all results in knowledge base if requested
      if (storeResults) {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const insertRows = results
          .filter((r) => !r.content.startsWith("Error:"))
          .map((r) => ({
            title: r.category || r.query.slice(0, 100),
            content: r.content + (r.citations?.length ? `\n\n**Fontes:** ${r.citations.join(", ")}` : ""),
            category: "perplexity_research",
            priority: 9,
            source: "perplexity",
            tags: ["perplexity", "research", "2025", r.category || "general"],
          }));

        if (insertRows.length > 0) {
          const { error } = await sb.from("youtube_knowledge").insert(insertRows);
          if (error) console.error("Insert error:", error);
          else console.log(`Stored ${insertRows.length} research results`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, results, stored: storeResults ? results.length : 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Provide 'singleQuery' or 'queries' array" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("perplexity-research error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
