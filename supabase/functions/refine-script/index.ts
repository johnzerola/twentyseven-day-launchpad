import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { draft_script, niche, language, duration, style, target_words, rejection_feedback, consensus_improvements } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!draft_script) throw new Error("draft_script is required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch knowledge for review context
    const [ytRes, scriptRes, triggersRes, hookRes, structRes] = await Promise.all([
      sb.from("youtube_knowledge").select("category,title,content").order("priority", { ascending: false }).limit(5),
      sb.from("script_knowledge").select("category,title,content").order("effectiveness_score", { ascending: false }).limit(8),
      sb.from("viral_content_library").select("content_json,effectiveness_score,category").in("category", ["psychology_triggers", "retention_technique"]).order("effectiveness_score", { ascending: false }).limit(8),
      sb.from("hook_library").select("hook_text,hook_type,retention_score").order("retention_score", { ascending: false }).limit(5),
      sb.from("script_structures").select("structure_name,intro_pattern,middle_pattern,cliffhanger_pattern,ending_pattern,avg_retention").order("effectiveness_score", { ascending: false }).limit(3),
    ]);

    const ytKnowledge = (ytRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");
    const scriptKnowledge = (scriptRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");
    const psychTriggers = (triggersRes.data || []).map((r: any) => {
      const c = r.content_json;
      return `• ${c.name || c.technique}: ${c.description || c.how_to_apply || ''}`;
    }).join("\n");
    const topHooks = (hookRes.data || []).map((r: any) => `• [${r.hook_type}] "${r.hook_text}" (score: ${r.retention_score})`).join("\n");
    const structures = (structRes.data || []).map((r: any) => `• ${r.structure_name}: Intro=${r.intro_pattern?.slice(0,80)} | Cliff=${r.cliffhanger_pattern?.slice(0,80)}`).join("\n");

    const tw = target_words || 2000;

    // Build rejection context if this is a retry
    const rejectionContext = rejection_feedback ? `
⚠️ ATENÇÃO — TENTATIVA ANTERIOR REJEITADA:
Motivo da rejeição: ${rejection_feedback.reason}
Pontos fracos identificados: ${(rejection_feedback.weaknesses || []).join('; ')}
Melhorias exigidas: ${(rejection_feedback.improvements || []).join('; ')}
Score GPT anterior: ${rejection_feedback.gpt_score}/10
Score Gemini anterior: ${rejection_feedback.gemini_score}/10

VOCÊ DEVE corrigir ESPECIFICAMENTE esses pontos fracos. Não repita os mesmos erros.
` : '';

    // Build consensus improvements context
    const consensusContext = consensus_improvements?.length > 0 ? `
🎯 CONSENSO DAS IAs — MELHORIAS OBRIGATÓRIAS:
Ambas as IAs (GPT e Gemini) concordaram que esses pontos DEVEM ser melhorados:
${consensus_improvements.map((imp: string, i: number) => `${i+1}. ${imp}`).join('\n')}

APLIQUE TODAS essas melhorias de forma cirúrgica. Elas são a PRIORIDADE MÁXIMA.
` : '';

    const systemPrompt = `Você é um EDITOR CIRÚRGICO de roteiros para YouTube viral. Sua missão é MELHORAR o roteiro existente SEM reescrevê-lo do zero.

🚨 REGRA PRINCIPAL: PRESERVE 80-90% DO TEXTO ORIGINAL. Você NÃO é autor, é EDITOR.

🔧 O QUE VOCÊ PODE FAZER:
1. Melhorar o HOOK (primeiros 30s) — tornar mais impactante
2. Adicionar pattern interrupts onde está MONÓTONO (a cada 45s)
3. Inserir micro-cliffhangers entre seções
4. Melhorar transições fracas
5. Turbinar frases individuais que estão genéricas
6. Adicionar open loops onde falta curiosidade
7. Melhorar o FINAL — conectar ao hook

❌ O QUE VOCÊ NÃO PODE FAZER:
1. NÃO reescreva parágrafos inteiros que já funcionam
2. NÃO mude a ordem narrativa
3. NÃO remova conteúdo informativo
4. NÃO altere o tom/estilo geral
5. NÃO adicione informações inventadas
6. NÃO mude mais de 20% do texto total

🧠 CONHECIMENTO YOUTUBE:
${ytKnowledge.slice(0, 1500)}

📝 TÉCNICAS DE ROTEIRO:
${scriptKnowledge.slice(0, 1500)}

🧠 GATILHOS PSICOLÓGICOS:
${psychTriggers.slice(0, 1000)}

🎯 HOOKS DE REFERÊNCIA:
${topHooks.slice(0, 800)}

📊 ESTRUTURAS VIRAIS:
${structures.slice(0, 600)}
${rejectionContext}
${consensusContext}

📊 PROCESSO:
1. Leia o roteiro COMPLETO
2. Identifique os 3-5 pontos MAIS FRACOS
3. Melhore APENAS esses pontos
4. Mantenha TODO o resto intacto

⚠️ FORMATO DE SAÍDA:
RETORNE APENAS o roteiro COMPLETO com suas melhorias cirúrgicas integradas.
APENAS texto de narração. ZERO anotações técnicas, ZERO marcações de "melhorado", ZERO comentários. Valores em $.

REGRAS: Mínimo ${tw} palavras. Idioma: ${language || 'português'}.`;

    console.log("Refine: Streaming from Lovable AI Gateway (Gemini 2.5 Pro)...");

    const refineRes = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `ROTEIRO PARA EDIÇÃO CIRÚRGICA (NÃO reescreva do zero!):\n\n${draft_script.slice(0, 25000)}\n\nMISSÃO: Identifique os 3-5 pontos FRACOS e melhore APENAS esses pontos. Preserve 80-90% do texto original. Retorne o roteiro COMPLETO com melhorias integradas.` },
        ],
      }),
    });

    if (!refineRes.ok) {
      const errText = await refineRes.text();
      console.error("AI Gateway error:", refineRes.status, errText);
      if (refineRes.status === 429) return errResp("Rate limit. Aguarde.", 429);
      if (refineRes.status === 402) return errResp("Créditos insuficientes.", 402);
      throw new Error(`AI Gateway error: ${refineRes.status}`);
    }

    // Pass through SSE stream directly (already in OpenAI format)
    return new Response(refineRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("refine-script error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
