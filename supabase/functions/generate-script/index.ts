import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, duration, style, niche, language, viralContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const styleGuides: Record<string, string> = {
      'dopaminérgico': `ESTILO DOPAMINÉRGICO — Cada frase deve liberar dopamina no cérebro do espectador:
- Use "E aqui é onde tudo muda..." antes de revelações
- Intercale fatos chocantes com perguntas retóricas
- A cada 30 segundos, insira um OPEN LOOP: "Mas espera, tem algo que ninguém percebeu ainda..."
- Use contagem regressiva: "Existem 3 razões, e a última vai te chocar"
- PATTERN INTERRUPTS: mude o tom drasticamente a cada 60 segundos
- Coloque comparações inesperadas: "Isso é como encontrar ouro no quintal"`,
      
      'cinematográfico': `ESTILO CINEMATOGRÁFICO — Como roteiro de filme premiado:
- Abra com uma cena visual vívida (descreva cores, sons, cheiros)
- Use a técnica de "show don't tell" — não diga que é impressionante, MOSTRE
- Construa tensão como Christopher Nolan: revelações em camadas
- Diálogos internos do narrador como voice-over de filme
- Transições cinematográficas: "Corta para...", "A câmera desce e revela..."
- Clímax emocional com payoff que conecta ao hook inicial`,

      'mrbeast': `ESTILO MRBEAST — Alta energia + impossível não assistir:
- Hook IMPOSSÍVEL nos primeiros 5 segundos: desafio absurdo ou número chocante
- A cada 30s um novo desafio/revelação que aumenta as apostas
- Linguagem simples e direta — nível de leitura de 8ª série
- Contagem/ranking: "Isso custa $1, e isso custa $1.000.000"  
- Urgência constante: "Eles só tem 24 HORAS para..."
- Reações exageradas: "IMPOSSÍVEL!", "EU NÃO ACREDITO!"
- Final épico com o maior payoff de todos`,

      'narração': `ESTILO NARRAÇÃO — Voz profunda + hipnótico:
- Tom autoritário e misterioso
- Frases curtas e impactantes intercaladas com explicações
- Ritmo: tensão → alívio → nova tensão
- Suspense narrativo: "O que aconteceu a seguir mudou tudo..."`,

      'storytelling': `ESTILO STORYTELLING — Narrativa envolvente:
- Comece in medias res (no meio da ação)
- Personagens com nome, motivação e conflito
- Arco narrativo completo: setup → conflito → escalada → clímax → resolução
- Detalhes sensoriais em cada cena
- Plot twists inesperados`,

      'educativo': `ESTILO EDUCATIVO — Aprender sem perceber:
- Abra com um mito/crença comum e destrua com fatos
- Analogias do dia-a-dia para conceitos complexos
- "A maioria das pessoas pensa X, mas a verdade é..."
- Mini-quizzes: "Antes de eu revelar, tenta adivinhar..."`,

      'tutorial': `ESTILO TUTORIAL — Passo a passo irresistível:
- Mostre o resultado final PRIMEIRO (antes/depois)
- Cada passo numerado com mini-resultados
- "O erro #1 que 90% das pessoas cometem é..."
- Tips & tricks entre os passos para manter interesse`,

      'documentário': `ESTILO DOCUMENTÁRIO — Profundidade + impacto:
- Dados e estatísticas impactantes
- Múltiplas perspectivas sobre o tema
- Entrevistas simuladas com especialistas
- Revelações progressivas como uma investigação`,

      'listicle': `ESTILO LISTICLE — Top N irresistível:
- Comece com uma preview explosiva do #1
- Cada item escalando em impacto
- "Mas o número X vai te deixar de queixo caído"
- Contraste entre itens: surpreendente vs esperado`,
    };

    const selectedStyle = styleGuides[style?.toLowerCase()] || styleGuides['narração'];

    const viralInjection = viralContext
      ? `\n\n🔥 ELEMENTOS VIRAIS SELECIONADOS PELO USUÁRIO (OBRIGATÓRIO incorporar no roteiro):\n${viralContext}\n\nIMPORTANTE: Os elementos acima foram escolhidos pelo criador. Adapte-os ao tema e integre naturalmente no roteiro.\n`
      : '';

    // ========== PHASE 1: Generate the script with Gemini Pro ==========
    const systemPrompt = `Você é o MELHOR ROTEIRISTA DO MUNDO. Seus roteiros têm 95%+ de retenção no YouTube. Você estudou TODOS os vídeos com mais de 100M de views e extraiu os padrões que fazem as pessoas NÃO CONSEGUIREM PARAR DE ASSISTIR.

VOCÊ ESCREVE COMO SE ESTIVESSE CONTANDO O MAIOR SEGREDO DO MUNDO. Cada frase é uma ISCA que puxa para a próxima. O espectador sente que se parar, vai perder algo CRUCIAL.

🧲 TÉCNICAS DE MAGNETISMO NARRATIVO (USE TODAS):

1. HOOK DE CHOQUE [primeiros 5 segundos]:
   - Comece com uma afirmação ABSURDA, CONTRAINTUITIVA ou um NÚMERO IMPOSSÍVEL
   - Ex: "Um homem de 23 anos descobriu algo que fez a NASA entrar em pânico"
   - Ex: "Existe um lugar no fundo do oceano onde chove metal líquido"
   - NUNCA comece com "Você já se perguntou..." ou "Nesse vídeo vou falar sobre..."

2. LOOPS DE CURIOSIDADE IRRESISTÍVEIS:
   - Abra 2-3 loops nos primeiros 60 segundos que só fecham no final
   - "Daqui a pouco eu vou revelar o detalhe que ninguém percebeu... e quando você souber, nunca mais vai ver isso da mesma forma"
   - Cada loop aberto cria uma COCEIRA MENTAL que só passa quando fecha

3. ESCALADA EMOCIONAL CONSTANTE:
   - Cada revelação é MAIOR que a anterior (técnica bola de neve)
   - Use a estrutura: fato surpreendente → contexto → implicação CHOCANTE
   - "Isso já é impressionante, mas o que vem agora muda TUDO"

4. PATTERN INTERRUPTS A CADA 45 SEGUNDOS:
   - Mude o tom: sério → humor → choque → reflexão
   - Faça perguntas diretas: "Para e pensa comigo..."
   - Use analogias viscerais: "É como se alguém te desse a chave de um cofre e dissesse: abra por sua conta e risco"

5. TENSÃO NARRATIVA CONSTANTE:
   - Nunca entregue tudo de uma vez — sempre segure algo
   - "Mas tem um detalhe que muda completamente essa história..."
   - Crie mini-cliffhangers entre cada seção

6. LINGUAGEM HIPNÓTICA:
   - Frases curtas. Impactantes. Que grudam na mente.
   - Use presente do indicativo (cria urgência): "Ele abre a porta. O que ele vê muda tudo."
   - Metáforas sensoriais: sons, cheiros, texturas, cores
   - Ritmo: frase curta, frase curta, frase LONGA que explode

7. REGRA DO "E DAÍ?":
   - Após cada informação, pergunte-se "e daí?" — se não tem impacto emocional, REESCREVA
   - Cada frase deve ter um PROPÓSITO: chocar, ensinar, emocionar ou criar suspense

📐 ESTRUTURA OBRIGATÓRIA:
- HOOK EXPLOSIVO [00:00-00:08] — A frase mais impossível de ignorar
- SETUP + PRIMEIRO LOOP [00:08-01:00] — Por que isso importa + abra curiosidade
- DESENVOLVIMENTO com MICROHOOKS a cada 45s — Cada bloco tem seu mini-gancho
- ESCALADA PROGRESSIVA — Cada revelação maior que a anterior
- CLÍMAX [últimos 20%] — O maior payoff, conectado ao hook
- CTA NATURAL [final] — Integrado à narrativa, não forçado

✍️ REGRAS DE ESCRITA:
1. O roteiro DEVE ter NO MÍNIMO ${targetWords} palavras (~${Math.round(targetChars)} caracteres) para cobrir ${duration} minutos
2. Cada minuto = ~${wordsPerMinute} palavras faladas. Para ${duration} min = ${targetWords} palavras MÍNIMO
3. ESCREVA CADA PALAVRA. NÃO use "[continue aqui]", "[expanda]", "[adicione mais]" ou qualquer placeholder
4. ⚠️ ROTEIRO LIMPO: APENAS o texto da narração. ZERO indicações técnicas ([B-ROLL:], [TEXTO NA TELA:], [EFEITO SONORO:], [MÚSICA:], [TRANSIÇÃO:], [CORTE PARA:]). ZERO marcações de tempo ([00:00], [01:30]). O texto vai direto pro TTS.
5. Parágrafos curtos (2-3 frases) para facilitar narração
6. Use linguagem conversacional — como se falasse com um amigo inteligente
7. Use valores monetários em dólares ($) — NUNCA use R$
8. PROIBIDO: "Narrador:", "Cena:", cabeçalhos de seção, ou qualquer meta-texto

${selectedStyle}
${viralInjection}
Nicho: ${niche || 'geral'}
Idioma: ${language || 'português'}

📝 NO FINAL DO ROTEIRO, ADICIONE (separado por "---EXTRAS---"):
- 5 sugestões de TÍTULO com CTR estimado 30%+ (números, palavras de poder, curiosidade, urgência)
- 5 ideias de THUMBNAIL (descrição visual ULTRA detalhada: expressões faciais, cores, texto overlay, composição)
- 15-20 tags SEO relevantes
- Descrição otimizada para SEO (3 parágrafos + hashtags)

⚠️ ATENÇÃO: Escreva ABSOLUTAMENTE TUDO. Sem atalhos. O roteiro final deve ter ${targetWords}+ palavras.`;

    const generateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Escreva um roteiro MAGNÉTICO e HIPNÓTICO de ${duration} minutos sobre: "${topic}"

O espectador NÃO PODE conseguir parar de assistir. Cada frase puxa para a próxima como um vício.

REQUISITOS INEGOCIÁVEIS:
- Mínimo ${targetWords} palavras
- Hook de CHOQUE nos primeiros 5 segundos (número absurdo, fato impossível, ou revelação que causa arrepio)
- 2-3 loops de curiosidade abertos nos primeiros 60 segundos
- Pattern interrupts a cada 45 segundos
- Escalada emocional constante — cada revelação MAIOR que a anterior
- ROTEIRO LIMPO: APENAS texto falado. ZERO anotações, ZERO timestamps. Vai direto pro TTS.
- Use valores em dólares ($), nunca R$
- Ao final (após ---EXTRAS---): títulos, thumbnails, tags SEO e descrição
${viralContext ? '\n- INCORPORE os elementos virais selecionados' : ''}

Comece com o HOOK mais IMPOSSÍVEL DE IGNORAR que você já criou. Vamos!` }
        ],
        stream: false,
      }),
    });

    if (!generateResponse.ok) {
      if (generateResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (generateResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await generateResponse.text();
      console.error("AI Phase 1 error:", generateResponse.status, t);
      throw new Error("Script generation failed");
    }

    const phase1Data = await generateResponse.json();
    const draftScript = phase1Data.choices?.[0]?.message?.content;
    if (!draftScript) throw new Error("No script generated in Phase 1");

    console.log("Phase 1 complete. Draft length:", draftScript.length, "chars");

    // ========== PHASE 2: Review & Enhance with second AI pass ==========
    const reviewResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: `Você é um DIRETOR CRIATIVO IMPLACÁVEL que avalia roteiros para canais com 10M+ inscritos. Seu trabalho é pegar um roteiro BOM e transformar em OBRA-PRIMA.

VOCÊ AVALIA E REESCREVE baseado nesses critérios:

🔍 CRITÉRIOS DE AVALIAÇÃO:
1. HOOK (primeiros 5 seg): É IMPOSSÍVEL de ignorar? Causa choque/curiosidade visceral?
2. LOOPS DE CURIOSIDADE: Existem 2-3 loops abertos nos primeiros 60 seg?
3. RETENÇÃO: Tem pattern interrupts a cada 45 seg? O espectador seria INCAPAZ de sair?
4. ESCALADA: Cada revelação é MAIOR que a anterior? Existe crescendo emocional?
5. LINGUAGEM: É HIPNÓTICA? Frases curtas + impactantes? Metáforas sensoriais?
6. FLUIDEZ: A narração flui naturalmente? Parece conversa, não texto?
7. CLÍMAX: O final conecta ao hook? O payoff é SATISFATÓRIO?
8. MAGNETISMO: Se você fosse espectador, conseguiria parar de assistir?

🔧 SEU PROCESSO:
1. Leia o roteiro inteiro
2. Identifique TODOS os pontos fracos (partes chatas, previsíveis, genéricas, sem tensão)
3. REESCREVA o roteiro COMPLETO, mantendo a estrutura geral mas:
   - Turbine o hook (se não causa arrepio, refaça)
   - Adicione loops de curiosidade onde faltam
   - Injete pattern interrupts onde está monótono
   - Substitua frases genéricas por frases viscerais e específicas
   - Aumente a tensão narrativa em cada transição
   - Torne cada frase IMPOSSÍVEL DE PULAR

⚠️ REGRAS ABSOLUTAS:
- Retorne APENAS o roteiro reescrito (texto da narração + extras após ---EXTRAS---)
- ZERO anotações técnicas, ZERO timestamps, ZERO marcações de tempo
- ZERO meta-texto como "Narrador:", "Cena:", cabeçalhos
- Mantenha o mínimo de ${targetWords} palavras
- Idioma: ${language || 'português'}
- Valores em dólares ($), nunca R$
- O roteiro vai direto pro TTS — escreva SOMENTE o que será falado` },
          { role: "user", content: `ROTEIRO PARA REVISAR E TURBINAR:

${draftScript}

MISSÃO: Transforme esse roteiro em algo que o espectador NÃO CONSIGA parar de assistir. Cada segundo deve criar dependência. Se alguma parte está fraca, monótona ou previsível — REESCREVA com força total.

Retorne o roteiro COMPLETO reescrito (incluindo a seção ---EXTRAS--- com títulos, thumbnails, tags e descrição).` }
        ],
        stream: true,
      }),
    });

    if (!reviewResponse.ok) {
      if (reviewResponse.status === 429) {
        // If review fails due to rate limit, stream the draft instead
        console.log("Phase 2 rate limited, returning Phase 1 draft");
        return streamText(draftScript, corsHeaders);
      }
      if (reviewResponse.status === 402) {
        console.log("Phase 2 payment required, returning Phase 1 draft");
        return streamText(draftScript, corsHeaders);
      }
      console.error("Phase 2 error, falling back to Phase 1 draft");
      return streamText(draftScript, corsHeaders);
    }

    console.log("Phase 2 streaming enhanced script...");

    return new Response(reviewResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper: convert plain text to SSE stream format for fallback
function streamText(text: string, corsHeaders: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const chunks = text.match(/.{1,80}/g) || [text];
  
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const sseData = JSON.stringify({
          choices: [{ delta: { content: chunk } }]
        });
        controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}
