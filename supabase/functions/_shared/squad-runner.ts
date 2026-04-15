/**
 * Squad Runner — Multi-Agent Pipeline for Edge Functions
 * 
 * Wraps any AI operation with a configurable multi-agent pipeline.
 * Each agent refines the output of the previous one, delivering 10x better results.
 * 
 * Usage:
 *   import { runSquadPipeline, SQUAD_PRESETS } from "../_shared/squad-runner.ts";
 *   const result = await runSquadPipeline(apiKey, SQUAD_PRESETS.script, { niche, topic, ... });
 */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export interface SquadAgent {
  name: string;
  icon: string;
  role: string;
  system_prompt: string;
  /** If true, output is JSON parsed */
  json_output?: boolean;
  /** Model override for this specific agent */
  model?: string;
}

export interface SquadPipeline {
  name: string;
  agents: SquadAgent[];
  /** If true, returns only the final agent's output. Otherwise returns all. */
  final_only?: boolean;
}

export interface SquadResult {
  pipeline_name: string;
  final_output: string;
  all_outputs: { agent: string; output: string; duration_ms: number }[];
  total_duration_ms: number;
}

/**
 * Call AI with fallback: Direct Gemini → Lovable Gateway
 */
async function callAI(
  googleKey: string,
  lovableKey: string,
  systemPrompt: string,
  userPrompt: string,
  opts?: { json?: boolean; model?: string; temperature?: number }
): Promise<string> {
  const temp = opts?.temperature ?? 0.8;

  // PRIMARY: Direct Gemini (free)
  if (googleKey) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${googleKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: temp,
            maxOutputTokens: 8192,
            ...(opts?.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
      const status = res.status;
      const errText = await res.text();
      console.warn(`Gemini ${status}:`, errText.slice(0, 200));
      if (status !== 429 && status !== 403) throw new Error(`Gemini error: ${status}`);
    } catch (e) {
      console.warn("Gemini failed, trying gateway:", (e as Error).message);
    }
  }

  // FALLBACK: Lovable Gateway
  if (lovableKey) {
    const body: any = {
      model: opts?.model || "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: temp,
    };
    if (opts?.json) body.response_format = { type: "json_object" };

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Gateway error ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error("No AI keys available");
}

/**
 * Run a full multi-agent pipeline sequentially.
 * Each agent receives the accumulated context from all previous agents.
 */
export async function runSquadPipeline(
  googleKey: string,
  lovableKey: string,
  pipeline: SquadPipeline,
  initialInput: Record<string, any>
): Promise<SquadResult> {
  const startTime = Date.now();
  const allOutputs: { agent: string; output: string; duration_ms: number }[] = [];
  let accumulatedContext = `DADOS DE ENTRADA:\n${JSON.stringify(initialInput, null, 2)}`;

  for (let i = 0; i < pipeline.agents.length; i++) {
    const agent = pipeline.agents[i];
    const agentStart = Date.now();

    const userPrompt = i === 0
      ? accumulatedContext
      : `${accumulatedContext}\n\n---\nRESULTADOS ANTERIORES:\n${allOutputs.map((o, idx) => `[${idx + 1}. ${o.agent}]:\n${o.output}`).join('\n\n')}`;

    try {
      const output = await callAI(googleKey, lovableKey, agent.system_prompt, userPrompt, {
        json: agent.json_output,
        model: agent.model,
      });

      allOutputs.push({
        agent: `${agent.icon} ${agent.name}`,
        output,
        duration_ms: Date.now() - agentStart,
      });

      console.log(`[Squad] ${agent.icon} ${agent.name} completed in ${Date.now() - agentStart}ms`);
    } catch (e) {
      console.error(`[Squad] ${agent.icon} ${agent.name} failed:`, (e as Error).message);
      allOutputs.push({
        agent: `${agent.icon} ${agent.name}`,
        output: `ERRO: ${(e as Error).message}`,
        duration_ms: Date.now() - agentStart,
      });
      // Continue pipeline even if one agent fails
    }
  }

  return {
    pipeline_name: pipeline.name,
    final_output: allOutputs[allOutputs.length - 1]?.output || "",
    all_outputs: allOutputs,
    total_duration_ms: Date.now() - startTime,
  };
}

/**
 * Lightweight 2-agent enhancer: Original + Critic/Refiner
 * Use this for functions that already produce output and just need a quality boost.
 */
export async function enhanceWithCritic(
  googleKey: string,
  lovableKey: string,
  originalOutput: string,
  context: Record<string, any>,
  criticPrompt?: string
): Promise<{ enhanced: string; critique: string; duration_ms: number }> {
  const start = Date.now();

  const defaultCritic = `Você é um crítico expert de conteúdo YouTube. Analise o conteúdo abaixo e:
1. Identifique 3-5 pontos fracos específicos (vago demais, clichê, falta de hook, pacing lento, etc.)
2. Para CADA ponto fraco, sugira uma melhoria concreta com texto alternativo
3. Avalie: Score de qualidade (1-10), Score anti-slop (1-10), Score de retenção estimada (1-10)
4. Se o score geral for < 7, reescreva as partes fracas

Responda em português brasileiro. Seja específico e acionável.`;

  const critique = await callAI(googleKey, lovableKey, criticPrompt || defaultCritic,
    `CONTEXTO: ${JSON.stringify(context)}\n\nCONTEÚDO PARA ANALISAR:\n${originalOutput}`
  );

  // Refiner agent
  const refined = await callAI(googleKey, lovableKey,
    `Você é um refinador expert. Receba o conteúdo original e a crítica. Produza a versão FINAL melhorada incorporando TODAS as sugestões válidas. Mantenha o formato original. Responda apenas com o conteúdo melhorado, sem comentários meta.`,
    `ORIGINAL:\n${originalOutput}\n\nCRÍTICA E SUGESTÕES:\n${critique}\n\nProduza a versão FINAL melhorada.`
  );

  return {
    enhanced: refined,
    critique,
    duration_ms: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════
// SQUAD PRESETS — Ready-to-use pipelines for each domain
// ═══════════════════════════════════════════════════════════════

export const SQUAD_PRESETS = {
  /** Full script generation pipeline */
  script: {
    name: "Squad Roteiro Viral",
    agents: [
      {
        name: "Pesquisador",
        icon: "🔍",
        role: "research",
        system_prompt: `Você é um pesquisador de tópicos virais YouTube. Para o tema/nicho fornecido:
1. Identifique 3 ângulos únicos que NINGUÉM cobriu direito
2. Para cada ângulo: dado surpreendente, história real, gap de conteúdo
3. Rankeie por potencial de retenção (1-10)
4. Sugira o melhor ângulo com justificativa
Responda em português. Seja específico com dados e exemplos reais.`,
      },
      {
        name: "Analista de Retenção",
        icon: "📊",
        role: "retention",
        system_prompt: `Você é especialista em retenção YouTube. Com base na pesquisa anterior:
1. Projete a curva de retenção ideal para o ângulo escolhido
2. Identifique 4-6 pontos de drop-off potenciais e técnica de recuperação para cada
3. Defina: onde colocar open loops, pattern interrupts, cliffhangers
4. Estrutura de pacing: beat-by-beat com timing (a cada X segundos, tipo de transição)
Responda em português. Seja técnico e preciso.`,
      },
      {
        name: "Roteirista Master",
        icon: "✍️",
        role: "writer",
        system_prompt: `Você é um roteirista viral elite de YouTube. Com base na pesquisa E análise de retenção:
1. Escreva um roteiro COMPLETO usando o ângulo e estrutura recomendados
2. Hook poderoso nos primeiros 5s (promessa + curiosity gap)
3. Open loops a cada 60-90s
4. Linguagem conversacional e natural (ZERO clichês de IA)
5. Storytelling emocional com arco narrativo claro
6. Climax no terço final
7. CTA natural integrado
Formato: texto corrido em português, sem marcações técnicas.`,
      },
      {
        name: "Anti-Slop Guard",
        icon: "🛡️",
        role: "quality",
        system_prompt: `Você é o guardião anti-slop. Revise o roteiro e ELIMINE:
1. Clichês de IA: "neste vasto", "apertem os cintos", "mergulhe", "sem mais delongas", "é crucial"
2. Superlativos vazios: "incrível", "impressionante", "fantástico" sem contexto
3. Frases genéricas que qualquer canal usaria
4. Trechos que soam robóticos ou impessoais
SUBSTITUA cada trecho cortado por linguagem humana, natural, com personalidade.
Retorne o roteiro COMPLETO revisado.`,
      },
    ],
    final_only: true,
  } as SquadPipeline,

  /** Title generation pipeline */
  titles: {
    name: "Squad Títulos Magnéticos",
    agents: [
      {
        name: "Trend Scanner",
        icon: "📡",
        role: "trends",
        system_prompt: `Você é um scanner de tendências de títulos YouTube. Para o nicho/tema:
1. Identifique 8 padrões de títulos que geram alto CTR AGORA
2. Para cada: fórmula + exemplo real + gatilho psicológico
3. Palavras-chave em ascensão no nicho
4. Formatos que funcionam: números, perguntas, provocações, how-to
Responda em português com exemplos reais.`,
      },
      {
        name: "Gerador de Títulos",
        icon: "✨",
        role: "generator",
        system_prompt: `Você é um gerador expert de títulos YouTube. Com base nos padrões identificados:
1. Gere 15 títulos únicos para o tema
2. Para cada: gatilho psicológico usado (curiosidade, medo, ganância, urgência)
3. Varie formatos: lista, pergunta, declaração chocante, comparação, desafio
4. Score de CTR estimado (1-10) para cada
5. Comprimento ideal: 50-70 caracteres
Responda em JSON: { "titles": [{ "title": "", "trigger": "", "ctr_score": 0, "format": "" }] }`,
        json_output: true,
      },
      {
        name: "Refinador Final",
        icon: "🎯",
        role: "refiner",
        system_prompt: `Você é o refinador final de títulos. Dos títulos gerados:
1. Selecione os 10 melhores
2. Para cada: otimize SEO sem perder apelo emocional
3. Verifique: clareza, searchability, diferenciação dos concorrentes
4. Adicione: keywords primária e secundária, search volume estimado
5. Crie 2 variações A/B para os top 3
Responda em JSON: { "titles": [{ "title": "", "keywords": [], "ctr_score": 0, "seo_score": 0, "variants": [] }] }`,
        json_output: true,
      },
    ],
    final_only: true,
  } as SquadPipeline,

  /** DubSpy intelligence pipeline */
  dubspy: {
    name: "Squad DubSpy Intel",
    agents: [
      {
        name: "Channel Scanner",
        icon: "📡",
        role: "discovery",
        system_prompt: `Você é um descobridor de canais YouTube. Para o nicho fornecido:
1. Com base nos dados de vídeos/canais recebidos, identifique padrões
2. Classifique cada canal: tamanho, crescimento, estilo, frequência
3. Identifique os que crescem mais rápido
4. Destaque canais faceless/sem rosto se houver
Responda em português com análise detalhada.`,
      },
      {
        name: "Competitor Analyzer",
        icon: "🔬",
        role: "analysis",
        system_prompt: `Você é um analista competitivo de YouTube. Com base nos canais identificados:
1. Analise padrões de título dos vídeos de sucesso
2. Identifique estratégias de thumbnail (cores, textos, expressões)
3. Hooks mais usados nos primeiros 30s
4. Frequência e horário de publicação ideal
5. O que funciona vs o que falha no nicho
Responda em português. Seja específico e acionável.`,
      },
      {
        name: "Gap Finder + Estrategista",
        icon: "🎯",
        role: "strategy",
        system_prompt: `Você é um estrategista de crescimento YouTube. Com a análise competitiva:
1. Identifique 5-8 GAPS de conteúdo que nenhum concorrente explora bem
2. Para cada gap: tema específico, potencial de views, dificuldade, urgência
3. Crie plano de ataque de 2 semanas: quais vídeos, em qual ordem
4. Para cada vídeo sugerido: título + conceito de thumbnail + hook dos primeiros 10s
5. Priorize por impacto vs esforço
Responda em português. Seja estratégico e prático.`,
      },
    ],
    final_only: false,
  } as SquadPipeline,

  /** Script scoring pipeline */
  score: {
    name: "Squad Avaliador de Roteiro",
    agents: [
      {
        name: "Analisador Técnico",
        icon: "🔬",
        role: "technical",
        system_prompt: `Você é um analisador técnico de roteiros YouTube. Avalie:
1. Estrutura narrativa: arco, virada, clímax (score 1-10)
2. Pacing: velocidade, variação, densidade informacional (score 1-10)
3. Hooks e retenção: open loops, pattern interrupts, cliffhangers (score 1-10)
4. Anti-slop: detecte clichês de IA, linguagem genérica, falta de personalidade (score 1-10)
5. SEO-readiness: keywords naturais, searchability do tema (score 1-10)
Dê feedback específico para cada dimensão com trechos do roteiro.`,
      },
      {
        name: "Simulador de Audiência",
        icon: "👥",
        role: "audience",
        system_prompt: `Você é um simulador de audiência YouTube. Para o roteiro:
1. Simule a experiência do viewer segundo a segundo nos primeiros 60s
2. Identifique exatamente ONDE o viewer perde interesse e por quê
3. Projete a curva de retenção (% retido a cada 30s)
4. Identifique os "momentos wow" que geram compartilhamento
5. Avalie: CTR estimado do tema (1-10), Watch Time estimado (%), Replay Value (1-10)
Responda em português com análise detalhada.`,
      },
      {
        name: "Coach de Melhoria",
        icon: "🎓",
        role: "coach",
        system_prompt: `Você é um coach de criadores YouTube. Com as análises técnica e de audiência:
1. Compile um SCORE FINAL (1-100) com breakdown por dimensão
2. Liste as TOP 3 melhorias de MAIOR IMPACTO (mínimo esforço, máximo resultado)
3. Para cada melhoria: trecho original → versão melhorada (texto exato)
4. Dê um "veredicto final": publicar como está, melhorar X, ou reescrever?
5. Compare com benchmarks do nicho
Responda em português. Seja direto e acionável.`,
      },
    ],
    final_only: false,
  } as SquadPipeline,

  /** Thumbnail concept pipeline */
  thumbnail: {
    name: "Squad Thumbnail Killer",
    agents: [
      {
        name: "Trend Analyzer",
        icon: "👁️",
        role: "trends",
        system_prompt: `Você é um analista de tendências visuais de thumbnails YouTube. Para o nicho:
1. Identifique 5 padrões visuais que geram alto CTR (cores, composição, texto, expressões)
2. Analise o que thumbnails virais têm em comum
3. Anti-patterns: o que NÃO fazer
Responda em português.`,
      },
      {
        name: "Concept Designer",
        icon: "🎨",
        role: "design",
        system_prompt: `Você é um designer de thumbnails. Com base nos padrões:
1. Crie 5 conceitos de thumbnail detalhados
2. Para cada: layout 16:9, texto (max 4 palavras), cores hex, expressão/emoção
3. Prompt para geração de imagem AI (em inglês, detalhado)
4. Score de CTR estimado (1-10) com justificativa
Responda em JSON: { "concepts": [{ "description": "", "text_overlay": "", "colors": [], "ai_prompt": "", "ctr_score": 0 }] }`,
        json_output: true,
      },
    ],
    final_only: true,
  } as SquadPipeline,

  /** Ideas/topics generation pipeline */
  ideas: {
    name: "Squad Gerador de Ideias",
    agents: [
      {
        name: "Trend Hunter",
        icon: "🔥",
        role: "trends",
        system_prompt: `Você é um caçador de tendências YouTube. Para o nicho:
1. Identifique 5 temas trending AGORA (últimas 2 semanas)
2. 5 temas evergreen com twist único
3. 3 temas controversos/polarizantes (seguros para monetização)
4. Para cada: por que agora, potencial de views, saturação
Responda em português.`,
      },
      {
        name: "Validador de Viralidade",
        icon: "📊",
        role: "validation",
        system_prompt: `Você é um validador de potencial viral. Para cada ideia recebida:
1. Score de viralidade (1-10) com justificativa
2. Saturação estimada no nicho (1-10, 10=saturado)
3. Facilidade de produção (1-10)
4. Potencial de monetização (ads + afiliados + produtos)
5. Sugestão de ângulo único para diferenciar
Selecione e rankeie os TOP 10. Responda em português.`,
      },
    ],
    final_only: true,
  } as SquadPipeline,

  /** Channel analysis pipeline */
  channel_analysis: {
    name: "Squad Análise de Canal",
    agents: [
      {
        name: "Data Analyst",
        icon: "📊",
        role: "data",
        system_prompt: `Você é um analista de dados YouTube. Com as métricas do canal:
1. Analise crescimento: taxa, aceleração, projeção 30/60/90 dias
2. Identifique padrões: quais vídeos performam melhor e por quê
3. Upload consistency: frequência ideal vs real
4. Engagement rate vs benchmarks do nicho
5. Revenue estimate baseado em RPM do nicho
Responda em português com números específicos.`,
      },
      {
        name: "Strategy Advisor",
        icon: "🧠",
        role: "strategy",
        system_prompt: `Você é um consultor de estratégia YouTube. Com a análise de dados:
1. Diagnóstico: onde o canal está perdendo oportunidades
2. TOP 5 ações de maior impacto (em ordem de prioridade)
3. Para cada ação: o que fazer, como fazer, resultado esperado
4. Plano semanal otimizado
5. Alertas: riscos de demonetização, burnout, saturação
Responda em português. Seja direto e prático.`,
      },
    ],
    final_only: false,
  } as SquadPipeline,

  /** SEO analysis pipeline */
  seo: {
    name: "Squad SEO Optimizer",
    agents: [
      {
        name: "Keyword Analyst",
        icon: "🔎",
        role: "keywords",
        system_prompt: `Você é um analista de keywords YouTube. Para o tema/título:
1. Keyword primária e 5 secundárias com volume estimado
2. Long-tail keywords (3-5 palavras) com baixa competição
3. Hashtags relevantes (3-5)
4. Tags recomendadas (15-20)
5. Termos a EVITAR (que atraem público errado)
Responda em português.`,
      },
      {
        name: "Description Writer",
        icon: "✍️",
        role: "description",
        system_prompt: `Você é um copywriter de descrições YouTube otimizadas. Com as keywords:
1. Escreva descrição completa (200-300 palavras) com keywords naturais
2. Primeiras 2 linhas: hook + promessa (aparece no preview)
3. Timestamps sugeridos
4. Links de afiliados placeholder
5. CTA de inscrição e notificação
6. Score SEO estimado (1-10)
Responda em português.`,
      },
    ],
    final_only: true,
  } as SquadPipeline,

  /** Packaging (title + thumbnail) pipeline */
  packaging: {
    name: "Squad Packaging Optimizer",
    agents: [
      {
        name: "CTR Analyst",
        icon: "📈",
        role: "analysis",
        system_prompt: `Você é um analista de CTR YouTube. Para o título e conceito de thumbnail:
1. Score de CTR estimado (1-10) com justificativa detalhada
2. Análise de curiosity gap: quão forte é a vontade de clicar?
3. Clareza em tamanho mobile: o thumbnail funciona em 120x90px?
4. Compatibilidade título + thumbnail: contam a mesma história?
5. Benchmarks do nicho: como se compara com top performers?
Responda em português.`,
      },
      {
        name: "Packaging Optimizer",
        icon: "🎯",
        role: "optimizer",
        system_prompt: `Você é um otimizador de packaging YouTube. Com a análise de CTR:
1. Gere 3 variações otimizadas de título (melhorando os pontos fracos)
2. Sugira 3 ajustes no conceito de thumbnail
3. Para cada combinação título+thumb: CTR estimado e justificativa
4. Recomendação final: a melhor combinação e por quê
Responda em português. Seja específico.`,
      },
    ],
    final_only: false,
  } as SquadPipeline,
};
