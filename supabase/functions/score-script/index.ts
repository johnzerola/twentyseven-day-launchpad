import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SCORE_PROMPT = `Você é um CRÍTICO IMPLACÁVEL de roteiros YouTube com 20 anos de experiência.
Avalie este roteiro com nota de 1 a 10 (INTEIRO, sem decimais).

CRITÉRIOS:
- Hook (primeiros 30s): Impossível de ignorar?
- Retenção: Pattern interrupts? Open loops? Re-hooks?
- Emoção: Escalada emocional? Contraste? Gatilhos psicológicos?
- Fluidez: Tom conversacional? Ritmo natural?
- Payoff: Final conecta ao hook? Satisfatório?
- Originalidade: Traz algo novo ou é genérico?

ESCALA:
1-3: Ruim, genérico, sem gancho
4-5: Medíocre, precisa de muito trabalho
6: Razoável, tem potencial
7: Bom, pronto para produção com ajustes menores
8: Muito bom, alto potencial viral
9-10: Excepcional, referência de qualidade

Seja BRUTALMENTE HONESTO. A maioria dos roteiros fica entre 5-7.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, niche, style, language, topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!script?.trim()) throw new Error("Script text is required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const scriptText = script.slice(0, 12000);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    const toolDef = {
      type: "function" as const,
      function: {
        name: "score_script",
        description: "Score a YouTube script 1-10 with detailed feedback",
        parameters: {
          type: "object",
          properties: {
            score: { type: "number", description: "Overall score 1-10 (integer)" },
            hook_score: { type: "number", description: "Hook quality 1-10" },
            retention_score: { type: "number", description: "Retention techniques 1-10" },
            emotion_score: { type: "number", description: "Emotional impact 1-10" },
            flow_score: { type: "number", description: "Flow and pacing 1-10" },
            payoff_score: { type: "number", description: "Ending quality 1-10" },
            originality_score: { type: "number", description: "Originality 1-10" },
            strengths: { type: "array", items: { type: "string" }, description: "Top 3 strengths" },
            weaknesses: { type: "array", items: { type: "string" }, description: "Top 3 weaknesses" },
            improvements: { type: "array", items: { type: "string" }, description: "Top 3 specific improvements needed" },
            verdict: { type: "string", description: "One-line verdict in Portuguese" },
          },
          required: ["score", "hook_score", "retention_score", "emotion_score", "flow_score", "payoff_score", "originality_score", "strengths", "weaknesses", "improvements", "verdict"],
          additionalProperties: false,
        },
      },
    };

    // Run BOTH evaluations in parallel: GPT-5-nano + Gemini Flash (fast models to avoid timeout)
    console.log("Dual scoring: GPT-5-nano + Gemini Flash in parallel...");
    const [gptRes, geminiRes] = await Promise.all([
      fetch(AI_URL, {
        method: "POST", headers: aiHeaders,
        body: JSON.stringify({
          model: "openai/gpt-5-nano",
          messages: [
            { role: "system", content: SCORE_PROMPT + "\nVocê é o AVALIADOR GPT. Seja independente na sua análise." },
            { role: "user", content: `Avalie este roteiro${niche ? ` (nicho: ${niche})` : ''}${style ? ` (estilo: ${style})` : ''}:\n\n${scriptText}` },
          ],
          tools: [toolDef],
          tool_choice: { type: "function", function: { name: "score_script" } },
        }),
      }),
      fetch(AI_URL, {
        method: "POST", headers: aiHeaders,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SCORE_PROMPT + "\nVocê é o AVALIADOR GEMINI. Seja independente na sua análise." },
            { role: "user", content: `Avalie este roteiro${niche ? ` (nicho: ${niche})` : ''}${style ? ` (estilo: ${style})` : ''}:\n\n${scriptText}` },
          ],
          tools: [toolDef],
          tool_choice: { type: "function", function: { name: "score_script" } },
        }),
      }),
    ]);

    // Handle errors
    for (const [name, res] of [["GPT", gptRes], ["Gemini", geminiRes]] as const) {
      if (!res.ok) {
        const t = await res.text();
        console.error(`${name} error:`, res.status, t);
        if (res.status === 429) return errResp("Rate limit. Tente novamente.", 429);
        if (res.status === 402) return errResp("Créditos insuficientes.", 402);
      }
    }

    const parseScore = async (res: Response, name: string) => {
      try {
        if (!res.ok) return null;
        const data = await res.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) return null;
        return JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error(`Parse ${name} error:`, e);
        return null;
      }
    };

    const [gptScore, geminiScore] = await Promise.all([
      parseScore(gptRes, "GPT"),
      parseScore(geminiRes, "Gemini"),
    ]);

    if (!gptScore && !geminiScore) throw new Error("Both AI evaluations failed");

    const gpt = gptScore?.score || 5;
    const gemini = geminiScore?.score || 5;
    const combinedScore = gpt + gemini;
    const approved = combinedScore >= 14;

    // Merge weaknesses and improvements from both AIs
    const allWeaknesses = [...new Set([
      ...(gptScore?.weaknesses || []),
      ...(geminiScore?.weaknesses || []),
    ])].slice(0, 5);

    const allImprovements = [...new Set([
      ...(gptScore?.improvements || []),
      ...(geminiScore?.improvements || []),
    ])].slice(0, 5);

    const allStrengths = [...new Set([
      ...(gptScore?.strengths || []),
      ...(geminiScore?.strengths || []),
    ])].slice(0, 5);

    // If rejected, save learnings to improve future generations
    if (!approved) {
      console.log(`Script REJECTED: GPT=${gpt}, Gemini=${gemini}, Combined=${combinedScore}/20`);
      try {
        // Save rejection learnings to script_knowledge
        await sb.from("ai_learning").insert({
          topic: `script_rejection_${Date.now()}`,
          source: "dual_score_rejection",
          insight: JSON.stringify({
            topic: topic || "unknown",
            niche: niche || "unknown",
            style: style || "unknown",
            gpt_score: gpt,
            gemini_score: gemini,
            combined: combinedScore,
            weaknesses: allWeaknesses,
            improvements: allImprovements,
            rejected_at: new Date().toISOString(),
          }),
        });
      } catch (e) { console.warn("Failed to save rejection learning:", e); }
    }

    return new Response(JSON.stringify({
      approved,
      combinedScore,
      gpt_score: gpt,
      gemini_score: gemini,
      gpt_details: gptScore ? {
        hook: gptScore.hook_score, retention: gptScore.retention_score,
        emotion: gptScore.emotion_score, flow: gptScore.flow_score,
        payoff: gptScore.payoff_score, originality: gptScore.originality_score,
        verdict: gptScore.verdict,
      } : null,
      gemini_details: geminiScore ? {
        hook: geminiScore.hook_score, retention: geminiScore.retention_score,
        emotion: geminiScore.emotion_score, flow: geminiScore.flow_score,
        payoff: geminiScore.payoff_score, originality: geminiScore.originality_score,
        verdict: geminiScore.verdict,
      } : null,
      strengths: allStrengths,
      weaknesses: allWeaknesses,
      improvements: allImprovements,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("score-script error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
