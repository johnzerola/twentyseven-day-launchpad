import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Script Scoring Engine
 * Evaluates scripts on 6 metrics with weighted formula:
 * hook_strength(0.25) + curiosity_gap(0.15) + emotional_intensity(0.20) +
 * story_tension(0.20) + retention_structure(0.10) + pacing_quality(0.10)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, niche, style } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!script?.trim()) throw new Error("Script text is required");

    // Truncate script to avoid token overflow
    const scriptText = script.slice(0, 12000);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a YouTube script scoring expert with 20+ years of experience analyzing viral content. You evaluate scripts with brutal honesty on 6 dimensions. Each score is 0-100.

SCORING CRITERIA:
1. HOOK STRENGTH (0-100): First 30 seconds. Does it create immediate curiosity? Is there a pattern interrupt? Does it promise value?
2. CURIOSITY GAP (0-100): Are there unanswered questions? Open loops? Information gaps that compel viewing?
3. EMOTIONAL INTENSITY (0-100): Does the script trigger strong emotions? Fear, surprise, anger, joy, awe?
4. STORY TENSION (0-100): Is there conflict? Stakes? Escalation? Unexpected twists?
5. RETENTION STRUCTURE (0-100): Are there pattern interrupts at drop points (30s, 2min, 5min)? Re-hooks? Payoff promises?
6. PACING QUALITY (0-100): Does the rhythm vary? Are there breathers between intense moments? Is the information density right?

Be HARSH. Most scripts score 40-70. Only exceptional scripts score 80+.`
          },
          {
            role: "user",
            content: `Score this script${niche ? ` (niche: ${niche})` : ''}${style ? ` (style: ${style})` : ''}:\n\n${scriptText}`
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "score_script",
            description: "Score a YouTube video script on 6 retention metrics",
            parameters: {
              type: "object",
              properties: {
                hook_strength: { type: "number", description: "0-100 score for first 30 seconds hook power" },
                hook_feedback: { type: "string", description: "Specific feedback on the hook" },
                curiosity_gap: { type: "number", description: "0-100 score for unanswered questions and open loops" },
                curiosity_feedback: { type: "string" },
                emotional_intensity: { type: "number", description: "0-100 score for emotional triggers" },
                emotional_feedback: { type: "string" },
                story_tension: { type: "number", description: "0-100 score for conflict and stakes" },
                tension_feedback: { type: "string" },
                retention_structure: { type: "number", description: "0-100 score for re-hooks and pattern interrupts" },
                retention_feedback: { type: "string" },
                pacing_quality: { type: "number", description: "0-100 score for rhythm and information density" },
                pacing_feedback: { type: "string" },
                strengths: { type: "array", items: { type: "string" }, description: "Top 3 strengths" },
                weaknesses: { type: "array", items: { type: "string" }, description: "Top 3 weaknesses" },
                improvements: { type: "array", items: { type: "string" }, description: "Top 3 specific improvements" },
                estimated_retention_30s: { type: "number", description: "Estimated % of viewers still watching at 30s" },
                estimated_retention_50pct: { type: "number", description: "Estimated % of viewers at 50% of video" },
                viral_potential: { type: "string", enum: ["low", "medium", "high", "very_high"], description: "Overall viral potential" },
              },
              required: [
                "hook_strength", "hook_feedback",
                "curiosity_gap", "curiosity_feedback",
                "emotional_intensity", "emotional_feedback",
                "story_tension", "tension_feedback",
                "retention_structure", "retention_feedback",
                "pacing_quality", "pacing_feedback",
                "strengths", "weaknesses", "improvements",
                "estimated_retention_30s", "estimated_retention_50pct",
                "viral_potential"
              ],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "score_script" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No AI response");
    const scores = JSON.parse(toolCall.function.arguments);

    // Calculate weighted final score
    const finalScore = Math.round(
      scores.hook_strength * 0.25 +
      scores.curiosity_gap * 0.15 +
      scores.emotional_intensity * 0.20 +
      scores.story_tension * 0.20 +
      scores.retention_structure * 0.10 +
      scores.pacing_quality * 0.10
    );

    // Determine recommendation
    let recommendation: string;
    if (finalScore >= 75) recommendation = "🟢 PRODUZIR — Este roteiro tem alto potencial viral. Prossiga com a produção.";
    else if (finalScore >= 50) recommendation = "🟡 OTIMIZAR — Bom potencial, mas precisa de melhorias antes da produção.";
    else recommendation = "🔴 REESCREVER — Este roteiro precisa de revisão significativa nos pontos fracos.";

    return new Response(JSON.stringify({
      finalScore,
      recommendation,
      metrics: {
        hook_strength: { score: scores.hook_strength, weight: 0.25, feedback: scores.hook_feedback },
        curiosity_gap: { score: scores.curiosity_gap, weight: 0.15, feedback: scores.curiosity_feedback },
        emotional_intensity: { score: scores.emotional_intensity, weight: 0.20, feedback: scores.emotional_feedback },
        story_tension: { score: scores.story_tension, weight: 0.20, feedback: scores.tension_feedback },
        retention_structure: { score: scores.retention_structure, weight: 0.10, feedback: scores.retention_feedback },
        pacing_quality: { score: scores.pacing_quality, weight: 0.10, feedback: scores.pacing_feedback },
      },
      strengths: scores.strengths,
      weaknesses: scores.weaknesses,
      improvements: scores.improvements,
      estimates: {
        retention_30s: scores.estimated_retention_30s,
        retention_50pct: scores.estimated_retention_50pct,
        viral_potential: scores.viral_potential,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("score-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
