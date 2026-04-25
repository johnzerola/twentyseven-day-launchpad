import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callClaudeStreaming, callGeminiStreaming, callClaude } from "../_shared/gemini-direct.ts";
import { CLAUDE_NATURALIZER_SYSTEM, SENSORY_DETAILS, MICRO_HOOKS } from "../_shared/scriptwriting-skills.ts";
import { buildFlashQualityBoost, FLASH_REFINE_MASTERCLASS } from "../_shared/flash-quality-boost.ts";
import { enforceCreditGuard } from "../_shared/credit-guard.ts";
import { fetchNicheTemplate, buildNicheInjection } from "../_shared/niche-templates.ts";
import { runSquadPipeline, SQUAD_PRESETS } from "../_shared/squad-runner.ts";

// ═══ SMART AI ROUTING — Use Claude only where it adds value ═══
// Claude excels at: emotional depth, literary polish, storytelling nuance
// Gemini Pro/Flash: factual accuracy, speed, cost-efficiency
const CLAUDE_STYLES = ['storytelling', 'terror', 'horror', 'emocionante', 'superacao', 'superação',
  'novela', 'novela_style', 'polêmica', 'polemica', 'filme_style', 'serie_style'];
const GEMINI_PRO_STYLES = ['webdocumentário', 'webdocumentario', 'documentário', 'documentario',
  'ciência', 'ciencia', 'educativo'];
// Everything else (dopaminérgico, mrbeast, listicle, curiosidades, tutorial, etc.) → Gemini Flash

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══ ANTI-AI-SLOP DETECTOR ═══
const SLOP_PATTERNS = [
  /neste vasto/gi, /mergulh(e|emos|ando)/gi, /é crucial/gi, /é importante notar/gi,
  /jornada (incrível|fascinante)/gi, /no mundo (acelerado|dinâmico)/gi,
  /desbloqueie? o potencial/gi, /sem mais delongas/gi, /apertem os cintos/gi,
  /prepare-se para ter a mente/gi, /isso vai mudar tudo/gi,
  /buckle up/gi, /let's dive in/gi, /without further ado/gi,
  /imagine (um mundo|uma realidade|que)/gi,
  /mas calma/gi, /ficou curios/gi, /quer saber mais/gi, /fique comigo/gi,
];

function countSlopScore(text: string): { score: number; matches: string[] } {
  const matches: string[] = [];
  for (const p of SLOP_PATTERNS) {
    const m = text.match(p);
    if (m) matches.push(...m.map(s => s.trim()));
  }
  const superlatives = (text.match(/(incrível|impressionante|fantástic[oa]|extraordinári[oa]|surpreendente)/gi) || []);
  if (superlatives.length > 3) matches.push(`${superlatives.length}x superlativos genéricos`);
  return { score: matches.length, matches };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ═══ AUTH CHECK ═══
    const authHeader = req.headers.get("authorization") || '';
    if (!authHeader.startsWith("Bearer ")) {
      return errResp("Unauthorized", 401);
    }
    const _authSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: _claims, error: _authErr } = await (_authSb.auth as any).getClaims(authHeader.replace("Bearer ", ""));
    if (_authErr || !_claims?.claims) {
      return errResp("Invalid or expired token", 401);
    }
    const _userId = _claims.claims.sub as string;

    // ═══ CREDIT ENFORCEMENT ═══
    const creditBlock = await enforceCreditGuard(_userId, "refine-script");
    if (creditBlock) return creditBlock;

    const reqBody = await req.json();
    const { draft_script, niche, language, duration, style, target_words, rejection_feedback, consensus_improvements, phaseId, use_squad } = reqBody;
    const channelIdForLearning: string | null = reqBody?.channel_id || reqBody?.channelId || reqBody?.channel_id_ref || null;
    const styleLC = (style || '').toLowerCase();
    const isWebDoc = ['webdocumentário', 'webdocumentario', 'documentário', 'documentario'].includes(styleLC);
    
    if (!draft_script) throw new Error("draft_script is required");

    // ═══ NICHE TEMPLATE ═══
    const nicheTemplate = await fetchNicheTemplate(niche || '', styleLC);
    const nicheTemplateBlock = buildNicheInjection(nicheTemplate);

    const runId = phaseId || crypto.randomUUID();
    const hasClaude = !!Deno.env.get("CLAUDE_API_KEY");
    console.log(`[PHASE-2 REFINE] runId=${runId} draft_length=${draft_script.length} chars ENGINE=${hasClaude ? 'CLAUDE' : 'GEMINI_FALLBACK'}`);

    // Pre-flight: detect AI slop
    const slopCheck = countSlopScore(draft_script);
    console.log(`[PHASE-2 REFINE] runId=${runId} Slop score: ${slopCheck.score}`);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get user tier early (needed for system prompt)
    const { data: tierData } = await sb.rpc("get_user_tier", { _user_id: _userId });
    const userTierRefine = (tierData || 'starter').toString().toLowerCase();
    const starterTier = userTierRefine === 'starter';

    // Fetch knowledge + past learnings in parallel
    const [ytRes, scriptRes, hookRes, structRes, rejectionsRes] = await Promise.all([
      sb.from("youtube_knowledge").select("category,title,content").order("priority", { ascending: false }).limit(5),
      sb.from("script_knowledge").select("category,title,content").order("effectiveness_score", { ascending: false }).limit(8),
      sb.from("hook_library").select("hook_text,hook_type,retention_score").order("retention_score", { ascending: false }).limit(5),
      sb.from("script_structures").select("structure_name,intro_pattern,cliffhanger_pattern,avg_retention").order("effectiveness_score", { ascending: false }).limit(3),
      sb.from("ai_learning").select("insight").eq("source", "dual_score_rejection").order("created_at", { ascending: false }).limit(10),
    ]);

    const ytKnowledge = (ytRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");
    const scriptKnowledge = (scriptRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");
    const topHooks = (hookRes.data || []).map((r: any) => `• [${r.hook_type}] "${r.hook_text}" (score: ${r.retention_score})`).join("\n");
    const structures = (structRes.data || []).map((r: any) => `• ${r.structure_name}: Intro=${r.intro_pattern?.slice(0,80)} | Cliff=${r.cliffhanger_pattern?.slice(0,80)}`).join("\n");

    // ═══ EVOLUTIONARY LEARNING LOOP: inject past lessons ═══
    let pastLessonsBlock = '';
    const rejData = rejectionsRes.data || [];
    if (rejData.length > 0) {
      const allWeaknesses: string[] = [];
      const allImprovements: string[] = [];
      for (const r of rejData) {
        try {
          const d = JSON.parse(r.insight);
          for (const w of (d.weaknesses || [])) if (!allWeaknesses.includes(w)) allWeaknesses.push(w);
          for (const i of (d.improvements || [])) if (!allImprovements.includes(i)) allImprovements.push(i);
        } catch { /* skip */ }
      }
      if (allWeaknesses.length > 0 || allImprovements.length > 0) {
        pastLessonsBlock = `\n🧠 LIÇÕES DE ${rejData.length} ROTEIROS ANTERIORES (APLIQUE OBRIGATORIAMENTE):
${allWeaknesses.length > 0 ? `Erros recorrentes a EVITAR: ${allWeaknesses.slice(0, 8).join('; ')}` : ''}
${allImprovements.length > 0 ? `Melhorias comprovadas a APLICAR: ${allImprovements.slice(0, 8).join('; ')}` : ''}
SE qualquer uma dessas fraquezas existir no texto atual, CORRIJA cirurgicamente.\n`;
      }
    }

    const tw = target_words || 2000;
    const draftWordCount = draft_script.split(/\s+/).filter(Boolean).length;
    const effectiveMinWords = Math.max(tw, Math.round(draftWordCount * 0.90));

    // Build rejection/consensus context
    const rejectionContext = rejection_feedback ? `
⚠️ TENTATIVA ANTERIOR REJEITADA:
Motivo: ${rejection_feedback.reason}
Pontos fracos: ${(rejection_feedback.weaknesses || []).join('; ')}
Melhorias exigidas: ${(rejection_feedback.improvements || []).join('; ')}
CORRIJA ESPECIFICAMENTE esses pontos.
` : '';

    const consensusContext = consensus_improvements?.length > 0 ? `
🎯 CONSENSO DAS IAs — MELHORIAS OBRIGATÓRIAS:
${consensus_improvements.map((imp: string, i: number) => `${i+1}. ${imp}`).join('\n')}
APLIQUE TODAS. PRIORIDADE MÁXIMA.
` : '';

    const slopContext = slopCheck.score > 0 ? `
🚫 ALERTA ANTI-AI-SLOP — ${slopCheck.score} PADRÕES DETECTADOS:
Padrões: ${slopCheck.matches.join(', ')}
SUBSTITUA cada ocorrência por linguagem HUMANA, ESPECÍFICA e IMPREVISÍVEL.
` : '';

    // ⭐ CHANNEL LEARNING BRIEF — proven hooks/title patterns from this channel
    let channelLearningBrief = "";
    try {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/script-learning-context`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ user_id: _userId, niche, channel_id: channelIdForLearning }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j?.has_data && j?.prompt_brief) {
          channelLearningBrief = `\n\n${j.prompt_brief}\n`;
          const topHook = j?.top_hooks?.[0]?.hook_type ?? "—";
          console.log(`[CHANNEL-LEARNING-REFINE] runId=${runId} channel=${channelIdForLearning ?? "all"} sample=${j.sample_size} top_hook="${topHook}"`);
        }
      }
    } catch (e) {
      console.warn(`[CHANNEL-LEARNING-REFINE] failed: ${(e as any)?.message}`);
    }


═══ PROTOCOLO DE LEITURA (OBRIGATÓRIO) ═══
ANTES de editar qualquer palavra, LEIA O ROTEIRO INTEIRO do início ao fim.
Entenda: personagens, enredo, arco emocional, tom do autor, clímax, resolução.
SÓ DEPOIS comece a editar.

═══ MISSÃO PRINCIPAL: HOOK DOS PRIMEIROS 30 SEGUNDOS ═══

O gancho é sua MAIOR liberdade e MAIOR responsabilidade:
- Reescreva os primeiros 30s para ser DIRETO AO PONTO, com ação imediata
- Use cold open (flashforward para momento tenso) ou declaração chocante
- Zero enrolação, zero "hoje vamos falar sobre"
- O espectador deve sentir que NÃO PODE sair
- MAS: mesmos personagens, mesmo enredo, mesma história

═══ POLIMENTO EMOCIONAL (CORPO DO ROTEIRO) ═══

1. EMOTION MAP: Cada bloco de ~45-60s deve ter emoção DIFERENTE do anterior
   (curiosidade → tensão → empatia → choque → esperança)
2. SHOW DON'T TELL: "Ele ficou com medo" → "As mãos dele começaram a tremer"
3. DETALHES SENSORIAIS: textura, cheiro, temperatura, som
4. RITMO: alterne frases curtas (3-5 palavras) com médias (10-15)
5. MAGNETISMO: criar intimidade — o espectador sente que ouve um segredo
6. DOPAMINA: revelações dosadas, cada uma maior que a anterior

═══ TÉCNICAS AVANÇADAS ═══

• HITCHCOCK: Mostre o perigo ao espectador ANTES do personagem saber
• PIXAR: Construa conforto e ENTÃO devaste
• CHEKHOV'S GUN: Detalhe plantado cedo retorna no clímax
• EMOTIONAL WHIPLASH: Mudança brusca de tom (máx 2x por roteiro)
• INNER MONOLOGUE: Narrador hesita, questiona, muda de opinião

═══ HUMANIZAÇÃO OBRIGATÓRIA ═══

O texto deve soar como HUMANO REAL, não IA. Adicione cirurgicamente:
• Hesitações: "Eu ia dizer que... não. É pior que isso."
• Autocorreção: "Na verdade, risca isso."
• Opinião pessoal forte
• Humor inesperado em momento tenso (1-2x)
• Vulnerabilidade: "Confesso que fiquei sem reação"

${SENSORY_DETAILS}

${MICRO_HOOKS}

═══ REGRAS ABSOLUTAS ═══

✅ PODE: Reescrever hook, intensificar emoções, melhorar ritmo, adicionar detalhes sensoriais
❌ PROIBIDO: Mudar história/enredo/personagens, usar linguagem de IA, adicionar VFX/SFX/tags, cortar o final
${isWebDoc ? `
═══ MODO WEBDOCUMENTÁRIO (ATIVO) ═══
Este é um WEBDOCUMENTÁRIO no estilo LEMMiNO/Kurzgesagt/JJ/Veritasium.
REGRAS ESPECIAIS:
1. PRESERVE todas as fontes, dados, citações e referências do rascunho
2. Tom INVESTIGATIVO-CIENTÍFICO — calmo, inteligente, SEM sensacionalismo
3. NÃO adicione emoção artificial — a emoção vem da REVELAÇÃO dos fatos
4. Curiosity gaps baseados em EVIDÊNCIA, não hype
5. Mantenha comparações de ESCALA (dados transformados em imagens mentais)
6. O narrador é um INVESTIGADOR curioso, não um showman
7. Transições entre temas devem ser ORGÂNICAS (conexões causais, não cortes bruscos)
8. Preserve a estrutura em camadas: fato → contexto → evidência → revelação
` : ''}

🧠 CONHECIMENTO:
${ytKnowledge.slice(0, 600)}
${scriptKnowledge.slice(0, 600)}
🎯 HOOKS TOP: ${topHooks.slice(0, 400)}
📐 ESTRUTURAS: ${structures.slice(0, 300)}
${rejectionContext}${consensusContext}${slopContext}${pastLessonsBlock}
${nicheTemplateBlock}

${starterTier ? FLASH_REFINE_MASTERCLASS : ''}
${buildFlashQualityBoost({ durationMin: parseInt(duration) || 15, style: styleLC, isStarterTier: starterTier, phase: 'refine' })}

⚠️ FORMATO: APENAS narração pura. ZERO anotações, tags, VFX, SFX, música, câmera, títulos. Valores em $.
Mínimo ${effectiveMinWords} palavras. Idioma: ${language || 'português'}.`;

    const userMessage = `ROTEIRO PARA EDITAR (${draftWordCount} palavras):

${draft_script}

MISSÃO: Hook dos primeiros 30s é prioridade #1. Corpo: edições cirúrgicas para emoção, magnetismo e ritmo.
A história é INTOCÁVEL. NÃO resuma. NÃO encurte. Mínimo ${effectiveMinWords} palavras.`;

    // ═══ SMART AI ROUTING — Choose engine based on style + tier ═══
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

    // ═══ SQUAD MODE (opt-in via use_squad=true) ═══
    // Returns full refined script as JSON instead of streaming.
    if (use_squad === true && GOOGLE_AI_API_KEY) {
      try {
        console.log(`[PHASE-2 REFINE] runId=${runId} SQUAD MODE active`);
        const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
        const squadResult = await runSquadPipeline(
          GOOGLE_AI_API_KEY,
          LOVABLE_KEY,
          SQUAD_PRESETS.refine,
          {
            draft_script,
            target_min_words: effectiveMinWords,
            niche: niche || "general",
            style: styleLC,
            language: language || "português",
          },
        );
        // Refiner output (agent index 1) is the actual refined script
        const refinedScript = squadResult.all_outputs[1]?.output || "";
        const validatorRaw = squadResult.all_outputs[2]?.output || "{}";
        let validation: any = {};
        try { validation = JSON.parse(validatorRaw); } catch { /* keep empty */ }

        return new Response(JSON.stringify({
          mode: "squad",
          refined_script: refinedScript,
          critique: squadResult.all_outputs[0]?.output || "",
          validation,
          duration_ms: squadResult.total_duration_ms,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (sqErr) {
        console.warn("[refine-script] squad mode failed, falling back to streaming:", (sqErr as Error).message);
      }
    }

    // Starter: always Gemini Flash (cost optimization — skip Claude & Pro)
    const useClaude = !starterTier && hasClaude && CLAUDE_STYLES.includes(styleLC);
    const useGeminiPro = !starterTier && GEMINI_PRO_STYLES.includes(styleLC);
    const engineLabel = useClaude ? 'CLAUDE' : useGeminiPro ? 'GEMINI_PRO' : 'GEMINI_FLASH';
    console.log(`[PHASE-2 REFINE] runId=${runId} Style="${styleLC}" Tier="${userTierRefine}" → Engine=${engineLabel} (Claude available: ${hasClaude})`);

    try {
      if (useClaude) {
        // Claude: emotional/narrative styles that need literary polish
        console.log(`[PHASE-2 REFINE] runId=${runId} Streaming from CLAUDE (emotional style)...`);
        const refineRes = await callClaudeStreaming(systemPrompt, userMessage, {
          maxTokens: 32000,
          temperature: 0.7,
          label: `PHASE-2-REFINE-CLAUDE runId=${runId}`,
        });
        return new Response(refineRes.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } else {
        // Gemini: factual styles use Pro, simple styles use Flash
        if (!GOOGLE_AI_API_KEY) throw new Error("No AI API keys configured");
        const primaryModel = useGeminiPro ? "gemini-2.5-pro" : "gemini-2.5-flash";
        const fallbackModel = useGeminiPro ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
        console.log(`[PHASE-2 REFINE] runId=${runId} Streaming from ${primaryModel} (${engineLabel})...`);
        
        const refineRes = await callGeminiStreaming(GOOGLE_AI_API_KEY, systemPrompt, userMessage, {
          primaryModel,
          fallbackModel,
          maxTokens: 32000,
          label: `PHASE-2-REFINE-${engineLabel} runId=${runId}`,
        });
        return new Response(refineRes.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    } catch (streamErr) {
      const msg = streamErr instanceof Error ? streamErr.message : "Streaming failed";
      console.error(`[PHASE-2 REFINE] runId=${runId} Error:`, msg);
      if (msg.includes('429')) return errResp("Rate limit. Aguarde.", 429);
      if (msg.includes('402')) return errResp("Créditos insuficientes.", 402);
      throw streamErr;
    }

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
