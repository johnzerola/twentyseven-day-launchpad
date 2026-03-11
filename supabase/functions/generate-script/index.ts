import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, duration, style, niche, language, viralContext, intelligenceBriefing } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ========== Fetch Knowledge from DB ==========
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const [ytRes, scriptRes, channelRes] = await Promise.all([
      sb.from("youtube_knowledge").select("category,title,content").order("priority", { ascending: false }).limit(10),
      sb.from("script_knowledge").select("category,title,content,examples").order("effectiveness_score", { ascending: false }).limit(10),
      sb.from("channel_intelligence").select("channel_name,style,viral_patterns,visual_style_notes,avg_views,growth_rate").eq("is_faceless", true).order("avg_views", { ascending: false }).limit(8),
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
    const targetWords = (duration || 15) * wordsPerMinute;
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

    // ========== PHASE 1: GPT-5 Creates the Draft ==========
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
Nicho: ${niche || 'geral'}
Idioma: ${language || 'português'}

✍️ REGRAS:
1. MÍNIMO ${targetWords} palavras (~${Math.round(targetChars)} chars) para ${duration} min
2. ${wordsPerMinute} palavras/min. Para ${duration} min = ${targetWords} palavras MÍNIMO
3. ESCREVA CADA PALAVRA. ZERO placeholders
4. ROTEIRO LIMPO: APENAS texto falado. ZERO anotações técnicas, ZERO timestamps
5. Parágrafos curtos (2-3 frases)
6. Linguagem conversacional
7. Valores em dólares ($), nunca R$
8. PROIBIDO: "Narrador:", "Cena:", cabeçalhos, meta-texto

📝 NO FINAL, após "---EXTRAS---":
- 5 títulos com CTR 30%+
- 5 ideias de thumbnail ultra-detalhadas
- 15-20 tags SEO
- Descrição otimizada (3 parágrafos + hashtags)

⚠️ Escreva ABSOLUTAMENTE TUDO. ${targetWords}+ palavras.`;

    const phase1Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: phase1System },
          { role: "user", content: `Escreva um roteiro MAGNÉTICO de ${duration} minutos sobre: "${topic}"

REQUISITOS INEGOCIÁVEIS:
- Mínimo ${targetWords} palavras
- Hook de CHOQUE nos primeiros 5 segundos
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
    console.log("Phase 1 (GPT-5) complete. Draft length:", draftScript.length, "chars");

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

REGRAS:
- ZERO anotações técnicas, ZERO timestamps
- Mínimo ${targetWords} palavras
- Idioma: ${language || 'português'}
- Valores em dólares ($)
- SOMENTE texto falado`;

    const phase2Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: phase2System },
          { role: "user", content: `ROTEIRO PARA REVISAR E TURBINAR:\n\n${draftScript}\n\nMISSÃO: Transforme em algo que o espectador NÃO CONSIGA parar de assistir. Dê scores HONESTOS e reescreva as partes fracas com força total.\n\nRetorne o roteiro COMPLETO reescrito (incluindo ---EXTRAS---).` }
        ],
        stream: true,
      }),
    });

    if (!phase2Response.ok) {
      console.error("Phase 2 error, falling back to Phase 1 draft");
      return streamText(draftScript, corsHeaders);
    }

    console.log("Phase 2 (Gemini Pro) streaming enhanced script...");

    return new Response(phase2Response.body, {
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
