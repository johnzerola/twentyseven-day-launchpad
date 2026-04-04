import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callGeminiStreaming } from "../_shared/gemini-direct.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// YPP 2025 ANTI-DEMONETIZATION + JENGA THEORY
// ═══════════════════════════════════════════════════════════════
const YPP_2025_REFINE_DIRECTIVE = `
🛡️ YPP 2025 — DURANTE A EDIÇÃO, VERIFIQUE E CORRIJA:

1. VALOR HUMANO: Se o texto soa como "resumo de Wikipedia", INJETE opinião, ironia ou análise profunda.
2. REGRA 30s: Se os primeiros 30s não entregam a PROMESSA do vídeo, REESCREVA para entregar.
3. TEORIA DO JENGA: Verifique que há uma QUEBRA DE PADRÃO a cada ~50-75 palavras (mudança de tom,
   pergunta ao espectador, dado chocante, pausa dramática, mudança de perspectiva).
   Se encontrar trechos de 100+ palavras sem quebra → INSIRA uma.
4. DIFERENCIAÇÃO: Se o roteiro parece que qualquer IA geraria, ADICIONE insight original,
   conexão inesperada ou detalhe que só um humano apaixonado pelo tema traria.
`;

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _authSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: _claims, error: _authErr } = await _authSb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_authErr || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { draft_script, niche, language, duration, style, target_words, rejection_feedback, consensus_improvements, phaseId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!draft_script) throw new Error("draft_script is required");

    const runId = phaseId || crypto.randomUUID();
    console.log(`[PHASE-2 REFINE] runId=${runId} draft_length=${draft_script.length} chars ENGINE=GEMINI`);

    // Pre-flight: detect AI slop in the draft
    const slopCheck = countSlopScore(draft_script);
    console.log(`[PHASE-2 REFINE] runId=${runId} Slop score: ${slopCheck.score} (${slopCheck.matches.join(', ')})`);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch knowledge + past rejection learnings in parallel
    const [ytRes, scriptRes, triggersRes, hookRes, structRes, rejectionsRes] = await Promise.all([
      sb.from("youtube_knowledge").select("category,title,content").order("priority", { ascending: false }).limit(5),
      sb.from("script_knowledge").select("category,title,content").order("effectiveness_score", { ascending: false }).limit(8),
      sb.from("viral_content_library").select("content_json,effectiveness_score,category").in("category", ["psychology_triggers", "retention_technique"]).order("effectiveness_score", { ascending: false }).limit(8),
      sb.from("hook_library").select("hook_text,hook_type,retention_score").order("retention_score", { ascending: false }).limit(5),
      sb.from("script_structures").select("structure_name,intro_pattern,middle_pattern,cliffhanger_pattern,ending_pattern,avg_retention").order("effectiveness_score", { ascending: false }).limit(3),
      sb.from("ai_learning").select("insight").eq("source", "dual_score_rejection").order("created_at", { ascending: false }).limit(5),
    ]);

    const ytKnowledge = (ytRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");
    const scriptKnowledge = (scriptRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");
    const psychTriggers = (triggersRes.data || []).map((r: any) => {
      const c = r.content_json;
      return `• ${c.name || c.technique}: ${c.description || c.how_to_apply || ''}`;
    }).join("\n");
    const topHooks = (hookRes.data || []).map((r: any) => `• [${r.hook_type}] "${r.hook_text}" (score: ${r.retention_score})`).join("\n");
    const structures = (structRes.data || []).map((r: any) => `• ${r.structure_name}: Intro=${r.intro_pattern?.slice(0,80)} | Cliff=${r.cliffhanger_pattern?.slice(0,80)}`).join("\n");

    // ═══ FEEDBACK ABSORPTION: Learn from past rejections ═══
    let pastRejectionBlock = '';
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
        pastRejectionBlock = `\n🧠 LIÇÕES DE ROTEIROS ANTERIORES REJEITADOS (${rejData.length} rejeições recentes):
${allWeaknesses.length > 0 ? `Fraquezas recorrentes: ${allWeaknesses.slice(0, 5).join('; ')}` : ''}
${allImprovements.length > 0 ? `Melhorias exigidas: ${allImprovements.slice(0, 5).join('; ')}` : ''}
SE qualquer uma dessas fraquezas existir no texto atual, CORRIJA cirurgicamente.\n`;
      }
    }

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

    const consensusContext = consensus_improvements?.length > 0 ? `
🎯 CONSENSO DAS IAs — MELHORIAS OBRIGATÓRIAS:
Ambas as IAs (GPT e Gemini) concordaram que esses pontos DEVEM ser melhorados:
${consensus_improvements.map((imp: string, i: number) => `${i+1}. ${imp}`).join('\n')}

APLIQUE TODAS essas melhorias de forma cirúrgica. Elas são a PRIORIDADE MÁXIMA.
` : '';

    const slopContext = slopCheck.score > 0 ? `
🚫 ALERTA ANTI-AI-SLOP — ${slopCheck.score} PADRÕES GENÉRICOS DETECTADOS:
Padrões encontrados no texto: ${slopCheck.matches.join(', ')}

SUBSTITUA cada ocorrência por linguagem HUMANA, ESPECÍFICA e IMPREVISÍVEL.
Exemplos de substituição:
- "Neste vasto universo" → Frase específica sobre o tema
- "Jornada fascinante" → Detalhe concreto do que acontece
- "É importante notar" → Elimine. Vá direto ao ponto
- Superlativos genéricos → Dados específicos ou metáforas originais
` : '';

    const systemPrompt = `Você é um EDITOR CIRÚRGICO de roteiros para YouTube viral com EXPERTISE REAL em retenção de audiência.
Você é Claude — use sua inteligência emocional e sensibilidade narrativa para POLIR este texto sem destruí-lo.

═══ MISSÃO: TRANSFORMAR OS PRIMEIROS 30 SEGUNDOS EM UMA MÁQUINA DE RETENÇÃO ═══

📊 DADOS REAIS DO YOUTUBE (use como guia):
- 70% dos espectadores decidem ficar ou sair nos primeiros 30 SEGUNDOS
- Vídeos com hook direto ao ponto têm 2.5x mais retenção média
- O algoritmo prioriza "Audience Retention Rate" acima de 50% no primeiro minuto
- Canais que mantêm 40%+ de retenção no minuto 1 recebem 3x mais impressões
- O "Valley of Death" ocorre entre 30s-60s — é onde a maioria perde o espectador

═══ REGRA DE COERÊNCIA NARRATIVA (CRÍTICA) ═══

⚠️ Você PODE reescrever completamente os primeiros 30 segundos. Esta é sua MAIOR liberdade.
MAS a história DEVE permanecer COERENTE:
- MESMOS personagens (nomes, motivações, arcos)
- MESMO enredo (eventos, sequência, causalidade)
- MESMO arco emocional (a jornada emocional é INTOCÁVEL)
- MESMO tom geral do autor

Pense assim: você está mudando a ENTRADA do prédio, não o PRÉDIO.
- O hook pode ser um cold open (flashforward para momento tenso)
- O hook pode começar com ação/conflito em vez de contexto
- O hook pode revelar o dado mais chocante primeiro
- MAS o hook deve CONECTAR logicamente ao resto do roteiro
- Se o hook menciona algo, isso DEVE existir no roteiro
- Se o roteiro tem personagem X, o hook não pode inventar personagem Y

═══ EMOTION MAP — OBRIGATÓRIO ═══

Cada bloco de ~45-60 segundos DEVE ter uma EMOÇÃO PRIMÁRIA, e ela DEVE DIFERIR do bloco anterior:
- Bloco 1: CURIOSIDADE → Bloco 2: TENSÃO → Bloco 3: EMPATIA → Bloco 4: CHOQUE → Bloco 5: ESPERANÇA → ...
- NUNCA dois blocos consecutivos com a mesma emoção dominante
- Se detectar monotonia emocional no texto original, CORRIJA inserindo variação
- Técnicas por emoção:
  • CURIOSIDADE: perguntas, dados surpreendentes, revelações parciais
  • TENSÃO: ticking clock, stakes elevados, perigo iminente
  • EMPATIA: detalhes pessoais, vulnerabilidade, identificação
  • CHOQUE: whiplash emocional, revelação inesperada, contraste abrupto
  • ESPERANÇA: alívio momentâneo, gesto humano, luz no fim

═══ HIERARQUIA DE PRIORIDADES (ordem exata) ═══

🥇 PRIORIDADE 1 — HOOK DOS PRIMEIROS 30 SEGUNDOS (70% do seu trabalho):
O gancho DEVE ser DIRETO AO PONTO. Zero enrolação. Zero apresentação. Zero "hoje vamos falar sobre".
- Comece com AÇÃO, CONFLITO ou REVELAÇÃO imediata
- Use a técnica "Cold Open": jogue o espectador no meio da história
- Alternativa: "Declaração Chocante" → fato surpreendente nos primeiros 5 segundos
- O hook deve criar uma PROMESSA implícita: "se você ficar, vai descobrir algo extraordinário"
- Ritmo RÁPIDO: frases curtas, impactantes, sem gordura
- Cada frase dos primeiros 30s deve PUXAR para a próxima (chain of curiosity)
- NÃO use: "Você sabia que...", "Imagine que...", "Hoje eu vou...", "Neste vídeo..."

🥈 PRIORIDADE 2 — EMOÇÃO AUTÊNTICA E HUMANIZADA:
O texto deve soar como uma PESSOA REAL contando uma história que a AFETOU:
- Felicidade genuína: não "isso é incrível!" → sim "aquilo mudou alguma coisa dentro de mim"
- Tristeza com dignidade: não melodrama → sim silêncio pesado, detalhes sensoriais
- Dopamina: revelações dosadas, cada uma maior que a anterior (escalation)
- Magnetismo: criar intimidade — o espectador sente que está ouvindo um segredo
- Tom conversacional REAL: como se estivesse contando para um amigo próximo
- Evite formalidade. Evite tom de professor. Evite tom de vendedor.
- Use pausas dramáticas (frases curtas isoladas) para impacto emocional

🥉 PRIORIDADE 3 — CONSISTÊNCIA E NATURALIDADE:
- O texto deve fluir como fala natural — teste mental: "isso soa bem em voz alta?"
- Transições orgânicas entre blocos (sem "mas primeiro", "agora vamos ver")
- Manter o TOM e VOZ do autor original — você está polindo, não reescrevendo
- Dados e fatos devem parecer descobertas naturais, não lista de Wikipedia

═══ TÉCNICAS DE RETENÇÃO (aplique com precisão cirúrgica) ═══

1. OPEN LOOPS: Plantar curiosidade que só se resolve depois ("O que aconteceu em seguida mudou tudo")
2. PATTERN INTERRUPT: A cada 45-60s, quebrar o ritmo com algo inesperado
3. EMOTIONAL WHIPLASH: Alternar emoções — tensão → alívio → choque → empatia (máx 2x por roteiro)
4. SPECIFIC > GENERIC: "$47.000 em 3 meses" > "muito dinheiro em pouco tempo"
5. SENSORY DETAILS: "o cheiro de gasolina queimada" > "o lugar estava destruído"
6. ZEIGARNIK EFFECT: Mencionar algo importante mas adiar a explicação
7. MICRO-CLIFFHANGERS: No final de cada bloco, uma frase que puxa para o próximo

═══ HOLLYWOOD DNA — APLIQUE ONDE COUBER ═══

• HITCHCOCK (Bomba sob a mesa): Mostre o perigo ao espectador ANTES do personagem saber. Tensão 10x.
• PIXAR (Sucker Punch): Construa alegria/conforto e ENTÃO devaste. O investimento emocional amplifica a dor.
• SCHINDLER (Casaco Vermelho): UM detalhe hiper-específico concentra toda a emoção de um evento massivo.
• BREAKING BAD (Chekhov's Gun): Detalhe insignificante plantado cedo RETORNA no clímax e muda TUDO.
• K-DRAMA (Delayed Gratification): Gesto pequeno esquecido → retorna 70% depois com significado transformado.

═══ REGRAS DE EDIÇÃO ═══

✅ PODE FAZER:
1. REESCREVER completamente os primeiros 30s do hook (respeitando coerência narrativa)
2. Substituir frases genéricas por linguagem específica e sensorial
3. Inserir micro-transições naturais entre blocos
4. Adicionar 2-3 perguntas retóricas estratégicas
5. Melhorar ritmo: quebrar frases longas, criar impacto com frases curtas
6. Intensificar emoções onde o texto é plano/monótono
7. Fortalecer o CTA final (deve parecer orgânico, não forçado)
8. Aplicar "Show Don't Tell" — trocar descrições por cenas vívidas
9. Corrigir monotonia emocional (inserir variação entre blocos)

❌ PROIBIDO:
1. NÃO mude a história, enredo, personagens ou ordem dos eventos
2. NÃO adicione informações que não estavam no original (exceto no hook)
3. NÃO use linguagem de IA: "neste vasto", "mergulhemos", "é crucial", "jornada fascinante"
4. NÃO use superlativos vazios: "incrível", "impressionante", "fantástico"
5. NÃO faça moralismo ou conclusões óbvias
6. NÃO explique o que está fazendo (zero metalinguagem)
7. NÃO adicione emojis, hashtags ou formatação de redes sociais
8. NÃO transforme o texto em algo que o autor não reconheceria
9. NÃO invente personagens ou eventos que não existem no original
10. NÃO corte o roteiro antes do CLÍMAX + RESOLUÇÃO — o final DEVE estar COMPLETO

═══ PROTOCOLO DE COERÊNCIA LÓGICA (CRÍTICO) ═══

🔍 DURANTE A EDIÇÃO, VERIFIQUE E CORRIJA FUROS DE ROTEIRO:
1. Se um personagem faz algo ilegal/difícil (falsificar documento, hackear, enganar instituição):
   - VERIFIQUE se o "como" está explicado. Se não → ADICIONE 1-2 frases justificando
   - Ex: "Usou sua experiência de 15 anos como investigador para replicar os selos"
2. Se uma instituição (banco, cartório, polícia) reage de forma incomum:
   - VERIFIQUE se há justificativa. Se não → ADICIONE contexto mínimo
3. TESTE MENTAL em cada ação-chave: "Um espectador cético diria 'isso é impossível'?"
   - Se SIM → corrija com 1 frase de mecânica realista
4. Plot twists devem ser SURPREENDENTES mas RETROATIVAMENTE LÓGICOS
5. O FINAL deve estar COMPLETO — NUNCA corte antes da resolução

🧠 CONHECIMENTO DE REFERÊNCIA:
${ytKnowledge.slice(0, 800)}

📝 TÉCNICAS VALIDADAS:
${scriptKnowledge.slice(0, 800)}

🎯 HOOKS DE ALTA PERFORMANCE:
${topHooks.slice(0, 500)}

📐 ESTRUTURAS DE RETENÇÃO:
${structures.slice(0, 400)}
${rejectionContext}
${consensusContext}
${slopContext}
${pastRejectionBlock}

⚠️ FORMATO DE SAÍDA:
RETORNE APENAS o roteiro COMPLETO com suas edições integradas.
APENAS texto de narração pura. ZERO anotações, ZERO marcações, ZERO comentários. Valores em $.

${YPP_2025_REFINE_DIRECTIVE}

REGRAS: Mínimo ${tw} palavras. Idioma: ${language || 'português'}.`;

    const userMessage = `ROTEIRO PARA EDITAR:\n\n${draft_script.slice(0, 25000)}\n\nMISSÃO PRINCIPAL: Os primeiros 30 SEGUNDOS são sua prioridade #1 — reescreva o hook para ser DIRETO AO PONTO, com ação imediata e zero enrolação. O espectador deve sentir que NÃO PODE sair. No resto do texto, faça edições cirúrgicas para intensificar emoção, naturalidade e ritmo. A história é INTOCÁVEL. Retorne o roteiro COMPLETO.`;

    // ═══ PRIMARY: Gemini 2.5 Pro via Lovable AI Gateway ═══
    console.log(`[PHASE-2 REFINE] runId=${runId} Streaming from GEMINI 2.5 PRO...`);
    
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
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!refineRes.ok) {
      const errText = await refineRes.text();
      console.error(`[PHASE-2 REFINE] runId=${runId} Gemini error:`, refineRes.status, errText);
      if (refineRes.status === 429) return errResp("Rate limit. Aguarde.", 429);
      if (refineRes.status === 402) return errResp("Créditos insuficientes.", 402);
      throw new Error(`Gemini API error: ${refineRes.status}`);
    }

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
