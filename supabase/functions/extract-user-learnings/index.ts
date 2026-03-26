import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const body = await req.json().catch(() => ({}));
    let userId: string;

    // Support both user-auth and cron/service-key modes
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await sb.auth.getUser(token);
    
    if (userData?.user) {
      userId = userData.user.id;
    } else if (body.user_id) {
      // Called from cron with explicit user_id
      userId = body.user_id;
    } else {
      // Cron mode: process all users with performance data
      const { data: allLinks } = await sb.from("script_performance_link")
        .select("user_id")
        .not("avg_retention_pct", "is", null);
      const userIds = [...new Set((allLinks || []).map((l: any) => l.user_id))];
      const results: any[] = [];
      for (const uid of userIds) {
        try {
          const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-user-learnings`, {
            method: "POST",
            headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: uid }),
          });
          const data = await res.json().catch(() => ({}));
          results.push({ user_id: uid, success: res.ok, ...data });
        } catch (e) { results.push({ user_id: uid, success: false, error: (e as Error).message }); }
      }
      return new Response(JSON.stringify({ success: true, mode: "all_users", processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { channel_id } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch all script_performance_link with metrics
    const { data: links } = await sb
      .from("script_performance_link")
      .select("*, saved_scripts(topic, style, video_type, duration, niche)")
      .eq("user_id", userId)
      .not("avg_retention_pct", "is", null);

    if (!links?.length) {
      return new Response(JSON.stringify({ success: true, message: "No performance data yet", patterns: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by style
    const byStyle: Record<string, { retentions: number[]; views: number[]; ctrs: number[] }> = {};
    const byDuration: Record<string, { retentions: number[]; count: number }> = {};
    const byHook: Record<string, { retentions: number[]; count: number }> = {};
    const topics: string[] = [];

    for (const link of links) {
      const script = link.saved_scripts;
      const style = script?.style || "unknown";
      const duration = script?.duration || 0;
      const topic = script?.topic || "";

      if (topic) topics.push(topic);

      // By style
      if (!byStyle[style]) byStyle[style] = { retentions: [], views: [], ctrs: [] };
      byStyle[style].retentions.push(link.avg_retention_pct || 0);
      byStyle[style].views.push(link.views_7d || link.views_48h || 0);
      if (link.ctr_pct) byStyle[style].ctrs.push(link.ctr_pct);

      // By duration bucket
      const bucket = duration <= 10 ? "0-10min" : duration <= 15 ? "10-15min" : duration <= 20 ? "15-20min" : "20+min";
      if (!byDuration[bucket]) byDuration[bucket] = { retentions: [], count: 0 };
      byDuration[bucket].retentions.push(link.avg_retention_pct || 0);
      byDuration[bucket].count++;
    }

    // Calculate averages
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const stylePerformance = Object.entries(byStyle).map(([style, data]) => ({
      style,
      avg_retention: Math.round(avg(data.retentions) * 10) / 10,
      avg_views: Math.round(avg(data.views)),
      avg_ctr: Math.round(avg(data.ctrs) * 10) / 10,
      count: data.retentions.length,
    })).sort((a, b) => b.avg_retention - a.avg_retention);

    const durationPerformance = Object.entries(byDuration).map(([bucket, data]) => ({
      bucket,
      avg_retention: Math.round(avg(data.retentions) * 10) / 10,
      count: data.count,
    })).sort((a, b) => b.avg_retention - a.avg_retention);

    // Use AI to identify patterns
    const prompt = `Analyze this YouTube channel performance data and identify 3-5 actionable patterns:

Style Performance: ${JSON.stringify(stylePerformance)}
Duration Performance: ${JSON.stringify(durationPerformance)}
Total videos analyzed: ${links.length}
Recent topics: ${topics.slice(0, 10).join(", ")}

Return patterns as JSON array: [{"pattern": "description", "confidence": 0.0-1.0, "action": "what to do"}]`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a YouTube analytics expert. Output ONLY via the tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "store_patterns",
            description: "Store identified patterns",
            parameters: {
              type: "object",
              properties: {
                patterns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pattern: { type: "string" },
                      confidence: { type: "number" },
                      action: { type: "string" },
                    },
                    required: ["pattern", "confidence", "action"],
                  },
                },
              },
              required: ["patterns"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "store_patterns" } },
      }),
    });

    let patterns: any[] = [];
    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) patterns = JSON.parse(tc.function.arguments).patterns || [];
    }

    // Best performing values
    const bestStyle = stylePerformance[0];
    const bestDuration = durationPerformance[0];
    const overallRetention = avg(links.map((l: any) => l.avg_retention_pct || 0));

    // Upsert user_content_memory
    await sb.from("user_content_memory").upsert({
      user_id: userId,
      channel_id: channel_id || null,
      preferred_style: bestStyle?.style,
      best_performing_style: bestStyle?.style,
      worst_performing_style: stylePerformance[stylePerformance.length - 1]?.style,
      preferred_duration_minutes: bestDuration?.bucket === "0-10min" ? 8 : bestDuration?.bucket === "10-15min" ? 12 : bestDuration?.bucket === "15-20min" ? 17 : 22,
      avg_retention_pct: Math.round(overallRetention * 10) / 10,
      total_scripts_generated: links.length,
      total_scripts_published: links.filter((l: any) => l.youtube_video_id).length,
      total_views_accumulated: links.reduce((s: number, l: any) => s + (l.views_30d || l.views_7d || 0), 0),
      ai_identified_patterns: patterns,
      last_topics_used: topics.slice(0, 20),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({
      success: true,
      analyzed: links.length,
      patterns,
      best_style: bestStyle,
      best_duration: bestDuration,
      avg_retention: Math.round(overallRetention * 10) / 10,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-user-learnings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
