import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Audience Psychology Engine
 * Analyzes viral content across multiple knowledge tables to extract
 * psychological patterns that drive clicks, retention and engagement.
 * Stores results in audience_psychology_patterns.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

  try {
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // ========== 1. Gather data from all sources ==========
    const [
      { data: viralTitles },
      { data: blueprints },
      { data: scriptKnowledge },
      { data: existingPsych },
      { data: viralContent },
    ] = await Promise.all([
      sb.from("viral_titles_db").select("title, views, niche, why_viral, title_pattern, emotional_triggers").order("views", { ascending: false }).limit(100),
      sb.from("video_blueprints").select("video_title, hook_type, hook_text, psychological_triggers, narrative_style, retention_map, scores, niche").order("created_at", { ascending: false }).limit(50),
      sb.from("script_knowledge").select("title, content, category, effectiveness_score").in("category", ["hook", "retention_technique", "open_loop", "psychology"]).order("effectiveness_score", { ascending: false }).limit(50),
      sb.from("audience_psychology_patterns").select("trigger_type").limit(200),
      sb.from("viral_content_library").select("content_json, category, effectiveness_score, niches").eq("category", "psychology_triggers").limit(30),
    ]);

    const existingTriggers = new Set((existingPsych || []).map(p => p.trigger_type));

    // Build context for AI
    const titlesSample = (viralTitles || []).slice(0, 40).map(t =>
      `"${t.title}" (${t.views} views, niche: ${t.niche}, triggers: ${(t.emotional_triggers || []).join(', ')}, pattern: ${t.title_pattern || 'unknown'})`
    ).join('\n');

    const blueprintsSample = (blueprints || []).slice(0, 20).map(b =>
      `"${b.video_title}" — hook: ${b.hook_type} "${(b.hook_text || '').slice(0, 100)}", style: ${b.narrative_style}, triggers: ${(b.psychological_triggers || []).join(', ')}`
    ).join('\n');

    const knowledgeSample = (scriptKnowledge || []).slice(0, 20).map(k =>
      `[${k.category}] ${k.title}: ${k.content.slice(0, 150)}`
    ).join('\n');

    const existingContentTriggers = (viralContent || []).slice(0, 15).map(v => {
      const cj = v.content_json as any;
      return `${cj.name || cj.triggers?.[0] || 'unknown'}: ${cj.description || cj.how_to_apply || ''}`.slice(0, 200);
    }).join('\n');

    // ========== 2. AI Analysis ==========
    const aiRes = await _ai({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a behavioral psychologist specializing in YouTube audience behavior. Analyze the provided data to extract psychological patterns that drive clicks, retention, and engagement. Focus on patterns NOT yet in the database. Be specific with examples.`
          },
          {
            role: "user",
            content: `ANALYZE THESE DATA SOURCES AND EXTRACT NEW PSYCHOLOGICAL PATTERNS:

VIRAL TITLES (top performing):
${titlesSample}

VIDEO BLUEPRINTS (reverse engineered):
${blueprintsSample}

SCRIPT KNOWLEDGE (proven techniques):
${knowledgeSample}

EXISTING PSYCHOLOGY TRIGGERS:
${existingContentTriggers}

ALREADY CATALOGED TRIGGERS (do NOT repeat): ${[...existingTriggers].join(', ') || 'none yet'}

DOMAINS TO ANALYZE:
- curiosity_gap: information gaps that compel clicking/watching
- dopamine_triggers: reward anticipation, reveals, countdowns
- emotional_storytelling: empathy, identification, catharsis
- conflict_and_resolution: tension building, stakes, payoff
- surprise_elements: plot twists, unexpected facts, reversals
- social_validation: numbers, authority, proof, testimonials
- fomo: urgency, scarcity, exclusivity, time-sensitivity
- identity_storytelling: "people like you" narratives, aspiration

Extract 8-15 NEW patterns with specific examples from the data.`
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_psychology_patterns",
            description: "Extract audience psychology patterns from viral content data",
            parameters: {
              type: "object",
              properties: {
                patterns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      trigger_type: { type: "string", description: "Specific trigger name e.g. 'numbered_mystery_gap', 'escalating_stakes'" },
                      domain: { type: "string", enum: ["curiosity_gap", "dopamine_triggers", "emotional_storytelling", "conflict_and_resolution", "surprise_elements", "social_validation", "fomo", "identity_storytelling"] },
                      description: { type: "string", description: "How this pattern works psychologically (2-3 sentences)" },
                      how_to_apply: { type: "string", description: "Practical instruction for applying this in scripts/titles" },
                      example_titles: { type: "array", items: { type: "string" }, description: "2-4 example titles using this pattern" },
                      example_hooks: { type: "array", items: { type: "string" }, description: "1-3 example hook scripts using this pattern" },
                      storytelling_pattern: { type: "string", description: "The narrative structure this trigger fits into" },
                      retention_score: { type: "number", description: "1-10 estimated retention impact" },
                      best_niches: { type: "array", items: { type: "string" }, description: "Niches where this works best" },
                    },
                    required: ["trigger_type", "domain", "description", "how_to_apply", "example_titles", "example_hooks", "storytelling_pattern", "retention_score", "best_niches"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["patterns"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_psychology_patterns" } },
      });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Credits insufficient." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No AI response");
    const { patterns } = JSON.parse(toolCall.function.arguments);

    // ========== 3. Save new patterns ==========
    let inserted = 0;
    for (const p of (patterns || [])) {
      if (existingTriggers.has(p.trigger_type)) continue;

      const { error } = await sb.from("audience_psychology_patterns").insert({
        trigger_type: p.trigger_type,
        description: `[${p.domain}] ${p.description}\n\nComo aplicar: ${p.how_to_apply}`,
        example_titles: p.example_titles || [],
        example_hooks: p.example_hooks || [],
        storytelling_pattern: p.storytelling_pattern,
        retention_score: p.retention_score || 7,
        niches: p.best_niches || [],
        source: "audience-psychology-engine",
      });

      if (!error) {
        inserted++;
        existingTriggers.add(p.trigger_type);
      }
    }

    // ========== 4. Also enrich viral_content_library ==========
    for (const p of (patterns || []).filter((p: any) => p.retention_score >= 8).slice(0, 5)) {
      await sb.from("viral_content_library").insert({
        category: "psychology_triggers",
        content_json: {
          name: p.trigger_type,
          domain: p.domain,
          description: p.description,
          how_to_apply: p.how_to_apply,
          example_titles: p.example_titles,
          best_for_niches: p.best_niches,
        },
        niches: p.best_niches || [],
        effectiveness_score: p.retention_score,
        language: "en",
      }).then(() => {}).catch(() => {});
    }

    await sb.from("execution_logs").insert({
      function_name: "audience-psychology-engine",
      duration_ms: Date.now() - startTime,
      success: true,
      api_calls_made: 1,
      metadata: { patterns_found: patterns?.length || 0, inserted, sources_analyzed: { titles: (viralTitles || []).length, blueprints: (blueprints || []).length, knowledge: (scriptKnowledge || []).length } },
    });

    return new Response(JSON.stringify({
      success: true,
      patterns_found: patterns?.length || 0,
      patterns_inserted: inserted,
      patterns,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audience-psychology-engine error:", e);
    await sb.from("execution_logs").insert({
      function_name: "audience-psychology-engine",
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: e instanceof Error ? e.message : "Unknown error",
    }).catch(() => {});
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
