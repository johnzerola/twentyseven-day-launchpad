import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ═══════════════════════════════════════════════════════════════
// ANTI-AI-SLOP DETECTOR — Run BEFORE refinement to flag problems
// ═══════════════════════════════════════════════════════════════
const SLOP_PATTERNS = [
  /neste vasto/gi, /mergulh(e|emos|ando)/gi, /é crucial/gi, /é importante notar/gi,
  /jornada (incrível|fascinante)/gi, /no mundo (acelerado|dinâmico)/gi,
  /desbloqueie? o potencial/gi, /sem mais delongas/gi, /apertem os cintos/gi,
  /prepare-se para ter a mente/gi, /isso vai mudar tudo/gi,
  /buckle up/gi, /let's dive in/gi, /without further ado/gi,
  /imagine (um mundo|uma realidade|que)/gi,
];

function countSlopScore(text: string): { score: number; matches: string[] } {
  const matches: string[] = [];
  for (const p of SLOP_PATTERNS) {
    const m = text.match(p);
    if (m) matches.push(...m.map(s => s.trim()));
  }
  // Check for excessive superlatives
  const superlatives = (text.match(/(incrível|impressionante|fantástic[oa]|extraordinári[oa]|surpreendente)/gi) || []);
  if (superlatives.length > 3) matches.push(`${superlatives.length}x superlativos genéricos`);
  
  return { score: matches.length, matches };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { draft_script, niche, language, duration, style, target_words, rejection_feedback, consensus_improvements, phaseId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!draft_script) throw new Error("draft_script is required");

    // ═══ ORCHESTRATION CONTRACT ═══
    // This function is PHASE 2 (Surgical Refinement). It receives:
    //   - draft_script: The EXACT text the user approved from Phase 1
    //   - rejection_feedback: Optional feedback from Phase 3 (score-script)
    //   - consensus_improvements: Optional specific improvements both AIs agreed on
    // It outputs: SSE stream of the IMPROVED script (80-90% preserved)
    // It does NOT score the script (Phase 3's job)
    // It does NOT generate from scratch (Phase 1's job)
    const runId = phaseId || crypto.randomUUID();
    console.log(`[PHASE-2 REFINE] runId=${runId} draft_length=${draft_script.length} chars`);

    // Pre-flight: detect AI slop in the draft
    const slopCheck = countSlopScore(draft_script);
    console.log(`[PHASE-2 REFINE] runId=${runId} Slop score: ${slopCheck.score} (${slopCheck.matches.join(', ')})`);

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

    // Build anti-slop remediation context
    const slopContext = slopCheck.score > 0 ? `
🚫 ALERTA ANTI-AI-SLOP — ${slopCheck.score} PADRÕES GENÉRICOS DETECTADOS:
Padrões encontrados no texto: ${slopCheck.matches.join(', ')}

SUBSTITUA cada ocorrência por linguagem HUMANA, ESPECÍFICA e IMPREVISÍVEL.
Exemplos de substituição:
- "Neste vasto universo" → Frase específica sobre o tema
- "Jornada fascinante" → Detalhe concreto do que acontece
- "É importante notar" → Eliminir. Vá direto ao ponto
- Superlativos genéricos → Dados específicos ou metáforas originais
` : '';

    const systemPrompt = `Você é um EDITOR CIRÚRGICO de roteiros para YouTube viral. Sua missão é MELHORAR o roteiro existente SEM reescrevê-lo do zero.

═══ SEU PAPEL: FASE 2 — EDITOR CIRÚRGICO ═══
- Você recebe o rascunho que o USUÁRIO JÁ EDITOU e APROVOU
- O usuário investiu tempo editando. RESPEITE o texto dele
- Você NÃO é autor (isso foi Fase 1) nem avaliador (isso é Fase 3)
- Sua ÚNICA missão: melhorar 3-5 pontos fracos sem descaracterizar

🚨 REGRA PRINCIPAL: PRESERVE 80-90% DO TEXTO ORIGINAL.

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
${slopContext}

🚫 ANTI-AI-SLOP — DURANTE A EDIÇÃO:
- NUNCA introduza frases clichê de IA (veja lista acima)
- Se encontrar frases genéricas no original, SUBSTITUA por linguagem humana
- Cada frase deve passar no teste: "Um humano FALARIA isso em uma conversa real?"
- Injete pelo menos 2 elementos de "alma": analogia inesperada, número específico estranho, confissão do narrador, ou pausa narrativa abrupta

📊 PROCESSO:
1. Leia o roteiro COMPLETO
2. Identifique os 3-5 pontos MAIS FRACOS
3. Verifique se há padrões AI-slop e elimine-os
4. Melhore APENAS esses pontos
5. Mantenha TODO o resto intacto

⚠️ FORMATO DE SAÍDA:
RETORNE APENAS o roteiro COMPLETO com suas melhorias cirúrgicas integradas.
APENAS texto de narração. ZERO anotações técnicas, ZERO marcações de "melhorado", ZERO comentários. Valores em $.

REGRAS: Mínimo ${tw} palavras. Idioma: ${language || 'português'}.`;

    console.log(`[PHASE-2 REFINE] runId=${runId} Streaming from Gemini Pro...`);

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
      console.error(`[PHASE-2 REFINE] runId=${runId} Error:`, refineRes.status, errText);
      if (refineRes.status === 429) return errResp("Rate limit. Aguarde.", 429);
      if (refineRes.status === 402) return errResp("Créditos insuficientes.", 402);
      throw new Error(`AI Gateway error: ${refineRes.status}`);
    }

    // Pass through SSE stream directly
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
