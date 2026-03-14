import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ═══════════════════════════════════════════════════════════════
// AI SLOP DETECTION — Pre-score automated check
// ═══════════════════════════════════════════════════════════════
const SLOP_PATTERNS = [
  /neste vasto/gi, /mergulh(e|emos|ando)/gi, /é crucial/gi, /é importante notar/gi,
  /jornada (incrível|fascinante)/gi, /no mundo (acelerado|dinâmico)/gi,
  /desbloqueie? o potencial/gi, /sem mais delongas/gi, /apertem os cintos/gi,
  /prepare-se para ter a mente/gi, /isso vai mudar tudo/gi,
  /buckle up/gi, /let's dive in/gi, /without further ado/gi,
];

function detectSlop(text: string): { slopScore: number; slopPenalty: number; details: string[] } {
  const details: string[] = [];
  let count = 0;
  for (const p of SLOP_PATTERNS) {
    const m = text.match(p);
    if (m) { count += m.length; details.push(`"${m[0]}" (${m.length}x)`); }
  }
  // Superlative density check
  const superlatives = (text.match(/(incrível|impressionante|fantástic[oa]|extraordinári[oa]|surpreendente|maravilhos[oa])/gi) || []);
  const words = text.split(/\s+/).length;
  const supDensity = superlatives.length / (words / 1000); // per 1000 words
  if (supDensity > 5) { count += Math.floor(supDensity - 5); details.push(`superlativos: ${superlatives.length} (${supDensity.toFixed(1)}/1k palavras)`); }
  
  // Penalty: 0 if clean, -0.5 per slop pattern found (max -3)
  const penalty = Math.min(3, count * 0.5);
  return { slopScore: count, slopPenalty: penalty, details };
}

const SCORE_PROMPT = `Você é um CRÍTICO IMPLACÁVEL de roteiros YouTube com 20 anos de experiência.
Avalie este roteiro com nota de 1 a 10 (INTEIRO, sem decimais).

═══ SEU PAPEL: FASE 3 — JUIZ IMPLACÁVEL ═══
- Você NÃO é autor (Fase 1) nem editor (Fase 2)
- Sua ÚNICA missão: avaliar com HONESTIDADE BRUTAL
- Não sugira "refazer" — apenas aponte os problemas ESPECÍFICOS

CRITÉRIOS:
- Hook (primeiros 30s): Impossível de ignorar? Ou genérico e previsível?
- Retenção: Pattern interrupts? Open loops? Re-hooks? Ou monotonia?
- Emoção: Escalada emocional? Contraste? Gatilhos psicológicos? Ou texto morto?
- Fluidez: Tom conversacional? Ritmo natural? Ou leitura robótica?
- Payoff: Final conecta ao hook? Satisfatório? Ou anticlimático?
- Originalidade: Traz algo novo? Ou qualquer IA geraria isso?

🚫 DETECTOR DE AI-SLOP (peso alto na avaliação):
- O texto soa como um HUMANO apaixonado ou como uma IA genérica?
- Tem frases clichê de IA? ("neste vasto", "é crucial", "jornada fascinante")
- Usa linguagem específica e inesperada ou genérica e previsível?
- O espectador SENTIRIA algo real (raiva, riso, medo) ou ficaria indiferente?
- Se fosse um canal de podcast, alguém pausaria para ouvir esse trecho?

PENALIZE FORTEMENTE:
- Frases que soam como Wikipedia ou artigo de blog
- Superlativos vazios sem dados específicos
- Conclusões que apenas resumem o que já foi dito
- Falta de personalidade / voz autoral
- Padrões repetitivos de estrutura frasal

ESCALA:
1-3: Ruim, genérico, sem gancho — conteúdo que o YouTube enterraria
4-5: Medíocre, precisa de muito trabalho — "Valued Watch Time" baixo
6: Razoável, tem potencial mas não prende — espectador sai no minuto 3
7: Bom, pronto para produção com ajustes menores — retém 60%+
8: Muito bom, alto potencial viral — retém 75%+
9-10: Excepcional, referência de qualidade — alguém compartilharia

Seja BRUTALMENTE HONESTO. A maioria dos roteiros fica entre 5-7.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, niche, style, language, topic, phaseId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!script?.trim()) throw new Error("Script text is required");

    // ═══ ORCHESTRATION CONTRACT ═══
    // This function is PHASE 3 (Dual AI Scoring). It receives:
    //   - script: The FINAL text after Phase 1 draft + user edit + Phase 2 refine
    //   - niche, style, language, topic: Context for evaluation
    // It outputs: JSON with scores, approval status, and feedback
    // It does NOT modify the script (Phase 2's job)
    // It does NOT generate new content (Phase 1's job)
    const runId = phaseId || crypto.randomUUID();
    console.log(`[PHASE-3 SCORE] runId=${runId} script_length=${script.length} chars`);

    // Pre-flight: automated slop detection
    const slopResult = detectSlop(script);
    console.log(`[PHASE-3 SCORE] runId=${runId} Slop: score=${slopResult.slopScore} penalty=${slopResult.slopPenalty} patterns=[${slopResult.details.join(', ')}]`);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const scriptText = script.slice(0, 12000);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // ═══ Fetch calibration data from real results ═══
    let calibrationContext = '';
    try {
      const [calibRes, avgScoresRes, recentErrorsRes] = await Promise.all([
        sb.from("score_calibration").select("niche, avg_error, bias_correction, samples_count, confidence")
          .eq("score_type", "viral_probability").limit(10),
        sb.from("mv_avg_scores_by_niche").select("*").limit(20),
        sb.from("prediction_vs_result").select("niche, predicted_viral_score, real_views, prediction_error_score")
          .order("created_at", { ascending: false }).limit(10),
      ]);

      const calibData = calibRes.data || [];
      const avgScores = avgScoresRes.data || [];
      const recentErrors = recentErrorsRes.data || [];

      if (calibData.length > 0 || avgScores.length > 0) {
        const parts: string[] = [];
        if (calibData.length > 0) {
          parts.push('CALIBRAÇÃO REAL: ' + calibData.map(c => 
            `${c.niche}: erro médio ${c.avg_error}%, bias ${c.bias_correction > 0 ? '+' : ''}${c.bias_correction}, ${c.samples_count} amostras (confiança: ${Math.round((c.confidence || 0) * 100)}%)`
          ).join('; '));
        }
        if (avgScores.length > 0 && niche) {
          const nicheMatch = avgScores.find((a: any) => a.niche?.toLowerCase().includes(niche?.toLowerCase()));
          if (nicheMatch) {
            parts.push(`BENCHMARK REAL DO NICHO "${niche}": viral_score médio=${nicheMatch.avg_viral_score}, attention=${nicheMatch.avg_attention_score}, retenção=${nicheMatch.avg_retention}, baseado em ${nicheMatch.total_videos} vídeos reais`);
          }
        }
        if (recentErrors.length > 0) {
          const avgErr = recentErrors.reduce((s: number, e: any) => s + (e.prediction_error_score || 0), 0) / recentErrors.length;
          parts.push(`ERRO MÉDIO RECENTE DAS PREVISÕES: ${avgErr.toFixed(1)} pontos. Calibre suas notas baseado nesta margem de erro.`);
        }
        calibrationContext = parts.length > 0 ? `\n\n═══ DADOS REAIS DE CALIBRAÇÃO (use para ajustar sua avaliação) ═══\n${parts.join('\n')}\n` : '';
      }
    } catch (e) { console.warn("Calibration fetch error:", e); }

    // Add slop context to scoring prompt
    const slopWarning = slopResult.slopScore > 0
      ? `\n⚠️ NOTA PRÉ-AVALIAÇÃO: O detector automático encontrou ${slopResult.slopScore} padrões de AI-slop: ${slopResult.details.join(', ')}. Considere isso na sua avaliação de originalidade.\n`
      : '';

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
            originality_score: { type: "number", description: "Originality and human voice 1-10 (penalize AI-sounding text)" },
            ai_slop_detected: { type: "boolean", description: "True if the text sounds like generic AI output" },
            strengths: { type: "array", items: { type: "string" }, description: "Top 3 strengths" },
            weaknesses: { type: "array", items: { type: "string" }, description: "Top 3 weaknesses" },
            improvements: { type: "array", items: { type: "string" }, description: "Top 3 specific improvements needed" },
            verdict: { type: "string", description: "One-line verdict in Portuguese" },
          },
          required: ["score", "hook_score", "retention_score", "emotion_score", "flow_score", "payoff_score", "originality_score", "ai_slop_detected", "strengths", "weaknesses", "improvements", "verdict"],
          additionalProperties: false,
        },
      },
    };

    // Run BOTH evaluations in parallel: GPT-5-nano + Gemini Flash
    console.log(`[PHASE-3 SCORE] runId=${runId} Dual scoring: GPT-5-nano + Gemini Flash...`);
    const [gptRes, geminiRes] = await Promise.all([
      fetch(AI_URL, {
        method: "POST", headers: aiHeaders,
        body: JSON.stringify({
          model: "openai/gpt-5-nano",
          messages: [
            { role: "system", content: SCORE_PROMPT + slopWarning + calibrationContext + "\nVocê é o AVALIADOR GPT. Seja independente. NÃO INFLACIONE notas." },
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
            { role: "system", content: SCORE_PROMPT + slopWarning + "\nVocê é o AVALIADOR GEMINI. Seja independente. NÃO INFLACIONE notas." },
            { role: "user", content: `Avalie este roteiro${niche ? ` (nicho: ${niche})` : ''}${style ? ` (estilo: ${style})` : ''}:\n\n${scriptText}` },
          ],
          tools: [toolDef],
          tool_choice: { type: "function", function: { name: "score_script" } },
        }),
      }),
    ]);

    for (const [name, res] of [["GPT", gptRes], ["Gemini", geminiRes]] as const) {
      if (!res.ok) {
        const t = await res.text();
        console.error(`[PHASE-3 SCORE] ${name} error:`, res.status, t);
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
        console.error(`[PHASE-3 SCORE] Parse ${name} error:`, e);
        return null;
      }
    };

    const [gptScore, geminiScore] = await Promise.all([
      parseScore(gptRes, "GPT"),
      parseScore(geminiRes, "Gemini"),
    ]);

    if (!gptScore && !geminiScore) throw new Error("Both AI evaluations failed");

    // Apply slop penalty to raw scores
    let gpt = gptScore?.score || 5;
    let gemini = geminiScore?.score || 5;
    
    if (slopResult.slopPenalty > 0) {
      const gptPenalized = Math.max(1, Math.round(gpt - slopResult.slopPenalty));
      const geminiPenalized = Math.max(1, Math.round(gemini - slopResult.slopPenalty));
      console.log(`[PHASE-3 SCORE] runId=${runId} Slop penalty applied: GPT ${gpt}→${gptPenalized}, Gemini ${gemini}→${geminiPenalized}`);
      gpt = gptPenalized;
      gemini = geminiPenalized;
    }

    const combinedScore = gpt + gemini;
    const approved = combinedScore >= 14;

    // Detect if BOTH AIs flagged AI slop
    const bothDetectedSlop = (gptScore?.ai_slop_detected && geminiScore?.ai_slop_detected);
    
    // Merge weaknesses and improvements
    const allWeaknesses = [...new Set([
      ...(gptScore?.weaknesses || []),
      ...(geminiScore?.weaknesses || []),
      ...(slopResult.slopScore > 2 ? [`AI-Slop detectado: ${slopResult.details.slice(0, 3).join(', ')}`] : []),
    ])].slice(0, 5);

    const allImprovements = [...new Set([
      ...(gptScore?.improvements || []),
      ...(geminiScore?.improvements || []),
      ...(bothDetectedSlop ? ['Substituir linguagem genérica de IA por voz humana autêntica com analogias específicas e números reais'] : []),
    ])].slice(0, 5);

    const allStrengths = [...new Set([
      ...(gptScore?.strengths || []),
      ...(geminiScore?.strengths || []),
    ])].slice(0, 5);

    // If rejected, save learnings
    if (!approved) {
      console.log(`[PHASE-3 SCORE] runId=${runId} REJECTED: GPT=${gpt}, Gemini=${gemini}, Combined=${combinedScore}/20, slopPenalty=${slopResult.slopPenalty}`);
      try {
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
            slop_score: slopResult.slopScore,
            slop_penalty: slopResult.slopPenalty,
            slop_patterns: slopResult.details,
            weaknesses: allWeaknesses,
            improvements: allImprovements,
            rejected_at: new Date().toISOString(),
          }),
        });
      } catch (e) { console.warn("Failed to save rejection learning:", e); }
    } else {
      console.log(`[PHASE-3 SCORE] runId=${runId} APPROVED: GPT=${gpt}, Gemini=${gemini}, Combined=${combinedScore}/20`);
    }

    return new Response(JSON.stringify({
      approved,
      combinedScore,
      gpt_score: gpt,
      gemini_score: gemini,
      slop_score: slopResult.slopScore,
      slop_penalty: slopResult.slopPenalty,
      slop_details: slopResult.details,
      gpt_details: gptScore ? {
        hook: gptScore.hook_score, retention: gptScore.retention_score,
        emotion: gptScore.emotion_score, flow: gptScore.flow_score,
        payoff: gptScore.payoff_score, originality: gptScore.originality_score,
        ai_slop_detected: gptScore.ai_slop_detected,
        verdict: gptScore.verdict,
        weaknesses: gptScore.weaknesses || [],
        improvements: gptScore.improvements || [],
      } : null,
      gemini_details: geminiScore ? {
        hook: geminiScore.hook_score, retention: geminiScore.retention_score,
        emotion: geminiScore.emotion_score, flow: geminiScore.flow_score,
        payoff: geminiScore.payoff_score, originality: geminiScore.originality_score,
        ai_slop_detected: geminiScore.ai_slop_detected,
        verdict: geminiScore.verdict,
        weaknesses: geminiScore.weaknesses || [],
        improvements: geminiScore.improvements || [],
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
