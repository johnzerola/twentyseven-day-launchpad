import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts

// ═══════════════════════════════════════════════════════════════
// ENGINE 2: CONTENT DNA EXTRACTION
// Analyzes a viral video and extracts its replicable DNA pattern
// Feeds: content_dna, hook_library, viral_patterns, video_blueprints
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const {
      video_id, video_title, channel_name, channel_id, niche,
      views, subscribers, likes, comments, duration_seconds,
      multiplier, gold_score, language = "pt", video_type = "long",
      source = "auto",
    } = await req.json();

    if (!video_title) throw new Error("video_title is required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiH = { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" };

    // Check if already extracted
    const vid = video_id || `manual_${Date.now()}`;
    const { data: existing } = await sb.from("content_dna")
      .select("id").eq("video_id", vid).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, already_exists: true, id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch web context via Brave for deeper analysis
    let webContext = "";
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    if (BRAVE_API_KEY) {
      try {
        const q = `"${video_title}" analysis breakdown structure`;
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=3`, {
          headers: { "X-Subscription-Token": BRAVE_API_KEY },
        });
        const data = await res.json();
        webContext = (data?.web?.results || []).slice(0, 3)
          .map((r: any) => `${r.title}: ${r.description || ""}`)
          .join("\n");
      } catch (e) { console.error("Brave error:", e); }
    }

    // AI DNA Extraction via Gemini Pro (deep analysis)
    const isShort = video_type === "short";
    const dnaRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an elite Content DNA Analyst. Extract the exact REPLICABLE viral DNA from YouTube videos.
Your job is to reverse-engineer WHY a video went viral and create a blueprint that can be used to generate new viral content.

Focus on:
1. HOOK DNA — First 5-10 seconds. What technique? What curiosity gap?
2. TITLE DNA — Pattern, emotion, structure
3. NARRATIVE DNA — Story arc, pacing, cliffhangers, open loops
4. VISUAL DNA — Style, thumbnail pattern, editing rhythm
5. EMOTIONAL DNA — Primary/secondary emotions, emotional arc through the video
6. RETENTION DNA — Where are the re-hooks? Pattern interrupts? Dopamine spikes?
7. REPLICATION BLUEPRINT — Step-by-step how to replicate this video's success

For ${isShort ? "SHORTS" : "LONG-FORM"} videos.`
          },
          {
            role: "user",
            content: `Extract FULL Content DNA from this ${isShort ? "Short" : "long-form"} video:

Title: "${video_title}"
Channel: ${channel_name || "Unknown"} (${subscribers || "?"} subs)
Niche: ${niche || "general"}
Views: ${views || "N/A"}
Duration: ${duration_seconds ? Math.round(duration_seconds / 60) + "min" : "N/A"}
Multiplier: ${multiplier || "N/A"}x
Engagement: ${views && likes ? ((likes + (comments || 0)) / views * 100).toFixed(2) : "?"}%

Web context:
${webContext || "No additional context available"}

Extract the complete viral DNA.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_content_dna",
            parameters: {
              type: "object",
              properties: {
                hook_type: { type: "string", description: "curiosity_gap, shock, counter_intuitive, stakes, forbidden_knowledge, identity, paradox, challenge, revelation" },
                hook_pattern: { type: "string", description: "Reusable hook template, e.g. 'E se [impossível] fosse real?'" },
                hook_strength: { type: "number", description: "0-10 rating" },
                title_structure: { type: "string", description: "Title pattern template" },
                title_uses_numbers: { type: "boolean" },
                title_uses_questions: { type: "boolean" },
                title_emotion: { type: "string" },
                story_structure: { type: "string", description: "linear, flashforward, mystery_reveal, listicle, comparison, transformation, challenge_arc, escalating_stakes" },
                pacing: { type: "string", description: "fast_cuts, slow_build, escalating, constant_intensity, rhythmic" },
                narrative_arc: {
                  type: "object",
                  properties: {
                    setup: { type: "string" },
                    conflict: { type: "string" },
                    escalation: { type: "string" },
                    climax: { type: "string" },
                    resolution: { type: "string" },
                  }
                },
                cliffhanger_count: { type: "number" },
                open_loop_count: { type: "number" },
                visual_style: { type: "string" },
                thumbnail_pattern: { type: "string" },
                emotion_primary: { type: "string" },
                emotion_secondary: { type: "string" },
                emotional_arc: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      timestamp_pct: { type: "number", description: "0-100 percentage through video" },
                      emotion: { type: "string" },
                      intensity: { type: "number", description: "1-10" },
                    }
                  }
                },
                psychological_triggers: { type: "array", items: { type: "string" } },
                retention_hooks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      timestamp_pct: { type: "number" },
                      technique: { type: "string" },
                      description: { type: "string" },
                    }
                  }
                },
                attention_score: { type: "number", description: "0-10" },
                curiosity_score: { type: "number", description: "0-10" },
                dopamine_score: { type: "number", description: "0-10" },
                estimated_retention: { type: "number", description: "0-100 percentage" },
                why_viral: { type: "string", description: "1-sentence viral mechanism" },
                replication_template: { type: "string", description: "Step-by-step replication guide" },
                content_model: { type: "string", description: "Best matching content model" },
              },
              required: ["hook_type", "hook_pattern", "story_structure", "emotion_primary", "psychological_triggers", "why_viral", "replication_template", "attention_score", "curiosity_score", "dopamine_score"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_content_dna" } },
      }),
    });

    let dna: any = {};
    if (dnaRes.ok) {
      const data = await dnaRes.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) dna = JSON.parse(tc.function.arguments);
    } else {
      throw new Error(`AI DNA extraction failed: ${dnaRes.status}`);
    }

    // ═══ PERSIST DNA ═══
    const { data: inserted, error: insertErr } = await sb.from("content_dna").upsert({
      video_id: vid,
      video_title,
      channel_id,
      channel_name,
      niche: niche || "general",
      language,
      views: views || 0,
      subscribers: subscribers || 0,
      multiplier: multiplier || 0,
      hook_type: dna.hook_type,
      hook_pattern: dna.hook_pattern,
      hook_strength: dna.hook_strength || 0,
      title_structure: dna.title_structure,
      title_uses_numbers: dna.title_uses_numbers || false,
      title_uses_questions: dna.title_uses_questions || false,
      title_emotion: dna.title_emotion,
      story_structure: dna.story_structure,
      pacing: dna.pacing,
      narrative_arc: dna.narrative_arc || {},
      cliffhanger_count: dna.cliffhanger_count || 0,
      open_loop_count: dna.open_loop_count || 0,
      visual_style: dna.visual_style,
      thumbnail_pattern: dna.thumbnail_pattern,
      emotion_primary: dna.emotion_primary,
      emotion_secondary: dna.emotion_secondary,
      emotional_arc: dna.emotional_arc || [],
      psychological_triggers: dna.psychological_triggers || [],
      retention_hooks: dna.retention_hooks || [],
      attention_score: dna.attention_score || 0,
      curiosity_score: dna.curiosity_score || 0,
      dopamine_score: dna.dopamine_score || 0,
      estimated_retention: dna.estimated_retention || 0,
      why_viral: dna.why_viral,
      replication_template: dna.replication_template,
      content_model: dna.content_model,
      gold_score: gold_score || 0,
      viral_score: Math.round(((dna.attention_score || 0) + (dna.curiosity_score || 0) + (dna.dopamine_score || 0)) / 3 * 10),
      source,
      video_type,
      duration_seconds: duration_seconds || 0,
    }, { onConflict: "video_id" }).select("id").single();

    if (insertErr) console.error("DNA insert error:", insertErr);

    // ═══ AUTO-FEED OTHER TABLES ═══
    const feedPromises: Promise<any>[] = [];

    // Feed hook_library
    if (dna.hook_pattern) {
      feedPromises.push(
        sb.from("hook_library").insert({
          hook_text: dna.hook_pattern,
          hook_type: dna.hook_type || "curiosity",
          niche: niche || "general",
          retention_score: dna.hook_strength || 7,
          source_video: vid,
        }).catch(() => {})
      );
    }

    // Feed viral_patterns
    if (dna.story_structure) {
      feedPromises.push(
        sb.from("viral_patterns").upsert({
          pattern_name: `${dna.story_structure}_${dna.hook_type}_${niche}`,
          niche: niche || "general",
          source_video: vid,
          pattern_json: {
            hook_type: dna.hook_type,
            story_structure: dna.story_structure,
            pacing: dna.pacing,
            narrative_arc: dna.narrative_arc,
            emotional_arc: dna.emotional_arc,
            retention_hooks: dna.retention_hooks,
            psychological_triggers: dna.psychological_triggers,
            scores: { attention: dna.attention_score, curiosity: dna.curiosity_score, dopamine: dna.dopamine_score },
          },
        }, { onConflict: "pattern_name" }).catch(() => {})
      );
    }

    // Feed video_blueprints
    feedPromises.push(
      sb.from("video_blueprints").upsert({
        video_id: vid,
        video_title,
        channel_id, channel_name,
        niche: niche || "general",
        views: views || 0,
        hook_type: dna.hook_type,
        hook_text: dna.hook_pattern,
        narrative_style: dna.story_structure,
        pacing_type: dna.pacing,
        visual_style: dna.visual_style,
        story_structure: dna.narrative_arc || {},
        psychological_triggers: dna.psychological_triggers || [],
        thumbnail_analysis: { pattern: dna.thumbnail_pattern },
        scores: {
          attention: dna.attention_score,
          curiosity: dna.curiosity_score,
          dopamine: dna.dopamine_score,
          retention: dna.estimated_retention,
          gold: gold_score || 0,
        },
        clone_template: { replication: dna.replication_template, content_model: dna.content_model },
        source: "content-dna-engine",
      }, { onConflict: "video_id" }).catch(() => {})
    );

    // Feed attention_library with retention hooks
    if (dna.retention_hooks?.length > 0) {
      for (const hook of dna.retention_hooks.slice(0, 5)) {
        feedPromises.push(
          sb.from("attention_library").insert({
            pattern_name: `${hook.technique}_${niche}_${vid.slice(0, 8)}`,
            scene_type: hook.technique || "re-hook",
            time_window: `${hook.timestamp_pct || 0}%`,
            emotion: dna.emotion_primary || "curiosity",
            attention_score: dna.attention_score || 7,
            retention_score: (dna.estimated_retention || 60) / 100,
            niche: niche || "general",
            example_text: `[${video_title}] ${hook.description || hook.technique}`,
            source: "content-dna-auto",
          }).catch(() => {})
        );
      }
    }

    await Promise.all(feedPromises);

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "extract-content-dna",
      success: true,
      duration_ms: Date.now() - startTime,
      api_calls_made: 1 + (BRAVE_API_KEY ? 1 : 0),
      metadata: {
        video_id: vid, niche,
        scores: { attention: dna.attention_score, curiosity: dna.curiosity_score, dopamine: dna.dopamine_score },
        tables_fed: feedPromises.length,
      },
    }).catch(() => {});

    return new Response(JSON.stringify({
      success: true,
      id: inserted?.id,
      dna: {
        hook_type: dna.hook_type,
        hook_pattern: dna.hook_pattern,
        story_structure: dna.story_structure,
        pacing: dna.pacing,
        emotion_primary: dna.emotion_primary,
        attention_score: dna.attention_score,
        curiosity_score: dna.curiosity_score,
        dopamine_score: dna.dopamine_score,
        estimated_retention: dna.estimated_retention,
        why_viral: dna.why_viral,
        replication_template: dna.replication_template,
      },
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("extract-content-dna error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
