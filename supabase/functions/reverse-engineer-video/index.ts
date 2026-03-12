import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const { video_id, video_title, video_url, channel_name, channel_id, niche, language = "pt", views, subscribers, duration_seconds, user_id } = await req.json();
    if (!video_title && !video_id) throw new Error("video_title or video_id required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiH = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // Check if already analyzed
    if (video_id) {
      const { data: existing } = await sb.from("reverse_engineering_analyses")
        .select("id").eq("video_id", video_id).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ success: true, already_exists: true, id: existing.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Credit check (5 credits for reverse engineering)
    if (user_id) {
      const { data: hasCredits } = await sb.rpc("consume_credits", { _user_id: user_id, _amount: 5 });
      if (!hasCredits) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes (necessário: 5)" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch transcript/context via Brave
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    let webContext = "";
    if (BRAVE_API_KEY) {
      try {
        const searchQuery = `"${video_title}" transcript analysis breakdown`;
        const braveRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=3`, {
          headers: { "X-Subscription-Token": BRAVE_API_KEY },
        });
        const braveData = await braveRes.json();
        webContext = (braveData?.web?.results || []).slice(0, 3)
          .map((r: any) => `${r.title}: ${r.description || ""}`)
          .join("\n");
      } catch (e) { console.error("Brave error:", e); }
    }

    // Phase 1: Deep analysis via Gemini Pro
    const analysisRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are an elite YouTube reverse-engineering analyst. Analyze viral long-form videos to extract replicable patterns. Focus on: hook structure, retention mechanics, pacing, psychological triggers, narrative arc, and scene composition. Output structured analysis.`
          },
          {
            role: "user",
            content: `Reverse-engineer this viral video:\n\nTitle: "${video_title}"\nChannel: ${channel_name || "Unknown"}\nNiche: ${niche || "general"}\nViews: ${views || "N/A"}\nDuration: ${duration_seconds ? Math.round(duration_seconds / 60) + " min" : "N/A"}\n\nWeb context:\n${webContext}\n\nProvide deep analysis.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_analysis",
            parameters: {
              type: "object",
              properties: {
                hook_analysis: {
                  type: "object",
                  properties: {
                    hook_type: { type: "string" },
                    hook_text_estimate: { type: "string" },
                    first_3s_technique: { type: "string" },
                    curiosity_gap: { type: "string" },
                    retention_loop_count: { type: "number" }
                  }
                },
                narrative_structure: {
                  type: "object",
                  properties: {
                    arc_type: { type: "string" },
                    segments: { type: "array", items: { type: "object", properties: { name: { type: "string" }, purpose: { type: "string" }, duration_pct: { type: "number" } } } },
                    cliffhanger_count: { type: "number" },
                    payoff_style: { type: "string" }
                  }
                },
                psychological_triggers: { type: "array", items: { type: "string" } },
                pacing_analysis: {
                  type: "object",
                  properties: {
                    avg_scene_duration_sec: { type: "number" },
                    intensity_curve: { type: "string" },
                    music_usage: { type: "string" },
                    visual_variety_score: { type: "number" }
                  }
                },
                scene_structure: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      scene_index: { type: "number" },
                      timestamp_estimate: { type: "string" },
                      visual_style: { type: "string" },
                      purpose: { type: "string" },
                      retention_technique: { type: "string" }
                    }
                  }
                },
                clone_template: {
                  type: "object",
                  properties: {
                    replicable_elements: { type: "array", items: { type: "string" } },
                    unique_angle_needed: { type: "string" },
                    estimated_production_cost: { type: "string" },
                    recommended_duration_min: { type: "number" }
                  }
                },
                viral_score: { type: "number" },
                quality_score: { type: "number" },
                monetization_score: { type: "number" }
              },
              required: ["hook_analysis", "narrative_structure", "psychological_triggers", "scene_structure", "clone_template", "viral_score"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_analysis" } },
      }),
    });

    let analysis: any = {};
    if (analysisRes.ok) {
      const data = await analysisRes.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) analysis = JSON.parse(tc.function.arguments);
    } else {
      const errText = await analysisRes.text();
      console.error("AI analysis error:", analysisRes.status, errText);
      throw new Error(`AI analysis failed: ${analysisRes.status}`);
    }

    // Persist analysis
    const { data: inserted, error: insertErr } = await sb.from("reverse_engineering_analyses").insert({
      video_id: video_id || `manual_${Date.now()}`,
      video_title,
      channel_id,
      channel_name,
      niche: niche || "general",
      language,
      views: views || 0,
      subscribers: subscribers || 0,
      duration_seconds: duration_seconds || 0,
      hook_analysis: analysis.hook_analysis || {},
      retention_curve: analysis.retention_curve || [],
      narrative_structure: analysis.narrative_structure || {},
      scene_structure: analysis.scene_structure || [],
      psychological_triggers: analysis.psychological_triggers || [],
      pacing_analysis: analysis.pacing_analysis || {},
      clone_template: analysis.clone_template || {},
      viral_score: analysis.viral_score || 0,
      quality_score: analysis.quality_score || 0,
      monetization_score: analysis.monetization_score || 0,
      analyzed_by: "ensemble-gemini-pro",
      user_id: user_id || null,
    }).select("id").single();

    if (insertErr) console.error("Insert error:", insertErr);

    // Also save to video_blueprints for cross-referencing
    await sb.from("video_blueprints").upsert({
      video_id: video_id || `manual_${Date.now()}`,
      video_title,
      channel_id,
      channel_name,
      niche: niche || "general",
      views: views || 0,
      hook_text: analysis.hook_analysis?.hook_text_estimate,
      hook_type: analysis.hook_analysis?.hook_type,
      narrative_style: analysis.narrative_structure?.arc_type,
      psychological_triggers: analysis.psychological_triggers,
      scene_structure: analysis.scene_structure,
      story_structure: analysis.narrative_structure,
      clone_template: analysis.clone_template,
      scores: { viral: analysis.viral_score, quality: analysis.quality_score, monetization: analysis.monetization_score },
      source: "reverse-engineer",
    }, { onConflict: "video_id" }).catch(() => {});

    await sb.from("execution_logs").insert({
      function_name: "reverse-engineer-video",
      success: true,
      duration_ms: Date.now() - startTime,
      api_calls_made: 2,
      metadata: { video_id, niche, viral_score: analysis.viral_score },
    }).catch(() => {});

    return new Response(JSON.stringify({
      success: true,
      id: inserted?.id,
      viral_score: analysis.viral_score,
      quality_score: analysis.quality_score,
      hook_analysis: analysis.hook_analysis,
      clone_template: analysis.clone_template,
      scenes_extracted: (analysis.scene_structure || []).length,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("reverse-engineer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
