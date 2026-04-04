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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { planId, userId } = await req.json();
    if (!planId && !userId) throw new Error("planId or userId is required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // Validate caller auth — hybrid pattern: JWT for interactive, service key for cron
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isCronCall = authHeader === `Bearer ${serviceKey}`;
    
    if (!isCronCall) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Missing authorization" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: authErr } = await sbAuth.auth.getClaims(token);
      if (authErr || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const callerUid = claims.claims.sub as string;
      // Ensure caller can only adapt their own plans
      if (userId && userId !== callerUid) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    // Resolve plan — either by planId or most recent for userId
    let plan: any;
    if (planId) {
      const { data, error } = await sb.from("monetization_30day_plans").select("*").eq("id", planId).single();
      if (error || !data) throw new Error("Plan not found");
      plan = data;
    } else {
      const { data, error } = await sb.from("monetization_30day_plans")
        .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single();
      if (error || !data) {
        return new Response(JSON.stringify({ 
          error: "no_plan", 
          message: "Nenhum plano de 30 dias encontrado. Crie um plano primeiro na aba Tracker." 
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      plan = data;
    }

    const effectiveUserId = plan.user_id;

    // Fetch tasks + milestones
    const [tasksRes, milestonesRes] = await Promise.all([
      sb.from("daily_tasks").select("*").eq("plan_id", plan.id).order("day_number"),
      sb.from("monetization_milestones").select("*").eq("plan_id", plan.id).order("day_expected"),
    ]);
    const tasks = (tasksRes.data || []) as any[];
    const milestones = (milestonesRes.data || []) as any[];

    // ═══════════════════════════════════════════════════════════
    // REAL PERFORMANCE DATA — retention, views, CTR from YouTube
    // ═══════════════════════════════════════════════════════════
    const { data: perfData } = await sb.from("video_performance")
      .select("*, duration_seconds, watch_time_hours")
      .eq("user_id", effectiveUserId)
      .order("created_at", { ascending: false })
      .limit(30);

    // Group performance by video duration buckets
    const durationBuckets: Record<string, { views: number; retention: number; count: number }> = {};
    for (const v of (perfData || [])) {
      const dur = (v as any).duration_seconds || 0;
      let bucket = "short";
      if (dur > 600) bucket = "long_10min+";
      else if (dur > 300) bucket = "medium_5-10min";
      else if (dur > 60) bucket = "short_1-5min";
      
      if (!durationBuckets[bucket]) durationBuckets[bucket] = { views: 0, retention: 0, count: 0 };
      durationBuckets[bucket].views += (v as any).views_current || 0;
      durationBuckets[bucket].retention += (v as any).avg_retention_percent || 0;
      durationBuckets[bucket].count += 1;
    }

    // Average retention per bucket
    const performanceSummary: Record<string, any> = {};
    for (const [bucket, data] of Object.entries(durationBuckets)) {
      performanceSummary[bucket] = {
        avgViews: Math.round(data.views / data.count),
        avgRetention: Math.round(data.retention / data.count),
        videoCount: data.count,
      };
    }

    // ═══════════════════════════════════════════════════════════
    // NICHE BENCHMARKS — from content_dna and channel_intelligence
    // ═══════════════════════════════════════════════════════════
    const niche = plan.niche || "dark_storytelling";
    const { data: nicheDNA } = await sb.from("content_dna")
      .select("estimated_retention, views, duration_seconds, viral_score")
      .ilike("niche", `%${niche}%`)
      .gte("views", 10000)
      .limit(100);

    let nicheBenchmark = { avgRetention: 50, avgViews: 50000, topRetention: 70 };
    if (nicheDNA?.length) {
      const retentions = nicheDNA.map((d: any) => d.estimated_retention || 50);
      nicheBenchmark.avgRetention = Math.round(retentions.reduce((a: number, b: number) => a + b, 0) / retentions.length);
      nicheBenchmark.avgViews = Math.round(nicheDNA.reduce((s: number, d: any) => s + (d.views || 0), 0) / nicheDNA.length);
      nicheBenchmark.topRetention = Math.round(Math.max(...retentions));
    }

    // ═══════════════════════════════════════════════════════════
    // YPP PROXIMITY CHECK — auto-switch to virality mode
    // ═══════════════════════════════════════════════════════════
    let yppProximity: any = null;
    let viralityMode = false;
    
    if (plan.channel_id) {
      const { data: channel } = await sb.from("user_channels")
        .select("subscribers, total_views")
        .eq("id", plan.channel_id)
        .single();
      
      if (channel) {
        const subsRemaining = Math.max(0, 1000 - ((channel as any).subscribers || 0));
        // Use watch_time_hours if available, else calculate from duration_seconds
        let estimatedWatchHours = 0;
        for (const v of (perfData || [])) {
          const wth = (v as any).watch_time_hours;
          if (wth && wth > 0) {
            // Real watch time from YouTube Analytics
            estimatedWatchHours += wth;
          } else {
            // Fallback: estimate from views * duration * retention
            const views = (v as any).views_current || 0;
            const ret = (v as any).avg_retention_percent || 50;
            const dur = (v as any).duration_seconds;
            // Smart fallback: if no duration, estimate by video type (shorts ~30s, longs ~600s)
            const effectiveDur = dur && dur > 0 ? dur : (views > 0 ? 300 : 30);
            estimatedWatchHours += (views * effectiveDur * (ret / 100)) / 3600;
          }
        }
        const watchRemaining = Math.max(0, 4000 - estimatedWatchHours);

        yppProximity = {
          subscribers: (channel as any).subscribers || 0,
          subsRemaining,
          estimatedWatchHours: Math.round(estimatedWatchHours),
          watchRemaining: Math.round(watchRemaining),
          subsClose: subsRemaining <= 500,
          watchClose: watchRemaining <= 200,
        };

        // If within striking distance, enable virality mode
        viralityMode = subsRemaining <= 500 || watchRemaining <= 200;
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PLAN PROGRESS METRICS
    // ═══════════════════════════════════════════════════════════
    const started = new Date(plan.started_at);
    const now = new Date();
    const currentDay = Math.min(30, Math.max(1, Math.ceil((now.getTime() - started.getTime()) / 86400000)));
    
    const pastTasks = tasks.filter((t: any) => t.day_number <= currentDay);
    const completedTasks = pastTasks.filter((t: any) => t.completed);
    const completionRate = pastTasks.length > 0 ? completedTasks.length / pastTasks.length : 1;
    const contentCompleted = completedTasks.filter((t: any) => t.task_type === 'content').length;
    const contentTotal = pastTasks.filter((t: any) => t.task_type === 'content').length;
    const contentRate = contentTotal > 0 ? contentCompleted / contentTotal : 1;

    // ═══════════════════════════════════════════════════════════
    // AI ADAPTATION — with real performance data + niche benchmarks
    // ═══════════════════════════════════════════════════════════
    const prompt = `You are a YouTube growth strategist adapting a 30-day monetization plan using REAL PERFORMANCE DATA.

PLAN CONTEXT:
- Niche: ${niche}
- Strategy: ${plan.strategy}
- Current Day: ${currentDay}/30
- Overall task completion: ${Math.round(completionRate * 100)}%
- Content production rate: ${Math.round(contentRate * 100)}%
- Shorts published: ${plan.total_shorts_published || 0}
- Longs published: ${plan.total_longs_published || 0}

REAL VIDEO PERFORMANCE (by duration):
${Object.entries(performanceSummary).map(([bucket, stats]: [string, any]) => 
  `- ${bucket}: avg ${stats.avgViews} views, ${stats.avgRetention}% retention (${stats.videoCount} videos)`
).join('\n') || '- No performance data yet'}

NICHE BENCHMARK (${niche}):
- Average retention: ${nicheBenchmark.avgRetention}%
- Top retention: ${nicheBenchmark.topRetention}%
- Average views for viral: ${nicheBenchmark.avgViews.toLocaleString()}

${yppProximity ? `YPP PROXIMITY ALERT:
- Subscribers: ${yppProximity.subscribers}/1000 (${yppProximity.subsRemaining} remaining)
- Watch Hours: ${yppProximity.estimatedWatchHours}/4000 (${yppProximity.watchRemaining}h remaining)
${viralityMode ? '⚠️ VIRALITY MODE ACTIVE — channel is close to YPP. Prioritize maximum reach over editorial quality.' : ''}` : ''}

MILESTONES:
${milestones.map((m: any) => `- ${m.title}: ${m.current_value}/${m.target_value} (day ${m.day_expected}) ${m.reached ? '✅' : '❌'}`).join('\n') || '- None'}

REMAINING TASKS (day ${currentDay + 1} to 30):
${tasks.filter((t: any) => t.day_number > currentDay).slice(0, 15).map((t: any) => `Day ${t.day_number}: ${t.title} (${t.task_type})`).join('\n')}

Based on REAL DATA, provide specific adaptations. If certain video durations perform significantly better, recommend doubling down. If retention is below niche average, suggest specific pacing/hook fixes.
${viralityMode ? '\nVIRALITY MODE: Recommend only high-reach strategies — trending topics, shorts for subscriber spikes, proven viral hooks. Quality > quantity is SUSPENDED until YPP is reached.' : ''}

Respond in JSON:
{
  "assessment": "2-3 sentence assessment comparing real vs benchmark performance",
  "pace": "ahead|on_track|behind|critical",
  "performance_insights": [
    {"insight": "clear finding", "action": "what to do", "impact": "high|medium|low"}
  ],
  "duration_recommendation": {
    "best_format": "short|medium|long",
    "reason": "based on real data",
    "optimal_minutes": N
  },
  "adapted_tasks": [{"day_number": N, "new_title": "...", "new_description": "...", "priority": "high|medium|low"}],
  "virality_mode_active": ${viralityMode},
  "ypp_sprint_tips": ["tip1", "tip2"],
  "strategy_tips": ["tip1", "tip2", "tip3"],
  "focus_shift": "what to focus on for remaining days"
}`;

    const aiRes = await _ai({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a YouTube growth expert that makes decisions based on DATA, not theory. Respond ONLY in valid JSON." },
          { role: "user", content: prompt },
        ],
      });

    if (!aiRes.ok) throw new Error(`AI error: ${aiRes.status}`);
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const adaptation = JSON.parse(jsonStr);

    // Apply task adaptations
    if (adaptation.adapted_tasks?.length > 0) {
      for (const at of adaptation.adapted_tasks.slice(0, 10)) {
        const matchingTask = tasks.find((t: any) => t.day_number === at.day_number && !t.completed);
        if (matchingTask) {
          await sb.from("daily_tasks").update({
            title: at.new_title || matchingTask.title,
            description: at.new_description || matchingTask.description,
            metadata: { ...((matchingTask as any).metadata || {}), adapted: true, priority: at.priority },
            updated_at: new Date().toISOString(),
          }).eq("id", matchingTask.id);
        }
      }
    }

    // Update plan
    await sb.from("monetization_30day_plans").update({
      current_day: currentDay,
      updated_at: new Date().toISOString(),
    }).eq("id", plan.id);

    return new Response(JSON.stringify({
      success: true,
      currentDay,
      completionRate: Math.round(completionRate * 100),
      contentRate: Math.round(contentRate * 100),
      performanceSummary,
      nicheBenchmark,
      yppProximity,
      viralityMode,
      adaptation,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("adapt-30day-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
