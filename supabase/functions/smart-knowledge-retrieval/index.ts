import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * SMART KNOWLEDGE RETRIEVAL v2 — Fast Direct Queries + AI Re-Ranking
 * 
 * V1 used a chat model to generate embeddings (125s+). V2 skips that:
 * 1. Direct queries to critical tables with keyword matching
 * 2. Quick re-rank with Gemini Flash Lite (optional, <5s)
 * 3. Total target: <10s
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, niche, style, language, limit = 15 } = await req.json();
    if (!topic) throw new Error("topic is required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const startTime = Date.now();

    // ═══ RAG CACHE — 24h TTL for same topic+niche combo ═══
    const cacheKey = `rag:${(topic || '').toLowerCase().trim().slice(0, 100)}:${(niche || 'general').toLowerCase()}`;
    try {
      const { data: cached } = await sb.from("research_cache")
        .select("result_json, expires_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cached?.result_json && cached.expires_at && new Date(cached.expires_at) > new Date()) {
        const cachedResult = cached.result_json as any;
        console.log(`[RAG-CACHE] HIT for "${cacheKey}" — returning ${cachedResult.knowledge?.length || 0} cached results`);
        return new Response(JSON.stringify({
          success: true,
          knowledge: cachedResult.knowledge || [],
          stats: { ...cachedResult.stats, cached: true, duration_ms: Date.now() - startTime },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) { console.warn("[RAG-CACHE] Cache read failed:", e); }

    const topicWords = topic.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);

    // ═══ STEP 1: Parallel direct queries (fast, no AI needed) ═══
    const [hooksRes, scriptsRes, titlesRes, attentionRes, modelsRes] = await Promise.all([
      sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
        .order("retention_score", { ascending: false }).limit(10),
      sb.from("script_knowledge").select("category,title,content")
        .order("effectiveness_score", { ascending: false }).limit(10),
      sb.from("viral_titles_db" as any).select("title,views,why_viral,niche")
        .order("views", { ascending: false }).limit(20),
      sb.from("attention_library").select("pattern_name,scene_type,example_text,attention_score")
        .order("attention_score", { ascending: false }).limit(8),
      sb.from("content_models").select("model_name,hook_pattern,pacing_guide,description")
        .order("effectiveness_score", { ascending: false }).limit(5),
    ]);

    // ═══ STEP 2: Score by keyword relevance ═══
    const scoreByRelevance = (text: string): number => {
      let score = 0;
      const lc = (text || '').toLowerCase();
      for (const w of topicWords) {
        if (lc.includes(w)) score += 10;
      }
      if (niche && lc.includes(niche.toLowerCase())) score += 15;
      if (style && lc.includes(style.toLowerCase())) score += 5;
      return score;
    };

    const allCandidates = [
      ...(hooksRes.data || []).map((h: any) => ({
        text: `[HOOK:${h.hook_type}] "${h.hook_text}" (retenção:${h.retention_score})`,
        score: scoreByRelevance(h.hook_text + ' ' + h.niche) + (h.retention_score || 0) / 10,
      })),
      ...(scriptsRes.data || []).map((s: any) => ({
        text: `[TECHNIQUE:${s.category}] ${s.title}: ${(s.content || '').slice(0, 200)}`,
        score: scoreByRelevance(s.title + ' ' + s.content + ' ' + s.category),
      })),
      ...(titlesRes.data || []).map((t: any) => ({
        text: `[TITLE] "${t.title}" (${(t.views || 0).toLocaleString()} views) — ${t.why_viral || 'N/A'}`,
        score: scoreByRelevance(t.title + ' ' + t.why_viral + ' ' + t.niche),
      })),
      ...(attentionRes.data || []).map((a: any) => ({
        text: `[ATTENTION:${a.scene_type}] ${a.pattern_name}: ${(a.example_text || '').slice(0, 150)}`,
        score: scoreByRelevance(a.pattern_name + ' ' + a.example_text) + (a.attention_score || 0) / 10,
      })),
      ...(modelsRes.data || []).map((m: any) => ({
        text: `[MODEL] ${m.model_name}: Hook="${m.hook_pattern}" Pacing="${m.pacing_guide}"`,
        score: scoreByRelevance(m.model_name + ' ' + m.description),
      })),
    ];

    // Sort by relevance score
    allCandidates.sort((a, b) => b.score - a.score);

    // ═══ STEP 3: Optional quick re-rank with Gemini (only if >limit candidates) ═══
    let finalKnowledge: string[];

    if (allCandidates.length > limit * 1.5) {
      // Take top candidates and optionally re-rank with AI
      const topCandidates = allCandidates.slice(0, Math.min(limit * 2, 30));
      
      try {
        const rerankAbort = new AbortController();
        const rerankTimeout = setTimeout(() => rerankAbort.abort(), 8000); // 8s max
        
        const rerankRes = await _ai({
            model: "google/gemini-2.5-flash-lite",
            max_completion_tokens: 256,
            messages: [
              { role: "system", content: `Return ONLY a JSON array of the ${limit} most relevant indexes (0-based) for the topic. No explanation.` },
              { role: "user", content: `Topic: "${topic}" (niche: ${niche || 'general'}, style: ${style || 'any'})\n\n${topCandidates.map((c, i) => `${i}: ${c.text.slice(0, 120)}`).join('\n')}` }
            ],
          });
        clearTimeout(rerankTimeout);

        if (rerankRes.ok) {
          const rerankData = await rerankRes.json();
          const content = rerankData.choices?.[0]?.message?.content || '';
          const indexMatch = content.match(/\[[\d\s,]+\]/);
          if (indexMatch) {
            const indexes: number[] = JSON.parse(indexMatch[0]);
            finalKnowledge = indexes
              .filter(i => i >= 0 && i < topCandidates.length)
              .slice(0, limit)
              .map(i => topCandidates[i].text);
          }
        }
      } catch (e) {
        console.warn("Re-ranking skipped:", (e as Error).message);
      }
    }

    // Fallback: use keyword-scored order
    if (!finalKnowledge! || finalKnowledge!.length === 0) {
      finalKnowledge = allCandidates.slice(0, limit).map(c => c.text);
    }

    const durationMs = Date.now() - startTime;
    console.log(`Smart knowledge retrieval v2: ${finalKnowledge.length} results in ${durationMs}ms (${allCandidates.length} candidates)`);

    const responsePayload = {
      success: true,
      knowledge: finalKnowledge,
      stats: {
        semantic_matches: 0,
        total_candidates: allCandidates.length,
        final_count: finalKnowledge.length,
        duration_ms: durationMs,
      }
    };

    // ═══ CACHE WRITE — store for 24h ═══
    try {
      await sb.from("research_cache").upsert({
        cache_key: cacheKey,
        source: "smart-knowledge-retrieval",
        result_json: responsePayload,
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
        query: `${topic?.slice(0, 100)}|${niche || 'general'}`,
      }, { onConflict: "cache_key" });
    } catch (e) { console.warn("[RAG-CACHE] Cache write failed:", e); }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-knowledge-retrieval error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
