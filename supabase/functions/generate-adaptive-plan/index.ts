import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
      userId = body.user_id;
    } else if (body.mode === "all_users") {
      // Cron mode: generate plans for all active users
      const { data: plans } = await sb.from("onboarding_plans").select("user_id").order("created_at", { ascending: false });
      const userIds = [...new Set((plans || []).map((p: any) => p.user_id))];
      const results: any[] = [];
      for (const uid of userIds.slice(0, 50)) {
        try {
          const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-adaptive-plan`, {
            method: "POST",
            headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: uid }),
          });
          const data = await res.json().catch(() => ({}));
          results.push({ user_id: uid, success: res.ok });
        } catch (e) { results.push({ user_id: uid, success: false }); }
      }
      return new Response(JSON.stringify({ success: true, mode: "all_users", processed: results.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { channel_id, week_number, target_date } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const planDate = target_date || new Date().toISOString().split("T")[0];
    const weekNum = week_number || Math.ceil((Date.now() - new Date(planDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

    // Fetch user context
    const [memoryResult, perfResult, planResult, channelResult] = await Promise.all([
      sb.from("user_content_memory").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("video_performance").select("*").eq("user_id", userId).order("published_at", { ascending: false }).limit(7),
      sb.from("onboarding_plans").select("niche, goal, language, content_type, time_per_day").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
      channel_id ? sb.from("user_channels").select("*").eq("id", channel_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const memory = memoryResult.data;
    const recentVideos = perfResult.data || [];
    const plan = planResult.data?.[0];
    const channel = channelResult.data;

    // Calculate yesterday's performance
    const yesterdayPerf: any = {};
    if (recentVideos.length > 0) {
      const avgRet = recentVideos.filter((v: any) => v.avg_retention_percent).reduce((s: number, v: any) => s + v.avg_retention_percent, 0) / Math.max(recentVideos.filter((v: any) => v.avg_retention_percent).length, 1);
      const avgCtr = recentVideos.filter((v: any) => v.ctr_percent).reduce((s: number, v: any) => s + v.ctr_percent, 0) / Math.max(recentVideos.filter((v: any) => v.ctr_percent).length, 1);
      yesterdayPerf.avg_retention = Math.round(avgRet * 10) / 10;
      yesterdayPerf.avg_ctr = Math.round(avgCtr * 10) / 10;
      yesterdayPerf.total_views = recentVideos.reduce((s: number, v: any) => s + (v.views_current || 0), 0);
      yesterdayPerf.videos_count = recentVideos.length;
    }

    // Build AI prompt for adaptive plan
    const prompt = `Generate a daily production plan for a YouTube creator.

Context:
- Niche: ${plan?.niche || channel?.niche || "general"}
- Goal: ${plan?.goal || "monetization"}
- Available time: ${plan?.time_per_day || "2 hours"}
- Week number: ${weekNum}
- Channel memory: ${memory ? `Best style: ${memory.best_performing_style}, Avg retention: ${memory.avg_retention_pct}%, Patterns: ${JSON.stringify(memory.ai_identified_patterns || []).slice(0, 500)}` : "No data yet"}
- Recent performance: ${JSON.stringify(yesterdayPerf)}

Adaptation rules:
- If retention < 40%: Focus on hooks — include study time + A/B test scripts
- If CTR < 3%: Priority thumbnails — generate 3 variants per video
- If growth < target: Increase Shorts from 3 to 5/week
- If performing well: Maintain pace + add 1 experimental video
- Week 1-2: Focus on breaking the "12 video bubble"
- Week 3-4: Optimize based on data

Generate 3-6 tasks for today. Each task must have: type (script/short/community/publish/analyze/rest), title, description, priority (high/medium/low), estimated_minutes.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a YouTube production planner. Output ONLY via the tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_plan",
            description: "Create daily adaptive plan",
            parameters: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["script", "short", "community", "publish", "analyze", "rest", "thumbnail", "study"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      estimated_minutes: { type: "integer" },
                    },
                    required: ["type", "title", "priority", "estimated_minutes"],
                  },
                },
                adaptation_reason: { type: "string" },
                ai_notes: { type: "string" },
              },
              required: ["tasks", "adaptation_reason"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_plan" } },
      }),
    });

    if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`);
    const aiData = await aiResp.json();
    const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("No plan generated");

    const planData = JSON.parse(tc.function.arguments);
    const tasks = (planData.tasks || []).map((t: any, i: number) => ({
      id: crypto.randomUUID(),
      ...t,
      completed: false,
      auto_generated: true,
    }));

    // Upsert daily plan
    await sb.from("daily_adaptive_plan").upsert({
      user_id: userId,
      channel_id: channel_id || null,
      plan_date: planDate,
      week_number: weekNum,
      tasks,
      generated_based_on: recentVideos.length > 0 ? "performance_data" : "ai_recommendation",
      adaptation_reason: planData.adaptation_reason,
      yesterday_performance: yesterdayPerf,
      total_tasks: tasks.length,
      completed_tasks: 0,
      completion_pct: 0,
      ai_adapted: recentVideos.length > 0,
      ai_adaptation_notes: planData.ai_notes || null,
    }, { onConflict: "user_id,plan_date" });

    return new Response(JSON.stringify({
      success: true,
      plan_date: planDate,
      week_number: weekNum,
      tasks,
      adaptation_reason: planData.adaptation_reason,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-adaptive-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
