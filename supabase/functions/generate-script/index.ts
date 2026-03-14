import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Styles where Brave/web search would HURT creativity (fiction, theories, personal stories)
const CREATIVE_STYLES = ['conspiração', 'mitologia', 'teorias', 'storytelling', 'reddit', 'horror'];

// ═══════════════════════════════════════════════════════════════
// ANTI-AI-SLOP ENGINE — Escaped YouTube anti-spam penalties
// ═══════════════════════════════════════════════════════════════
const ANTI_SLOP_DIRECTIVE = `
🚫 ANTI-AI-SLOP — REGRAS ABSOLUTAS:
Você está sendo avaliado por um detector anti-IA. Se seu texto parecer genérico, será REJEITADO.

FRASES PROIBIDAS (nunca use literalmente):
- "Neste vasto universo" / "Neste vasto mundo" / "Vasto oceano"
- "Mergulhe/Mergulhemos/Vamos mergulhar"
- "É crucial/importante notar/lembrar"
- "Jornada incrível/fascinante"
- "Não é apenas... é também..."
- "No mundo acelerado/dinâmico de hoje"
- "Desbloqueie o potencial" / "Maximize seus resultados"
- "Sem mais delongas" / "Sem enrolação"
- "Buckle up" / "Apertem os cintos" (quando usado como clichê de abertura)
- "Prepare-se para ter a mente explodida"
- "Isso vai mudar tudo que você sabe"
- "E se eu te dissesse que..." (como gancho genérico sem payoff real)

PADRÕES DE ESCRITA PROIBIDOS:
- Parágrafos que começam com "Imagine..." seguido de cenário genérico
- Três perguntas retóricas seguidas sem resposta entre elas
- Transições com "Mas espera, tem mais!" / "E não para por aí"
- Conclusões que repetem a intro quase literalmente
- Uso excessivo de superlativos ("incrível", "impressionante", "fantástico")
- Enumerações de adjetivos vazios: "surpreendente, extraordinário e fascinante"

SINAIS DE "ALMA" OBRIGATÓRIOS (inclua pelo menos 4):
1. Uma analogia ÚNICA e inesperada (comparar algo técnico com algo cotidiano específico — "como quando você abre a geladeira às 3 da manhã e percebe que não tem nada")
2. Uma confissão ou imperfeição do narrador ("Eu pesquisei isso por 3 semanas e quase desisti quando...")
3. Um número ESPECÍFICO e estranho em vez de arredondado (em vez de "milhões", diga "2.347.891")
4. Uma pausa narrativa intencional — mudar o tom abruptamente por 1-2 frases
5. Referência cultural POP atual (meme, série, notícia recente) conectada ao tema
6. Um momento de "eu errei" ou "a maioria pensa errado" com dado surpreendente
7. Frase curta solitária como parágrafo: "Isso não deveria ter acontecido."
8. Uma pergunta dirigida AO espectador que exige reflexão pessoal real

VOZ DNA — CADA ESTILO TEM PERSONALIDADE:
- Dopaminérgico: Irreverente, cortante, zero cerimônia. Frases de 3-8 palavras intercaladas com explosões de informação
- Cinematográfico: Poético sem ser pretensioso. Descrições sensoriais (cheiro, textura, temperatura)
- Storytelling: Vulnerável. O narrador FALHA, DUVIDA, MUDA de opinião durante a história
- Documentário: Frio e preciso, mas com momentos de genuína perplexidade humana
- Reddit: Caótico, digressões que voltam ao ponto, humor self-deprecating
- Conspiração: Paranóico mas lúcido. Alterna fatos verificáveis com especulação rotulada
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, duration, style, niche, language, viralContext, intelligenceBriefing, videoType, phaseId } = await req.json();
    const isShort = videoType === 'short';
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ═══ ORCHESTRATION CONTRACT ═══
    // This function is PHASE 1 (Draft Generation). It receives:
    //   - topic, duration, style, niche, language (user config)
    //   - viralContext (optional viral DB context)
    //   - intelligenceBriefing (optional analyze-topic output)
    //   - phaseId (unique ID to track this generation run)
    // It outputs: SSE stream of the draft script text
    // It does NOT score, refine, or save the script.
    const runId = phaseId || crypto.randomUUID();
    console.log(`[PHASE-1 DRAFT] runId=${runId} topic="${topic}" style="${style}" duration=${duration}min`);

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const styleLC = (style || '').toLowerCase();
    const isCreativeStyle = CREATIVE_STYLES.includes(styleLC);

    // ========== Fetch ALL Knowledge + Voice Profile (parallel — 12 queries) ==========
    // Extract userId from auth header for voice profile lookup
    const authHeader = req.headers.get("authorization") || '';
    let currentUserId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      try {
        const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
        currentUserId = user?.id || null;
      } catch {}
    }

    const [
      ytRes, scriptRes, channelRes, triggersRes, formatsRes, psychPatternsRes,
      hookRes, structRes, attEngRes, attLibRes, viralTitlesRes, voiceRes, backtestRes
    ] = await Promise.all([
      sb.from("youtube_knowledge").select("category,title,content").order("priority", { ascending: false }).limit(8),
      sb.from("script_knowledge").select("category,title,content,examples").order("effectiveness_score", { ascending: false }).limit(12),
      sb.from("channel_intelligence").select("channel_name,style,viral_patterns,visual_style_notes,avg_views,growth_rate,niche")
        .eq("is_faceless", true).order("avg_views", { ascending: false }).limit(8),
      sb.from("viral_content_library").select("content_json,effectiveness_score,category")
        .in("category", ["psychology_triggers", "storytelling_structure", "retention_technique"])
        .order("effectiveness_score", { ascending: false }).limit(12),
      sb.from("viral_content_library").select("content_json,effectiveness_score").eq("category", "content_format")
        .order("effectiveness_score", { ascending: false }).limit(5),
      sb.from("audience_psychology_patterns").select("trigger_type,description,example_hooks,storytelling_pattern,retention_score")
        .order("retention_score", { ascending: false }).limit(8),
      sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
        .order("retention_score", { ascending: false }).limit(15),
      sb.from("script_structures").select("structure_name,intro_pattern,middle_pattern,cliffhanger_pattern,ending_pattern,avg_retention,niche")
        .order("effectiveness_score", { ascending: false }).limit(5),
      sb.from("attention_engineering").select("pattern_name,technique,category,retention_impact,psychological_basis,intensity_level")
        .order("retention_impact", { ascending: false }).limit(10),
      sb.from("attention_library").select("pattern_name,scene_type,example_text,retention_score,emotion,recovery_technique")
        .order("attention_score", { ascending: false }).limit(10),
      sb.from("viral_titles_db" as any).select("title,views,why_viral,title_pattern,niche")
        .order("views", { ascending: false }).limit(20),
      // Channel Voice Profile (if user has one)
      currentUserId
        ? sb.from("channel_voice_profiles").select("voice_signature,tone_keywords,style_markers")
            .eq("user_id", currentUserId).order("last_analyzed_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      // Backtesting corrections (most recent lessons)
      sb.from("ai_learning").select("insight")
        .eq("source", "backtest-scores")
        .order("created_at", { ascending: false }).limit(5),
    ]);

    // ========== Format existing knowledge ==========
    const ytKnowledge = (ytRes.data || []).map((r: any) => `[${r.category.toUpperCase()}] ${r.title}: ${r.content}`).join("\n\n");
    const scriptKnowledge = (scriptRes.data || []).map((r: any) => {
      const examples = Array.isArray(r.examples) ? r.examples.slice(0, 2).join(" | ") : "";
      return `[${r.category.toUpperCase()}] ${r.title}: ${r.content}${examples ? `\nExemplos: ${examples}` : ""}`;
    }).join("\n\n");
    const channelIntel = (channelRes.data || []).map((r: any) => {
      const hooks = r.viral_patterns?.hooks ? (r.viral_patterns.hooks as string[]).join(", ") : "";
      return `🎯 ${r.channel_name} (${r.niche}, ${r.style}, avg ${r.avg_views} views): Hooks=[${hooks}]`;
    }).join("\n");
    const psychTriggers = (triggersRes.data || []).map((r: any) => {
      const c = r.content_json;
      return `• [${r.category}] ${c.name || c.technique || c.trigger}: ${c.description || c.how_to_apply || ''} (score: ${r.effectiveness_score}/10)`;
    }).join("\n");
    const viralFormats = (formatsRes.data || []).map((r: any) => {
      const c = r.content_json;
      return `• ${c.name || c.format}: ${c.description || ''}`;
    }).join("\n");
    const psychPatterns = (psychPatternsRes.data || []).map((r: any) => {
      const hooks = Array.isArray(r.example_hooks) ? r.example_hooks.slice(0, 2).join(' | ') : '';
      return `• ${r.trigger_type}: ${r.description?.slice(0, 150)}${hooks ? ` — Hooks: ${hooks}` : ''}`;
    }).join("\n");

    const hookLibrary = (hookRes.data || []).map((r: any) =>
      `• [${r.hook_type}] "${r.hook_text}" (retenção: ${r.retention_score}/10${r.niche ? `, nicho: ${r.niche}` : ''})`
    ).join("\n");

    const scriptStructures = (structRes.data || []).map((r: any) =>
      `📐 ${r.structure_name} (retenção: ${r.avg_retention}%${r.niche ? `, ${r.niche}` : ''}):\n  Intro: ${(r.intro_pattern || '').slice(0, 120)}\n  Meio: ${(r.middle_pattern || '').slice(0, 120)}\n  Cliffhanger: ${(r.cliffhanger_pattern || '').slice(0, 120)}\n  Final: ${(r.ending_pattern || '').slice(0, 120)}`
    ).join("\n\n");

    const attEngineering = (attEngRes.data || []).map((r: any) =>
      `⚡ ${r.pattern_name} [${r.category}]: ${r.technique.slice(0, 150)} (impacto: ${r.retention_impact}%, intensidade: ${r.intensity_level}/10${r.psychological_basis ? `, base: ${r.psychological_basis.slice(0, 60)}` : ''})`
    ).join("\n");

    const attLibrary = (attLibRes.data || []).map((r: any) =>
      `🎬 ${r.pattern_name} [${r.scene_type}]: "${(r.example_text || '').slice(0, 100)}" (retenção: ${r.retention_score}, emoção: ${r.emotion}${r.recovery_technique ? `, recuperação: ${r.recovery_technique.slice(0, 60)}` : ''})`
    ).join("\n");

    const topicWords = (topic || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    const scoredTitles = (viralTitlesRes.data || []).map((t: any) => {
      let score = 0;
      const titleLC = (t.title || '').toLowerCase();
      const nicheLC = (t.niche || '').toLowerCase();
      for (const w of topicWords) {
        if (titleLC.includes(w)) score += 10;
        if (nicheLC.includes(w)) score += 5;
      }
      if (niche && nicheLC.includes(niche.toLowerCase())) score += 15;
      if (styleLC && (t.title_pattern || '').toLowerCase().includes(styleLC)) score += 5;
      return { ...t, matchScore: score };
    }).sort((a: any, b: any) => b.matchScore - a.matchScore);

    const relevantTitles = scoredTitles.slice(0, 10);
    const viralTitlesBlock = relevantTitles.length > 0
      ? relevantTitles.map((t: any) =>
        `• "${t.title}" (${(t.views || 0).toLocaleString()} views) — Padrão: ${t.title_pattern || '?'} | Viral porque: ${t.why_viral || 'N/A'}`
      ).join("\n")
      : '';

    // ========== Channel Voice Profile ==========
    let voiceInjection = '';
    const voiceData = voiceRes?.data;
    if (voiceData?.voice_signature) {
      const sig = voiceData.voice_signature as any;
      const markers = (voiceData.style_markers || []).join(', ');
      const toneKw = (voiceData.tone_keywords || []).join(', ');
      voiceInjection = `\n🎤 VOZ DO CANAL (aprendida de ${voiceData.sample_scripts_analyzed || '?'} roteiros anteriores):
Tonalidade: ${sig.tone || 'N/A'}
Ritmo: ${sig.rhythm || 'N/A'}
Humor: ${sig.humor_style || 'N/A'}
Narrativa: ${sig.narrative_preference || 'N/A'}
Relação com audiência: ${sig.audience_relationship || 'N/A'}
Marcadores: ${markers || 'N/A'}
Keywords de tom: ${toneKw || 'N/A'}
${sig.voice_prompt_injection ? `\nINSTRUÇÃO DE VOZ: ${sig.voice_prompt_injection}` : ''}
IMPORTANTE: Use esta voz como BASE. O roteiro deve soar como ESTE criador específico, não como um roteirista genérico.\n`;
    }

    // ========== Backtesting Corrections ==========
    let backtestBlock = '';
    const btData = backtestRes?.data || [];
    if (btData.length > 0) {
      const corrections = btData.map((b: any) => {
        try { const p = JSON.parse(b.insight); return p.correction; } catch { return null; }
      }).filter(Boolean).slice(0, 3);
      if (corrections.length > 0) {
        backtestBlock = `\n📊 CORREÇÕES DO BACKTESTING (baseado em resultados REAIS de vídeos anteriores):
${corrections.map((c: string) => `• ${c}`).join('\n')}
Use estas correções para calibrar suas previsões e evitar os mesmos erros.\n`;
      }
    }

    // ========== Speech rate ==========
    const speechRates: Record<string, number> = {
      'português': 150, 'inglês': 160, 'english': 160, 'espanhol': 155,
      'alemão': 140, 'polonês': 145, 'turco': 150, 'japonês': 130,
      'francês': 155, 'italiano': 155, 'tcheco': 145, 'holandês': 150,
      'coreano': 135, 'hindi': 145, 'árabe': 140, 'indonésio': 150,
    };
    const wpm = speechRates[language?.toLowerCase()] || 150;
    const dur = parseInt(duration) || 15;
    const targetWords = dur * wpm;
    const minWords = Math.round(targetWords * 0.85);

    // ========== Style guides ==========
    const styleGuides: Record<string, string> = {
      'dopaminérgico': 'DOPAMINÉRGICO: Open loops a cada 30s, pattern interrupts, "E aqui é onde tudo muda...", contagem regressiva, comparações viscerais.',
      'cinematográfico': 'CINEMATOGRÁFICO: Cena visual vívida, show dont tell, tensão como Nolan, transições cinematográficas, clímax emocional.',
      'mrbeast': 'MRBEAST: Hook IMPOSSÍVEL em 5s, desafio a cada 30s, linguagem simples, contagem/ranking, urgência e reações exageradas.',
      'narração': 'NARRAÇÃO: Voz profunda e hipnótica, frases curtas e impactantes, ritmo tensão→alívio→tensão, suspense narrativo.',
      'storytelling': 'STORYTELLING: In medias res, personagens com nome/motivação/conflito, arco setup→conflito→escalada→clímax→resolução, plot twists.',
      'educativo': 'EDUCATIVO: Destruir mitos com fatos, analogias do dia-a-dia, "A maioria pensa X mas...", mini-quizzes.',
      'tutorial': 'TUTORIAL: Resultado final PRIMEIRO, passos numerados, "O erro #1 que 90% cometem..."',
      'documentário': 'DOCUMENTÁRIO: Dados impactantes, múltiplas perspectivas, revelações progressivas.',
      'listicle': 'LISTICLE: Preview do #1, escalada de impacto, "Mas o número X vai te deixar de queixo caído".',
      'reddit': 'REDDIT: Tom 1ª pessoa, "Eu nunca contei isso...", detalhes sensoriais, plot twists, escalada de tensão. NÃO use fatos reais — crie uma narrativa envolvente.',
      'conspiração': 'CONSPIRAÇÃO: Fato oficial → inconsistências → evidências alternativas → contra-argumentos → "Tire suas conclusões". Pode misturar fatos reais com teorias alternativas. Tom investigador e misterioso.',
      'mitologia': 'MITOLOGIA: Tom épico, personagens míticos com motivações humanas, batalhas cinematográficas, conexões mito→moderno. Use LENDAS e MITOS como base, não fatos científicos.',
      'teorias': 'TEORIAS: Dado real impressionante + pergunta, ciência + mistério, múltiplas teorias, tom investigador. Explore hipóteses e mistérios sem necessidade de provas definitivas.',
    };
    const selectedStyle = styleGuides[styleLC] || styleGuides['narração'];

    const viralInjection = viralContext ? `\n🔥 ELEMENTOS VIRAIS:\n${viralContext}\n` : '';

    // Intelligence briefing
    let intelBlock = '';
    if (intelligenceBriefing) {
      const ib = intelligenceBriefing;
      const ca = ib.competitive_analysis || {};
      const hooks = (ib.recommended_hooks || []).slice(0, 3).map((h: any) => `"${h.hook_text}" (${h.hook_type})`).join(', ');
      intelBlock = `\n🧠 BRIEFING: ${ca.top_channels_analyzed || '?'} canais analisados. Dominantes: ${(ca.dominant_styles || []).join(', ')}. Hooks: ${hooks}. Evitar: ${(ca.what_to_avoid || []).join('; ')}. Gaps: ${(ca.content_gaps || []).join('; ')}.\n`;

      const ytAnalysis = ib.youtube_real_time_analysis;
      if (ytAnalysis) {
        intelBlock += `\n📹 ANÁLISE DE COMPETIDORES YOUTUBE:\n`;
        intelBlock += `• ${ytAnalysis.videos_found || 0} vídeos encontrados sobre este tópico\n`;
        if (ytAnalysis.top_performing_video) intelBlock += `• Top vídeo: "${ytAnalysis.top_performing_video}"\n`;
        if (ytAnalysis.why_top_videos_work?.length) intelBlock += `• Por que funcionam: ${ytAnalysis.why_top_videos_work.join('; ')}\n`;
        if (ytAnalysis.successful_angles?.length) intelBlock += `• Ângulos de sucesso: ${ytAnalysis.successful_angles.join('; ')}\n`;
        if (ytAnalysis.underexplored_angles?.length) intelBlock += `• Ângulos POUCO explorados (oportunidade): ${ytAnalysis.underexplored_angles.join('; ')}\n`;
        intelBlock += `INSTRUÇÃO: Use os ângulos POUCO explorados para se diferenciar. Aprenda com o que funciona nos top vídeos mas NÃO copie.\n`;
      }
    }

    const creativeWarning = isCreativeStyle ? `
⚠️ ATENÇÃO ESPECIAL — ESTILO CRIATIVO "${style?.toUpperCase()}":
Este é um estilo NARRATIVO/CRIATIVO. Você tem LIBERDADE para:
- Criar histórias, teorias e narrativas envolventes
- Usar dramatização, suspense e mistério
- Misturar fatos reais com especulação criativa
- NÃO precisa ser 100% factual — o objetivo é ENTRETER e FASCINAR
- Os dados de pesquisa web são REFERÊNCIA, não restrição
- Priorize NARRATIVA MAGNÉTICA sobre precisão factual
` : '';

    // ═══════════════════════════════════════════════════════
    // PHASE 0: Hook Generation (non-streaming, fast model)
    // CONTRACT: Receives topic+style+language → Returns 60s hook text
    // OUTPUT: Pure narration text, no metadata, no instructions
    // ═══════════════════════════════════════════════════════
    console.log(`[PHASE-0 HOOK] runId=${runId} Starting hook generation...`);
    let hookText = '';
    try {
      const hookSystemPrompt = `Crie os primeiros 60 segundos de narração IMPOSSÍVEIS DE IGNORAR para YouTube. Idioma: ${language}. Estilo: ${style}.

🎯 HOOKS DE REFERÊNCIA REAIS (use como inspiração, NÃO copie):
${hookLibrary.slice(0, 1500)}

🧠 GATILHOS PSICOLÓGICOS:
${psychTriggers.slice(0, 800)}

${viralInjection}${intelBlock}${creativeWarning}

${ANTI_SLOP_DIRECTIVE}

REGRAS: Hook devastador (5-8s) + 3 OPEN LOOPS. APENAS texto falado. Valores em $. ZERO anotações.
Seu texto deve soar como um HUMANO apaixonado pelo assunto, não como uma IA escrevendo sobre ele.`;

      const hookRes2 = await fetch(AI_URL, {
        method: "POST", headers: aiHeaders,
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: hookSystemPrompt },
            { role: "user", content: `Hook + Open Loops para vídeo de ${duration}min sobre: "${topic}"\nRetorne APENAS texto de narração.` }
          ],
          stream: false,
        }),
      });
      if (hookRes2.ok) {
        const d = await hookRes2.json();
        hookText = d.choices?.[0]?.message?.content || '';
        console.log(`[PHASE-0 HOOK] runId=${runId} Done: ${hookText.length} chars`);
      }
    } catch (e) { console.warn(`[PHASE-0 HOOK] runId=${runId} Error:`, e); }

    // ═══════════════════════════════════════════════════════
    // PHASE 1: Full Draft Generation (streaming, Gemini Flash)
    // CONTRACT: Receives all knowledge + Phase 0 hook → Streams full script
    // INPUT: Phase 0 hook is INJECTED as opening, not as instruction
    // OUTPUT: Pure narration + ---EXTRAS--- + ---SCENE_BLUEPRINT---
    // The draft is RAW and will be refined in Phase 2 (refine-script)
    // This function does NOT call Phase 2 or Phase 3.
    // ═══════════════════════════════════════════════════════
    const hookInjection = hookText ? `\n🎯 HOOK PRÉ-GERADO (USE COMO BASE dos primeiros 60s — você pode melhorar mas NÃO descarte):\n${hookText}\n` : '';

    const systemPrompt = `Você é o MELHOR ROTEIRISTA DO MUNDO para YouTube. 95%+ retenção.

═══ SEU PAPEL NESTA FASE ═══
Você é o FASE 1: RASCUNHISTA. Seu trabalho é criar o rascunho completo do roteiro.
- NÃO avalie o roteiro (isso é trabalho do FASE 3)
- NÃO refine cirurgicamente (isso é trabalho do FASE 2)
- FOQUE em criar narrativa com ALMA e estrutura sólida
- O usuário vai editar seu texto antes de passar para a próxima fase

🧠 CONHECIMENTO YOUTUBE (algoritmo):
${ytKnowledge.slice(0, 2500)}

📡 CANAIS VIRAIS DE REFERÊNCIA:
${channelIntel || "N/A"}

🎯 HOOKS REAIS DE ALTA PERFORMANCE (192 hooks testados):
${hookLibrary.slice(0, 2000)}

📐 ESTRUTURAS DE ROTEIRO VALIDADAS:
${scriptStructures.slice(0, 2000)}

⚡ ENGENHARIA DE ATENÇÃO (técnicas de retenção avançadas):
${attEngineering.slice(0, 1500)}

🎬 BIBLIOTECA DE ATENÇÃO (cenas que retêm):
${attLibrary.slice(0, 1200)}

🧠 GATILHOS PSICOLÓGICOS:
${psychTriggers.slice(0, 1500)}

🎬 FORMATOS VIRAIS:
${viralFormats.slice(0, 1000)}

📝 TÉCNICAS DE ROTEIRO:
${scriptKnowledge.slice(0, 2500)}

🧪 PSICOLOGIA DA AUDIÊNCIA:
${psychPatterns.slice(0, 1200)}

${viralTitlesBlock ? `\n🏆 TÍTULOS VIRAIS SIMILARES (945 títulos, top 10 relevantes):\n${viralTitlesBlock}\n` : ''}

${selectedStyle}
${viralInjection}
${intelBlock}
${hookInjection}
${creativeWarning}
${voiceInjection}
${backtestBlock}

${ANTI_SLOP_DIRECTIVE}

Nicho: ${niche || 'geral'} | Idioma: ${language || 'português'} | Formato: ${isShort ? 'SHORT (vertical 9:16)' : 'LONGFORM (16:9)'}

${isShort ? `
✍️ FORMATO SHORT (15-60 segundos):
- Duração: ${dur} minutos (=${Math.round(dur * 60)}s). Taxa: ${wpm} palavras/min. ALVO: ${targetWords} palavras.
- Hook DEVASTADOR nos primeiros 2 segundos — texto na tela + voz
- UMA ideia central, ZERO enrolação
- Ritmo RÁPIDO, frases curtíssimas (máx 8 palavras)
- CTA direto: "Segue pra mais" / "Salva esse vídeo"
- NÃO inclua seção EXTRAS (títulos, tags, thumbnails)
- NÃO inclua SCENE_BLUEPRINT
- Linguagem ULTRA coloquial e dinâmica
` : `
✍️ DURAÇÃO: EXATAMENTE ${dur} minutos. Taxa: ${wpm} palavras/min. MÍNIMO: ${minWords} palavras. ALVO: ${targetWords} palavras.

REGRAS:
1. ESCREVA CADA PALAVRA. ZERO placeholders
2. APENAS texto falado. ZERO anotações, timestamps, "Narrador:", "Cena:"
3. Parágrafos curtos (2-3 frases). Linguagem conversacional. Valores em $
4. Hook EXPLOSIVO [0-8s] → Setup + Loops [8s-60s] → Microhooks a cada 45s → Escalada → Clímax → CTA
5. USE as estruturas de roteiro validadas acima como esqueleto
6. APLIQUE as técnicas de engenharia de atenção nos momentos certos
7. INSPIRE-SE nos hooks reais de alta performance

📝 NO FINAL, após "---EXTRAS---":
- 5 títulos CTR 30%+
- 5 ideias thumbnail
- 15-20 tags SEO
- Descrição otimizada

Após EXTRAS, adicione ---SCENE_BLUEPRINT--- com JSON array de blocos (~30-45s cada):
[{"block":1,"narrative_summary":"...","mood":"tense","visual_hint":"...","camera_suggestion":"...","characters_present":[]}]
---END_SCENE_BLUEPRINT---

⚠️ DEVE ter ${targetWords}+ palavras para ${dur} minutos COMPLETOS.
`}

═══ LEMBRETE FINAL: ALMA DO ROTEIRO ═══
O YouTube detecta e penaliza conteúdo genérico com baixo "Valued Watch Time".
Seu roteiro deve fazer o espectador SENTIR algo — raiva, espanto, riso, medo, curiosidade genuína.
Se ao ler seu texto você sente que "qualquer IA escreveria isso", REESCREVA.
O teste é simples: uma pessoa real pausaria o que está fazendo para ouvir isso?`;

    console.log(`[PHASE-1 DRAFT] runId=${runId} Streaming from Gemini Flash with FULL knowledge...`);
    const phase1Res = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: isShort
            ? `Escreva um SHORT VIRAL de ${Math.round(dur * 60)}s sobre: "${topic}"\nAlvo: ${targetWords} palavras. Hook de CHOQUE em 2s. Ritmo frenético. ROTEIRO LIMPO.\nComece!`
            : `Escreva roteiro MAGNÉTICO de ${duration}min sobre: "${topic}"\nMínimo ${targetWords} palavras. Hook de CHOQUE. Pattern interrupts a cada 45s. Escalada emocional. ROTEIRO LIMPO.${hookText ? ' USE O HOOK PRÉ-GERADO.' : ''}\nComece!`
          }
        ],
        stream: true,
      }),
    });

    if (!phase1Res.ok) {
      if (phase1Res.status === 429) return errResp("Rate limit. Tente novamente.", 429);
      if (phase1Res.status === 402) return errResp("Créditos insuficientes.", 402);
      const t = await phase1Res.text();
      console.error(`[PHASE-1 DRAFT] runId=${runId} Error:`, phase1Res.status, t);
      throw new Error("Script generation failed");
    }

    console.log(`[PHASE-1 DRAFT] runId=${runId} Streaming to client...`);
    return new Response(phase1Res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("generate-script error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
