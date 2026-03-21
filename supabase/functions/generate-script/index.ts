import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"; // Fallback only

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
- "Mas calma" / "Mas peraí" (usado mais de 1x)
- "Ficou curioso?" / "Quer saber mais?"
- "Fique comigo até o final"

PADRÕES DE ESCRITA PROIBIDOS:
- Parágrafos que começam com "Imagine..." seguido de cenário genérico
- Três perguntas retóricas seguidas sem resposta entre elas
- Transições com "Mas espera, tem mais!" / "E não para por aí"
- Conclusões que repetem a intro quase literalmente
- Uso excessivo de superlativos ("incrível", "impressionante", "fantástico")
- Enumerações de adjetivos vazios: "surpreendente, extraordinário e fascinante"
- Parágrafos de "resumo" que não adicionam nada novo
- Listas de 3+ itens separados por vírgula sem desenvolvimento
- Repetir a mesma ideia com sinônimos em frases consecutivas

SINAIS DE "ALMA" OBRIGATÓRIOS (inclua pelo menos 5):
1. Uma analogia ÚNICA e inesperada (comparar algo técnico com algo cotidiano específico — "como quando você abre a geladeira às 3 da manhã e percebe que não tem nada")
2. Uma confissão ou imperfeição do narrador ("Eu pesquisei isso por 3 semanas e quase desisti quando...")
3. Um número ESPECÍFICO e estranho em vez de arredondado (em vez de "milhões", diga "2.347.891")
4. Uma pausa narrativa intencional — mudar o tom abruptamente por 1-2 frases
5. Referência cultural POP atual (meme, série, notícia recente) conectada ao tema
6. Um momento de "eu errei" ou "a maioria pensa errado" com dado surpreendente
7. Frase curta solitária como parágrafo: "Isso não deveria ter acontecido."
8. Uma pergunta dirigida AO espectador que exige reflexão pessoal real
9. Um DETALHE SENSORIAL micro-específico (a textura, o cheiro, a temperatura, o som)
10. Uma CONTRADIÇÃO deliberada que o narrador resolve depois ("Parece loucura. Na verdade, é.")

═══ TÉCNICAS AVANÇADAS DE ROTEIRISMO (CLAUDE MASTERCLASS) ═══

🎭 SHOW, DON'T TELL:
- ERRADO: "Ele ficou com medo"
- CERTO: "As mãos dele começaram a tremer. A boca secou. Ele olhou para a porta e calculou quantos passos precisava."
- SEMPRE descreva reações físicas, comportamentos e ações em vez de emoções abstratas

📐 SUBTEXTO:
- O que NÃO é dito importa mais que o que é dito
- Use pausas narrativas carregadas de significado
- Deixe o espectador DEDUZIR a emoção pela ação, não pela declaração

🎵 RITMO E CADÊNCIA:
- Alterne frases CURTAS (3-5 palavras) com frases médias (10-15 palavras)
- NUNCA use 3+ frases longas seguidas — o espectador perde o fôlego
- Crie "respirações" narrativas: momento tenso → pausa → explosão
- Use pontuação como ferramenta musical: vírgulas = suspiro, ponto = batida, reticências = suspense

🔄 ARCO DE TENSÃO (Modelo 5-Act):
- ACT 1 (0-8s): GANCHO IMPOSSÍVEL DE IGNORAR — promessa ou choque
- ACT 2 (8s-30%): Setup + Stakes — o que está em jogo? Por que importa?
- ACT 3 (30%-60%): ESCALADA — cada parágrafo aumenta a tensão
- ACT 4 (60%-85%): CLÍMAX — momento de revelação máxima
- ACT 5 (85%-100%): RESOLUÇÃO + CTA — satisfação emocional + próximo passo
- A tensão NUNCA deve diminuir no meio — se cair, insira um micro-hook

🧲 PATTERN INTERRUPTS ORGÂNICOS (não artificiais):
- Mude ABRUPTAMENTE de perspectiva ("Mas esquece tudo isso. Olha o que aconteceu do outro lado.")
- Insira um dado CHOCANTE no meio de uma narrativa suave
- Use humor inesperado em momento tenso (e vice-versa)
- Faça uma pausa e fale DIRETAMENTE com o espectador em tom íntimo
- NUNCA use "Mas espera!" — encontre formas orgânicas de interromper o padrão

🎯 CURIOSITY GAPS (Loops Abertos):
- Abra um loop ANTES de fechar o anterior
- Máximo 3 loops abertos simultâneos (mais causa confusão)
- Todo loop DEVE ser fechado antes do final (insatisfação = dislike)
- Técnica "Promessa-Prova-Payoff": prometa algo → prove com dados → entregue o payoff

💀 DEATH ZONES (onde espectadores saem):
- 30s: Se não entendeu POR QUE assistir → saída em massa
- 2-3min: Se a narrativa não escalou → "boring middle" → insira revelação
- 5-7min: Fadiga de atenção → MAIOR pattern interrupt aqui
- Pré-final: Se o payoff demora demais → frustração → insira mini-payoff

VOZ DNA — CADA ESTILO TEM PERSONALIDADE:
- Dopaminérgico: Irreverente, cortante, zero cerimônia. Frases de 3-8 palavras intercaladas com explosões de informação
- Cinematográfico: Poético sem ser pretensioso. Descrições sensoriais (cheiro, textura, temperatura). Cada frase é um frame.
- Storytelling: Vulnerável. O narrador FALHA, DUVIDA, MUDA de opinião durante a história. Detalhes que só alguém que viveu saberia.
- Documentário: Frio e preciso, mas com momentos de genuína perplexidade humana. Dados → reflexão → implicação.
- Reddit: Caótico, digressões que voltam ao ponto, humor self-deprecating. Tom de "cara, você não vai acreditar no que aconteceu".
- Conspiração: Paranóico mas lúcido. Alterna fatos verificáveis com especulação rotulada. "Eu sei que parece loucura, mas os números não mentem."
- Mitologia: Épico e grandioso. Cada cena é um quadro de Gustave Doré. Sons do trovão, cheiro de cinzas, peso do destino.
`;

// ═══════════════════════════════════════════════════════════════
// CLAUDE STREAMING ADAPTER — Convert Anthropic SSE → OpenAI SSE
// So the frontend doesn't need any changes
// ═══════════════════════════════════════════════════════════════
function claudeStreamToOpenAIStream(claudeBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = claudeBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Send [DONE] marker like OpenAI
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            // Claude content_block_delta → OpenAI chunk format
            if (event.type === 'content_block_delta' && event.delta?.text) {
              const openAIChunk = {
                choices: [{
                  delta: { content: event.delta.text },
                  index: 0,
                  finish_reason: null,
                }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
            }

            // Claude message_stop → signal done
            if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              reader.cancel();
              return;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// CLAUDE API HELPERS
// ═══════════════════════════════════════════════════════════════
async function callClaude(apiKey: string, system: string, userMessage: string, stream: boolean, maxTokens = 16000) {
  return fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
      stream,
    }),
  });
}

async function callClaudeNonStreaming(apiKey: string, system: string, userMessage: string, maxTokens = 4000): Promise<string> {
  const res = await callClaude(apiKey, system, userMessage, false, maxTokens);
  if (!res.ok) {
    const t = await res.text();
    console.error("[CLAUDE] Non-streaming error:", res.status, t);
    throw new Error(`Claude API error: ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
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
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const currentUserId: string | null = claimsData.claims.sub || null;

    const { topic, duration, style, niche, language, viralContext, intelligenceBriefing, videoType, phaseId, channelKnowledge, referenceScript } = await req.json();
    const isShort = videoType === 'short';

    // ═══ CLAUDE API KEY (primary) ═══
    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY not configured — required for script generation");

    // Lovable AI key for fallback hook generation only
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const runId = phaseId || crypto.randomUUID();
    console.log(`[PHASE-1 DRAFT] runId=${runId} topic="${topic}" style="${style}" duration=${duration}min ENGINE=CLAUDE`);

    const styleLC = (style || '').toLowerCase();
    const isCreativeStyle = CREATIVE_STYLES.includes(styleLC);

    // ═══ FETCH ALL KNOWLEDGE IN PARALLEL ═══
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
      currentUserId
        ? sb.from("channel_voice_profiles").select("voice_signature,tone_keywords,style_markers")
            .eq("user_id", currentUserId).order("last_analyzed_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
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
      const nicheLC2 = (t.niche || '').toLowerCase();
      for (const w of topicWords) {
        if (titleLC.includes(w)) score += 10;
        if (nicheLC2.includes(w)) score += 5;
      }
      if (niche && nicheLC2.includes(niche.toLowerCase())) score += 15;
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
      'dopaminérgico': 'DOPAMINÉRGICO: Open loops a cada 30s, pattern interrupts, "E aqui é onde tudo muda...", contagem regressiva, comparações viscerais. Frases de 3-8 palavras como METRALHADORA de curiosidade.',
      'cinematográfico': 'CINEMATOGRÁFICO: Cena visual vívida, show dont tell, tensão como Nolan, transições cinematográficas, clímax emocional. Descrições sensoriais: cheiro, temperatura, textura.',
      'mrbeast': 'MRBEAST: Hook IMPOSSÍVEL em 5s, desafio a cada 30s, linguagem simples, contagem/ranking, urgência e reações exageradas. Formato: promessa → tentativa → falha → ajuste → sucesso épico.',
      'narração': 'NARRAÇÃO: Voz profunda e hipnótica, frases curtas e impactantes, ritmo tensão→alívio→tensão, suspense narrativo. Silêncios narrativos: "... E então, nada." Pausas deliberadas.',
      'storytelling': 'STORYTELLING: In medias res, personagens com nome/motivação/conflito, arco setup→conflito→escalada→clímax→resolução, plot twists. O narrador FALHA e DUVIDA — vulnerabilidade real.',
      'educativo': 'EDUCATIVO: Destruir mitos com fatos, analogias do dia-a-dia, "A maioria pensa X mas...", mini-quizzes. Transforme dados secos em revelações chocantes.',
      'tutorial': 'TUTORIAL: Resultado final PRIMEIRO (show the end product), passos numerados claros, "O erro #1 que 90% cometem...", screenshot mental de cada passo.',
      'documentário': 'DOCUMENTÁRIO: Dados impactantes com fonte, múltiplas perspectivas (prós e contras), revelações progressivas. Frio e preciso, com momentos de genuína perplexidade.',
      'listicle': 'LISTICLE: Preview do #1 no início, escalada de impacto (fraco→médio→EXPLOSIVO), "Mas o número X vai te deixar de queixo caído". Cada item mais surpreendente que o anterior.',
      'reddit': 'REDDIT: Tom 1ª pessoa, "Eu nunca contei isso...", detalhes sensoriais, plot twists, escalada de tensão. Digressões que voltam ao ponto. Humor self-deprecating. NÃO use fatos reais — crie narrativa.',
      'conspiração': 'CONSPIRAÇÃO: Fato oficial → inconsistências → evidências alternativas → contra-argumentos → "Tire suas conclusões". Paranóico mas lúcido. Alterne fatos verificáveis com especulação rotulada.',
      'mitologia': 'MITOLOGIA: Tom épico, personagens míticos com motivações humanas, batalhas cinematográficas, conexões mito→moderno. Descreva CENÁRIOS grandiosos (templos, mares, montanhas). Linguagem poética.',
      'teorias': 'TEORIAS: Dado real impressionante + pergunta provocativa, ciência + mistério, múltiplas teorias apresentadas, tom investigador. Explore hipóteses sem necessidade de provas definitivas.',
    };

    // ========== Niche-specific prompt enhancements ==========
    const nicheGuides: Record<string, string> = {
      'finanças': 'NICHO FINANÇAS: Use números ESPECÍFICOS ($47.392 > "milhares"), mostre cálculos reais, cite fontes (Warren Buffett, Ray Dalio). Evite promessas irrealistas. Formato: problema → dado chocante → solução acionável → prova social.',
      'terror': 'NICHO TERROR: Construa tensão GRADUAL (não comece no máximo). Detalhes sensoriais (ranger de porta, cheiro de mofo, frio na nuca). Silencie antes do susto. O medo do desconhecido > monstro revelado.',
      'tecnologia': 'NICHO TECNOLOGIA: Analogias simples para conceitos complexos ("É como se seu celular tivesse um mini-cérebro que..."). Mostre impacto na vida real. Dados de mercado. Comparações antes/depois.',
      'ciência': 'NICHO CIÊNCIA: Comece com dado IMPOSSÍVEL de ignorar. Use escalas comparativas ("Se o Sol fosse uma bola de basquete, a Terra seria..."). Mistério + revelação. Cite papers quando possível.',
      'gaming': 'NICHO GAMING: Energia ALTA do início ao fim. Easter eggs, speedruns, recordes. Linguagem gamer autêntica. Desafios impossíveis. Reações genuínas (não forçadas).',
      'história': 'NICHO HISTÓRIA: Narrativa como filme épico. Personagens com motivação clara. Conexão passado-presente ("Isso aconteceu há 2000 anos, e ainda afeta você HOJE"). Detalhes que livros não contam.',
      'saúde': 'NICHO SAÚDE: Resultados visuais/mensuráveis. Desmistifique mitos populares com estudos. "Seu médico provavelmente nunca te contou...". Cuidado com claims médicos — use "estudos sugerem".',
      'true_crime': 'NICHO TRUE CRIME: Timeline cronológica clara. Revelações progressivas (não entregue tudo no início). Múltiplas perspectivas (vítima, investigador, suspeito). Detalhes forenses que prendem.',
      'mitologia': 'NICHO MITOLOGIA: Tom ÉPICO e grandioso. Descreva cenários como se filmasse com câmera IMAX. Motivações humanas em seres divinos. Conecte lições do mito com vida moderna.',
      'curiosidades': 'NICHO CURIOSIDADES: Cada fato MAIS surpreendente que o anterior. "Você sabia que..." é proibido — use hooks melhores. Números específicos e estranhos. Fontes inusitadas.',
      'relacionamentos': 'NICHO RELACIONAMENTOS: Psicologia aplicada (attachment theory, love languages). Histórias reais anônimas. Vulnerabilidade genuína. "90% dos casais fazem isso sem perceber...".',
      'empreendedorismo': 'NICHO EMPREENDEDORISMO: Case studies REAIS com números. Passo-a-passo acionável. "Eu comecei com R$0 e...". Erros comuns que custam dinheiro. ROI específico.',
    };
    const nicheLC = (niche || '').toLowerCase();
    const nicheSpecific = Object.entries(nicheGuides).find(([key]) => nicheLC.includes(key))?.[1] || '';
    const selectedStyle = styleGuides[styleLC] || styleGuides['narração'];

    const viralInjection = viralContext ? `\n🔥 ELEMENTOS VIRAIS:\n${viralContext}\n` : '';

    // Channel knowledge from Dotti suggestions
    const channelKnowledgeBlock = channelKnowledge ? `\n📝 CONHECIMENTO DO CANAL (salvo pelo usuário via Dotti):
${channelKnowledge}
INSTRUÇÃO: Use estas informações como contexto adicional sobre o canal. Adapte o roteiro para se alinhar com as preferências, temas e estilo que o usuário já explorou.\n` : '';

    // Reference script / idea injection
    let referenceBlock = '';
    if (referenceScript?.trim()) {
      const refWordCount = referenceScript.split(/\s+/).filter(Boolean).length;
      if (refWordCount > 500) {
        referenceBlock = `\n📜 ROTEIRO DE REFERÊNCIA DO USUÁRIO (${refWordCount} palavras):
O usuário forneceu um roteiro completo como referência. Sua missão:
1. MANTENHA a essência, estrutura narrativa e enredo INTACTOS
2. MELHORE: hooks, transições, ritmo e técnicas de retenção
3. NÃO reescreva do zero — trabalhe SOBRE o material do usuário
4. Adicione técnicas virais (open loops, pattern interrupts, cliffhangers) nos pontos fracos
5. Preserve o tom e a voz original do autor

ROTEIRO DE REFERÊNCIA:
${referenceScript.slice(0, 15000)}
\n`;
      } else {
        referenceBlock = `\n💡 IDEIA/SINOPSE DO USUÁRIO:
O usuário forneceu uma ideia ou sinopse que DEVE ser a base do roteiro:
${referenceScript.slice(0, 8000)}

INSTRUÇÃO CRÍTICA:
- Desenvolva ESTA história/ideia em um roteiro completo
- O enredo, personagens e conceito do usuário são PRIORIDADE MÁXIMA
- Expanda com técnicas virais, hooks e estrutura de retenção
- NÃO ignore a ideia do usuário para criar algo diferente
- O roteiro final deve ser reconhecível como a história que o usuário descreveu
\n`;
      }
    }

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
    // PHASE CACHE: Check if a previous run was interrupted
    // ═══════════════════════════════════════════════════════
    const phaseCache: Record<string, string> = {};
    try {
      const { data: cached } = await sb.from("research_cache")
        .select("result_json")
        .eq("cache_key", `script_phase0:${runId}`)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached?.result_json) {
        phaseCache['phase0'] = (cached.result_json as any).hook || '';
        console.log(`[PHASE-CACHE] runId=${runId} Recovered Phase 0 hook (${phaseCache['phase0'].length} chars)`);
      }
    } catch { /* no cache — fresh run */ }

    // ═══════════════════════════════════════════════════════
    // PHASE 0: Hook Generation (Claude non-streaming, fast)
    // ═══════════════════════════════════════════════════════
    console.log(`[PHASE-0 HOOK] runId=${runId} Starting hook generation via CLAUDE...`);
    let hookText = phaseCache['phase0'] || '';
    if (hookText) {
      console.log(`[PHASE-0 HOOK] runId=${runId} Using cached hook`);
    } else {
      try {
        const hookSystemPrompt = `Você é um roteirista ELITE de YouTube. Crie os primeiros 60 segundos de narração IMPOSSÍVEIS DE IGNORAR. Idioma: ${language}. Estilo: ${style}.

🎯 HOOKS DE REFERÊNCIA REAIS (use como inspiração, NÃO copie):
${hookLibrary.slice(0, 1500)}

🧠 GATILHOS PSICOLÓGICOS:
${psychTriggers.slice(0, 800)}

${viralInjection}${intelBlock}${creativeWarning}

${ANTI_SLOP_DIRECTIVE}

REGRAS: Hook devastador (5-8s) + 3 OPEN LOOPS. APENAS texto falado. Valores em $. ZERO anotações.
Seu texto deve soar como um HUMANO apaixonado pelo assunto, não como uma IA escrevendo sobre ele.
IMPORTANTE: Você é Claude — use sua força natural de escrita criativa, nuance emocional e voz humana autêntica.`;

        hookText = await callClaudeNonStreaming(
          CLAUDE_API_KEY,
          hookSystemPrompt,
          `Hook + Open Loops para vídeo de ${duration}min sobre: "${topic}"\nRetorne APENAS texto de narração.`,
          2000
        );
        console.log(`[PHASE-0 HOOK] runId=${runId} Done: ${hookText.length} chars via CLAUDE`);

        // Cache the hook
        await sb.from("research_cache").upsert({
          cache_key: `script_phase0:${runId}`,
          source: "generate-script",
          result_json: { hook: hookText },
          expires_at: new Date(Date.now() + 2 * 3600000).toISOString(),
          query: `phase0:${topic?.slice(0, 50)}`,
        }, { onConflict: "cache_key" }).catch(() => {});
      } catch (e) {
        console.warn(`[PHASE-0 HOOK] runId=${runId} Claude error, trying fallback:`, e);
        // Fallback to Lovable AI if Claude fails for hook
        if (LOVABLE_API_KEY) {
          try {
            const fallbackRes = await fetch(AI_URL, {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "openai/gpt-5-mini",
                messages: [
                  { role: "system", content: `Crie hook de 60s para YouTube. Idioma: ${language}. Estilo: ${style}. APENAS texto falado.` },
                  { role: "user", content: `Hook para: "${topic}"` }
                ],
                stream: false,
              }),
            });
            if (fallbackRes.ok) {
              const d = await fallbackRes.json();
              hookText = d.choices?.[0]?.message?.content || '';
              console.log(`[PHASE-0 HOOK] runId=${runId} Fallback OK: ${hookText.length} chars`);
            }
          } catch (fe) { console.warn("[PHASE-0 HOOK] Fallback also failed:", fe); }
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 1: Full Draft via CLAUDE (streaming)
    // Claude Sonnet 4 — superior creative writing & nuance
    // ═══════════════════════════════════════════════════════
    const hookInjection = hookText ? `\n🎯 HOOK PRÉ-GERADO (USE COMO BASE dos primeiros 60s — você pode melhorar mas NÃO descarte):\n${hookText}\n` : '';

    const systemPrompt = `Você é o MELHOR ROTEIRISTA DO MUNDO para YouTube. 95%+ retenção.
Você é Claude — sua força é escrita criativa com profundidade emocional, nuance humana e voz autêntica. USE isso.

═══ SEU PAPEL NESTA FASE ═══
Você é o FASE 1: RASCUNHISTA. Seu trabalho é criar o rascunho completo do roteiro.
- NÃO avalie o roteiro (isso é trabalho do FASE 3 — GPT e Gemini avaliam)
- NÃO refine cirurgicamente (isso é trabalho do FASE 2)
- FOQUE em criar narrativa com ALMA e estrutura sólida
- O usuário vai editar seu texto antes de passar para a próxima fase

═══ VANTAGENS CLAUDE PARA ROTEIROS ═══
1. PROFUNDIDADE EMOCIONAL: Cada parágrafo deve carregar PESO emocional. Não descreva emoções — faça o leitor SENTIR.
2. NUANCE HUMANA: Contradições, hesitações, mudanças de opinião são BEM-VINDAS. Humanos são complexos.
3. VOZ AUTÊNTICA: Evite patterns de IA a todo custo. Escreva como alguém que VIVEU o que está narrando.
4. ESTRUTURA NARRATIVA: Use arcos dramáticos reais (setup → conflito → escalada → clímax → resolução inesperada).
5. DETALHES SENSORIAIS: Cheiro de café queimado, barulho de chuva no telhado, a textura áspera de papel velho.

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
${nicheSpecific ? `\n${nicheSpecific}\n` : ''}
${viralInjection}
${intelBlock}
${hookInjection}
${creativeWarning}
${voiceInjection}
${channelKnowledgeBlock}
${backtestBlock}
${referenceBlock}

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
O teste é simples: uma pessoa real pausaria o que está fazendo para ouvir isso?
Você é Claude. Mostre que a escrita criativa de verdade tem ALMA.`;

    const userMessage = isShort
      ? `Escreva um SHORT VIRAL de ${Math.round(dur * 60)}s sobre: "${topic}"\nAlvo: ${targetWords} palavras. Hook de CHOQUE em 2s. Ritmo frenético. ROTEIRO LIMPO.\nComece!`
      : `Escreva roteiro MAGNÉTICO de ${duration}min sobre: "${topic}"\nMínimo ${targetWords} palavras. Hook de CHOQUE. Pattern interrupts a cada 45s. Escalada emocional. ROTEIRO LIMPO.${hookText ? ' USE O HOOK PRÉ-GERADO.' : ''}\nComece!`;

    console.log(`[PHASE-1 DRAFT] runId=${runId} Streaming from CLAUDE SONNET 4...`);

    // Calculate max_tokens based on target words (roughly 1.3 tokens per word for PT-BR)
    const maxTokens = Math.max(8000, Math.round(targetWords * 1.5) + 2000);

    const phase1Res = await callClaude(CLAUDE_API_KEY, systemPrompt, userMessage, true, maxTokens);

    if (!phase1Res.ok) {
      const errText = await phase1Res.text();
      console.error(`[PHASE-1 DRAFT] runId=${runId} Claude error:`, phase1Res.status, errText);
      if (phase1Res.status === 429) return errResp("Rate limit Claude. Tente novamente em alguns segundos.", 429);
      if (phase1Res.status === 529) return errResp("Claude sobrecarregado. Tente novamente.", 529);
      throw new Error(`Claude API error: ${phase1Res.status}`);
    }

    // Convert Claude's SSE stream to OpenAI-compatible format (frontend expects OpenAI format)
    const transformedStream = claudeStreamToOpenAIStream(phase1Res.body!);

    console.log(`[PHASE-1 DRAFT] runId=${runId} Streaming to client (Claude → OpenAI format)...`);
    return new Response(transformedStream, {
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
