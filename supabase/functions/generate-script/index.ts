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
    const { topic, duration, style, niche, language, viralContext, intelligenceBriefing } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // ========== Fetch Knowledge from DB ==========
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const [ytRes, scriptRes, channelRes, triggersRes, formatsRes] = await Promise.all([
      sb.from("youtube_knowledge").select("category,title,content").order("priority", { ascending: false }).limit(10),
      sb.from("script_knowledge").select("category,title,content,examples").order("effectiveness_score", { ascending: false }).limit(10),
      sb.from("channel_intelligence").select("channel_name,style,viral_patterns,visual_style_notes,avg_views,growth_rate").eq("is_faceless", true).order("avg_views", { ascending: false }).limit(8),
      sb.from("viral_content_library").select("content_json,effectiveness_score,category").in("category", ["psychology_triggers", "storytelling_structure", "retention_technique"]).order("effectiveness_score", { ascending: false }).limit(15),
      sb.from("viral_content_library").select("content_json,effectiveness_score").eq("category", "content_format").order("effectiveness_score", { ascending: false }).limit(8),
    ]);

    const ytKnowledge = (ytRes.data || []).map((r: any) => `[${r.category.toUpperCase()}] ${r.title}: ${r.content}`).join("\n\n");
    const scriptKnowledge = (scriptRes.data || []).map((r: any) => {
      const examples = Array.isArray(r.examples) ? r.examples.slice(0, 2).join(" | ") : "";
      return `[${r.category.toUpperCase()}] ${r.title}: ${r.content}${examples ? `\nExemplos: ${examples}` : ""}`;
    }).join("\n\n");

    const channelIntel = (channelRes.data || []).map((r: any) => {
      const hooks = r.viral_patterns?.hooks ? (r.viral_patterns.hooks as string[]).join(", ") : "";
      return `🎯 ${r.channel_name} (${r.style}, ${r.growth_rate}, avg ${r.avg_views} views): Hooks=[${hooks}] | Visual: ${r.visual_style_notes || "N/A"}`;
    }).join("\n");

    // ========== Speech rate calculation ==========
    const speechRates: Record<string, number> = {
      'português': 150, 'inglês': 160, 'english': 160,
      'espanhol': 155, 'español': 155,
      'alemão': 140, 'deutsch': 140,
      'polonês': 145, 'polski': 145,
      'turco': 150, 'türkçe': 150,
      'japonês': 130, '日本語': 130,
    };
    const wordsPerMinute = speechRates[language?.toLowerCase()] || 150;
    const durationMinutes = parseInt(duration) || 15;
    const targetWords = durationMinutes * wordsPerMinute;
    const minAcceptableWords = Math.round(targetWords * 0.85);
    const targetChars = targetWords * 5.5;

    // ========== Style guides ==========
    const styleGuides: Record<string, string> = {
      'dopaminérgico': `ESTILO DOPAMINÉRGICO — Cada frase deve liberar dopamina:
- Use "E aqui é onde tudo muda..." antes de revelações
- Intercale fatos chocantes com perguntas retóricas
- A cada 30 segundos, insira um OPEN LOOP
- Use contagem regressiva: "Existem 3 razões, e a última vai te chocar"
- PATTERN INTERRUPTS: mude o tom a cada 60 segundos
- Comparações viscerais: "Isso é como encontrar ouro no quintal"`,
      'cinematográfico': `ESTILO CINEMATOGRÁFICO — Como roteiro de filme premiado:
- Abra com cena visual vívida (cores, sons, cheiros)
- Show don't tell
- Tensão como Christopher Nolan: revelações em camadas
- Transições cinematográficas: "Corta para...", "A câmera desce e revela..."
- Clímax emocional conectado ao hook inicial`,
      'mrbeast': `ESTILO MRBEAST — Alta energia + impossível não assistir:
- Hook IMPOSSÍVEL nos primeiros 5 segundos
- A cada 30s novo desafio/revelação
- Linguagem simples e direta
- Contagem/ranking: "Isso custa $1, e isso custa $1.000.000"
- Urgência constante: "Eles só tem 24 HORAS para..."
- Reações exageradas: "IMPOSSÍVEL!", "EU NÃO ACREDITO!"`,
      'narração': `ESTILO NARRAÇÃO — Voz profunda + hipnótico:
- Tom autoritário e misterioso
- Frases curtas e impactantes intercaladas com explicações
- Ritmo: tensão → alívio → nova tensão
- Suspense narrativo: "O que aconteceu a seguir mudou tudo..."`,
      'storytelling': `ESTILO STORYTELLING — Narrativa envolvente:
- Comece in medias res
- Personagens com nome, motivação e conflito
- Arco completo: setup → conflito → escalada → clímax → resolução
- Plot twists inesperados`,
      'educativo': `ESTILO EDUCATIVO — Aprender sem perceber:
- Abra com mito comum e destrua com fatos
- Analogias do dia-a-dia
- "A maioria pensa X, mas a verdade é..."
- Mini-quizzes: "Antes de eu revelar, tenta adivinhar..."`,
      'tutorial': `ESTILO TUTORIAL — Passo a passo irresistível:
- Mostre resultado final PRIMEIRO
- Cada passo numerado
- "O erro #1 que 90% cometem é..."`,
      'documentário': `ESTILO DOCUMENTÁRIO — Profundidade + impacto:
- Dados e estatísticas impactantes
- Múltiplas perspectivas
- Revelações progressivas como investigação`,
      'listicle': `ESTILO LISTICLE — Top N irresistível:
- Preview explosiva do #1
- Cada item escalando em impacto
- "Mas o número X vai te deixar de queixo caído"`,
      'reddit': `ESTILO REDDIT STORIES — Narração confessional + animação 2D:
- Tom de primeira pessoa íntimo e vulnerável
- "Eu nunca contei isso pra ninguém, mas..."
- Detalhes sensoriais que criam imagens mentais
- Plot twists genuínos que surpreendem
- Escalada progressiva de tensão
- Final que muda perspectiva sobre tudo`,
      'conspiração': `ESTILO CONSPIRAÇÃO/MISTÉRIO — Investigação profunda:
- Abra com fato oficial inquestionável
- Apresente 1-2 inconsistências que ninguém explica
- Evidências alternativas apresentadas progressivamente
- Tom sério e respeitoso — nunca piada
- "A versão oficial diz X. Mas quando olhamos Y..."
- Inclua contra-argumentos para credibilidade
- Final aberto: "Tire suas próprias conclusões"`,
      'mitologia': `ESTILO MITOLOGIA ÉPICA — Grandiosidade cinematográfica:
- Tom de narrador épico, como abertura de Senhor dos Anéis
- Personagens míticos com motivações HUMANAS
- Batalhas descritas com detalhes visuais cinematográficos
- Conexões surpreendentes entre mitos e mundo moderno
- "Antes do tempo, antes da memória, existia..."
- Escala grandiosa: deuses, titãs, forças primordiais`,
      'teorias': `ESTILO TEORIAS & MISTÉRIOS — Exploração fascinante:
- Abra com dado real impressionante + pergunta
- "95% do oceano não foi explorado. O que achamos nos 5% deveria te assustar"
- Misture ciência real com perguntas sem resposta
- Múltiplas teorias apresentadas progressivamente
- Tom de investigador curioso, não conspiracionista
- Deixe o espectador PENSANDO após o vídeo`,
    };

    const selectedStyle = styleGuides[style?.toLowerCase()] || styleGuides['narração'];

    const viralInjection = viralContext
      ? `\n\n🔥 ELEMENTOS VIRAIS SELECIONADOS (OBRIGATÓRIO incorporar):\n${viralContext}\n`
      : '';

    // ========== Intelligence Briefing Injection ==========
    let intelligenceBlock = '';
    if (intelligenceBriefing) {
      const ib = intelligenceBriefing;
      const ca = ib.competitive_analysis || {};
      const hooks = (ib.recommended_hooks || []).map((h: any) => `  • "${h.hook_text}" (${h.hook_type}) — ${h.why_it_works}`).join('\n');
      const vb = ib.visual_blueprint || {};
      const retention = (ib.retention_techniques || []).map((r: any) => `  • ${r.technique}: ${r.when_to_use}`).join('\n');
      const angle = ib.topic_angle || {};
      
      intelligenceBlock = `\n\n🧠 BRIEFING DE INTELIGÊNCIA (baseado em dados REAIS de ${ca.top_channels_analyzed || '?'} canais analisados):

📊 ANÁLISE COMPETITIVA:
- Estilos dominantes: ${(ca.dominant_styles || []).join(', ')}
- Hooks que funcionam: ${(ca.common_hooks || []).join(', ')}
- O que funciona: ${(ca.what_works || []).join('; ')}
- O que EVITAR: ${(ca.what_to_avoid || []).join('; ')}
- Gaps de conteúdo: ${(ca.content_gaps || []).join('; ')}

🎣 HOOKS RECOMENDADOS (baseados em padrões virais REAIS):
${hooks}

🎨 BLUEPRINT VISUAL:
- Estilo recomendado: ${vb.recommended_style || 'N/A'}
- Iluminação: ${vb.lighting_mood || 'N/A'}
- Câmera: ${(vb.camera_techniques || []).join(', ')}
- Hook visual: ${vb.hook_visual_suggestion || 'N/A'}

🧲 TÉCNICAS DE RETENÇÃO RECOMENDADAS:
${retention}

🎯 ÂNGULO DO TÓPICO:
- Ângulo sugerido: ${angle.suggested_angle || 'N/A'}
- Diferenciação: ${angle.differentiation || 'N/A'}
- Core emocional: ${angle.emotional_core || 'N/A'}

⚠️ USE ESTE BRIEFING como BASE OBRIGATÓRIA. O roteiro deve refletir os padrões que FUNCIONAM neste nicho.\n`; 
    }

    // ========== PHASE 0: GPT-5 generates HOOK + OPEN LOOPS (Ensemble AI) ==========
    console.log("Phase 0 (GPT-5): Generating hook & open loops...");
    
    let gpt5Hook = '';
    try {
      const hookResponse = await fetch(AI_URL, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          model: "openai/gpt-5",
          messages: [
            { role: "system", content: `Você é o MELHOR COPYWRITER DO MUNDO para YouTube hooks. Seu trabalho é criar os primeiros 60 segundos IMPOSSÍVEIS DE IGNORAR.

Idioma: ${language || 'português'}
Estilo: ${style || 'narração'}
${viralInjection}
${intelligenceBlock}

REGRAS:
- Crie UM hook devastador (primeiros 5-8 segundos) que cause CHOQUE ou CURIOSIDADE VISCERAL
- Crie 3 OPEN LOOPS nos próximos 50 segundos que só fecham no final do vídeo
- Use linguagem hipnótica, presente do indicativo, frases curtas
- Valores em dólares ($)
- APENAS texto falado. ZERO anotações técnicas` },
            { role: "user", content: `Crie o HOOK + OPEN LOOPS para um vídeo de ${duration} minutos sobre: "${topic}"

Retorne APENAS o texto dos primeiros 60 segundos de narração. Sem cabeçalhos, sem meta-texto.` }
          ],
          stream: false,
        }),
      });

      if (hookResponse.ok) {
        const hookData = await hookResponse.json();
        gpt5Hook = hookData.choices?.[0]?.message?.content || '';
        console.log("Phase 0 (GPT-5) complete. Hook length:", gpt5Hook.length, "chars");
      } else {
        console.warn("Phase 0 (GPT-5) failed with status:", hookResponse.status, "— continuing without hook");
      }
    } catch (e) {
      console.warn("Phase 0 (GPT-5) error:", e, "— continuing without hook");
    }

    // ========== PHASE 1: Gemini Flash Creates the Draft ==========
    const hookInjection = gpt5Hook
      ? `\n\n🎯 HOOK PRÉ-GERADO POR GPT-5 (USE COMO BASE OBRIGATÓRIA para os primeiros 60 segundos — pode melhorar mas NÃO enfraquecer):\n---\n${gpt5Hook}\n---\n`
      : '';

    const phase1System = `Você é o MELHOR ROTEIRISTA DO MUNDO para YouTube. Seus roteiros têm 95%+ de retenção.

🧠 BASE DE CONHECIMENTO YOUTUBE (USE ATIVAMENTE):
${ytKnowledge}

📡 INTELIGÊNCIA DE CANAIS VIRAIS FACELESS (REFERÊNCIAS REAIS):
${channelIntel || "Sem dados de canais disponíveis"}

📝 TÉCNICAS DE ROTEIRO COMPROVADAS (APLIQUE TODAS):
${scriptKnowledge}

🧲 TÉCNICAS DE MAGNETISMO:
1. HOOK DE CHOQUE [primeiros 5 segundos] — Afirmação ABSURDA, CONTRAINTUITIVA ou NÚMERO IMPOSSÍVEL
2. LOOPS DE CURIOSIDADE — 2-3 loops nos primeiros 60 segundos que só fecham no final
3. ESCALADA EMOCIONAL — Cada revelação MAIOR que a anterior
4. PATTERN INTERRUPTS a cada 45 segundos — mude tom, ritmo, formato
5. LINGUAGEM HIPNÓTICA — Frases curtas. Impactantes. Presente do indicativo.
6. MICRO-CLIFFHANGERS entre cada bloco

📐 ESTRUTURA:
- HOOK EXPLOSIVO [00:00-00:08]
- SETUP + LOOPS [00:08-01:00]
- DESENVOLVIMENTO com MICROHOOKS a cada 45s
- ESCALADA PROGRESSIVA
- CLÍMAX [últimos 20%]
- CTA NATURAL [final]

${selectedStyle}
${viralInjection}
${intelligenceBlock}
${hookInjection}
Nicho: ${niche || 'geral'}
Idioma: ${language || 'português'}

✍️ REGRAS INEGOCIÁVEIS DE DURAÇÃO:
1. O roteiro DEVE ter EXATAMENTE ${durationMinutes} minutos de narração
2. Taxa de fala: ${wordsPerMinute} palavras/minuto
3. MÍNIMO ABSOLUTO: ${minAcceptableWords} palavras (85% do alvo)
4. ALVO EXATO: ${targetWords} palavras (~${Math.round(targetChars)} chars)
5. Se o roteiro ficar curto, ADICIONE mais conteúdo, exemplos, detalhes e revelações
6. CONTE suas palavras mentalmente. NÃO entregue menos que ${minAcceptableWords} palavras

✍️ REGRAS GERAIS:
1. ESCREVA CADA PALAVRA. ZERO placeholders
2. ROTEIRO LIMPO: APENAS texto falado. ZERO anotações técnicas, ZERO timestamps
3. Parágrafos curtos (2-3 frases)
4. Linguagem conversacional
5. Valores em dólares ($), nunca R$
6. PROIBIDO: "Narrador:", "Cena:", cabeçalhos, meta-texto

📝 NO FINAL, após "---EXTRAS---":
- 5 títulos com CTR 30%+
- 5 ideias de thumbnail ultra-detalhadas
- 15-20 tags SEO
- Descrição otimizada (3 parágrafos + hashtags)

⚠️ CRÍTICO: O roteiro DEVE ter ${targetWords}+ palavras para preencher ${durationMinutes} minutos COMPLETOS.`;

    const phase1Response = await fetch(AI_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: phase1System },
          { role: "user", content: `Escreva um roteiro MAGNÉTICO de ${duration} minutos sobre: "${topic}"

REQUISITOS INEGOCIÁVEIS:
- Mínimo ${targetWords} palavras
- Hook de CHOQUE nos primeiros 5 segundos${gpt5Hook ? ' (USE O HOOK PRÉ-GERADO COMO BASE)' : ''}
- 2-3 loops abertos nos primeiros 60 segundos
- Pattern interrupts a cada 45 segundos
- Escalada emocional constante
- ROTEIRO LIMPO: APENAS texto falado
- Valores em dólares ($)
- Ao final (após ---EXTRAS---): títulos, thumbnails, tags e descrição
${viralContext ? '\n- INCORPORE os elementos virais selecionados' : ''}

Comece com o HOOK mais IMPOSSÍVEL DE IGNORAR. Vamos!` }
        ],
        stream: false,
      }),
    });

    if (!phase1Response.ok) {
      if (phase1Response.status === 429) return errResp("Rate limit. Tente novamente.", 429);
      if (phase1Response.status === 402) return errResp("Créditos insuficientes.", 402);
      const t = await phase1Response.text();
      console.error("Phase 1 error:", phase1Response.status, t);
      throw new Error("Script generation failed");
    }

    const phase1Data = await phase1Response.json();
    const draftScript = phase1Data.choices?.[0]?.message?.content;
    if (!draftScript) throw new Error("No script generated in Phase 1");
    console.log("Phase 1 (Gemini Flash) complete. Draft length:", draftScript.length, "chars");

    // ========== PHASE 2: Gemini Pro Reviews & Scores ==========
    const phase2System = `Você é um DIRETOR CRIATIVO IMPLACÁVEL que avalia roteiros para canais 10M+ inscritos.

🧠 BASE DE CONHECIMENTO YOUTUBE:
${ytKnowledge}

📝 TÉCNICAS DE ROTEIRO:
${scriptKnowledge}

🔍 CRITÉRIOS DE SCORING (avalie 1-10 cada):
1. HOOK_SCORE: O hook dos primeiros 5s é IMPOSSÍVEL de ignorar? Causa choque/curiosidade visceral?
2. RETENTION_SCORE: Tem pattern interrupts a cada 45s? Open loops? Micro-cliffhangers? O espectador NUNCA pensaria em sair?
3. EMOTION_SCORE: Escalada emocional constante? Contraste emocional? Linguagem hipnótica?
4. FLOW_SCORE: Narração flui naturalmente? Parece conversa, não texto? Ritmo variado?
5. PAYOFF_SCORE: O final conecta ao hook? O payoff é SATISFATÓRIO?

🔧 PROCESSO:
1. Leia o roteiro
2. Dê scores reais (seja BRUTALMENTE HONESTO)
3. Se QUALQUER score < 8, REESCREVA as partes fracas
4. Se o hook score < 9, crie um hook NOVO e devastador
5. Injete mais pattern interrupts onde está monótono
6. Torne CADA frase impossível de pular

⚠️ FORMATO DE RESPOSTA:
PRIMEIRO: Uma linha com scores no formato exato:
---SCORES--- hook:X retention:X emotion:X flow:X payoff:X ---END_SCORES---

DEPOIS: O roteiro COMPLETO reescrito (narração + ---EXTRAS---)

DEPOIS DOS EXTRAS, adicione um bloco ---SCENE_BLUEPRINT--- com JSON array:
[{"block": 1, "narrative_summary": "resumo do bloco", "mood": "tense/epic/mysterious/emotional/action", "visual_hint": "sugestão visual curta", "camera_suggestion": "tipo de câmera", "characters_present": ["nome1"]}, ...]
Cada bloco = ~30-45 segundos de narração. O blueprint guia a geração visual posterior.
---END_SCENE_BLUEPRINT---

REGRAS:
- ZERO anotações técnicas, ZERO timestamps NO ROTEIRO (blueprint é separado)
- Mínimo ${targetWords} palavras
- Idioma: ${language || 'português'}
- Valores em dólares ($)
- SOMENTE texto falado na parte de narração`;

    const phase2Response = await fetch(AI_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: phase2System },
          { role: "user", content: `ROTEIRO PARA REVISAR E TURBINAR:\n\n${draftScript}\n\nMISSÃO: Transforme em algo que o espectador NÃO CONSIGA parar de assistir. Dê scores HONESTOS e reescreva as partes fracas com força total.\n\nRetorne o roteiro COMPLETO reescrito (incluindo ---EXTRAS---).` }
        ],
        stream: false,
      }),
    });

    let finalScript = draftScript;
    if (phase2Response.ok) {
      const phase2Data = await phase2Response.json();
      finalScript = phase2Data.choices?.[0]?.message?.content || draftScript;
      console.log("Phase 2 (Gemini Pro) complete. Final length:", finalScript.length, "chars");
    } else {
      console.warn("Phase 2 failed, using Phase 1 draft. Status:", phase2Response.status);
    }

    // ========== PHASE 3: GPT-5-mini Fact-Check (Ensemble AI) ==========
    console.log("Phase 3 (GPT-5-mini): Fact-checking...");
    
    let factCheckResult = '';
    try {
      // Extract only narration (before ---EXTRAS---) for fact-checking
      const narrationOnly = finalScript.split('---EXTRAS---')[0].trim();
      
      const factCheckResponse = await fetch(AI_URL, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: `Você é um VERIFICADOR DE FATOS rigoroso. Analise o roteiro abaixo e identifique:

1. AFIRMAÇÕES FACTUAIS que podem estar INCORRETAS ou EXAGERADAS
2. NÚMEROS/ESTATÍSTICAS que precisam de verificação
3. CITAÇÕES ou referências históricas imprecisas

Para cada problema encontrado, sugira a CORREÇÃO.

FORMATO DE RESPOSTA:
---FACT_CHECK---
Se NÃO encontrou problemas: "✅ APROVADO — Nenhuma imprecisão factual detectada."
Se encontrou problemas:
⚠️ [número]: "[frase original]" → PROBLEMA: [explicação] → CORREÇÃO: [versão correta]
---END_FACT_CHECK---

Seja pragmático — ignore opiniões, hipérboles narrativas e estilo. Foque APENAS em fatos verificáveis.
Idioma: ${language || 'português'}` },
            { role: "user", content: narrationOnly.slice(0, 12000) } // Limit to avoid token overflow
          ],
          stream: false,
        }),
      });

      if (factCheckResponse.ok) {
        const fcData = await factCheckResponse.json();
        factCheckResult = fcData.choices?.[0]?.message?.content || '';
        console.log("Phase 3 (Fact-check) complete. Issues found:", factCheckResult.includes('⚠️') ? 'YES' : 'NO');
      } else {
        console.warn("Phase 3 (Fact-check) failed:", factCheckResponse.status);
      }
    } catch (e) {
      console.warn("Phase 3 (Fact-check) error:", e);
    }

    // ========== Append fact-check to final output ==========
    if (factCheckResult) {
      finalScript += `\n\n${factCheckResult}`;
    }

    // ========== Stream the final result ==========
    return streamText(finalScript, corsHeaders);
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

function streamText(text: string, headers: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const chunks = text.match(/.{1,80}/g) || [text];
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });
  return new Response(stream, { headers: { ...headers, "Content-Type": "text/event-stream" } });
}
