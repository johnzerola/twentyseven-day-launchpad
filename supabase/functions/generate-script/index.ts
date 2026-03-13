import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Styles where Brave/web search would HURT creativity (fiction, theories, personal stories)
const CREATIVE_STYLES = ['conspiração', 'mitologia', 'teorias', 'storytelling', 'reddit', 'horror'];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, duration, style, niche, language, viralContext, intelligenceBriefing } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const styleLC = (style || '').toLowerCase();
    const isCreativeStyle = CREATIVE_STYLES.includes(styleLC);

    // ========== Fetch ALL Knowledge (parallel — 10 queries) ==========
    const [
      ytRes, scriptRes, channelRes, triggersRes, formatsRes, psychPatternsRes,
      hookRes, structRes, attEngRes, attLibRes, viralTitlesRes
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
      // NEW: hook_library
      sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
        .order("retention_score", { ascending: false }).limit(15),
      // NEW: script_structures
      sb.from("script_structures").select("structure_name,intro_pattern,middle_pattern,cliffhanger_pattern,ending_pattern,avg_retention,niche")
        .order("effectiveness_score", { ascending: false }).limit(5),
      // NEW: attention_engineering
      sb.from("attention_engineering").select("pattern_name,technique,category,retention_impact,psychological_basis,intensity_level")
        .order("retention_impact", { ascending: false }).limit(10),
      // NEW: attention_library
      sb.from("attention_library").select("pattern_name,scene_type,example_text,retention_score,emotion,recovery_technique")
        .order("attention_score", { ascending: false }).limit(10),
      // NEW: viral_titles_db — find similar topic titles
      sb.from("viral_titles_db" as any).select("title,views,why_viral,title_pattern,niche")
        .order("views", { ascending: false }).limit(20),
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

    // ========== NEW: Format hook_library ==========
    const hookLibrary = (hookRes.data || []).map((r: any) =>
      `• [${r.hook_type}] "${r.hook_text}" (retenção: ${r.retention_score}/10${r.niche ? `, nicho: ${r.niche}` : ''})`
    ).join("\n");

    // ========== NEW: Format script_structures ==========
    const scriptStructures = (structRes.data || []).map((r: any) =>
      `📐 ${r.structure_name} (retenção: ${r.avg_retention}%${r.niche ? `, ${r.niche}` : ''}):\n  Intro: ${(r.intro_pattern || '').slice(0, 120)}\n  Meio: ${(r.middle_pattern || '').slice(0, 120)}\n  Cliffhanger: ${(r.cliffhanger_pattern || '').slice(0, 120)}\n  Final: ${(r.ending_pattern || '').slice(0, 120)}`
    ).join("\n\n");

    // ========== NEW: Format attention_engineering ==========
    const attEngineering = (attEngRes.data || []).map((r: any) =>
      `⚡ ${r.pattern_name} [${r.category}]: ${r.technique.slice(0, 150)} (impacto: ${r.retention_impact}%, intensidade: ${r.intensity_level}/10${r.psychological_basis ? `, base: ${r.psychological_basis.slice(0, 60)}` : ''})`
    ).join("\n");

    // ========== NEW: Format attention_library ==========
    const attLibrary = (attLibRes.data || []).map((r: any) =>
      `🎬 ${r.pattern_name} [${r.scene_type}]: "${(r.example_text || '').slice(0, 100)}" (retenção: ${r.retention_score}, emoção: ${r.emotion}${r.recovery_technique ? `, recuperação: ${r.recovery_technique.slice(0, 60)}` : ''})`
    ).join("\n");

    // ========== NEW: Format viral_titles for topic-matching ==========
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

      // Add YouTube competitor analysis
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

    // Creative style warning
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

    // ========== PHASE 0: GPT-5 Hook (fast, non-streaming) ==========
    console.log("Phase 0: Hook generation with full knowledge...");
    let hookText = '';
    try {
      const hookSystemPrompt = `Crie os primeiros 60 segundos de narração IMPOSSÍVEIS DE IGNORAR para YouTube. Idioma: ${language}. Estilo: ${style}.

🎯 HOOKS DE REFERÊNCIA REAIS (use como inspiração):
${hookLibrary.slice(0, 1500)}

🧠 GATILHOS PSICOLÓGICOS:
${psychTriggers.slice(0, 800)}

${viralInjection}${intelBlock}${creativeWarning}

REGRAS: Hook devastador (5-8s) + 3 OPEN LOOPS. APENAS texto falado. Valores em $. ZERO anotações.`;

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
        console.log("Phase 0 done:", hookText.length, "chars");
      }
    } catch (e) { console.warn("Phase 0 error:", e); }

    // ========== PHASE 1: Gemini Flash Draft (REAL STREAMING) ==========
    const hookInjection = hookText ? `\n🎯 HOOK PRÉ-GERADO (USE COMO BASE dos primeiros 60s):\n${hookText}\n` : '';

    const systemPrompt = `Você é o MELHOR ROTEIRISTA DO MUNDO para YouTube. 95%+ retenção.

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
Nicho: ${niche || 'geral'} | Idioma: ${language || 'português'}

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

⚠️ DEVE ter ${targetWords}+ palavras para ${dur} minutos COMPLETOS.`;

    console.log("Phase 1: Streaming draft from Gemini Flash with FULL knowledge...");
    const phase1Res = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Escreva roteiro MAGNÉTICO de ${duration}min sobre: "${topic}"\nMínimo ${targetWords} palavras. Hook de CHOQUE. Pattern interrupts a cada 45s. Escalada emocional. ROTEIRO LIMPO.${hookText ? ' USE O HOOK PRÉ-GERADO.' : ''}\nComece!` }
        ],
        stream: true,
      }),
    });

    if (!phase1Res.ok) {
      if (phase1Res.status === 429) return errResp("Rate limit. Tente novamente.", 429);
      if (phase1Res.status === 402) return errResp("Créditos insuficientes.", 402);
      const t = await phase1Res.text();
      console.error("Phase 1 error:", phase1Res.status, t);
      throw new Error("Script generation failed");
    }

    console.log("Streaming Phase 1 to client...");
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
