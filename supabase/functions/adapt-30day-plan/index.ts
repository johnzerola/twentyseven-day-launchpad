import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { planId } = await req.json();
    if (!planId) throw new Error("planId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch plan + tasks + milestones
    const [planRes, tasksRes, milestonesRes] = await Promise.all([
      sb.from("monetization_30day_plans").select("*").eq("id", planId).single(),
      sb.from("daily_tasks").select("*").eq("plan_id", planId).order("day_number"),
      sb.from("monetization_milestones").select("*").eq("plan_id", planId).order("day_expected"),
    ]);

    if (planRes.error || !planRes.data) throw new Error("Plan not found");
    const plan = planRes.data as any;
    const tasks = (tasksRes.data || []) as any[];
    const milestones = (milestonesRes.data || []) as any[];

    // Calculate progress metrics
    const started = new Date(plan.started_at);
    const now = new Date();
    const currentDay = Math.min(30, Math.max(1, Math.ceil((now.getTime() - started.getTime()) / 86400000)));
    
    const pastTasks = tasks.filter((t: any) => t.day_number <= currentDay);
    const completedTasks = pastTasks.filter((t: any) => t.completed);
    const completionRate = pastTasks.length > 0 ? completedTasks.length / pastTasks.length : 1;
    
    const contentCompleted = completedTasks.filter((t: any) => t.task_type === 'content').length;
    const contentTotal = pastTasks.filter((t: any) => t.task_type === 'content').length;
    const contentRate = contentTotal > 0 ? contentCompleted / contentTotal : 1;

    // Fetch real YouTube metrics if channel connected
    let realMetrics = null;
    if (plan.channel_id) {
      const { data: channel } = await sb.from("user_channels")
        .select("subscribers, views")
        .eq("id", plan.channel_id)
        .single();
      if (channel) realMetrics = channel;
    }

    // Build adaptation prompt
    const prompt = `You are a YouTube growth strategist. Analyze this 30-day monetization plan's progress and provide SPECIFIC adaptations.

PLAN CONTEXT:
- Niche: ${plan.niche}
- Strategy: ${plan.strategy}
- Current Day: ${currentDay}/30
- Overall completion: ${Math.round(completionRate * 100)}%
- Content tasks completion: ${Math.round(contentRate * 100)}%
- Shorts published: ${plan.total_shorts_published || 0}
- Longs published: ${plan.total_longs_published || 0}
- Total views: ${plan.total_views || 0}
${realMetrics ? `- Real subscribers: ${realMetrics.subscribers}\n- Real views: ${realMetrics.views}` : ''}

MILESTONES:
${milestones.map((m: any) => `- ${m.title}: ${m.current_value}/${m.target_value} (day ${m.day_expected}) ${m.reached ? '✅' : '❌'}`).join('\n')}

REMAINING TASKS (day ${currentDay + 1} to 30):
${tasks.filter((t: any) => t.day_number > currentDay).slice(0, 20).map((t: any) => `Day ${t.day_number}: ${t.title} (${t.task_type})`).join('\n')}

Respond in JSON:
{
  "assessment": "brief assessment of progress",
  "pace": "ahead|on_track|behind|critical",
  "adapted_tasks": [{"day_number": N, "new_title": "...", "new_description": "...", "priority": "high|medium|low"}],
  "milestone_adjustments": [{"milestone_type": "...", "new_target": N, "reason": "..."}],
  "strategy_tips": ["tip1", "tip2", "tip3"],
  "focus_shift": "what to focus on for remaining days"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a YouTube growth expert. Respond ONLY in valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) throw new Error(`AI error: ${aiRes.status}`);
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    
    // Parse JSON (handle markdown code blocks)
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
            updated_at: new Date().toISOString(),
          }).eq("id", matchingTask.id);
        }
      }
    }

    // Update plan current_day
    await sb.from("monetization_30day_plans").update({
      current_day: currentDay,
      updated_at: new Date().toISOString(),
    }).eq("id", planId);

    return new Response(JSON.stringify({
      success: true,
      currentDay,
      completionRate: Math.round(completionRate * 100),
      contentRate: Math.round(contentRate * 100),
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
