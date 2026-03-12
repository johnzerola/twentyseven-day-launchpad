import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * User Research Learning Engine
 * 
 * Learns from user activity to enrich the knowledge database:
 * - type: "search" → learns from search queries & results
 * - type: "video_analysis" → learns from deep-scan results
 * - type: "script_generated" → learns from generated scripts metadata
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, data } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    let learned = 0;

    // ========== LEARN FROM USER SEARCHES ==========
    if (type === "search") {
      const { query, niche, results } = data;
      if (!results?.length) return respond({ learned: 0, type });

      // Extract high-performing videos from search results
      const viralVideos = (results || []).filter((v: any) => (v.views || 0) >= 350000);
      
      for (const v of viralVideos.slice(0, 10)) {
        // Add to viral_titles_db if not exists
        const { data: existing } = await sb.from("viral_titles_db")
          .select("id").eq("title", v.title).maybeSingle();

        if (!existing && v.title) {
          await sb.from("viral_titles_db").insert({
            title: v.title,
            views: v.views || 0,
            likes: v.likes || 0,
            channel_name: v.channel_name || v.channelTitle || '',
            channel_id: v.channel_id || v.channelId || '',
            niche: niche || query || 'unknown',
            published_at: v.published_at || v.publishedAt || null,
          });
          learned++;
        }
      }

      // Track the niche if new
      if (niche) {
        const { data: nicheExists } = await sb.from("niche_database")
          .select("id").ilike("name", niche).maybeSingle();
        
        if (!nicheExists) {
          await sb.from("niche_database").insert({
            name: niche,
            faceless_friendly: true,
          });
          learned++;
        }
      }
    }

    // ========== LEARN FROM VIDEO ANALYSIS ==========
    if (type === "video_analysis") {
      const { videoInfo, analysis } = data;
      if (!analysis || !videoInfo) return respond({ learned: 0, type });

      // The deep-scan-video already auto-learns (we enhanced it above)
      // Here we track the analysis pattern for future reference
      
      // If the analysis reveals a new content format, save it
      if (analysis.visualStyle?.primaryStyle && analysis.scores?.replicability >= 70) {
        const { data: formatExists } = await sb.from("viral_content_library")
          .select("id")
          .eq("category", "content_format")
          .contains("content_json", { name: analysis.visualStyle.primaryStyle })
          .maybeSingle();

        if (!formatExists) {
          await sb.from("viral_content_library").insert({
            category: "content_format",
            content_json: {
              name: analysis.visualStyle.primaryStyle,
              description: `Auto-detected from "${videoInfo.title}" by ${videoInfo.channelTitle}`,
              editing_pace: analysis.visualStyle.editingPace,
              color_grading: analysis.visualStyle.colorGrading,
              production_level: analysis.visualStyle.productionLevel,
              tools: analysis.visualStyle.toolsSuggested || [],
              faceless: analysis.visualStyle.faceless,
              hook_style: analysis.hookAnalysis?.hookType || 'unknown',
            },
            niches: [analysis.contentDNA?.nicheCategory || 'general'],
            effectiveness_score: Math.round((analysis.scores?.virality || 70) / 10),
          });
          learned++;
        }
      }

      // Extract and save open loops as retention techniques
      if (analysis.retentionMap?.openLoops?.length >= 2) {
        await sb.from("script_knowledge").insert({
          category: "open_loop",
          title: `Open Loops from "${videoInfo.title}"`,
          content: `Open loops detectados: ${analysis.retentionMap.openLoops.join(' | ')}. Pattern interrupts: ${(analysis.retentionMap.patternInterrupts || []).join(' | ')}.`,
          effectiveness_score: 8,
          examples: JSON.stringify(analysis.retentionMap.openLoops.slice(0, 3)),
        });
        learned++;
      }
    }

    // ========== LEARN FROM GENERATED SCRIPTS ==========
    if (type === "script_generated") {
      const { topic, niche, style, duration } = data;
      
      // Track popular topic/niche combinations
      if (topic && niche && LOVABLE_API_KEY) {
        // Use AI to extract keyword patterns from the topic
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Extract keyword patterns. Return JSON only." },
                { role: "user", content: `Topic: "${topic}", Niche: "${niche}", Style: "${style}". Extract: 1) 3 SEO keywords, 2) emotional angle, 3) content format category.` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "extract_patterns",
                  description: "Extract content patterns",
                  parameters: {
                    type: "object",
                    properties: {
                      keywords: { type: "array", items: { type: "string" } },
                      emotional_angle: { type: "string" },
                      format_category: { type: "string" },
                    },
                    required: ["keywords", "emotional_angle", "format_category"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "extract_patterns" } },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (tc) {
              const patterns = JSON.parse(tc.function.arguments);
              await sb.from("viral_content_library").insert({
                category: "user_content_pattern",
                content_json: {
                  topic, niche, style, duration,
                  keywords: patterns.keywords,
                  emotional_angle: patterns.emotional_angle,
                  format_category: patterns.format_category,
                  generated_at: new Date().toISOString(),
                },
                niches: [niche],
                effectiveness_score: 6,
              });
              learned++;
            }
          }
        } catch { /* non-critical */ }
      }
    }

    return respond({ learned, type });
  } catch (e) {
    console.error("learn-from-user error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
