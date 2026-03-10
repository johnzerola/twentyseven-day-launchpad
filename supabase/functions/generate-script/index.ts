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

    const wordsPerMinute = 140;
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

    // Build viral injection block
    const viralInjection = viralContext
      ? `\n\n🔥 ELEMENTOS VIRAIS SELECIONADOS PELO USUÁRIO (OBRIGATÓRIO incorporar no roteiro):\n${viralContext}\n\nIMPORTANTE: Os elementos acima foram escolhidos pelo criador. Adapte-os ao tema e integre naturalmente no roteiro. O hook deve ser usado como inspiração/base para os primeiros segundos. O CTA deve ser inserido no local indicado. A estrutura narrativa deve guiar toda a organização do roteiro.\n`
      : '';

    const systemPrompt = `Você é um ROTEIRISTA VETERANO que trabalhou com MrBeast, Disney, HBO e produções dignas de Oscar. Você domina TODAS as técnicas de retenção que mantêm 80%+ de audiência em vídeos do YouTube.

TÉCNICAS OBRIGATÓRIAS QUE VOCÊ DEVE USAR:

🧠 DOPAMINA & RETENÇÃO:
- HOOK NOS PRIMEIROS 8 SEGUNDOS: Uma frase impossível de ignorar. Número chocante, pergunta provocativa, ou afirmação contraintuitiva.
- OPEN LOOPS: A cada 45-60 segundos, abra um loop de curiosidade que só fecha 2-3 minutos depois. "Daqui a pouco vou revelar algo que muda tudo..."
- PATTERN INTERRUPTS: A cada 60 segundos, mude algo — tom, ritmo, formato, tipo de informação. Nunca deixe o espectador prever o que vem.
- CURIOSITY GAPS: "Existe um segredo que [experts] usam, e eu vou revelar em um instante..."
- CLIFFHANGERS INTERNOS: No fim de cada seção, crie expectativa para a próxima.
- REGRA DOS 8 SEGUNDOS: Nenhum trecho de mais de 8 segundos sem algo que prenda atenção (dado novo, pergunta, mudança visual, emoção).

📐 ESTRUTURA NARRATIVA:
- HOOK EXPLOSIVO [00:00-00:08] — 1-2 frases que tornam impossível sair
- INTRO + CONTEXTO [00:08-01:00] — Por que isso importa? Stakeholders altos.
- DESENVOLVIMENTO com MICROHOOKS a cada 45-60s — Cada seção tem seu mini-hook e payoff
- BUILD UP progressivo — Cada revelação é maior que a anterior (técnica "bola de neve")
- CLÍMAX [últimos 3-4 minutos] — O maior payoff, a revelação final
- CTA NATURAL [final] — Conectado ao tema, não forçado

✍️ REGRAS DE ESCRITA:
1. O roteiro DEVE ter NO MÍNIMO ${targetWords} palavras (~${Math.round(targetChars)} caracteres) para cobrir ${duration} minutos
2. Cada minuto = ~140 palavras faladas. Para ${duration} min = ${targetWords} palavras MÍNIMO
3. ESCREVA CADA PALAVRA. NÃO use "[continue aqui]", "[expanda]", "[adicione mais]" ou qualquer placeholder
4. Inclua MARCAÇÕES DE TEMPO: [00:00], [01:30], [03:00], etc.
5. ⚠️ ROTEIRO LIMPO: Escreva APENAS o texto da narração. NÃO inclua indicações técnicas como [B-ROLL:], [TEXTO NA TELA:], [EFEITO SONORO:], [MÚSICA:], [TRANSIÇÃO:], [CORTE PARA:] ou qualquer anotação entre colchetes que não seja marcação de tempo. O roteiro será usado diretamente para TTS (Text-to-Speech), então qualquer anotação será lida em voz alta pelo narrador.
6. Parágrafos curtos (2-3 frases) para facilitar narração
7. Use linguagem conversacional — como se falasse com um amigo inteligente
8. Use valores monetários em dólares (ex: $15, $1.000, $50.000) — NUNCA use R$

📝 NO FINAL DO ROTEIRO, ADICIONE:
- 5 sugestões de TÍTULO com CTR estimado 30%+ (use números, palavras de poder, curiosidade, urgência)
- 5 ideias de THUMBNAIL (descrição visual ULTRA detalhada: expressões faciais, cores, texto overlay, composição)
- 15-20 tags SEO relevantes
- Descrição otimizada para SEO (3 parágrafos: hook, sobre o vídeo, sobre o canal + hashtags)

${selectedStyle}
${viralInjection}
Nicho: ${niche || 'geral'}
Idioma: ${language || 'português'}

⚠️ ATENÇÃO MÁXIMA: Escreva ABSOLUTAMENTE TUDO. Cada seção COMPLETA. Sem atalhos. Sem resumos. O roteiro final deve ter ${targetWords}+ palavras. Se necessário, adicione mais exemplos, dados, analogias e detalhes sensoriais para atingir a contagem.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Escreva um roteiro COMPLETO e LONGO de ${duration} minutos sobre: "${topic}"

REQUISITOS INEGOCIÁVEIS:
- Mínimo ${targetWords} palavras (verifique antes de finalizar)
- Cada seção totalmente escrita, sem placeholders
- Hooks, open loops e pattern interrupts ao longo de TODO o roteiro
- Marcações de tempo realistas [00:00], [01:30], etc.
- ROTEIRO LIMPO: APENAS texto falado. ZERO anotações técnicas ([B-ROLL], [MÚSICA], [EFEITO SONORO], [TRANSIÇÃO], [CORTE], etc.). O texto vai direto pro TTS.
- Use valores em dólares ($), nunca R$
- Ao final: títulos, thumbnails, tags SEO e descrição (essa parte pode ter formatação)
${viralContext ? '\n- INCORPORE os elementos virais selecionados pelo criador (hook, CTA e/ou estrutura narrativa)' : ''}

Comece com o HOOK mais explosivo possível. Vamos lá!` }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Script generation failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
