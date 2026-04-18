import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiagnosisResult {
  channelHealth: {
    score: number;
    grade: string;
    strengths: string[];
    weaknesses: string[];
  };
  viralReadiness: {
    score: number;
    missingElements: string[];
    readyElements: string[];
  };
  monetizationPath: {
    daysToYPP: number | null;
    currentPhase: string;
    bottleneck: string;
    strategy: string;
  };
  actionPlan: {
    immediate: ActionItem[];
    thisWeek: ActionItem[];
    thisMonth: ActionItem[];
  };
  nicheIntelligence: {
    nicheStrength: number;
    topCompetitorInsight: string;
    contentGap: string;
    recommendedPivot: string | null;
  };
}

interface ActionItem {
  priority: 'critical' | 'high' | 'medium';
  action: string;
  reason: string;
  expectedImpact: string;
  tool: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await sb.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    // ═══ 1. GATHER ALL CHANNEL DATA ═══
    const [
      { data: channels },
      { data: perfData },
      { data: scripts },
      { data: contentQueue },
      { data: dailyTasks },
      { data: learnings },
      { data: milestones },
    ] = await Promise.all([
      sb.from("user_channels").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      sb.from("video_performance").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      sb.from("video_projects").select("id, title, niche, created_at, status").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      sb.from("content_queue").select("*").eq("user_id", userId).limit(30),
      sb.from("daily_tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      sb.from("user_content_memory" as any).select("*").eq("user_id", userId).limit(20),
      sb.from("monetization_milestones" as any).select("*").eq("user_id", userId),
    ]);

    const mainChannel = (channels as any)?.[0];
    if (!mainChannel) {
      return new Response(JSON.stringify({ error: "No channel found. Add a channel first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ 2. FETCH NICHE BENCHMARKS ═══
    const channelNiche = mainChannel.niche || "general";
    const { data: nicheBenchmarks } = await sb.from("channel_intelligence")
      .select("subscribers, avg_views, growth_rate, content_category, upload_frequency, is_monetized")
      .ilike("niche", `%${channelNiche}%`)
      .limit(100);

    // ═══ 3. FETCH VIRAL PATTERNS FOR THIS NICHE ═══
    const { data: viralPatterns } = await sb.from("content_dna")
      .select("hook_type, hook_strength, story_structure, viral_score, views, multiplier")
      .ilike("niche", `%${channelNiche}%`)
      .gte("viral_score", 70)
      .order("viral_score", { ascending: false })
      .limit(30);

    // ═══ 3.5 FETCH USER REFERENCE CHANNELS INTEL (auto-injection) ═══
    const referenceIntelBlock = await fetchReferenceIntelBlock(sb, userId, { limit: 3 });

    // ═══ 4. CALCULATE RAW METRICS ═══
    const subs = mainChannel.subscribers || 0;
    const totalVideos = (perfData as any)?.length || 0;
    const avgViews = totalVideos > 0
      ? (perfData as any).reduce((s: number, v: any) => s + (v.views_current || 0), 0) / totalVideos
      : 0;
    const avgRetention = totalVideos > 0
      ? (perfData as any).reduce((s: number, v: any) => s + (v.avg_retention_percent || 0), 0) / totalVideos
      : 0;

    // Upload frequency analysis
    const videosByDate = (perfData as any)?.map((v: any) => new Date(v.created_at).getTime()).sort() || [];
    let avgDaysBetweenUploads = 0;
    if (videosByDate.length > 1) {
      const gaps = [];
      for (let i = 1; i < videosByDate.length; i++) {
        gaps.push((videosByDate[i] - videosByDate[i - 1]) / 86400000);
      }
      avgDaysBetweenUploads = gaps.reduce((a: number, b: number) => a + b, 0) / gaps.length;
    }

    // Niche benchmarks
    const nicheAvgSubs = (nicheBenchmarks as any)?.length
      ? (nicheBenchmarks as any).reduce((s: number, c: any) => s + (c.subscribers || 0), 0) / (nicheBenchmarks as any).length
      : 10000;
    const nicheAvgViews = (nicheBenchmarks as any)?.length
      ? (nicheBenchmarks as any).reduce((s: number, c: any) => s + (c.avg_views || 0), 0) / (nicheBenchmarks as any).length
      : 5000;
    const monetizedChannels = (nicheBenchmarks as any)?.filter((c: any) => c.is_monetized).length || 0;
    const monetizationRate = (nicheBenchmarks as any)?.length
      ? monetizedChannels / (nicheBenchmarks as any).length
      : 0.5;

    // Task completion rate
    const completedTasks = (dailyTasks as any)?.filter((t: any) => t.completed).length || 0;
    const totalTasks = (dailyTasks as any)?.length || 1;
    const taskCompletionRate = completedTasks / totalTasks;

    // Content patterns from DNA
    const topHookTypes = viralPatterns?.reduce((acc: any, p: any) => {
      if (p.hook_type) acc[p.hook_type] = (acc[p.hook_type] || 0) + 1;
      return acc;
    }, {}) || {};
    const bestHookType = Object.entries(topHookTypes).sort(([, a]: any, [, b]: any) => b - a)[0]?.[0] || 'curiosidade';
    const avgViralScore = viralPatterns?.length
      ? viralPatterns.reduce((s: number, p: any) => s + (p.viral_score || 0), 0) / viralPatterns.length
      : 50;

    // ═══ 5. AI DIAGNOSIS ═══
    const diagnosisPrompt = `You are a world-class YouTube growth strategist. Analyze this channel and create a BRUTALLY HONEST diagnosis with a personalized viral action plan.
${referenceIntelBlock}

## CHANNEL DATA:
- Name: ${mainChannel.channel_name}
- Niche: ${channelNiche}
- Subscribers: ${subs}
- Total Videos: ${totalVideos}
- Avg Views: ${Math.round(avgViews)}
- Avg Retention: ${Math.round(avgRetention)}%
- Upload Frequency: every ${Math.round(avgDaysBetweenUploads)} days
- Task Completion Rate: ${Math.round(taskCompletionRate * 100)}%
- Scripts Created: ${scripts?.length || 0}
- Content Queue Items: ${contentQueue?.length || 0}
- User Learnings: ${(learnings as any)?.length || 0}

## NICHE BENCHMARKS (${channelNiche}):
- Avg Subs in Niche: ${Math.round(nicheAvgSubs)}
- Avg Views in Niche: ${Math.round(nicheAvgViews)}
- Monetization Rate: ${Math.round(monetizationRate * 100)}%
- Top Hook Type: "${bestHookType}"
- Avg Viral Score: ${Math.round(avgViralScore)}

## YPP STATUS:
- Subs: ${subs}/1000 (${Math.round(subs / 10)}%)
- Watch Hours: estimated from ${totalVideos} videos

## VIRAL PATTERNS IN NICHE (top performers):
${viralPatterns?.slice(0, 10).map((p: any) => `- Hook: ${p.hook_type} | Score: ${p.viral_score} | Views: ${p.views} | Multiplier: ${p.multiplier}x`).join('\n') || 'No data yet'}

Generate a JSON response with this EXACT structure:
{
  "channelHealth": {
    "score": <0-100>,
    "grade": "<S/A/B/C/D/F>",
    "strengths": ["<max 3 strengths>"],
    "weaknesses": ["<max 3 weaknesses>"]
  },
  "viralReadiness": {
    "score": <0-100>,
    "missingElements": ["<what's missing for virality>"],
    "readyElements": ["<what's already good>"]
  },
  "monetizationPath": {
    "daysToYPP": <estimated days or null if already monetized>,
    "currentPhase": "<seed/growth/acceleration/monetization>",
    "bottleneck": "<the #1 thing holding the channel back>",
    "strategy": "<the ONE strategy that will have most impact>"
  },
  "actionPlan": {
    "immediate": [{"priority": "critical", "action": "<specific action>", "reason": "<why>", "expectedImpact": "<what will happen>", "tool": "<platform tool to use or null>"}],
    "thisWeek": [<2-3 items>],
    "thisMonth": [<2-3 items>]
  },
  "nicheIntelligence": {
    "nicheStrength": <0-100>,
    "topCompetitorInsight": "<key insight from top performers>",
    "contentGap": "<untapped content opportunity>",
    "recommendedPivot": "<pivot suggestion or null>"
  }
}

RULES:
- Be SPECIFIC, not generic. Use the data.
- Actions must reference actual tools: "DubSpy", "Gerador de Roteiros", "Daily Planner", "TubeBot", "TubeRush", "Niche Explorer"
- If upload frequency > 5 days, this is a CRITICAL weakness
- If retention < 40%, this is the #1 bottleneck
- If subs < 100, focus on Shorts strategy for rapid growth
- All text in Portuguese (PT-BR)`;

    const aiRes = await _ai({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a YouTube growth AI. Respond ONLY in valid JSON. No markdown, no explanation." },
          { role: "user", content: diagnosisPrompt },
        ],
        temperature: 0.7,
      });

    if (!aiRes.ok) throw new Error(`AI request failed: ${aiRes.status}`);

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let diagnosis: DiagnosisResult;
    try {
      diagnosis = JSON.parse(cleaned);
    } catch {
      // Attempt repair
      const repaired = cleaned.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
      diagnosis = JSON.parse(repaired);
    }

    return new Response(JSON.stringify({
      success: true,
      diagnosis,
      channel: {
        name: mainChannel.channel_name,
        niche: channelNiche,
        subscribers: subs,
        totalVideos,
        avgViews: Math.round(avgViews),
      },
      benchmarks: {
        nicheAvgSubs: Math.round(nicheAvgSubs),
        nicheAvgViews: Math.round(nicheAvgViews),
        monetizationRate: Math.round(monetizationRate * 100),
        totalNicheChannels: (nicheBenchmarks as any)?.length || 0,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("viral-diagnosis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
