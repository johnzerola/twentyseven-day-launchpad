import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const body = await req.json().catch(() => ({}));
    let userId: string;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await sb.auth.getUser(token);
    
    if (userData?.user) {
      userId = userData.user.id;
    } else if (body.user_id) {
      userId = body.user_id;
    } else {
      // Cron mode: process ALL users who have channels
      const { data: allUsers } = await sb.from("user_channels")
        .select("user_id")
        .limit(200);
      const userIds = [...new Set((allUsers || []).map((u: any) => u.user_id))];
      const results: any[] = [];
      for (const uid of userIds.slice(0, 50)) {
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

    // ═══ PATH 1: script_performance_link (highest fidelity) ═══
    const { data: links } = await sb
      .from("script_performance_link")
      .select("*")
      .eq("user_id", userId);

    const hasLinkData = links?.some((l: any) => l.views_7d || l.views_48h || l.views_30d);

    // ═══ PATH 2: video_performance (tracking data) ═══
    const { data: perfData } = await sb
      .from("video_performance")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    // ═══ PATH 3: video_projects (scripts created) ═══
    const { data: projects } = await sb
      .from("video_projects")
      .select("id, title, niche, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    // ═══ PATH 4: saved_scripts (detailed script data) ═══
    const { data: savedScripts } = await sb
      .from("saved_scripts" as any)
      .select("topic, style, video_type, duration, niche, hook_text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    // ═══ PATH 5: content_queue ═══
    const { data: queue } = await sb
      .from("content_queue")
      .select("title, video_type, niche, status, tags")
      .eq("user_id", userId)
      .limit(30);

    // ═══ PATH 6: user_channels ═══
    const { data: channels } = await sb
      .from("user_channels")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    // If NO data at all, return early
    const totalDataPoints = (links?.length || 0) + (perfData?.length || 0) + 
      (projects?.length || 0) + ((savedScripts as any)?.length || 0);
    
    if (totalDataPoints === 0 && !channels?.length) {
      return new Response(JSON.stringify({ success: true, message: "No data available yet", patterns: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ AGGREGATE METRICS ═══
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // From video_performance
    const retentions = (perfData || []).map((v: any) => v.avg_retention_percent).filter(Boolean);
    const views = (perfData || []).map((v: any) => v.views_current).filter(Boolean);
    const durations = (perfData || []).map((v: any) => v.duration_seconds).filter(Boolean);
    const avgRetention = avg(retentions);
    const avgViewsVal = avg(views);
    const avgDurationMin = avg(durations) / 60;

    // From saved_scripts — style & niche breakdown
    const scripts = (savedScripts as any) || [];
    const styleCount: Record<string, number> = {};
    const nicheCount: Record<string, number> = {};
    const hookTypes: Record<string, number> = {};
    const topics: string[] = [];
    const videoTypeCount: Record<string, number> = {};

    for (const s of scripts) {
      if (s.style) styleCount[s.style] = (styleCount[s.style] || 0) + 1;
      if (s.niche) nicheCount[s.niche] = (nicheCount[s.niche] || 0) + 1;
      if (s.topic) topics.push(s.topic);
      if (s.video_type) videoTypeCount[s.video_type] = (videoTypeCount[s.video_type] || 0) + 1;
    }

    // From links (if available)
    const linkStyles: Record<string, { retentions: number[]; views: number[] }> = {};
    for (const link of (links || [])) {
      const style = "linked";
      if (!linkStyles[style]) linkStyles[style] = { retentions: [], views: [] };
      if (link.avg_retention_pct) linkStyles[style].retentions.push(link.avg_retention_pct);
      const v = link.views_30d || link.views_7d || link.views_48h || 0;
      if (v) linkStyles[style].views.push(v);
    }

    // Best performers from video_performance
    const sortedByViews = [...(perfData || [])].sort((a: any, b: any) => (b.views_current || 0) - (a.views_current || 0));
    const topVideos = sortedByViews.slice(0, 5);

    // Determine preferred values
    const topStyle = Object.entries(styleCount).sort(([, a], [, b]) => b - a)[0]?.[0];
    const topNiche = Object.entries(nicheCount).sort(([, a], [, b]) => b - a)[0]?.[0];
    const worstStyle = Object.entries(styleCount).sort(([, a], [, b]) => a - b)[0]?.[0];
    const mainChannel = channels?.[0] as any;

    // ═══ AI PATTERN ANALYSIS ═══
    const analysisData = {
      channel: mainChannel ? { name: mainChannel.channel_name, niche: mainChannel.niche, subs: mainChannel.subscribers } : null,
      scriptsCreated: scripts.length,
      stylesUsed: styleCount,
      nichesUsed: nicheCount,
      videoTypesUsed: videoTypeCount,
      recentTopics: topics.slice(0, 15),
      avgRetention: Math.round(avgRetention),
      avgViews: Math.round(avgViewsVal),
      avgDurationMin: Math.round(avgDurationMin),
      topVideoTitles: topVideos.map((v: any) => v.video_title || 'unknown').slice(0, 5),
      trackedVideos: perfData?.length || 0,
      linkedScripts: links?.length || 0,
      queueItems: queue?.length || 0,
    };

    const prompt = `Analyze this YouTube creator's content patterns and identify 5-7 actionable insights.

DATA:
${JSON.stringify(analysisData, null, 2)}

Identify patterns about:
1. Content style preferences and what works best
2. Optimal video duration
3. Niche focus or diversification
4. Production consistency
5. Growth opportunities based on what they create vs what performs

Return as JSON array: [{"pattern": "insight description in PT-BR", "confidence": 0.0-1.0, "action": "specific action in PT-BR", "category": "style|duration|niche|consistency|growth"}]`;

    let patterns: any[] = [];
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You are a YouTube analytics expert. Output ONLY valid JSON array. No markdown." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const raw = aiData.choices?.[0]?.message?.content || '[]';
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        patterns = JSON.parse(cleaned);
      }
    } catch (e) {
      console.warn("AI pattern extraction failed, using rule-based:", e);
      // Rule-based fallback
      if (topStyle) patterns.push({ pattern: `Estilo preferido: ${topStyle}`, confidence: 0.9, action: `Priorize roteiros no estilo "${topStyle}"`, category: "style" });
      if (avgDurationMin > 0) patterns.push({ pattern: `Duração média: ${Math.round(avgDurationMin)} min`, confidence: 0.8, action: avgDurationMin < 10 ? "Experimente vídeos mais longos (12-15 min) para mais watch time" : "Duração atual está boa para retenção", category: "duration" });
      if (topNiche) patterns.push({ pattern: `Nicho principal: ${topNiche}`, confidence: 0.85, action: `Continue focando em "${topNiche}" para construir autoridade`, category: "niche" });
    }

    // ═══ UPSERT user_content_memory ═══
    const memoryData: any = {
      user_id: userId,
      channel_id: channel_id || mainChannel?.id || null,
      preferred_style: topStyle || null,
      best_performing_style: topStyle || null,
      worst_performing_style: worstStyle !== topStyle ? worstStyle : null,
      preferred_duration_minutes: avgDurationMin > 0 ? Math.round(avgDurationMin) : null,
      avg_retention_pct: avgRetention > 0 ? Math.round(avgRetention * 10) / 10 : null,
      total_scripts_generated: scripts.length + (projects?.length || 0),
      total_scripts_published: (links || []).filter((l: any) => l.youtube_video_id).length + (queue || []).filter((q: any) => q.status === 'published').length,
      total_views_accumulated: views.reduce((s: number, v: number) => s + v, 0) + (links || []).reduce((s: number, l: any) => s + (l.views_30d || l.views_7d || 0), 0),
      ai_identified_patterns: patterns,
      last_topics_used: topics.slice(0, 20),
      best_performing_niche: topNiche || mainChannel?.niche || null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await sb.from("user_content_memory").upsert(memoryData, { onConflict: "user_id" });
    if (upsertError) console.error("Upsert error:", upsertError);

    return new Response(JSON.stringify({
      success: true,
      source: hasLinkData ? "script_performance_link" : perfData?.length ? "video_performance" : "scripts_and_projects",
      dataPoints: totalDataPoints,
      analyzed: {
        trackedVideos: perfData?.length || 0,
        scripts: scripts.length,
        linkedVideos: links?.length || 0,
        queueItems: queue?.length || 0,
      },
      patterns,
      memory: {
        preferred_style: memoryData.preferred_style,
        best_niche: memoryData.best_performing_niche,
        avg_retention: memoryData.avg_retention_pct,
        total_views: memoryData.total_views_accumulated,
      },
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
