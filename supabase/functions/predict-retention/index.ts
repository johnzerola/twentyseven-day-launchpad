import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callGemini } from "../_shared/gemini-direct.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, niche, style, language, duration, videoType, script, returnCurve } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const isShort = videoType === 'short';

    // Fetch knowledge in parallel
    const [viralTitlesRes, hookRes, attRes, contentModelsRes, channelRes] = await Promise.all([
      sb.from("viral_titles_db" as any).select("title,views,why_viral,title_pattern,niche")
        .order("views", { ascending: false }).limit(15),
      sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
        .order("retention_score", { ascending: false }).limit(10),
      sb.from("attention_engineering").select("pattern_name,technique,retention_impact,category")
        .order("retention_impact", { ascending: false }).limit(8),
      sb.from("content_models" as any).select("model_name,model_type,retention_profile,effectiveness_score,video_type")
        .eq("video_type", isShort ? 'short' : 'long')
        .order("effectiveness_score", { ascending: false }).limit(5),
      sb.from("channel_intelligence").select("niche,avg_views,growth_rate")
        .eq("niche", niche || 'geral').limit(5),
    ]);

    // Build context for prediction
    const topicWords = (topic || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    const matchingTitles = (viralTitlesRes.data || []).filter((t: any) => {
      const titleLC = (t.title || '').toLowerCase();
      return topicWords.some((w: string) => titleLC.includes(w));
    });

    const avgViralViews = matchingTitles.length > 0
      ? matchingTitles.reduce((sum: number, t: any) => sum + (t.views || 0), 0) / matchingTitles.length
      : 0;

    const topHookScore = (hookRes.data || []).length > 0
      ? Math.max(...(hookRes.data || []).map((h: any) => h.retention_score || 0))
      : 5;

    const avgRetentionImpact = (attRes.data || []).length > 0
      ? (attRes.data || []).reduce((sum: number, a: any) => sum + (a.retention_impact || 0), 0) / (attRes.data || []).length
      : 10;

    const bestModel = (contentModelsRes.data || [])[0];
    const modelRetention = bestModel?.retention_profile?.avg_retention || 65;

    const channelAvgViews = (channelRes.data || []).length > 0
      ? (channelRes.data || []).reduce((sum: number, c: any) => sum + (c.avg_views || 0), 0) / (channelRes.data || []).length
      : 50000;

    // Context for AI
    const context = {
      topic,
      niche: niche || 'geral',
      style: style || 'narração',
      duration: duration || (isShort ? 45 : 15),
      videoType: isShort ? 'short' : 'long',
      matchingViralTitles: matchingTitles.length,
      avgViralViews,
      topHookScore,
      avgRetentionImpact,
      bestContentModel: bestModel?.model_name || 'N/A',
      modelAvgRetention: modelRetention,
      nicheAvgViews: channelAvgViews,
      hooks: (hookRes.data || []).slice(0, 5).map((h: any) => h.hook_text),
      attentionTechniques: (attRes.data || []).slice(0, 5).map((a: any) => a.pattern_name),
    };

    // Determine if we need a full curve
    const wantCurve = returnCurve && script && script.length >= 100;

    // AI prediction via Gemini Direct
    const systemPrompt = wantCurve
      ? `You are a YouTube retention curve predictor. Analyze the script provided and generate a timestamp-by-timestamp retention curve.

Return ONLY valid JSON:
{
  "curve": {
    "points": [{"second": 0, "label": "Hook", "attention": 0.95}],
    "avgRetention": 65,
    "dropOffs": [{"timestamp": "1:30", "from": 70, "to": 52, "drop": 18, "fix": "Add pattern interrupt or revelation here"}],
    "bestMoment": {"second": 15, "label": "Hook Payoff", "attention": 0.92},
    "worstMoment": {"second": 300, "label": "Valley", "attention": 0.45}
  },
  "prediction": {
    "estimated_ctr": 0, "estimated_retention": 0, "viral_probability": 0,
    "attention_score": 0, "curiosity_score": 0, "dopamine_score": 0,
    "retention_prediction": {"first_30s": 0, "mid_video": 0, "last_30s": 0},
    "recommended_content_model": "string", "recommended_hook_type": "string",
    "risk_factors": ["string"], "optimization_tips": ["string"], "confidence": 0
  }
}

Rules: Generate 10-20 points, start at 1.0, identify drops >10%, provide actionable fixes.`
      : `Você é um modelo de predição de performance de vídeos YouTube. Analise os dados e preveja métricas. Retorne APENAS JSON válido com: estimated_ctr, estimated_retention, viral_probability, attention_score, curiosity_score, dopamine_score, retention_prediction (first_30s, mid_video, last_30s), recommended_content_model, recommended_hook_type, risk_factors, optimization_tips, confidence.`;

    const userPrompt = wantCurve
      ? `Analyze this script and generate a retention curve:\n\nScript (first 3000 chars):\n${script.slice(0, 3000)}\n\nContext:\n${JSON.stringify(context, null, 2)}\n\nDuration: ${duration} ${isShort ? 'seconds' : 'minutes'}\nReturn ONLY the JSON.`
      : `Preveja a performance deste vídeo:\n${JSON.stringify(context, null, 2)}\n\nRetorne APENAS o JSON.`;

    try {
      const content = await callGemini(GOOGLE_AI_API_KEY, systemPrompt, userPrompt, {
        model: 'gemini-2.5-flash-lite',
        jsonMode: true,
        maxTokens: 4096,
        temperature: 0.5,
      });
      const parsed = JSON.parse(content);
      if (wantCurve && parsed.curve) {
        curve = parsed.curve;
        prediction = parsed.prediction || {};
      } else {
        prediction = parsed;
      }
    } catch (e) {
      console.warn("Gemini prediction failed, using fallback:", e);
    }

    // Fallback if AI failed
    if (!prediction.estimated_ctr) {
      const topicRelevance = matchingTitles.length > 0 ? Math.min(10, matchingTitles.length * 2) : 3;
      prediction = {
        estimated_ctr: Math.min(25, 5 + topicRelevance + (topHookScore > 7 ? 5 : 0)),
        estimated_retention: Math.min(85, modelRetention + (avgRetentionImpact / 5)),
        viral_probability: Math.min(90, 20 + topicRelevance * 5 + (avgViralViews > 500000 ? 20 : 0)),
        attention_score: Math.min(10, topHookScore),
        curiosity_score: Math.min(10, 5 + topicRelevance / 2),
        dopamine_score: Math.min(10, 4 + (style === 'dopaminérgico' ? 3 : 0) + (isShort ? 2 : 0)),
        retention_prediction: { first_30s: 85, mid_video: 60, last_30s: 55 },
        recommended_content_model: bestModel?.model_name || 'Curiosity Engine',
        recommended_hook_type: 'curiosity',
        risk_factors: ['Tópico pode ter alta concorrência'],
        optimization_tips: ['Use hook de curiosidade nos primeiros 5s'],
        confidence: 45,
      };
    }

    return new Response(JSON.stringify({
      prediction,
      curve: curve || null,
      context: {
        matchingViralTitles: matchingTitles.length,
        avgViralViews,
        nicheAvgViews: channelAvgViews,
        bestContentModel: bestModel?.model_name,
        videoType: isShort ? 'short' : 'long',
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("predict-retention error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
