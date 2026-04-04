import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const { video_id, video_title, video_url, channel_name, channel_id, niche, language = "pt", views, subscribers, duration_seconds, user_id } = await req.json();
    if (!video_title && !video_id) throw new Error("video_title or video_id required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

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

    // Credit check (5 credits)
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

    // ═══ Calculate exact timing ═══
    const totalDurationSec = duration_seconds || 0;
    const totalDurationMin = totalDurationSec > 0 ? Math.round(totalDurationSec / 60) : 0;
    const sceneDuration = 30; // ~30s per scene block
    const expectedScenes = totalDurationSec > 0 ? Math.max(6, Math.ceil(totalDurationSec / sceneDuration)) : 20;

    console.log(`Reverse-engineering: "${video_title}" | ${totalDurationMin}min | ${expectedScenes} scenes expected`);

    // ═══ Phase 1: Deep structural + visual analysis ═══
    const analysisRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are an ELITE YouTube reverse-engineering analyst specializing in EXACT CLONING of viral videos.

YOUR MISSION: Extract EVERY replicable element so someone can create a video with the SAME duration, SAME pacing, SAME visual patterns, and SAME emotional arc.

CRITICAL DURATION RULE: The original video is ${totalDurationMin} minutes (${totalDurationSec} seconds). Your scene_timeline MUST cover the ENTIRE duration from 00:00 to ${totalDurationMin > 0 ? `${String(Math.floor(totalDurationMin / 60)).padStart(2,'0')}:${String(totalDurationMin % 60).padStart(2,'0')}:00` : 'the end'}.
Each scene block should be ~${sceneDuration} seconds. Generate EXACTLY ${expectedScenes} scene blocks.

For EACH scene, describe:
- EXACT visual style (camera angle, color grading, lighting, composition)
- What is shown on screen (B-roll type, graphics, text overlays, transitions)
- Narration style at that moment (pace, tone, energy level)
- Retention technique used (open loop, pattern interrupt, cliffhanger, reveal)
- Visual prompt that could recreate a SIMILAR image/video with AI

OUTPUT FORMAT: Use the save_analysis function with ALL fields filled.`
          },
          {
            role: "user",
            content: `Reverse-engineer this viral video for EXACT CLONING:

Title: "${video_title}"
Channel: ${channel_name || "Unknown"}
Niche: ${niche || "general"}
Views: ${views || "N/A"}
EXACT Duration: ${totalDurationMin} minutes (${totalDurationSec} seconds)
Language: ${language}

Web context/transcript fragments:
${webContext}

REQUIREMENTS:
1. Generate EXACTLY ${expectedScenes} scene blocks covering the FULL ${totalDurationMin}-minute duration
2. Each scene_timeline entry must have start_time and end_time in "MM:SS" format
3. Include DETAILED visual_prompt for each scene (what AI image/video generator should create)
4. Map the EXACT emotional arc and pacing changes
5. Identify EVERY visual pattern (color shifts, camera movements, text overlays, B-roll types)
6. The clone script should result in a video of the SAME length: ${totalDurationMin} minutes`
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
                    retention_loop_count: { type: "number" },
                    visual_hook_description: { type: "string", description: "Exact visual description of the first 3-5 seconds" }
                  }
                },
                narrative_structure: {
                  type: "object",
                  properties: {
                    arc_type: { type: "string" },
                    segments: { type: "array", items: { type: "object", properties: { name: { type: "string" }, purpose: { type: "string" }, duration_pct: { type: "number" }, duration_seconds: { type: "number" } } } },
                    cliffhanger_count: { type: "number" },
                    payoff_style: { type: "string" },
                    total_duration_minutes: { type: "number" }
                  }
                },
                psychological_triggers: { type: "array", items: { type: "string" } },
                pacing_analysis: {
                  type: "object",
                  properties: {
                    avg_scene_duration_sec: { type: "number" },
                    intensity_curve: { type: "string" },
                    music_usage: { type: "string" },
                    visual_variety_score: { type: "number" },
                    cuts_per_minute: { type: "number" },
                    b_roll_percentage: { type: "number" }
                  }
                },
                visual_dna: {
                  type: "object",
                  description: "Complete visual identity of the video",
                  properties: {
                    primary_style: { type: "string" },
                    color_palette: { type: "array", items: { type: "string" } },
                    lighting_style: { type: "string" },
                    camera_patterns: { type: "array", items: { type: "string" } },
                    transition_types: { type: "array", items: { type: "string" } },
                    text_overlay_style: { type: "string" },
                    b_roll_types: { type: "array", items: { type: "string" } },
                    aspect_ratio: { type: "string" },
                    production_level: { type: "string" },
                    is_faceless: { type: "boolean" },
                    reference_style_prompt: { type: "string", description: "A comprehensive prompt that captures the ENTIRE visual identity for AI image generation" }
                  }
                },
                scene_timeline: {
                  type: "array",
                  description: `EXACTLY ${expectedScenes} scenes covering full ${totalDurationMin} minutes`,
                  items: {
                    type: "object",
                    properties: {
                      scene_index: { type: "number" },
                      start_time: { type: "string", description: "MM:SS format" },
                      end_time: { type: "string", description: "MM:SS format" },
                      duration_seconds: { type: "number" },
                      narration_summary: { type: "string", description: "What the narrator says in this segment" },
                      visual_description: { type: "string", description: "Detailed description of what is shown on screen" },
                      visual_prompt: { type: "string", description: "AI-ready prompt to recreate this scene's visuals" },
                      camera_angle: { type: "string" },
                      mood: { type: "string" },
                      retention_technique: { type: "string" },
                      energy_level: { type: "string", description: "low/medium/high/explosive" },
                      text_on_screen: { type: "string" },
                      transition_to_next: { type: "string" }
                    }
                  }
                },
                clone_template: {
                  type: "object",
                  properties: {
                    replicable_elements: { type: "array", items: { type: "string" } },
                    unique_angle_needed: { type: "string" },
                    estimated_production_cost: { type: "string" },
                    recommended_duration_min: { type: "number", description: "MUST match original duration" },
                    script_word_count_target: { type: "number", description: "Words needed for exact duration match at 150 wpm" },
                    visual_style_to_use: { type: "string" },
                    key_visual_moments: { type: "array", items: { type: "string" }, description: "Most impactful visual moments to recreate" }
                  }
                },
                viral_score: { type: "number" },
                quality_score: { type: "number" },
                monetization_score: { type: "number" }
              },
              required: ["hook_analysis", "narrative_structure", "psychological_triggers", "scene_timeline", "visual_dna", "clone_template", "viral_score"],
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

    // Ensure recommended_duration matches original
    if (analysis.clone_template) {
      analysis.clone_template.recommended_duration_min = totalDurationMin || analysis.clone_template.recommended_duration_min;
      if (!analysis.clone_template.script_word_count_target && totalDurationMin > 0) {
        analysis.clone_template.script_word_count_target = totalDurationMin * 150;
      }
    }

    console.log(`Analysis complete: ${(analysis.scene_timeline || []).length} scenes, visual_dna: ${analysis.visual_dna?.primary_style}`);

    // ═══ Build backward-compatible scene_structure from scene_timeline ═══
    const scene_structure = (analysis.scene_timeline || []).map((s: any) => ({
      scene_index: s.scene_index,
      timestamp_estimate: `${s.start_time}-${s.end_time}`,
      visual_style: s.visual_description || s.visual_prompt || '',
      purpose: s.narration_summary || '',
      retention_technique: s.retention_technique || '',
    }));

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
      duration_seconds: totalDurationSec,
      hook_analysis: analysis.hook_analysis || {},
      retention_curve: analysis.retention_curve || [],
      narrative_structure: analysis.narrative_structure || {},
      scene_structure: scene_structure,
      psychological_triggers: analysis.psychological_triggers || [],
      pacing_analysis: analysis.pacing_analysis || {},
      clone_template: analysis.clone_template || {},
      viral_score: analysis.viral_score || 0,
      quality_score: analysis.quality_score || 0,
      monetization_score: analysis.monetization_score || 0,
      analyzed_by: "ensemble-gemini-pro-v2",
      user_id: user_id || null,
    }).select("id").single();

    if (insertErr) console.error("Insert error:", insertErr);

    // Save to video_blueprints
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
      scene_structure: scene_structure,
      story_structure: analysis.narrative_structure,
      clone_template: analysis.clone_template,
      scores: { viral: analysis.viral_score, quality: analysis.quality_score, monetization: analysis.monetization_score },
      source: "reverse-engineer",
    }, { onConflict: "video_id" }).catch(() => {});

    // ═══ AUTO-FEED PIPELINE ═══
    const feedPromises: Promise<any>[] = [];

    if (analysis.hook_analysis?.hook_text_estimate) {
      feedPromises.push(
        sb.from("hook_library").upsert({
          hook_text: analysis.hook_analysis.hook_text_estimate,
          hook_type: analysis.hook_analysis.hook_type || "curiosity",
          niche: niche || "general",
          retention_score: analysis.hook_analysis.retention_loop_count ? Math.min(analysis.hook_analysis.retention_loop_count + 5, 10) : 7,
          source_video: video_id || video_title,
        }, { onConflict: "hook_text" }).catch(() => {})
      );
    }

    if (scene_structure?.length > 0) {
      for (const scene of scene_structure.slice(0, 8)) {
        feedPromises.push(
          sb.from("attention_library").insert({
            pattern_name: `${scene.retention_technique || scene.purpose || "scene"}_${niche}`,
            scene_type: scene.purpose || "narrative",
            time_window: scene.timestamp_estimate || "unknown",
            emotion: scene.visual_style || "neutral",
            visual_change: 6,
            attention_score: 7,
            retention_score: (analysis.viral_score || 5) / 10,
            niche: niche || "general",
            example_text: `[${video_title}] ${scene.purpose}: ${scene.visual_style}`,
            source: "reverse-engineer-auto",
          }).catch(() => {})
        );
      }
    }

    if (analysis.narrative_structure?.arc_type) {
      feedPromises.push(
        sb.from("viral_patterns").upsert({
          pattern_name: `${analysis.narrative_structure.arc_type}_${niche}`,
          niche: niche || "general",
          source_video: video_id || video_title,
          pattern_json: {
            arc_type: analysis.narrative_structure.arc_type,
            segments: analysis.narrative_structure.segments,
            cliffhanger_count: analysis.narrative_structure.cliffhanger_count,
            payoff_style: analysis.narrative_structure.payoff_style,
            pacing: analysis.pacing_analysis,
            psychological_triggers: analysis.psychological_triggers,
          },
        }, { onConflict: "pattern_name" }).catch(() => {})
      );
    }

    if ((analysis.viral_score || 0) >= 7 && video_title) {
      feedPromises.push(
        sb.from("viral_titles_db").upsert({
          title: video_title,
          views: views || 0,
          channel_id: channel_id || null,
          channel_name: channel_name || null,
          niche: niche || "general",
          duration_seconds: totalDurationSec,
          language: language || "pt",
          emotional_triggers: analysis.psychological_triggers || [],
          title_pattern: analysis.hook_analysis?.hook_type || null,
          why_viral: `Viral Score: ${analysis.viral_score}. Triggers: ${(analysis.psychological_triggers || []).join(", ")}`,
        }, { onConflict: "title" }).catch(() => {})
      );
    }

    if (analysis.psychological_triggers?.length > 0) {
      for (const trigger of analysis.psychological_triggers.slice(0, 3)) {
        feedPromises.push(
          sb.from("audience_psychology_patterns").insert({
            trigger_type: trigger,
            description: `Extracted from viral analysis of "${video_title}" (${niche})`,
            niches: [niche || "general"],
            example_titles: [video_title],
            example_hooks: analysis.hook_analysis?.hook_text_estimate ? [analysis.hook_analysis.hook_text_estimate] : [],
            retention_score: Math.round((analysis.viral_score || 5)),
            source: "reverse-engineer-auto",
          }).catch(() => {})
        );
      }
    }

    feedPromises.push(
      sb.from("content_dna").upsert({
        video_id: video_id || `manual_${Date.now()}`,
        video_title,
        channel_id,
        channel_name,
        niche: niche || "general",
        language,
        views: views || 0,
        subscribers: subscribers || 0,
        hook_type: analysis.hook_analysis?.hook_type || null,
        hook_pattern: analysis.hook_analysis?.hook_text_estimate || null,
        hook_strength: analysis.hook_analysis?.retention_loop_count ? Math.min(10, analysis.hook_analysis.retention_loop_count + 4) : 6,
        story_structure: analysis.narrative_structure?.arc_type || null,
        pacing: analysis.pacing_analysis?.intensity_curve || null,
        narrative_arc: analysis.narrative_structure?.segments ? {
          segments: analysis.narrative_structure.segments,
          payoff: analysis.narrative_structure.payoff_style,
        } : {},
        cliffhanger_count: analysis.narrative_structure?.cliffhanger_count || 0,
        visual_style: analysis.visual_dna?.primary_style || analysis.pacing_analysis?.music_usage || null,
        emotion_primary: analysis.psychological_triggers?.[0] || null,
        emotion_secondary: analysis.psychological_triggers?.[1] || null,
        psychological_triggers: analysis.psychological_triggers || [],
        attention_score: (analysis.viral_score || 0) / 10 * 8,
        curiosity_score: (analysis.viral_score || 0) / 10 * 7,
        dopamine_score: (analysis.viral_score || 0) / 10 * 6,
        estimated_retention: (analysis.quality_score || 5) * 10,
        why_viral: `Viral Score: ${analysis.viral_score}. Triggers: ${(analysis.psychological_triggers || []).slice(0, 3).join(", ")}`,
        replication_template: analysis.clone_template?.replicable_elements?.join("; ") || null,
        content_model: analysis.clone_template?.estimated_production_cost || null,
        viral_score: analysis.viral_score || 0,
        gold_score: analysis.quality_score || 0,
        source: "reverse-engineer",
        duration_seconds: totalDurationSec,
      }, { onConflict: "video_id" }).catch(() => {})
    );

    await Promise.all(feedPromises);

    await sb.from("execution_logs").insert({
      function_name: "reverse-engineer-video",
      success: true,
      duration_ms: Date.now() - startTime,
      api_calls_made: 2,
      metadata: { video_id, niche, viral_score: analysis.viral_score, scenes: (analysis.scene_timeline || []).length, libraries_fed: feedPromises.length },
    }).catch(() => {});

    return new Response(JSON.stringify({
      success: true,
      id: inserted?.id,
      viral_score: analysis.viral_score,
      quality_score: analysis.quality_score,
      hook_analysis: analysis.hook_analysis,
      clone_template: analysis.clone_template,
      visual_dna: analysis.visual_dna,
      scene_timeline: analysis.scene_timeline,
      scenes_extracted: (analysis.scene_timeline || []).length,
      duration_seconds: totalDurationSec,
      duration_minutes: totalDurationMin,
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
