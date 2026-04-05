import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Decision Engine — Next Best Action
 * Synthesizes ALL intelligence sources into ONE actionable recommendation.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await sbAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { channelId } = await req.json();

    // Gather intelligence in parallel
    const [
      channelRes,
      thesesRes,
      suggestionsRes,
      recentScriptsRes,
      emergingRes,
      planRes,
      performanceRes,
    ] = await Promise.all([
      // Channel info
      channelId
        ? sb.from("user_channels").select("*").eq("id", channelId).eq("user_id", userId).maybeSingle()
        : sb.from("user_channels").select("*").eq("user_id", userId).limit(1).maybeSingle(),
      // Pending content theses
      sb.from("content_thesis").select("*").eq("user_id", userId)
        .in("status", ["draft", "scripted", "packaged"])
        .order("confidence_score", { ascending: false }).limit(5),
      // Recent Dotti suggestions
      sb.from("dotti_suggestions").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(5),
      // Recent scripts with scores
      sb.from("saved_scripts").select("id, title, niche, score, video_type, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      // Emerging/trending videos in user's niche
      sb.from("emerging_videos").select("title, niche, views, velocity_score, pre_viral_score")
        .order("velocity_score", { ascending: false }).limit(8),
      // Current 30-day plan
      sb.from("monetization_30day_plans").select("strategy, plan_json, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      // Video performance
      sb.from("video_performance").select("title, views, retention_avg, ctr, published_at")
        .eq("user_id", userId).order("published_at", { ascending: false }).limit(5),
    ]);

    const channel = channelRes?.data;
    const theses = thesesRes?.data || [];
    const suggestions = suggestionsRes?.data || [];
    const recentScripts = recentScriptsRes?.data || [];
    const emerging = emergingRes?.data || [];
    const plan = planRes?.data;
    const performance = performanceRes?.data || [];

    // Build context for AI
    const contextParts: string[] = [];

    if (channel) {
      contextParts.push(`CHANNEL: ${channel.channel_name || 'unnamed'}, Niche: ${channel.niche || 'unknown'}, Subs: ${channel.subscriber_count || '?'}, Language: ${channel.language || 'pt-BR'}`);
    }

    if (plan) {
      contextParts.push(`STRATEGY: ${plan.strategy || 'hybrid'}`);
    }

    if (theses.length > 0) {
      contextParts.push("PENDING THESES:\n" + theses.map(t =>
        `• [${t.status}] "${t.thesis_text}" (niche: ${t.niche}, confidence: ${t.confidence_score}, originality_risk: ${t.originality_risk})`
      ).join("\n"));
    }

    if (suggestions.length > 0) {
      contextParts.push("RECENT SUGGESTIONS:\n" + suggestions.map(s =>
        `• "${s.title}" — ${s.content?.slice(0, 100)}`
      ).join("\n"));
    }

    if (recentScripts.length > 0) {
      contextParts.push("RECENT SCRIPTS:\n" + recentScripts.map(s =>
        `• "${s.title}" (${s.video_type}, score: ${s.score || '?'})`
      ).join("\n"));
    }

    if (performance.length > 0) {
      contextParts.push("RECENT PERFORMANCE:\n" + performance.map(p =>
        `• "${p.title}" — ${p.views} views, CTR: ${p.ctr}%, retention: ${p.retention_avg}%`
      ).join("\n"));
    }

    if (emerging.length > 0) {
      contextParts.push("TRENDING NOW:\n" + emerging.map(e =>
        `• "${e.title}" (${e.niche}) — ${e.views?.toLocaleString()} views, velocity: ${e.velocity_score}`
      ).join("\n"));
    }

    const prompt = `You are the Decision Engine for a YouTube monetization platform. Your job is to synthesize ALL available intelligence and give ONE clear, actionable recommendation.

${contextParts.join("\n\n")}

Based on all this data, determine the SINGLE best next action for this creator. Consider:
- What's trending in their niche RIGHT NOW
- What content they already have ready vs what needs production
- Their channel's current performance (what's working, what's not)
- Their monetization strategy
- Risk vs reward
- Time to produce vs potential impact

Return ONLY valid JSON with these keys:
- action (string, in Portuguese)
- format ("short" or "long")
- title_suggestion (string)
- thumb_direction (string)
- hook_strategy (string)
- why (string, in Portuguese)
- risk ("low", "medium", or "high")
- expected_views (string, e.g. "5k-15k")
- monetization_impact (string, in Portuguese)
- urgency ("now", "today", "this_week", or "when_ready")
- confidence (number 0-100)
- sources (array of strings)`;

    const resp = await fetch(`${GEMINI_BASE}/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1500, responseMimeType: "application/json" },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gemini error:", resp.status, errText);
      throw new Error(`AI error: ${resp.status}`);
    }
    const aiData = await resp.json();
    const raw = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Gemini raw length:", raw.length, "first 200 chars:", raw.slice(0, 200));
    if (!raw) {
      console.error("Full Gemini response:", JSON.stringify(aiData).slice(0, 500));
    }

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse AI response");
      result = JSON.parse(jsonMatch[0]);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("next-best-action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
