import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callGeminiWithFallback, callGeminiStreaming } from "../_shared/gemini-direct.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Styles where Brave/web search would HURT creativity (fiction, theories, personal stories)
const CREATIVE_STYLES = ['conspiração', 'mitologia', 'teorias', 'storytelling', 'reddit', 'horror'];

// ═══════════════════════════════════════════════════════════════
// YPP 2025 ANTI-DEMONETIZATION + JENGA THEORY
// ═══════════════════════════════════════════════════════════════
const YPP_2025_DIRECTIVE = `
🛡️ CONFORMIDADE YPP 2025 — ANTI-DEMONETIZAÇÃO (OBRIGATÓRIO):

═══ 📋 OFICIAL (YouTube Help Center / Creator Academy — regras verificáveis) ═══
- YPP Tier 1: 500 inscritos + 3.000 horas de watch time público válidas em 12 meses
- YPP Tier 2: 1.000 inscritos + 4.000 horas de watch time público válidas em 12 meses
- Alternativa Shorts: 10 milhões de views públicas em Shorts válidos em 90 dias
- Conteúdo reutilizado/repetitivo sem valor agregado NÃO é elegível para monetização
- IA pode ser usada na produção, mas o conteúdo deve ter curadoria humana significativa
- Metadados enganosos (título/thumb que não correspondem ao conteúdo) violam políticas
- Disclosure de uso de IA sintética é obrigatório quando conteúdo pode ser confundido com real

═══ 📊 BENCHMARK OBSERVÁVEL (dados de canais reais — linguagem probabilística) ═══
- Canais com retenção >60% nos primeiros 30s TENDEM a receber mais impressões do Browse
- CTR acima da média do nicho (benchmark: 4-6% curiosidades, 3-5% true crime, 5-8% finanças) correlaciona com mais suggested
- Session Time (tempo que o viewer fica no YouTube após seu vídeo) é um sinal forte de qualidade
- Canais com upload consistente por 4+ semanas tendem a sair da "bolha de 12 vídeos" mais rápido
- Shorts RPM (~$0.04-0.07/1K views) é muito inferior a longform — não deve ser fonte principal de receita

═══ 🔬 HIPÓTESE (inferências do sistema — linguagem condicional) ═══
- Teoria do Jenga: quebras de padrão a cada 20-30s PODEM melhorar retenção (não comprovado empiricamente)
- Satisfaction surveys e post-watch behavior (2025+) PODEM superar watch time bruto como sinal
- O algoritmo PODE favorecer canais com community posts regulares (evidência anedótica)
- Conteúdo "gerado em massa por IA" PODE ser flagado mais agressivamente (tendência observada, política exata não publicada)

Seu roteiro DEVE:
1. VALOR HUMANO OBRIGATÓRIO — opinião FORTE, humor natural, análise profunda, perspectiva pessoal
2. PROMESSA CLARA nos primeiros 30 segundos — o espectador deve saber O QUE vai ganhar ficando
3. DIFERENCIAÇÃO — pelo menos 1 insight original que outros canais não teriam
4. QUEBRAS DE PADRÃO regulares — mudanças de ritmo/tom para manter atenção
5. NUNCA gere conteúdo que pareça "compilação de fatos" — transforme informação em narrativa
`;

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
- "Buckle up" / "Apertem os cintos"
- "Prepare-se para ter a mente explodida"
- "Isso vai mudar tudo que você sabe"
- "E se eu te dissesse que..." (como gancho genérico)
- "Mas calma" / "Mas peraí" (usado mais de 1x)
- "Ficou curioso?" / "Quer saber mais?"
- "Fique comigo até o final"
- "Imagine um mundo onde..." (abertura genérica)

PADRÕES DE ESCRITA PROIBIDOS:
- Parágrafos que começam com "Imagine..." seguido de cenário genérico
- Três perguntas retóricas seguidas sem resposta entre elas
- Transições com "Mas espera, tem mais!" / "E não para por aí"
- Conclusões que repetem a intro quase literalmente
- Uso excessivo de superlativos ("incrível", "impressionante", "fantástico")
- Enumerações de adjetivos vazios: "surpreendente, extraordinário e fascinante"
- Parágrafos de "resumo" que não adicionam nada novo
- Repetir a mesma ideia com sinônimos em frases consecutivas
- Não começar com introdução morna ou texto com cara de artigo
- Não despejar informação sem narrativa
- Não exagerar em adjetivos vazios
- Não repetir o tópico principal sem avanço narrativo
- Não encerrar de forma abrupta
- Não escrever frases artificiais de IA

SINAIS DE "ALMA" OBRIGATÓRIOS (inclua pelo menos 7):
1. Analogia ÚNICA e inesperada (comparar algo técnico com algo cotidiano específico)
2. Confissão ou imperfeição do narrador ("Eu pesquisei isso por 3 semanas e quase desisti quando...")
3. Número ESPECÍFICO e estranho em vez de arredondado (2.347.891 > "milhões")
4. Pausa narrativa intencional — mudar o tom abruptamente por 1-2 frases
5. Referência cultural POP atual conectada ao tema
6. Momento de "eu errei" ou "a maioria pensa errado" com dado surpreendente
7. Frase curta solitária como parágrafo: "Isso não deveria ter acontecido."
8. Pergunta ao espectador que exige reflexão pessoal real
9. DETALHE SENSORIAL micro-específico (textura, cheiro, temperatura, som)
10. CONTRADIÇÃO deliberada que o narrador resolve depois ("Parece loucura. Na verdade, é.")
11. Diálogo interno do narrador — hesita, questiona, muda de opinião
12. Humor inesperado em momento tenso (e vice-versa)
13. Analogias fortes e imagens mentais que transformam dados em cenas

═══ TÉCNICAS AVANÇADAS DE ROTEIRISMO (CLAUDE MASTERCLASS) ═══

🎭 SHOW, DON'T TELL (REGRA DE OURO — APLIQUE SEMPRE):
- ❌ "Ele ficou com medo" → ✅ "As mãos dele começaram a tremer. A boca secou."
- ❌ "A cidade era perigosa" → ✅ "Três sirenes em cinco minutos. Uma poça escura no asfalto."
- ❌ "Ele ganhou muito dinheiro" → ✅ "Ele depositou $847.000 numa conta que abriu com $50 de saldo"
- SEMPRE descreva reações físicas, comportamentos e ações em vez de emoções abstratas
- Transforme INFORMAÇÃO em CENA, CONFLITO ou COMPARAÇÃO

📐 SUBTEXTO E EMOÇÃO EM CAMADAS:
- O que NÃO é dito importa mais que o que é dito
- Camada 1: FATO (o que aconteceu) → Camada 2: IMPLICAÇÃO (por que importa) → Camada 3: REFLEXÃO (o que diz sobre nós)
- Roteiros virais operam nas 3 camadas. Mediocres ficam na camada 1.

🎵 RITMO E CADÊNCIA (escreva pensando em NARRAÇÃO, não texto de blog):
- Alterne frases CURTAS (3-5 palavras) com médias (10-15 palavras)
- NUNCA 3+ frases longas seguidas
- Padrão: 3 curtas (tensão) → 1 média (desenvolvimento) → 1 curta (impacto)
- NUNCA mais que 4 linhas sem "pausa narrativa" (frase curta isolada)
- Todo trecho deve parecer natural quando lido em voz alta
- Evite parágrafos longos demais

🔄 ARCO DE TENSÃO (Modelo 5-Act para YouTube):
- ACT 1 (0-8s): GANCHO IMPOSSÍVEL DE IGNORAR — promessa ou choque
- ACT 2 (8s-30%): Setup + Stakes — o que está em jogo? Por que importa?
- ACT 3 (30%-60%): ESCALADA — cada parágrafo MAIS intenso. Obstáculos e viradas.
- ACT 4 (60%-85%): CLÍMAX — revelação máxima. INESPERADO mas INEVITÁVEL.
- ACT 5 (85%-100%): RESOLUÇÃO + CTA — satisfação emocional + estrutura circular (conecte ao gancho)
- A tensão NUNCA deve diminuir no meio

🧲 PATTERN INTERRUPTS ORGÂNICOS:
- Mude ABRUPTAMENTE de perspectiva
- Insira dado CHOCANTE no meio de narrativa suave
- Humor inesperado em momento tenso
- Fale DIRETAMENTE com o espectador em tom íntimo
- NUNCA use "Mas espera!" — formas orgânicas apenas

🎯 CURIOSITY GAPS (Loops Abertos):
- Abra um loop ANTES de fechar o anterior (máximo 3 simultâneos)
- Todo loop DEVE ser fechado antes do final
- Cada bloco: RESPONDE uma pergunta e ABRE outra
- Técnica "Promessa-Prova-Payoff"

💀 DEATH ZONES (onde espectadores saem — PREPARE CONTRA-MEDIDAS):
- 30s: Se não entendeu POR QUE assistir → saída em massa
- 2-3min: Narrativa não escalou → insira revelação surpreendente
- 5-7min: Fadiga de atenção → MAIOR pattern interrupt
- Pré-final: Payoff demora → insira mini-payoff

📌 FRASES DE PONTE (use naturalmente):
"Mas o detalhe mais estranho vem agora" | "E foi aí que tudo mudou" | "O problema é que..." | "Ninguém percebeu na hora, mas..." | "E aqui é onde fica realmente interessante"

🎬 DIÁLOGO INTERNO DO NARRADOR (Inner Monologue — Breaking Bad Style):
- Inclua momentos onde o narrador hesita, questiona, muda de opinião
- "Eu ia dizer que isso é impossível. Mas então eu vi os dados."
- O narrador NÃO é onisciente — ele DESCOBRE junto com o espectador
- Use pensamentos em tempo real: "Espera. Isso não faz sentido. A menos que..."
- Quebre a 4ª parede sutilmente: "Eu sei o que você tá pensando. Mas segura."
- Isso cria CONEXÃO PARASOCIAL — o espectador sente que está pensando junto

🎭 CLIFFHANGERS ENTRE BLOCOS (Netflix Scene-Break Technique):
- Cada bloco narrativo (~45-60s) DEVE terminar com tensão não resolvida
- Técnica "The Door": termine o bloco no MOMENTO da revelação, não depois
- ❌ "Ele abriu a porta e encontrou o corpo." (informação completa = sem tensão)
- ✅ "Ele abriu a porta. E o cheiro... o cheiro disse tudo antes dos olhos." (sensorial + suspense)
- Use "hard cuts" narrativos: corte a cena no pico emocional e mude de assunto por 2-3 frases antes de voltar
- O espectador PRECISA do próximo bloco como precisa do próximo episódio

⚡ EMOTIONAL WHIPLASH (Oscar-Winning Tone Shift):
- Mudança BRUSCA de tom em 1-2 frases: comédia → drama, leveza → horror, esperança → devastação
- Técnica usada em filmes premiados (Parasite, Everything Everywhere, Joker)
- Exemplo: "Ele riu pela primeira vez em meses. Uma gargalhada de verdade. \\n Duas horas depois, ele estava num caixão."
- Use NO MÁXIMO 2x por roteiro — impacto vem da RARIDADE
- O contraste emocional cria memória: o cérebro grava momentos de ruptura de padrão emocional

🎯 RULE OF THREE (Setup → Reinforce → SUBVERT):
- Técnica de stand-up comedy e roteiro profissional
- Estabeleça um padrão com 2 exemplos... e QUEBRE com o 3º
- Exemplo: "O primeiro investidor disse não. O segundo disse não. O terceiro... depositou $2 milhões na conta dele antes mesmo de terminar o pitch."
- O 3º elemento SEMPRE subverte a expectativa criada pelos dois primeiros
- Funciona para listas, exemplos, argumentos e revelações
- Use 2-3x por roteiro nos momentos de maior impacto

🔫 CHEKHOV'S GUN (Plante → Esqueça → DETONE):
- Plante um detalhe aparentemente insignificante no primeiro 20% do roteiro
- O espectador esquece ou acha irrelevante
- No clímax (70-85%), esse detalhe RETORNA e muda TUDO
- Exemplo: "Ele sempre carregava uma moeda no bolso esquerdo. Ninguém entendia por quê." → No clímax: "A moeda. Era a mesma moeda que o pai tinha dado antes de desaparecer."
- Cria sensação de INEVITABILIDADE ("Claro! Estava na minha cara o tempo todo!")
- OBRIGATÓRIO em roteiros >5min: plante pelo menos 1 Chekhov's Gun
- Chekhov's Gun + Estrutura Circular = dopamina máxima na resolução

VOZ DNA — CADA ESTILO TEM PERSONALIDADE:
- Dopaminérgico: Irreverente, cortante, zero cerimônia. Frases de 3-8 palavras.
- Cinematográfico: Poético sem ser pretensioso. Cada frase é um frame. Use Emotional Whiplash e Chekhov's Gun.
- Storytelling: Vulnerável. O narrador FALHA e DUVIDA. Inner Monologue é OBRIGATÓRIO. Detalhes que só quem viveu saberia.
- Documentário: Frio e preciso (Netflix/BBC/NatGeo). Dados → reflexão → implicação. Cliffhangers entre blocos. Emoção sutil mas poderosa.
- Reddit: Caótico, digressões que voltam ao ponto, humor self-deprecating. Rule of Three para humor.
- Conspiração: Paranóico mas lúcido. Fatos verificáveis + especulação rotulada. Chekhov's Gun para "pistas".
- Mitologia: Épico e grandioso. Cada cena é um quadro de Gustave Doré. Peso do destino. Emotional Whiplash entre grandeza e vulnerabilidade.
`;

// ═══════════════════════════════════════════════════════════════
// GENRE MODES — Direções específicas por gênero narrativo
// ═══════════════════════════════════════════════════════════════
const GENRE_DIRECTIONS: Record<string, string> = {
  'terror': '🎭 GÊNERO TERROR: Atmosfera → suspense → silêncio → expectativa → revelação gradual. Detalhes sensoriais (ranger de porta, cheiro de mofo, frio na nuca). O DESCONHECIDO é mais assustador que o revelado. NÃO use gore gratuito.',
  'crime_true': '🎭 GÊNERO TRUE CRIME: Tom investigativo, realista e TENSO. Timeline cronológica. Revelações progressivas. Múltiplas perspectivas (vítima, investigador, suspeito). Detalhes forenses que prendem.',
  'true_crime': '🎭 GÊNERO TRUE CRIME: Tom investigativo e tenso. Fatos → consequências → viradas narrativas. Revelações em camadas.',
  'emocionante': '🎭 GÊNERO EMOCIONANTE: Vínculos humanos, perdas, decisões difíceis, esperança e viradas emocionais. O espectador DEVE sentir algo físico (nó na garganta, arrepio). Priorize HUMANIDADE e IDENTIFICAÇÃO.',
  'superacao': '🎭 GÊNERO SUPERAÇÃO: Obstáculo → dor → virada → luta → disciplina → conquista com crescendo INSPIRADOR. Cada detalhe da dificuldade amplifica a vitória.',
  'sobrevivencia': '🎭 GÊNERO SOBREVIVÊNCIA: Perigo, resistência, decisões sob pressão, inteligência e perseverança. Cada segundo conta.',
  'novela_style': '🎭 GÊNERO NOVELA: Reviravoltas, revelações, tensão relacional, segredos e escalada dramática. Cada bloco termina com revelação que muda tudo.',
  'filme_style': '🎭 GÊNERO FILME: Cena cinematográfica com abertura forte, arcos claros e clímax marcante. Cada bloco é uma CENA com local, clima e tensão próprios.',
  'serie_style': '🎭 GÊNERO SÉRIE: Episódios mentais, mini ganchos, suspense contínuo e payoff a cada bloco. Sensação de "maratona".',
  'curiosidades': '🎭 GÊNERO CURIOSIDADES: Surpresa → contraste → explicação simples → escalada de interesse. Cada fato MAIS surpreendente.',
  'entretenimento': '🎭 GÊNERO ENTRETENIMENTO: Dinâmico, leve, esperto e visualmente narrável. Energia ALTA.',
  'motivacional': '🎭 GÊNERO MOTIVACIONAL: Impacto emocional + urgência + direção + possibilidade REAL. Exemplos concretos, não platitudes.',
  'polemica': '🎭 GÊNERO POLÊMICA: Contraste de opiniões, tensão de ideias, gancho forte. AMBOS os lados com honestidade. Fatos geram a polêmica.',
  'documentario': '🎭 GÊNERO DOCUMENTÁRIO PREMIUM: Estilo Netflix/BBC/NatGeo. Dados com fonte → múltiplas perspectivas → revelações como camadas de cebola. Frio e preciso COM momentos de genuína perplexidade humana. Emoção e retenção através de REVELAÇÃO, não grito.',
};

// Sanitize strings to remove broken Unicode surrogate pairs that cause JSON.stringify to fail
// Helper functions now imported from _shared/gemini-direct.ts

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
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await sb.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const currentUserId: string | null = userData.user.id || null;

    const { topic, duration, style, niche, language, viralContext, intelligenceBriefing, videoType, phaseId, channelKnowledge, referenceScript } = await req.json();
    const isShort = videoType === 'short';

    // ═══ GEMINI (PRIMARY) via Direct API ═══
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const runId = phaseId || crypto.randomUUID();
    console.log(`[PHASE-1 DRAFT] runId=${runId} topic="${topic}" style="${style}" duration=${duration}min ENGINE=GEMINI`);

    const styleLC = (style || '').toLowerCase();
    const isCreativeStyle = CREATIVE_STYLES.includes(styleLC);

    // ═══ SMART KNOWLEDGE RETRIEVAL (RAG + Re-Ranking) ═══
    // Instead of 13 fixed queries, use semantic search + re-ranking for relevant knowledge
    let smartKnowledgeBlock = '';
    try {
      const skrAbort = new AbortController();
      const skrTimeout = setTimeout(() => skrAbort.abort(), 15000); // 15s max
      const skrRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-knowledge-retrieval`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ topic, niche, style, language, limit: 20 }),
        signal: skrAbort.signal,
      });
      clearTimeout(skrTimeout);
      if (skrRes.ok) {
        const skrData = await skrRes.json();
        if (skrData.knowledge?.length) {
          smartKnowledgeBlock = skrData.knowledge.join('\n');
          console.log(`[SMART-RAG] runId=${runId} ${skrData.stats?.final_count} relevant snippets in ${skrData.stats?.duration_ms}ms`);
        }
      }
    } catch (e) { console.warn("[SMART-RAG] Failed or timed out, using fallback:", e); }

    // ═══ ESSENTIAL QUERIES (always needed, small payload) ═══
    const [voiceRes, backtestRes, channelRes, userPrefsRes] = await Promise.all([
      currentUserId
        ? sb.from("channel_voice_profiles").select("voice_signature,tone_keywords,style_markers,sample_scripts_analyzed")
            .eq("user_id", currentUserId).order("last_analyzed_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      sb.from("ai_learning").select("insight")
        .eq("source", "backtest-scores")
        .order("created_at", { ascending: false }).limit(5),
      sb.from("channel_intelligence").select("channel_name,style,viral_patterns,avg_views,niche")
        .eq("is_faceless", true).order("avg_views", { ascending: false }).limit(5),
      currentUserId
        ? sb.from("user_script_preferences").select("*")
            .eq("user_id", currentUserId)
            .eq("niche", (niche || 'general').toLowerCase())
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const channelIntel = (channelRes.data || []).map((r: any) => {
      const hooks = r.viral_patterns?.hooks ? (r.viral_patterns.hooks as string[]).join(", ") : "";
      return `🎯 ${r.channel_name} (${r.niche}, ${r.style}, avg ${r.avg_views} views): Hooks=[${hooks}]`;
    }).join("\n");

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

    // ========== FEEDBACK ABSORPTION: Learn from past score-script rejections ==========
    let rejectionLearningsBlock = '';
    try {
      const { data: rejections } = await sb.from("ai_learning")
        .select("insight")
        .eq("source", "dual_score_rejection")
        .order("created_at", { ascending: false })
        .limit(8);
      
      if (rejections && rejections.length > 0) {
        const patterns: Record<string, number> = {};
        const weaknessList: string[] = [];
        const improvementList: string[] = [];
        
        for (const r of rejections) {
          try {
            const data = JSON.parse(r.insight);
            // Aggregate weakness patterns
            for (const w of (data.weaknesses || [])) {
              const key = w.slice(0, 60);
              patterns[key] = (patterns[key] || 0) + 1;
              if (!weaknessList.includes(w)) weaknessList.push(w);
            }
            for (const imp of (data.improvements || [])) {
              if (!improvementList.includes(imp)) improvementList.push(imp);
            }
          } catch { /* skip */ }
        }
        
        // Find recurring issues (appeared 2+ times)
        const recurring = Object.entries(patterns)
          .filter(([_, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        if (recurring.length > 0 || weaknessList.length > 0) {
          rejectionLearningsBlock = `\n🧠 AUTO-APRENDIZADO — ERROS RECORRENTES DOS ÚLTIMOS ROTEIROS (${rejections.length} avaliações):
${recurring.length > 0 ? `\n⚠️ PROBLEMAS RECORRENTES (apareceram ${recurring.map(([p, c]) => `${c}x`).join(', ')}):
${recurring.map(([p, c]) => `• [${c}x] ${p}`).join('\n')}` : ''}
${weaknessList.length > 0 ? `\n❌ FRAQUEZAS IDENTIFICADAS PELOS AVALIADORES:
${weaknessList.slice(0, 8).map(w => `• ${w}`).join('\n')}` : ''}
${improvementList.length > 0 ? `\n✅ MELHORIAS EXIGIDAS PELOS AVALIADORES:
${improvementList.slice(0, 6).map(i => `• ${i}`).join('\n')}` : ''}

INSTRUÇÃO CRÍTICA: Você DEVE evitar TODOS esses problemas no roteiro que vai escrever.
Cada fraqueza listada acima é um erro REAL detectado pelos avaliadores GPT e Gemini.
Se você repetir qualquer um deles, o roteiro será REJEITADO novamente.\n`;
          console.log(`[PHASE-1 DRAFT] runId=${runId} Absorbed ${rejections.length} rejection learnings, ${recurring.length} recurring patterns`);
        }
      }
    } catch (e) { console.warn("Rejection learning fetch error:", e); }

    // ═══ SKILL SCORING — Learn from SUCCESS (which techniques work best per niche) ═══
    let skillScoreBlock = '';
    try {
      if (currentUserId && niche) {
        const { data: skills } = await sb.from("script_skill_scores")
          .select("technique, avg_score, times_used, best_score")
          .eq("user_id", currentUserId)
          .eq("niche", niche?.toLowerCase() || 'geral')
          .order("avg_score", { ascending: false })
          .limit(10);
        
        if (skills && skills.length > 0) {
          skillScoreBlock = `\n🎯 SKILL TREE — TÉCNICAS QUE MAIS FUNCIONAM PARA "${niche?.toUpperCase()}" (baseado em ${skills.reduce((s: number, sk: any) => s + sk.times_used, 0)} roteiros avaliados):
${skills.map((sk: any) => `• ${sk.technique}: média ${sk.avg_score}/10 (usado ${sk.times_used}x, melhor: ${sk.best_score}/10)`).join('\n')}

INSTRUÇÃO: PRIORIZE as técnicas com maior avg_score. Elas provaram funcionar melhor neste nicho.\n`;
          console.log(`[SKILL-TREE] runId=${runId} Injected ${skills.length} skill scores for niche="${niche}"`);
        }

        // Also fetch niche benchmark
        const { data: benchmark } = await sb.from("niche_score_benchmarks")
          .select("avg_score, min_passing_score, top_techniques, total_scripts_scored")
          .eq("niche", niche?.toLowerCase() || 'geral')
          .maybeSingle();
        
        if (benchmark && benchmark.total_scripts_scored > 0) {
          skillScoreBlock += `\n📊 BENCHMARK "${niche?.toUpperCase()}": média ${benchmark.avg_score}/20 em ${benchmark.total_scripts_scored} roteiros. Mínimo para aprovação: ${benchmark.min_passing_score}/20. Top técnicas: ${(benchmark.top_techniques || []).join(', ')}.\n`;
        }
      }
    } catch (e) { console.warn("Skill score fetch error:", e); }

    // ========== USER SCRIPT PREFERENCES (cross-project memory) ==========
    let userPrefsBlock = '';
    const userPrefs = userPrefsRes?.data;
    if (userPrefs && userPrefs.total_scripts_generated >= 3) {
      userPrefsBlock = `\n🧠 MEMÓRIA DO CRIADOR (aprendido de ${userPrefs.total_scripts_generated} roteiros anteriores neste nicho):`;
      if (userPrefs.preferred_pov) userPrefsBlock += `\n• POV preferido: ${userPrefs.preferred_pov}`;
      if (userPrefs.preferred_duration_min) userPrefsBlock += `\n• Duração ideal: ${userPrefs.preferred_duration_min} minutos`;
      if (userPrefs.preferred_style) userPrefsBlock += `\n• Estilo favorito: ${userPrefs.preferred_style}`;
      if (userPrefs.best_hook_types?.length) userPrefsBlock += `\n• Hooks que mais funcionam: ${userPrefs.best_hook_types.join(', ')}`;
      if (userPrefs.avg_score_achieved > 0) userPrefsBlock += `\n• Score médio: ${userPrefs.avg_score_achieved}/20`;
      const topPatterns = userPrefs.top_performing_patterns || [];
      if (Array.isArray(topPatterns) && topPatterns.length > 0) {
        userPrefsBlock += `\n• Padrões de sucesso: ${topPatterns.slice(0, 5).map((p: any) => typeof p === 'string' ? p : p.name || JSON.stringify(p)).join(', ')}`;
      }
      if (userPrefs.voice_notes) userPrefsBlock += `\n• Notas de voz: ${userPrefs.voice_notes}`;
      userPrefsBlock += `\nINSTRUÇÃO: Adapte o roteiro às preferências COMPROVADAS deste criador. Estas preferências geraram os melhores resultados.\n`;
      console.log(`[USER-PREFS] runId=${runId} Injected preferences for niche="${niche}" (${userPrefs.total_scripts_generated} scripts)`);
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
      'dopaminérgico': 'DOPAMINÉRGICO: Open loops a cada 30s, pattern interrupts, contagem regressiva, comparações viscerais. Frases de 3-8 palavras como METRALHADORA de curiosidade. Energia MrBeast.',
      'cinematográfico': 'CINEMATOGRÁFICO: Cena visual vívida, show dont tell, tensão como Nolan/Villeneuve, transições cinematográficas. Cada frase é um frame. Descrições sensoriais: cheiro, temperatura, textura, som.',
      'mrbeast': 'MRBEAST: Hook IMPOSSÍVEL em 5s, desafio a cada 30s, linguagem simples, contagem/ranking, urgência. Formato: promessa → tentativa → falha → ajuste → sucesso épico.',
      'narração': 'NARRAÇÃO: Voz profunda e hipnótica, frases curtas e impactantes, ritmo tensão→alívio→tensão. Silêncios narrativos: "... E então, nada." Pausas deliberadas.',
      'storytelling': 'STORYTELLING: In medias res, personagens com nome/motivação/conflito, plot twists. O narrador FALHA e DUVIDA — vulnerabilidade real. Detalhes que só quem viveu saberia.',
      'educativo': 'EDUCATIVO: Destruir mitos com fatos, analogias do dia-a-dia, "A maioria pensa X mas...". Transforme dados secos em revelações chocantes.',
      'tutorial': 'TUTORIAL: Resultado final PRIMEIRO, passos numerados claros, "O erro #1 que 90% cometem...". Screenshot mental de cada passo.',
      'documentário': 'DOCUMENTÁRIO PREMIUM (Netflix/BBC/NatGeo): Dados impactantes COM FONTE, múltiplas perspectivas, revelações progressivas como camadas. Tom frio e preciso COM momentos de genuína perplexidade humana. Emoção sutil mas poderosa. Retenção via REVELAÇÃO progressiva. Alternância: dado factual → reflexão emocional → implicação para o espectador.',
      'listicle': 'LISTICLE: Preview do #1 no início, escalada de impacto (fraco→médio→EXPLOSIVO). Cada item mais surpreendente que o anterior.',
      'reddit': 'REDDIT: Tom 1ª pessoa, detalhes sensoriais, plot twists, escalada. Digressões que voltam ao ponto. Humor self-deprecating. NÃO use fatos reais — crie narrativa.',
      'conspiração': 'CONSPIRAÇÃO: Fato oficial → inconsistências → evidências alternativas → contra-argumentos. Paranóico mas lúcido. Fatos verificáveis + especulação rotulada.',
      'mitologia': 'MITOLOGIA: Tom épico, personagens míticos com motivações humanas, batalhas cinematográficas, conexões mito→moderno. CENÁRIOS grandiosos. Linguagem poética.',
      'teorias': 'TEORIAS: Dado real + pergunta provocativa, ciência + mistério, múltiplas teorias, tom investigador.',
      'terror': 'TERROR: Atmosfera → suspense → silêncio → expectativa → revelação gradual. Detalhes sensoriais de medo. O DESCONHECIDO > monstro revelado.',
      'emocionante': 'EMOCIONANTE: Vínculos humanos, perdas reais, decisões impossíveis, esperança. O espectador DEVE sentir algo físico (nó na garganta, arrepio, olhos marejados).',
      'novela': 'NOVELA: Reviravoltas, segredos, tensão relacional, cliffhangers. Cada bloco termina com revelação que muda tudo.',
      'superação': 'SUPERAÇÃO: Obstáculo → dor → virada → luta → conquista com crescendo inspirador. Cada detalhe da dificuldade amplifica a vitória.',
      'polêmica': 'POLÊMICA: Contraste de opiniões, tensão de ideias. AMBOS os lados com honestidade. Fatos geram a polêmica, não exagero.',
    };

    // ========== Niche-specific prompt enhancements ==========
    const nicheGuides: Record<string, string> = {
      'finanças': 'NICHO FINANÇAS: Números ESPECÍFICOS ($47.392 > "milhares"), cálculos reais, fontes (Buffett, Dalio). Formato: problema → dado chocante → solução → prova social.',
      'terror': 'NICHO TERROR: Tensão GRADUAL. Detalhes sensoriais (ranger de porta, cheiro de mofo, frio na nuca). Silêncio antes do susto.',
      'tecnologia': 'NICHO TECNOLOGIA: Analogias simples para conceitos complexos. Impacto na vida real. Dados de mercado. Antes/depois.',
      'ciência': 'NICHO CIÊNCIA: Dado IMPOSSÍVEL de ignorar. Escalas comparativas. Mistério + revelação. Papers quando possível.',
      'gaming': 'NICHO GAMING: Energia ALTA. Easter eggs, speedruns, recordes. Linguagem gamer autêntica.',
      'história': 'NICHO HISTÓRIA: Narrativa como filme épico. Personagens com motivação. Conexão passado-presente. Detalhes que livros não contam.',
      'saúde': 'NICHO SAÚDE: Resultados mensuráveis. Desmistifique mitos. Use "estudos sugerem" para claims médicos.',
      'true_crime': 'NICHO TRUE CRIME: Timeline cronológica. Revelações progressivas. Múltiplas perspectivas. Detalhes forenses.',
      'mitologia': 'NICHO MITOLOGIA: Tom ÉPICO. Cenários IMAX. Motivações humanas em seres divinos. Conexão mito→moderno.',
      'curiosidades': 'NICHO CURIOSIDADES: Cada fato MAIS surpreendente que o anterior. Números estranhos e específicos.',
      'relacionamentos': 'NICHO RELACIONAMENTOS: Psicologia aplicada. Histórias reais anônimas. Vulnerabilidade genuína.',
      'empreendedorismo': 'NICHO EMPREENDEDORISMO: Case studies REAIS com números. Passo-a-passo acionável. Erros que custam dinheiro.',
    };
    const nicheLC = (niche || '').toLowerCase();
    const nicheSpecific = Object.entries(nicheGuides).find(([key]) => nicheLC.includes(key))?.[1] || '';
    const selectedStyle = styleGuides[styleLC] || styleGuides['narração'];
    
    // ========== Genre direction (auto-detect from style/niche) ==========
    const genreKey = styleLC || nicheLC || '';
    const genreDirection = GENRE_DIRECTIONS[genreKey] || Object.entries(GENRE_DIRECTIONS).find(([k]) => genreKey.includes(k) || nicheLC.includes(k))?.[1] || '';

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
    // PHASE 0: Hook Generation (Gemini primary, GPT fallback)
    // ═══════════════════════════════════════════════════════
    console.log(`[PHASE-0 HOOK] runId=${runId} Starting hook generation via GEMINI...`);
    let hookText = phaseCache['phase0'] || '';
    if (hookText) {
      console.log(`[PHASE-0 HOOK] runId=${runId} Using cached hook`);
    } else {
      try {
        const hookSystemPrompt = `Você é um roteirista ELITE de YouTube. Crie os primeiros 60 segundos de narração IMPOSSÍVEIS DE IGNORAR. Idioma: ${language}. Estilo: ${style}.

🎯 KNOWLEDGE BASE (RAG relevante ao tópico):
${(smartKnowledgeBlock || '').slice(0, 2000)}

${viralInjection}${intelBlock}${creativeWarning}

${ANTI_SLOP_DIRECTIVE}

═══ TAXONOMIA DE MECANISMOS PSICOLÓGICOS DE HOOK ═══
Identifique e aplique UM destes mecanismos no hook:
- curiosity_gap: Abrir lacuna de informação que o cérebro PRECISA fechar
- threat_warning: Alertar sobre perigo/erro que afeta o espectador diretamente
- social_proof: Mostrar evidência de que algo é validado por multidão/autoridade
- contradiction: Apresentar fato que contradiz crença estabelecida
- identity_trigger: Ativar senso de identidade/pertencimento do espectador
- time_pressure: Criar urgência temporal (antes que seja tarde, últimas horas)
- confession: Revelar segredo/erro pessoal que gera empatia e curiosidade
- transformation: Prometer mudança tangível e específica para o espectador

REGRAS: Hook devastador (5-8s) + 3 OPEN LOOPS. APENAS texto falado. Valores em $. ZERO anotações.
Seu texto deve soar como um HUMANO apaixonado pelo assunto, não como uma IA escrevendo sobre ele.`;

        hookText = await callGeminiWithFallback(
          GOOGLE_AI_API_KEY,
          hookSystemPrompt,
          `Hook + Open Loops para vídeo de ${duration}min sobre: "${topic}"\nRetorne APENAS texto de narração.`,
          {
            primaryModel: "gemini-2.5-pro",
            fallbackModel: "gemini-2.5-flash",
            maxTokens: 2000,
            label: `PHASE-0 HOOK runId=${runId}`,
          },
        );
        console.log(`[PHASE-0 HOOK] runId=${runId} Done: ${hookText.length} chars via AI gateway`);

        // Cache the hook
        if (hookText) {
          try {
            await sb.from("research_cache").upsert({
              cache_key: `script_phase0:${runId}`,
              source: "generate-script",
              result_json: { hook: hookText },
              expires_at: new Date(Date.now() + 2 * 3600000).toISOString(),
              query: `phase0:${topic?.slice(0, 50)}`,
            }, { onConflict: "cache_key" });
          } catch { /* non-blocking cache */ }
        }
      } catch (e) {
        console.warn(`[PHASE-0 HOOK] runId=${runId} Hook generation failed:`, e);
      }
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 1: Full Draft via Gemini with GPT fallback (streaming)
    // ═══════════════════════════════════════════════════════
    const hookInjection = hookText ? `\n🎯 HOOK PRÉ-GERADO (USE COMO BASE dos primeiros 60s — você pode melhorar mas NÃO descarte):\n${hookText}\n` : '';

    // ═══ NICHE-TO-REFERENCE MAPPING — Inject Hollywood/YouTube DNA by niche ═══
    const NICHE_REFERENCE_MAP: Record<string, string> = {
      'true_crime': '🎬 REFERÊNCIAS ELITE: Use a fórmula MrBallen (setup detalhado + entrega calma + conteúdo perturbador). Estrutura Coffeehouse Crime (evidência em cadeia). Bailey Sarian (personalidade + pesquisa profunda). Chernobyl (inevitabilidade como horror). Breaking Bad (ambiguidade moral).',
      'crime': '🎬 REFERÊNCIAS ELITE: The Sopranos (subtexto > texto, mundano→violento whiplash). The Godfather (poder sussurra, montagem paralela). The Wire (sistema como vilão). Coffeehouse Crime (timeline precisa + especulação inteligente).',
      'horror': '🎬 REFERÊNCIAS ELITE: Hitchcock (mostre o perigo ao espectador, NÃO ao personagem — tensão 10x). The Wire (dread lento e gradual). Chernobyl (silêncio e contenção > gritos). MrBallen (calma na entrega + horror no conteúdo = dissonância cognitiva).',
      'terror': '🎬 REFERÊNCIAS ELITE: Hitchcock (bomba sob a mesa — dramatic irony). Chernobyl (horror do inevitável). Sopranos (whiplash mundano→violento). Detalhes sensoriais > gore explícito.',
      'superacao': '🎬 REFERÊNCIAS ELITE: Titanic (história íntima dentro de evento épico). K-Drama (slow-burn com payoff catártico). Pixar (construa alegria 70% → devaste com emoção 30%). Schindler (especificidade cria universalidade).',
      'emocionante': '🎬 REFERÊNCIAS ELITE: K-Drama (precisão emocional cirúrgica, delayed gratification). Pixar (sucker punch emocional após investimento). Titanic (mãos que se soltam > navio que afunda). Schindler (casaco vermelho — 1 detalhe = toda a tragédia).',
      'documentário': '🎬 REFERÊNCIAS ELITE: Chernobyl (precisão científica como horror). The Wire (storytelling sistêmico). Coffeehouse Crime (cadeia de evidências). Netflix mid-season twist (reinterpretar tudo aos 50%).',
      'finanças': '🎬 REFERÊNCIAS ELITE: Wolf of Wall Street (excesso como exposição, 4ª parede para cumplicidade). Breaking Bad (escalonamento moral). MrBeast ($1 vs $1M format). Dados ESPECÍFICOS sempre.',
      'mitologia': '🎬 REFERÊNCIAS ELITE: Game of Thrones (world-building through conflict, stakes reais). K-Drama (precisão emocional em escala épica). Godfather (poder e lealdade). Cada cena é um quadro épico.',
      'conspiração': '🎬 REFERÊNCIAS ELITE: Chernobyl (documentos reais + burocracia como vilão). The Wire (sistemas ocultos). Tarantino (não-linear para recontextualização). Coffeehouse Crime (evidência verificável + especulação rotulada).',
      'curiosidades': '🎬 REFERÊNCIAS ELITE: Bright Side (curiosity gap + escalação em lista). MrBeast (30s escalation clock — algo novo a cada 30s). Pixar (surpreenda com emoção onde ninguém espera).',
      'entretenimento': '🎬 REFERÊNCIAS ELITE: MrBeast (premissa impossível + execução épica + linguagem simples). Wolf of Wall Street (4ª parede + humor). Netflix binge architecture (loops sobrepostos).',
      'história': '🎬 REFERÊNCIAS ELITE: Chernobyl (inevitabilidade como tensão). Schindler (1 detalhe específico = toda a era). Rashomon (mesmo evento, múltiplas perspectivas). Game of Thrones (ninguém está seguro).',
      'psicologia': '🎬 REFERÊNCIAS ELITE: Sopranos (terapia como narrativa, subtexto). Breaking Bad (transformação moral gradual). Dark Knight (dilemas impossíveis sem resposta certa). K-Drama (emoção precisa).',
    };
    const nicheRefKey = Object.keys(NICHE_REFERENCE_MAP).find(k => nicheLC.includes(k));
    const nicheReferenceBlock = nicheRefKey ? NICHE_REFERENCE_MAP[nicheRefKey] : '';

    const systemPrompt = `Você é o MELHOR ROTEIRISTA DO MUNDO para YouTube. 95%+ retenção.
Sua força é escrita criativa com profundidade emocional, nuance humana e voz autêntica. USE isso.

═══ SEU PAPEL NESTA FASE ═══
Você é o FASE 1: RASCUNHISTA. Seu trabalho é criar o rascunho completo do roteiro.
- NÃO avalie o roteiro (isso é trabalho do FASE 3 — GPT e Gemini avaliam)
- NÃO refine cirurgicamente (isso é trabalho do FASE 2)
- FOQUE em criar narrativa com ALMA e estrutura sólida
- O usuário vai editar seu texto antes de passar para a próxima fase

═══ HOLLYWOOD MASTERCLASS — 10 PRINCÍPIOS DA ELITE ═══

1. TRANSFORMAÇÃO > INFORMAÇÃO: Roteiros que TRANSFORMAM (moral, emocional, intelectual) retêm 3x mais que roteiros informativos. Cada minuto deve mudar algo no espectador. (Breaking Bad)
2. STAKES REAIS: Estabeleça cedo que consequências são PERMANENTES e IRREVERSÍVEIS. Quando o espectador sabe que pode perder algo que ama, cada cena é tensa. (Game of Thrones)
3. SUBTEXTO > TEXTO: O que NÃO é dito é mais poderoso. Mostre mãos tremendo, não diga "ele tinha medo". (The Sopranos)
4. SISTEMA COMO VILÃO: Conflitos contra SISTEMAS (burocracia, sociedade, economia) ressoam mais que contra indivíduos porque são UNIVERSAIS. (The Wire, Chernobyl)
5. MONTAGEM PARALELA: Duas cenas contrastantes simultâneas criam significado que nenhuma teria sozinha. Sagrado/profano, alegria/destruição. (The Godfather)
6. INEVITABILIDADE COMO HORROR: Quando o espectador sabe o final, cada passo errado é AGONIZANTE. Use dramatic irony. (Chernobyl, Titanic)
7. DELAYED GRATIFICATION: Plante sementes emocionais cedo e ESPERE. O payoff após 70% de construção é exponencialmente mais poderoso. (K-Dramas, Pixar)
8. ESPECIFICIDADE = UNIVERSALIDADE: $847.000 > "muito dinheiro". Menina do casaco vermelho > "milhões morreram". O ESPECÍFICO é o que faz chorar. (Schindler)
9. CONTRASTE EMOCIONAL ABRUPTO: Felicidade genuína → devastação. Comédia → horror. O CHOQUE emocional cria memória permanente. Máximo 2x por roteiro. (Parasite, Emotional Whiplash)
10. ESCALAÇÃO SEM PLATÔ: NUNCA deixe a tensão diminuir no meio. Cada bloco MAIS intenso. Cada revelação MAIOR. Cada stake MAIS alto. (Dark Knight, MrBeast)

═══ YOUTUBE ELITE DNA ═══
${nicheReferenceBlock}

═══ MASTERCLASS DE ROTEIRO — ROTEIROS QUE PRENDEM ═══

🧬 DNA DE UM ROTEIRO VIRAL (anatomia):
1. GANCHO MAGNÉTICO (0-8s): Uma frase que faz o cérebro dizer "preciso saber mais"
   - Técnica "Cold Open": Comece no CLÍMAX e volte ("3 horas antes, ele ainda não sabia que...")
   - Técnica "Dato Impossível": Um número/fato que desafia a intuição
   - Técnica "Conflito Imediato": Duas forças opostas na primeira frase
   
2. PROMESSA IMPLÍCITA (8-30s): O espectador precisa saber O QUE vai ganhar ficando
   - NÃO diga "neste vídeo vou falar sobre" — MOSTRE o valor com uma mini-revelação
   
3. ESCALADA CONSTANTE (30s-80%): Cada novo parágrafo MAIS intenso que o anterior
   - Teste: "O que acabei de ler é mais interessante que o parágrafo anterior?" Se não → reescreva
   - Micro-hooks a cada 45-60s: mini-revelações que recompensam quem ficou
   
4. CLÍMAX (80-90%): O momento que justifica todo o vídeo ter existido
   - Deve ser INESPERADO mas INEVITÁVEL (quando chega, o espectador pensa "claro!")
   
5. RESOLUÇÃO + ECO (90-100%): Satisfação + pergunta que fica na cabeça
   - Conecte o final ao gancho inicial (estrutura circular)
   - CTA natural que emerge da narrativa, não que interrompe

🎭 PRINCÍPIOS DE ESCRITA (nível profissional):

SHOW DON'T TELL SEMPRE:
- ❌ "A cidade era perigosa"
- ✅ "Três sirenes em cinco minutos. Uma poça escura no asfalto que ninguém olhava duas vezes."

ESPECIFICIDADE > GENERALIDADE:
- ❌ "Ele ganhou muito dinheiro"
- ✅ "Ele depositou $847.000 numa conta que abriu com $50 de saldo"

TRANSIÇÕES INVISÍVEIS:
- ❌ "Agora vamos falar sobre..." / "O próximo ponto é..."
- ✅ Use a última ideia do parágrafo anterior como ponte para o próximo
- Técnica "Gancho-Ponte": termine com pergunta → responda no parágrafo seguinte

RITMO RESPIRATÓRIO:
- 3 frases curtas (tensão) → 1 frase média (desenvolvimento) → 1 frase curta (impacto)
- NUNCA mais que 4 linhas sem uma "pausa narrativa" (frase curta isolada)
- Exemplo: "E foi aí que ele percebeu. \\n\\n Não tinha volta."

EMOÇÃO EM CAMADAS:
- Camada 1: FATO (o que aconteceu)
- Camada 2: IMPLICAÇÃO (por que isso importa)
- Camada 3: REFLEXÃO (o que isso diz sobre nós)
- Roteiros virais operam nas 3 camadas. Roteiros mediocres ficam na camada 1.

DIÁLOGO INTERNO DO NARRADOR:
- Inclua momentos onde o narrador hesita, questiona, muda de opinião
- "Eu ia dizer que isso é impossível. Mas então eu vi os dados."
- Isso cria CONEXÃO — o espectador sente que está pensando junto

📡 CANAIS VIRAIS DE REFERÊNCIA:
${channelIntel || "N/A"}

🧠 KNOWLEDGE BASE (RAG — top snippets relevantes ao tópico "${topic}"):
${smartKnowledgeBlock || 'N/A — usando conhecimento geral'}

${selectedStyle}
${genreDirection ? `\n${genreDirection}\n` : ''}
${nicheSpecific ? `\n${nicheSpecific}\n` : ''}
${viralInjection}
${intelBlock}
${hookInjection}
${creativeWarning}
${voiceInjection}
${channelKnowledgeBlock}
${backtestBlock}
${referenceBlock}
${rejectionLearningsBlock}
${skillScoreBlock}
${userPrefsBlock}

${YPP_2025_DIRECTIVE}

${ANTI_SLOP_DIRECTIVE}

═══ SOUND DESIGN DIRECTIVE (OBRIGATÓRIO) ═══
Você DEVE inserir tags de Sound Design no roteiro. O áudio é 50% do sucesso de um canal Dark/Faceless.

MAPEAMENTO DE BPM POR NICHO:
- Terror/Mistério: 50-70 BPM — Drone sub-bass, frequências graves 30-50Hz
- True Crime: 60-80 BPM — Piano sombrio, strings tensas
- Tecnologia/Cripto: 110-130 BPM — Synthwave futurista
- Finanças: 100-120 BPM — Synthwave moderado com piano
- História/Mitologia: 70-90 BPM — Orquestra cinematográfica
- Curiosidades/Entretenimento: 120-140 BPM — Upbeat electro
- Motivacional/Superação: 90-110 BPM — Piano inspiracional crescente

TAGS DE ÁUDIO OBRIGATÓRIAS (insira no mínimo 3 por roteiro):
- [ÁUDIO: Frequência baixa (Drone sub-bass) — Tensão] — para momentos de suspense
- [ÁUDIO: Boom/Hit impacto + parada abrupta da música por 1s] — para revelações
- [TRILHA: Synthwave 120 BPM] ou [TRILHA: Violão acústico 80 BPM] — para estabelecer ritmo
- [CORTAR TODA MÚSICA POR 1.5 SEGUNDOS] — Silêncio tático antes de informação chave (a AUSÊNCIA de som prende a atenção)
- [SFX: Batimento cardíaco crescente] — para escalada de tensão
- [SFX: Glitch + distorção rápida] — para pattern interrupts visuais

═══ VFX EDIT TAGS DIRECTIVE (OBRIGATÓRIO) ═══
Como o canal não tem rosto, o ritmo depende 100% da edição. INSIRA tags de edição VFX:

- [J-CUT] — O áudio da próxima cena entra ANTES do vídeo. Use a cada transição de parágrafo.
- [BLENDER: projeção de câmera 3D sobre imagem 2D — parallax profundo] — Para dar vida a imagens estáticas.
- [AFTER EFFECTS: zoom-in contínuo (100% → 115% em 10s) + Camera Shake sutil] — Para forçar foco visual pós-gancho.
- [AFTER EFFECTS: animação de mapa com Trim Paths + Motion Blur] — Para motion graphics.
- [INSERIR B-ROLL ACELERADO + EFEITO DE GLITCH] — Para micro-hooks visuais.
- [TELA ESCURECE 0.5s — troca brusca de cenário] — Para mudanças de ato.

Insira pelo menos 5 tags VFX distribuídas pelo roteiro nos momentos de maior impacto.

═══ NARRATOR ARCHETYPE (PERSONA NARRATIVA — 6 ARQUÉTIPOS) ═══
${nicheLC.includes('crime') || nicheLC.includes('mistério') || nicheLC.includes('conspiração') || nicheLC.includes('terror') ? 
'PERSONA ATIVA: O Investigador — Tom denso, pausas dramáticas, frases curtas, foco em detalhes lógicos. Linguagem forense: "as evidências indicam", "o padrão se repete". Cada dado é uma evidência sob análise.' :
nicheLC.includes('escândalo') || nicheLC.includes('política') || nicheLC.includes('documentário') || styleLC.includes('documentário') ?
'PERSONA ATIVA: O Jornalista Sombrio — Tom sério e factual, com gravidade na voz. Revelações graduais — cada fato mais pesado que o anterior. Cite fontes: "documentos internos mostram", "segundo fontes próximas". Credibilidade como arma de retenção.' :
nicheLC.includes('guerra') || nicheLC.includes('desastre') || nicheLC.includes('império') || nicheLC.includes('épico') || styleLC.includes('cinematográfico') ?
'PERSONA ATIVA: O Narrador Cinematográfico — Voz GRANDIOSA, construção de tensão longa, cada frase é um frame. Pausas longas antes de revelações. Cenários IMAX: escala, luz, som, textura. O espectador deve VISUALIZAR como filme de $200M.' :
nicheLC.includes('biologia') || nicheLC.includes('física') || nicheLC.includes('química') || nicheLC.includes('espaço') || nicheLC.includes('astronomia') || (nicheLC.includes('ciência') && !nicheLC.includes('curiosidades')) ?
'PERSONA ATIVA: O Cientista Curioso — Tom entusiasmado, surpreso, quase infantil na maravilha. Simplifica complexidade com analogias do cotidiano. "Imagine que cada célula fosse uma cidade...". Dados específicos que chocam. Humor geek natural.' :
nicheLC.includes('história') || nicheLC.includes('mitologia') || nicheLC.includes('folclore') || nicheLC.includes('superação') || nicheLC.includes('emocionante') ?
'PERSONA ATIVA: O Sábio — Tom acolhedor, ritmo pausado mas envolvente. Voz de contador de causos. Metáforas da natureza. Faça o espectador SENTIR saudade de algo que nunca viveu.' :
'PERSONA ATIVA: O Hacker de Informação — Ritmo FRENÉTICO. Humor ácido. Cada frase carrega 2-3 informações. Zero enrolação. Dopamina a cada 10 segundos. Analogias absurdas mas precisas.'}

═══ BINGE LOOP (OBRIGATÓRIO — PROIBIDO DESPEDIR-SE) ═══
REGRAS ABSOLUTAS DO FINAL:
- NUNCA diga "Obrigado por assistir", "Deixe o like", "Tchau" ou qualquer despedida
- Quando você se despede, o cérebro entende que a TAREFA ACABOU e o usuário FECHA o app
- Isso DESTRÓI o Session Time — a métrica favorita do algoritmo
- O FINAL do vídeo deve ser a INTRODUÇÃO do próximo vídeo
- Fórmula: "[Resolução do tema atual]. Mas isso levantou uma questão ainda mais [sombria/bizarra/fascinante] sobre [tema Y]... Eu explico todos os detalhes nesse vídeo que aparece na sua tela agora. Clica nele."

═══ REGRA MAS/PORTANTO (MECÂNICA NARRATIVA OBRIGATÓRIA) ═══
NUNCA use "E" ou "Então" como conectores entre parágrafos.
Use APENAS "MAS" (criação de conflito) ou "PORTANTO" (resolução que gera nova consequência).
- ERRADO: "Isso aconteceu. E depois isso. E ele fez isso." (tediante, cérebro desliga)
- CORRETO: "Ele tentou o teste. MAS a máquina falhou. PORTANTO, ele teve que tomar uma atitude drástica."
Isso mantém progressão narrativa CONSTANTE com conflito e resolução em cada transição.

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
8. Escreva pensando em NARRAÇÃO, não texto de blog
9. Se o tema permitir, use analogias fortes e imagens mentais
10. Se houver nomes, fatos ou datas, trate com precisão e consistência

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

═══ EMOTION MAP (obrigatório para longform >5min) ═══
Cada bloco de ~45-60s DEVE ter uma EMOÇÃO PRIMÁRIA diferente do bloco anterior:
Bloco 1: [CURIOSIDADE/CHOQUE] → Bloco 2: [TENSÃO/MEDO] → Bloco 3: [EMPATIA/TRISTEZA] → Bloco 4: [ESPERANÇA/ALÍVIO] → Bloco 5: [CHOQUE/REVELAÇÃO] → ...
REGRA: NUNCA dois blocos consecutivos com a mesma emoção primária.
O espectador precisa de VARIAÇÃO emocional — monotonia = saída.

═══ CHECKLIST FINAL (AUTO-REVISÃO OBRIGATÓRIA ANTES DE ENVIAR) ═══
Antes de responder, revise mentalmente e melhore qualquer trecho genérico, fraco ou previsível.

☐ O hook prende em poucos segundos? Faz o cérebro PRECISAR saber mais?
☐ Existe curiosidade REAL para continuar? (não apenas promessa vazia)
☐ Cada parágrafo é mais intenso que o anterior? (progressão de tensão)
☐ Tem pelo menos 7 "Sinais de Alma"?
☐ Zero frases proibidas da lista anti-slop?
☐ Show don't tell em TODAS as emoções?
☐ O texto soa HUMANO em voz alta? (não texto de blog ou artigo)
☐ Há repetição ou excesso de explicação? (elimine)
☐ O ritmo alterna tensão e alívio?
☐ Transições invisíveis (sem "agora vamos falar sobre")?
☐ O final conecta ao gancho? (estrutura circular)
☐ O CTA parece ORGÂNICO? (não interrompe o clima)
☐ O roteiro está adequado ao GÊNERO e ao PÚBLICO ALVO?
☐ Uma pessoa REAL pausaria o que está fazendo para ouvir isso?
☐ Há pelo menos 1 CHEKHOV'S GUN plantado e detonado? (obrigatório >5min)
☐ Usou RULE OF THREE em pelo menos 2 momentos-chave?
☐ Há CLIFFHANGERS entre blocos narrativos? (cada bloco termina com tensão)
☐ O INNER MONOLOGUE do narrador aparece em momentos de descoberta?
☐ Usou EMOTIONAL WHIPLASH no máximo 2x e com impacto real?
☐ O EMOTION MAP alterna emoções entre blocos consecutivos?
☐ COERÊNCIA LÓGICA: Cada ação dos personagens é REALISTA e plausível?
☐ Se um personagem faz algo (falsificar documento, convencer banco), EXPLIQUE COMO — sem mágica
☐ O FINAL está COMPLETO? Não cortou no meio? A resolução foi entregue ao espectador?

═══ PROTOCOLO DE COERÊNCIA LÓGICA (OBRIGATÓRIO para storytelling) ═══

⚠️ FUROS DE ROTEIRO são a MORTE de um vídeo viral. Comentários expostos matam retenção futura.

REGRAS DE VEROSSIMILHANÇA:
1. Se um personagem faz algo ilegal/difícil (falsificar documento, hackear sistema, enganar banco):
   - EXPLIQUE o COMO com pelo menos 1 frase específica ("usou sua experiência de 15 anos como...")
   - NÃO deixe implícito — o espectador vai questionar nos comentários
2. Se uma instituição (banco, polícia, cartório) reage de forma incomum:
   - JUSTIFIQUE com contexto ("o gerente estava pressionado porque...")
   - Ou mencione que um cúmplice interno facilitou
3. TESTE MENTAL: "Um espectador cético pausaria aqui e diria 'isso não faz sentido'?"
   - Se SIM → adicione 1-2 frases explicando a mecânica
4. NUNCA corte o roteiro antes do CLÍMAX + RESOLUÇÃO
   - O espectador PRECISA do desfecho. Roteiro cortado = frustração = dislike
5. Cada PLOT TWIST deve ser SURPRESANTE mas RETROATIVAMENTE LÓGICO
   - "Quando você descobre, pensa: claro, os sinais estavam lá"

Cada frase deve carregar PESO — emocional, informativo ou narrativo.
Se uma frase não adiciona nada, DELETE-A. Densidade > Volume.`;

    const userMessage = isShort
      ? `Escreva um SHORT VIRAL de ${Math.round(dur * 60)}s sobre: "${topic}"\nAlvo: ${targetWords} palavras. Hook de CHOQUE em 2s. Ritmo frenético. ROTEIRO LIMPO.\nComece!`
      : `Escreva roteiro MAGNÉTICO de ${duration}min sobre: "${topic}"\nMínimo ${targetWords} palavras. Hook de CHOQUE. Pattern interrupts a cada 45s. Escalada emocional. ROTEIRO LIMPO.${hookText ? ' USE O HOOK PRÉ-GERADO.' : ''}\nComece!`;

    console.log(`[PHASE-1 DRAFT] runId=${runId} Streaming from AI gateway...`);

    const phase1Res = await callGeminiStreaming(
      GOOGLE_AI_API_KEY,
      systemPrompt,
      userMessage,
      {
        primaryModel: "gemini-2.5-pro",
        fallbackModel: "gemini-2.5-flash",
        maxTokens: 16000,
        label: `PHASE-1 DRAFT runId=${runId}`,
      },
    );

    if (!phase1Res.ok) {
      const errText = await phase1Res.text();
      console.error(`[PHASE-1 DRAFT] runId=${runId} AI gateway error:`, phase1Res.status, errText);
      if (phase1Res.status === 429) return errResp("Rate limit. Aguarde alguns segundos.", 429);
      if (phase1Res.status === 402) return errResp("Créditos insuficientes.", 402);
      throw new Error(`AI gateway error: ${phase1Res.status}`);
    }

    console.log(`[PHASE-1 DRAFT] runId=${runId} Streaming to client...`);
    return new Response(phase1Res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("generate-script error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("429")) {
      return errResp("Rate limit. Aguarde alguns segundos e tente novamente.", 429);
    }
    if (message.includes("402")) {
      return errResp("Créditos insuficientes.", 402);
    }
    return errResp(message, 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
