import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { target } = await req.json().catch(() => ({ target: "all" }));

    const results: Record<string, number> = {};

    // ═══════════════════════════════════════════════════════════════
    // PART 1: HOLLYWOOD STORYTELLING DNA → script_knowledge
    // ═══════════════════════════════════════════════════════════════
    if (target === "all" || target === "script_knowledge") {
      const hollywoodDNA = [
        { category: "hollywood_technique", title: "Breaking Bad — Transformation Arc", content: "O protagonista começa como vítima das circunstâncias e gradualmente se torna o vilão. A transformação é TÃO gradual que o espectador só percebe quando é tarde demais. Técnica: plante decisões morais cada vez menores — cada uma parece justificável isoladamente, mas o acumulado é devastador. Chekhov's Gun é usado obsessivamente: cada detalhe insignificante retorna com peso narrativo. A 'ticking clock' (prazo, doença, perseguição) mantém urgência constante." },
        { category: "hollywood_technique", title: "Breaking Bad — Moral Ambiguity Escalation", content: "Nunca apresente personagens como 100% bons ou maus. O herói tem falhas genuínas. O vilão tem motivações compreensíveis. Cada decisão moral do protagonista deve fazer o espectador pensar 'eu faria o mesmo?'. Escalação: atos questionáveis → moralmente cinzentos → claramente errados → monstruosos. O espectador fica preso porque JÁ investiu emocionalmente antes de perceber a transformação." },
        { category: "hollywood_technique", title: "Game of Thrones — Stakes & Mortality", content: "Regra #1: QUALQUER personagem pode morrer. Quando o espectador sabe que ninguém está seguro, CADA cena de tensão é genuinamente aterrorizante. Aplique em roteiros: quando estabelecer que as consequências são REAIS e irreversíveis, a audiência não pode desligar. Múltiplos POVs criam investimento em todos os lados de um conflito." },
        { category: "hollywood_technique", title: "Game of Thrones — World-Building Through Conflict", content: "Nunca pare a narrativa para explicar o mundo. Revele o contexto ATRAVÉS de conflitos, decisões e diálogos. O espectador absorve o world-building sem perceber que está aprendendo. Intrigas políticas funcionam como hooks: alianças secretas, traições e jogos de poder são universalmente fascinantes." },
        { category: "hollywood_technique", title: "The Sopranos — Antihero Psychology", content: "O antihero funciona porque o espectador SE IDENTIFICA com a parte humana antes de confrontar a parte monstruosa. Técnica 'terapia como narrativa': use momentos de vulnerabilidade para revelar a psicologia profunda. O mundane-to-violent whiplash (jantar em família → assassinato) cria impacto por CONTRASTE." },
        { category: "hollywood_technique", title: "The Sopranos — Subtext Over Text", content: "O que NÃO é dito é mais poderoso que o que é dito. Personagens mentem, omitem, negam. O espectador entende a verdade pela linguagem corporal, pelo silêncio, pelo que é evitado. Não DIGA que alguém está com medo — mostre as mãos tremendo, a voz falhando." },
        { category: "hollywood_technique", title: "The Wire — Systemic Storytelling", content: "Não conte histórias de heróis vs vilões. Conte histórias de SISTEMAS que trituram indivíduos. O traficante é tão preso no sistema quanto o policial. Detalhes procedurais criam IMERSÃO e autoridade narrativa. A paciência na construção é RECOMPENSADA com payoffs devastadores." },
        { category: "hollywood_technique", title: "Chernobyl — Dread Through Inevitability", content: "Quando a audiência SABE o desfecho, o terror vem do COMO. Cada decisão errada, cada mentira burocrática amplifica o horror. A burocracia como vilão é universalmente aterrorizante porque é REAL. Silêncio e contenção emocional > gritos e drama." },
        { category: "hollywood_technique", title: "The Godfather — Power Dynamics & Restraint", content: "O poder não grita — sussurra. A cena do batismo funciona porque o CONTRASTE faz o trabalho emocional. Lealdade familiar vs moralidade é um conflito eterno. RESTRAINT = IMPACT: quanto menos emoção visível, mais o espectador projeta." },
        { category: "hollywood_technique", title: "Wolf of Wall Street — Excess as Spectacle", content: "O excesso como ferramenta narrativa quando serve para EXPOR. Quebrar a 4ª parede cria cumplicidade. Escalonamento de dopamina: cada cena mais extrema. Comédia mascarando tragédia: o humor faz o espectador baixar a guarda." },
        { category: "hollywood_technique", title: "Dark Knight — Chaos as Philosophy", content: "O vilão mais aterrorizante tem um PONTO VÁLIDO. Escolhas impossíveis criam engajamento máximo. Escalonamento SEM alívio: a tensão NUNCA diminui, cada solução cria um problema maior." },
        { category: "hollywood_technique", title: "Titanic — Known Ending Intimate Focus", content: "Quando todos SABEM o final, foco no COMO e nos detalhes humanos. História íntima dentro de evento monumental cria DUAS camadas de engajamento. Contraste de classes é universalmente ressonante." },
        { category: "hollywood_technique", title: "Schindler's List — Specificity Creates Universality", content: "Quanto mais ESPECÍFICO o detalhe, mais UNIVERSAL a emoção. A menina do casaco vermelho concentra toda a tragédia em uma imagem. A escolha de UM indivíduo contra um sistema é a narrativa mais poderosa." },
        { category: "hollywood_technique", title: "Korean Dramas — Emotional Precision", content: "Precisão emocional cirúrgica. Slow-burn payoff. Visual storytelling. Especificidade cultural como gancho universal. Cliffhangers estudados pela Netflix como padrão-ouro." },
        { category: "hollywood_technique", title: "Netflix Series Formula — Binge Architecture", content: "Cada episódio termina com pergunta NÃO respondida. Primeiros 5min respondem uma e abrem duas novas. Personagens apresentados em AÇÃO. Twist do meio reconfigura tudo. Ritmo: tensão → micro-alívio → tensão maior." },
        { category: "youtube_elite_dna", title: "MrBeast — Escalation Formula", content: "Promise-in-thumbnail. Escalonamento a cada 30 segundos. Linguagem de 6ª série. Challenge format com stakes impossíveis. SIMPLICIDADE do conceito + EXECUÇÃO épica = viral." },
        { category: "youtube_elite_dna", title: "MrBallen — Strange Dark Mysterious Formula", content: "3-Act True Story: Setup detalhado → Evento perturbador → Resolução chocante. CONTRASTE entre entrega CALMA e conteúdo PERTURBADOR. Detalhes sensoriais que colocam espectador NA CENA. Nunca sensacionalismo." },
        { category: "youtube_elite_dna", title: "Bailey Sarian — True Crime + Personality", content: "True crime filtrado por PERSONALIDADE. Tom casual sobre temas dark cria intimidade parasocial. Profundidade de pesquisa constrói autoridade. Personalidade autêntica + pesquisa profunda = retenção." },
        { category: "youtube_elite_dna", title: "That Chapter — Humor in Darkness", content: "Humor como mecanismo de coping e pattern interrupt em true crime. Interação com audiência cria comunidade. Consistência de formato = confiança = retention. Charme pessoal como âncora emocional." },
        { category: "youtube_elite_dna", title: "Coffeehouse Crime — Documentary Precision", content: "Autoridade vem de PRECISÃO: timelines exatas, fontes citadas. Tom calmo constrói credibilidade que RETÉM. Especulação baseada em evidências engaja o detetive interno do espectador." },
        { category: "youtube_elite_dna", title: "Dhar Mann Studios — Moral Lesson Format", content: "Setup→Twist→Lesson. Vilões RELATABLE. Resolução EMOCIONAL. O poder está na IDENTIFICAÇÃO: o espectador vê situações que já viveu." },
        { category: "youtube_elite_dna", title: "Bright Side — Curiosity Gap Mastery", content: "Títulos que criam COMPULSÃO de clicar. Escalação dentro de listas. Simplificação visual. Apelo broad. Título irresistível + escalação + simplificação = views massivas." },
      ];

      const { error } = await sb.from("script_knowledge").upsert(
        hollywoodDNA.map(item => ({
          ...item,
          effectiveness_score: 95,
        })),
        { onConflict: "title" }
      );
      results.script_knowledge = error ? -1 : hollywoodDNA.length;
      if (error) console.error("[SEED] script_knowledge error:", error);
      console.log(`[SEED] script_knowledge: ${results.script_knowledge} records`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PART 2: CONTENT MODELS — Hollywood/YouTube structural models
    // ═══════════════════════════════════════════════════════════════
    if (target === "all" || target === "content_models") {
      const eliteModels = [
        {
          model_name: "Breaking Bad Arc", model_type: "narrative_arc",
          description: "Arco de transformação moral gradual.",
          hook_pattern: "Cold open no momento de consequência máxima → flashback para 'como chegamos aqui'",
          pacing_guide: "Setup simpático (20%) → Decisão cinzenta (30%) → Escalada (50%) → Ponto sem retorno (70%) → Consequências (85%) → Resolução ambígua (100%)",
          structure_json: { acts: 5, techniques: ["chekhov_gun", "moral_ambiguity", "ticking_clock", "transformation_arc"] },
          retention_profile: { "0-10%": 95, "10-30%": 85, "30-50%": 80, "50-70%": 85, "70-90%": 92, "90-100%": 88 },
          best_for_niches: ["true_crime", "psychology", "business", "biography"],
          effectiveness_score: 96, video_type: "longform" as const,
        },
        {
          model_name: "MrBallen 3-Act Mystery", model_type: "story_structure",
          description: "Estrutura de mistério em 3 atos. Setup → Perturbação → Resolução chocante.",
          hook_pattern: "Declaração inquietante específica com data/hora → promessa de revelação",
          pacing_guide: "Setup sensorial (25%) → Primeiro sinal errado (35%) → Escalada (50%) → Revelação parcial (65%) → Twist (80%) → Resolução (100%)",
          structure_json: { acts: 3, techniques: ["sensory_details", "calm_delivery_contrast", "timeline_precision"] },
          retention_profile: { "0-10%": 93, "10-30%": 82, "30-50%": 78, "50-70%": 83, "70-90%": 90, "90-100%": 85 },
          best_for_niches: ["true_crime", "mystery", "horror", "unexplained"],
          effectiveness_score: 94, video_type: "longform" as const,
        },
        {
          model_name: "Chernobyl Dread Engine", model_type: "tension_structure",
          description: "Tensão por inevitabilidade. Espectador SABE o desfecho.",
          hook_pattern: "Resultado revelado primeiro → 'sequência de erros que parece ficção'",
          pacing_guide: "Resultado (5%) → Início pacífico (10%) → Alertas ignorados (25-40%) → Consequências (55%) → Desespero (70%) → Catástrofe (85%) → Reflexão (100%)",
          structure_json: { acts: 4, techniques: ["dramatic_irony", "bureaucracy_villain", "scientific_horror", "restraint"] },
          retention_profile: { "0-10%": 90, "10-30%": 78, "30-50%": 82, "50-70%": 88, "70-90%": 95, "90-100%": 87 },
          best_for_niches: ["history", "science", "disaster", "documentary"],
          effectiveness_score: 93, video_type: "longform" as const,
        },
        {
          model_name: "Netflix Binge Architecture", model_type: "retention_structure",
          description: "Loops abertos sobrepostos — cada bloco responde UMA pergunta e abre DUAS novas.",
          hook_pattern: "In medias res + personagem em crise → corte para '48 horas antes'",
          pacing_guide: "Cold open (5%) → Flashback (15%) → Camadas de perguntas (30%) → Mid-twist (50%) → Escalada (65%) → Shift perspectiva (80%) → Pergunta final (100%)",
          structure_json: { acts: 5, techniques: ["nested_loops", "mid_twist", "perspective_shift", "cliffhanger_blocks"] },
          retention_profile: { "0-10%": 92, "10-30%": 80, "30-50%": 83, "50-70%": 86, "70-90%": 91, "90-100%": 88 },
          best_for_niches: ["drama", "thriller", "mystery", "true_crime"],
          effectiveness_score: 92, video_type: "longform" as const,
        },
        {
          model_name: "K-Drama Emotional Precision", model_type: "emotional_structure",
          description: "Slow-burn com payoff catártico.",
          hook_pattern: "Flash forward emocional → 'Tudo começou com um gesto simples'",
          pacing_guide: "Detalhe insignificante (5%) → Vínculo (20%) → Obstáculo (35%) → Sacrifício (50%) → Motivação oculta (65%) → Crise (80%) → Catarse (90%) → Eco (100%)",
          structure_json: { acts: 4, techniques: ["slow_burn", "visual_storytelling", "cultural_specificity", "delayed_gratification"] },
          retention_profile: { "0-10%": 85, "10-30%": 78, "30-50%": 80, "50-70%": 85, "70-90%": 93, "90-100%": 90 },
          best_for_niches: ["emotional", "romance", "family", "inspiration"],
          effectiveness_score: 91, video_type: "longform" as const,
        },
        {
          model_name: "MrBeast Challenge Escalation", model_type: "engagement_structure",
          description: "Conceito simples + execução épica. Escalação a cada 30 segundos.",
          hook_pattern: "Premissa IMPOSSÍVEL em 1 frase + visual que PROVA",
          pacing_guide: "Premissa (3%) → Regras (8%) → Desafios escalando (15-55%) → Momento emocional (65%) → Eliminações (75%) → Final entre 2 (85%) → Vencedor (95%)",
          structure_json: { acts: 3, techniques: ["30s_escalation", "simple_language", "impossible_stakes", "emotional_contrast"] },
          retention_profile: { "0-10%": 96, "10-30%": 88, "30-50%": 85, "50-70%": 87, "70-90%": 92, "90-100%": 90 },
          best_for_niches: ["entertainment", "challenge", "social_experiment"],
          effectiveness_score: 95, video_type: "longform" as const,
        },
        {
          model_name: "Godfather Power Dynamics", model_type: "narrative_arc",
          description: "Dinâmicas de poder. Contenção emocional amplifica impacto.",
          hook_pattern: "Pedido de favor que revela relações de poder",
          pacing_guide: "Hierarquia (15%) → Desafio (25%) → Alianças/traições (40%) → Montagem paralela (55%) → Golpe (70%) → Custo pessoal (85%) → Novo equilíbrio (100%)",
          structure_json: { acts: 5, techniques: ["restraint_as_impact", "parallel_editing", "family_loyalty_dilemma"] },
          retention_profile: { "0-10%": 88, "10-30%": 82, "30-50%": 80, "50-70%": 85, "70-90%": 92, "90-100%": 86 },
          best_for_niches: ["crime", "business", "politics", "history"],
          effectiveness_score: 90, video_type: "longform" as const,
        },
        {
          model_name: "Wolf of Wall Street Excess Arc", model_type: "narrative_arc",
          description: "Ascensão → excesso → queda. 4ª parede. Comédia mascarando tragédia.",
          hook_pattern: "Cena de excesso + narrador olha para câmera: 'Sim, eu sei.'",
          pacing_guide: "Origem humilde (10%) → Atalho (20%) → Primeiro sucesso (30%) → Excesso (45%) → Pico (55%) → Sinais de queda (65%) → Queda (80%) → Consequências (90%) → Reflexão (100%)",
          structure_json: { acts: 3, techniques: ["4th_wall_break", "comedy_masking_tragedy", "dopamine_escalation"] },
          retention_profile: { "0-10%": 93, "10-30%": 85, "30-50%": 82, "50-70%": 86, "70-90%": 90, "90-100%": 84 },
          best_for_niches: ["finance", "crime", "biography", "business"],
          effectiveness_score: 91, video_type: "longform" as const,
        },
      ];

      const { error } = await sb.from("content_models").upsert(eliteModels, { onConflict: "model_name" });
      results.content_models = error ? -1 : eliteModels.length;
      if (error) console.error("[SEED] content_models error:", error);
      console.log(`[SEED] content_models: ${results.content_models} records`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PART 3: PROMPT LIBRARY — Maps to actual table schema
    // Schema: id, user_id, prompt_text, style, tags, scene_type, word_count, quality_score, video_style, project_id, created_at
    // ═══════════════════════════════════════════════════════════════
    if (target === "all" || target === "prompt_library") {
      const prompts = [
        // HOOK TEMPLATES
        { prompt_text: "[HOOK — Cold Open Flashforward] Às [HORA ESPECÍFICA], [PERSONAGEM] fez algo que mudaria [CONSEQUÊNCIA] para sempre. [DETALHE SENSORIAL]. Mas para entender como chegamos aqui, precisamos voltar [TEMPO] — quando tudo ainda parecia [ESTADO NORMAL].", style: "cinematográfico", tags: ["hook", "cold_open", "flashforward", "universal"], scene_type: "hook", quality_score: 95, video_style: "longform" },
        { prompt_text: "[HOOK — Dato Impossível] [NÚMERO ESPECÍFICO E ESTRANHO]. Esse é o [CONTEXTO]. E o mais perturbador? [IMPLICAÇÃO CHOCANTE]. Ninguém te contou isso porque [RAZÃO].", style: "dopaminérgico", tags: ["hook", "stat", "curiosity_gap", "universal"], scene_type: "hook", quality_score: 92, video_style: "longform" },
        { prompt_text: "[HOOK — Conflito Imediato] [FORÇA A] contra [FORÇA B]. [CONSEQUÊNCIA ESPECÍFICA]. E no meio disso tudo, [PERSONAGEM VULNERÁVEL] que só queria [DESEJO SIMPLES].", style: "storytelling", tags: ["hook", "conflict", "empathy", "universal"], scene_type: "hook", quality_score: 90, video_style: "longform" },
        { prompt_text: "[HOOK — MrBallen Mystery] Em [DATA ESPECÍFICA], [PESSOA] de [CIDADE] decidiu [AÇÃO COTIDIANA]. O que [ELE/ELA] não sabia é que nas próximas [TEMPO], [EVENTO PERTURBADOR QUE MUDA TUDO].", style: "storytelling", tags: ["hook", "mystery", "true_crime", "mrballen"], scene_type: "hook", quality_score: 96, video_style: "longform" },
        { prompt_text: "[HOOK — Chernobyl Inevitability] [RESULTADO DEVASTADOR EM 1 FRASE]. Isso não deveria ter acontecido. E não teria, se [ALGUÉM] tivesse ouvido [ALERTA] [TEMPO] antes. Mas [RAZÃO BUROCRÁTICA]. E assim começou [CATÁSTROFE].", style: "documentário", tags: ["hook", "inevitability", "dread", "history"], scene_type: "hook", quality_score: 94, video_style: "longform" },
        { prompt_text: "[HOOK — Breaking Bad Moral] [PERSONAGEM] era [DESCRIÇÃO SIMPÁTICA]. Até que um dia, [EVENTO] forçou uma escolha: [OPÇÃO MORAL] ou [OPÇÃO IMORAL MAS COMPREENSÍVEL]. Escolheu B. E depois... não conseguiu parar.", style: "cinematográfico", tags: ["hook", "moral_ambiguity", "psychology", "transformation"], scene_type: "hook", quality_score: 93, video_style: "longform" },
        { prompt_text: "[HOOK — Horror Atmosférico] [SOM ESPECÍFICO]. [SILÊNCIO]. [PERSONAGEM] acordou às [HORA]. O quarto estava [TEMPERATURA]. [DETALHE VISUAL PERTURBADOR]. E então, [SENSAÇÃO CORPORAL DE MEDO].", style: "cinematográfico", tags: ["hook", "horror", "sensory", "atmospheric"], scene_type: "hook", quality_score: 91, video_style: "longform" },
        { prompt_text: "[HOOK — Western Survival] [NÚMERO] de água. [NÚMERO] de balas. [DISTÂNCIA] até [DESTINO]. [PERSONAGEM] olhou para o horizonte e fez as contas. Não fechavam.", style: "cinematográfico", tags: ["hook", "western", "survival", "scarcity"], scene_type: "hook", quality_score: 90, video_style: "longform" },
        { prompt_text: "[HOOK — Animal Rescue] [ANIMAL] estava [SITUAÇÃO DE PERIGO]. [DETALHE SENSORIAL]. Já fazia [TEMPO]. E a cada [UNIDADE], [ESCALADA]. Mas a [DISTÂNCIA], alguém tinha acabado de [AÇÃO DE RESGATE].", style: "storytelling", tags: ["hook", "animal_rescue", "empathy", "urgency"], scene_type: "hook", quality_score: 92, video_style: "longform" },
        { prompt_text: "[HOOK — Restoration] Quando [PERSONAGEM] encontrou [OBJETO], ninguém daria [VALOR BAIXO] por ele. [ESTADO DE DETERIORAÇÃO]. [TEMPO] e [HORAS] de trabalho depois... Você não vai reconhecer.", style: "storytelling", tags: ["hook", "restoration", "transformation"], scene_type: "hook", quality_score: 89, video_style: "longform" },
        { prompt_text: "[HOOK — Finance Shock] $[NÚMERO ESTRANHO]. Em [TEMPO CURTO]. Não é clickbait. [FONTE VERIFICÁVEL] documentou cada centavo. E o método? [FRASE CONTRA SENSO COMUM].", style: "dopaminérgico", tags: ["hook", "finance", "proof", "contrarian"], scene_type: "hook", quality_score: 91, video_style: "longform" },
        { prompt_text: "[HOOK — Science Mind-Blow] Se [CONDIÇÃO CIENTÍFICA SURPREENDENTE], então [IMPLICAÇÃO QUE MUDA PERSPECTIVA]. Sim, [CONFIRMAÇÃO COM DADO]. E a maioria dos especialistas ainda não processou o que isso significa.", style: "documentário", tags: ["hook", "science", "paradigm_shift"], scene_type: "hook", quality_score: 90, video_style: "longform" },

        // TRANSITION FORMULAS
        { prompt_text: "[TRANSIÇÃO — Cadeia Consequência] E foi exatamente isso que desencadeou [PRÓXIMO EVENTO]. Porque quando [CONSEQUÊNCIA], [REAÇÃO INESPERADA].", style: "universal", tags: ["transition", "causal_chain"], scene_type: "transition", quality_score: 85, video_style: "longform" },
        { prompt_text: "[TRANSIÇÃO — Salto Temporal] [TEMPO] depois, [MUDANÇA DRÁSTICA]. Ninguém esperava. Especialmente [PERSONAGEM].", style: "universal", tags: ["transition", "temporal_shift"], scene_type: "transition", quality_score: 84, video_style: "longform" },
        { prompt_text: "[TRANSIÇÃO — Corte Contrastante] Enquanto [CENA A], do outro lado [CENA B CONTRASTANTE]. E nenhum dos dois sabia do outro.", style: "cinematográfico", tags: ["transition", "contrast_cut", "dramatic_irony"], scene_type: "transition", quality_score: 88, video_style: "longform" },
        { prompt_text: "[TRANSIÇÃO — Endereço Direto] Agora, eu sei o que você tá pensando. [PENSAMENTO PROVÁVEL]. E sinceramente? Eu também pensei isso. Até que [FATO QUE MUDA TUDO].", style: "storytelling", tags: ["transition", "4th_wall", "pattern_interrupt"], scene_type: "transition", quality_score: 87, video_style: "longform" },
        { prompt_text: "[TRANSIÇÃO — Dúvida do Narrador] Espera. Isso não faz sentido. A menos que... [NOVA PERSPECTIVA QUE RECONFIGURA TUDO].", style: "storytelling", tags: ["transition", "narrator_doubt", "reframe"], scene_type: "transition", quality_score: 89, video_style: "longform" },

        // EMOTIONAL ESCALATION
        { prompt_text: "[ESCALAÇÃO — Empatia] [SITUAÇÃO DIFÍCIL]. [DETALHE QUE HUMANIZA]. [AÇÃO DE RESILIÊNCIA]. Mas [OBSTÁCULO MAIOR]. E dessa vez, [CONSEQUÊNCIA PESSOAL].", style: "storytelling", tags: ["escalation", "empathy", "emotional"], scene_type: "escalation", quality_score: 90, video_style: "longform" },
        { prompt_text: "[ESCALAÇÃO — Whiplash Emocional] [MOMENTO DE FELICIDADE GENUÍNA]. [DETALHE QUE CONFIRMA]. [PAUSA]. [EVENTO DEVASTADOR EM CONTRASTE MÁXIMO]. [SILÊNCIO NARRATIVO].", style: "cinematográfico", tags: ["escalation", "whiplash", "contrast"], scene_type: "escalation", quality_score: 93, video_style: "longform" },
        { prompt_text: "[ESCALAÇÃO — K-Drama Slow Burn] Ninguém notou quando [GESTO PEQUENO]. Era insignificante. [TEMPO DEPOIS], quando [CRISE], esse mesmo gesto se tornou [SIGNIFICADO TRANSFORMADO].", style: "cinematográfico", tags: ["escalation", "slow_burn", "kdrama", "catharsis"], scene_type: "escalation", quality_score: 91, video_style: "longform" },

        // TENSION BUILDING
        { prompt_text: "[TENSÃO — Relógio] [PERSONAGEM] tinha [TEMPO ESPECÍFICO]. Depois disso, [CONSEQUÊNCIA IRREVERSÍVEL]. Cada [UNIDADE] que passava, [ESCALADA DA PRESSÃO].", style: "universal", tags: ["tension", "ticking_clock", "urgency"], scene_type: "tension", quality_score: 88, video_style: "longform" },
        { prompt_text: "[TENSÃO — Loop Triplo] Mas antes de explicar [LOOP 1], preciso te contar sobre [LOOP 2]. E [LOOP 2] só faz sentido quando você entende [LOOP 3]. Então vamos lá.", style: "storytelling", tags: ["tension", "nested_loops", "curiosity"], scene_type: "tension", quality_score: 90, video_style: "longform" },
        { prompt_text: "[TENSÃO — Chekhov's Gun] [DETALHE APARENTEMENTE INSIGNIFICANTE]. [PERSONAGEM] nem pensou duas vezes. [... muito depois ...] E então olhou para [DETALHE] e tudo fez sentido.", style: "cinematográfico", tags: ["tension", "chekhov_gun", "payoff"], scene_type: "tension", quality_score: 92, video_style: "longform" },

        // CHARACTER INTRODUCTION
        { prompt_text: "[PERSONAGEM — Contradição] [NOME], [IDADE], [CIDADE]. [DETALHE SIMPÁTICO]. Mas [NOME] tinha um [SEGREDO] que [CONSEQUÊNCIA]. E sabia que era questão de tempo.", style: "storytelling", tags: ["character", "contradiction", "intrigue"], scene_type: "character_intro", quality_score: 87, video_style: "longform" },
        { prompt_text: "[PERSONAGEM — Ação Primeiro] [AÇÃO EM ANDAMENTO]. [DETALHE SENSORIAL]. [NOME] fazia isso todo [FREQUÊNCIA]. Não porque queria. Porque [MOTIVAÇÃO PROFUNDA].", style: "cinematográfico", tags: ["character", "in_medias_res", "reveal"], scene_type: "character_intro", quality_score: 89, video_style: "longform" },

        // CTA TEMPLATES
        { prompt_text: "[CTA — Eco Circular] Lembra do [ELEMENTO DO HOOK]? Agora você sabe [O QUE MUDOU]. Se essa história te fez pensar, talvez valha compartilhar com [ALGUÉM QUE PRECISA OUVIR].", style: "universal", tags: ["cta", "circular", "sharing"], scene_type: "cta", quality_score: 86, video_style: "longform" },
        { prompt_text: "[CTA — Pergunta Aberta] E aqui é onde eu fico sem resposta. [PERGUNTA GENUÍNA]. Me conta nos comentários. Porque sinceramente... [CONFISSÃO DO NARRADOR].", style: "storytelling", tags: ["cta", "engagement", "vulnerability"], scene_type: "cta", quality_score: 88, video_style: "longform" },
        { prompt_text: "[CTA — Teaser Próximo] Mas essa é só a primeira parte. O que [PERSONAGEM] fez depois... [TEASER SEM SPOILER]. Eu conto no próximo vídeo.", style: "universal", tags: ["cta", "cliffhanger", "series"], scene_type: "cta", quality_score: 85, video_style: "longform" },

        // ENGLISH HOOKS
        { prompt_text: "[HOOK — Cold Open EN] At [SPECIFIC TIME], [CHARACTER] did something that would change [CONSEQUENCE] forever. [SENSORY DETAIL]. But to understand how we got here, we need to go back [TIME].", style: "cinematic", tags: ["hook", "cold_open", "english", "universal"], scene_type: "hook", quality_score: 94, video_style: "longform" },
        { prompt_text: "[HOOK — Impossible Stat EN] [SPECIFIC ODD NUMBER]. That's the [CONTEXT]. And the most disturbing part? [SHOCKING IMPLICATION]. Nobody told you this because [REASON].", style: "dopaminérgico", tags: ["hook", "stat", "english", "universal"], scene_type: "hook", quality_score: 91, video_style: "longform" },
        { prompt_text: "[HOOK — MrBallen EN] On [SPECIFIC DATE], [PERSON] from [CITY] decided to [EVERYDAY ACTION]. What they didn't know is that in the next [TIME], [DISTURBING EVENT THAT CHANGES EVERYTHING].", style: "storytelling", tags: ["hook", "mystery", "english", "true_crime"], scene_type: "hook", quality_score: 95, video_style: "longform" },

        // SPANISH HOOKS
        { prompt_text: "[HOOK — Apertura Cinematográfica ES] A las [HORA], [PERSONAJE] hizo algo que cambiaría [CONSECUENCIA] para siempre. [DETALLE SENSORIAL]. Pero para entender cómo llegamos aquí, necesitamos volver [TIEMPO] atrás.", style: "cinematográfico", tags: ["hook", "cold_open", "spanish", "universal"], scene_type: "hook", quality_score: 92, video_style: "longform" },
        { prompt_text: "[HOOK — Dato Imposible ES] [NÚMERO ESPECÍFICO]. Eso es el [CONTEXTO]. ¿Y lo más perturbador? [IMPLICACIÓN]. Nadie te contó esto porque [RAZÓN].", style: "dopaminérgico", tags: ["hook", "stat", "spanish", "universal"], scene_type: "hook", quality_score: 90, video_style: "longform" },
      ];

      // Insert with system user_id (no auth required for system prompts)
      let insertCount = 0;
      for (const p of prompts) {
        const { error } = await sb.from("prompt_library").insert({
          ...p,
          user_id: SYSTEM_USER_ID,
          word_count: p.prompt_text.split(' ').length,
        });
        if (!error) insertCount++;
        else console.error("[SEED] prompt_library insert error:", error.message);
      }
      results.prompt_library = insertCount;
      console.log(`[SEED] prompt_library: ${insertCount}/${prompts.length} records`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PART 4: ATTENTION ENGINEERING — Film/Series techniques
    // ═══════════════════════════════════════════════════════════════
    if (target === "all" || target === "attention_engineering") {
      const techniques = [
        { pattern_name: "Breaking Bad Transformation Escalation", category: "narrative_technique", technique: "Each moral compromise slightly worse than the last. The audience stays because they already invested emotionally.", retention_impact: 92, psychological_basis: "Sunk cost fallacy + gradual normalization", applicable_niches: ["true_crime", "psychology", "biography"] },
        { pattern_name: "Game of Thrones Anyone Can Die", category: "stakes_technique", technique: "Establish early that consequences are REAL and PERMANENT. Kill a beloved element in the first 20%.", retention_impact: 94, psychological_basis: "Genuine uncertainty + emotional investment at risk", applicable_niches: ["drama", "thriller", "true_crime"] },
        { pattern_name: "Chernobyl Dramatic Irony Engine", category: "tension_technique", technique: "Reveal the outcome FIRST, then show the path. The audience watches as each mistake leads to the known catastrophe.", retention_impact: 90, psychological_basis: "Dramatic irony + helplessness tension", applicable_niches: ["history", "documentary", "disaster"] },
        { pattern_name: "Sopranos Mundane-to-Violent Whiplash", category: "emotional_technique", technique: "Juxtapose mundane scenes with sudden violence. The CONTRAST amplifies both.", retention_impact: 91, psychological_basis: "Contrast effect + pattern disruption", applicable_niches: ["crime", "psychology", "drama"] },
        { pattern_name: "Godfather Parallel Montage", category: "structural_technique", technique: "Show two contrasting scenes simultaneously. The juxtaposition creates meaning neither has alone.", retention_impact: 89, psychological_basis: "Cognitive dissonance + meaning through contrast", applicable_niches: ["crime", "drama", "history"] },
        { pattern_name: "Wolf of Wall Street 4th Wall Complicity", category: "engagement_technique", technique: "Have narrator speak directly to audience as co-conspirators. Creates parasocial intimacy.", retention_impact: 88, psychological_basis: "Parasocial relationship + complicity", applicable_niches: ["finance", "biography", "comedy"] },
        { pattern_name: "Dark Knight Impossible Choice", category: "stakes_technique", technique: "Present a dilemma with no good answer. Both options have devastating consequences.", retention_impact: 93, psychological_basis: "Moral dilemma + active cognitive engagement", applicable_niches: ["philosophy", "ethics", "psychology"] },
        { pattern_name: "Titanic Intimate Epic", category: "structural_technique", technique: "Place small intimate story inside massive event. Epic provides spectacle; intimate provides emotion.", retention_impact: 87, psychological_basis: "Dual-layer engagement + scale contrast", applicable_niches: ["history", "disaster", "biography"] },
        { pattern_name: "Schindler Red Coat Detail", category: "emotional_technique", technique: "Use ONE hyper-specific visual detail to concentrate all emotion of a massive event.", retention_impact: 95, psychological_basis: "Focal point theory + specificity creates universality", applicable_niches: ["history", "documentary", "true_crime"] },
        { pattern_name: "K-Drama Delayed Gratification Bomb", category: "emotional_technique", technique: "Plant emotional seed early. Let 60-70% pass. Then DETONATE with true significance.", retention_impact: 90, psychological_basis: "Delayed gratification + recontextualization", applicable_niches: ["emotional", "romance", "family"] },
        { pattern_name: "Netflix Mid-Season Perspective Shift", category: "structural_technique", technique: "At 50%, reveal info that makes audience RE-INTERPRET everything seen so far.", retention_impact: 93, psychological_basis: "Cognitive reappraisal + replay value", applicable_niches: ["mystery", "thriller", "true_crime"] },
        { pattern_name: "MrBeast 30-Second Escalation Clock", category: "pacing_technique", technique: "Never more than 30s without something NEW. Brain craves novelty every 30s.", retention_impact: 91, psychological_basis: "Novelty seeking + dopamine refresh cycle", applicable_niches: ["entertainment", "challenge", "education"] },
        { pattern_name: "MrBallen Calm-Horror Contrast", category: "delivery_technique", technique: "Deliver disturbing content calmly. The MISMATCH creates cognitive dissonance brain can't ignore.", retention_impact: 92, psychological_basis: "Cognitive dissonance + authenticity signal", applicable_niches: ["true_crime", "horror", "mystery"] },
        { pattern_name: "Bailey Sarian Parasocial Intimacy", category: "engagement_technique", technique: "Talk about dark topics as if telling a friend. Casual tone on serious topics creates addictive viewing.", retention_impact: 89, psychological_basis: "Parasocial relationship + casual-serious contrast", applicable_niches: ["true_crime", "mystery", "culture"] },
        { pattern_name: "Wire Systemic Revelation", category: "narrative_technique", technique: "Reveal the SYSTEM, not individual blame. Show how each person is trapped by bigger forces.", retention_impact: 86, psychological_basis: "Systems thinking + universal empathy", applicable_niches: ["documentary", "social", "politics"] },
        { pattern_name: "Coffeehouse Crime Evidence Chain", category: "structural_technique", technique: "Present evidence like building a case: fact → implication → connection → bigger implication.", retention_impact: 88, psychological_basis: "Active participation + logical chain satisfaction", applicable_niches: ["true_crime", "mystery", "science"] },
        { pattern_name: "Rashomon Multi-Perspective", category: "structural_technique", technique: "Tell same event from 2-3 perspectives. Each adds info changing interpretation.", retention_impact: 87, psychological_basis: "Unreliable narrator + active interpretation", applicable_niches: ["mystery", "true_crime", "history"] },
        { pattern_name: "Hitchcock Bomb Under Table", category: "tension_technique", technique: "SHOW danger to audience but NOT to characters. Creates 10x more tension than surprise.", retention_impact: 94, psychological_basis: "Dramatic irony + helplessness + anticipation", applicable_niches: ["thriller", "horror", "suspense"] },
        { pattern_name: "Tarantino Non-Linear Payoff", category: "structural_technique", technique: "Tell events OUT OF ORDER so meaning changes based on what audience already knows.", retention_impact: 88, psychological_basis: "Recontextualization + cognitive pleasure", applicable_niches: ["crime", "thriller", "drama"] },
        { pattern_name: "Pixar Emotional Sucker Punch", category: "emotional_technique", technique: "Build joy for 70%. Then hit with ONE devastating moment that leverages all positive investment.", retention_impact: 96, psychological_basis: "Emotional investment leverage + contrast amplification", applicable_niches: ["emotional", "family", "inspiration"] },
      ];

      const { error } = await sb.from("attention_engineering").upsert(
        techniques.map(t => ({
          ...t,
          source: "seed-elite-knowledge-v3.1",
          intensity_level: Math.round(t.retention_impact / 10),
        })),
        { onConflict: "pattern_name" }
      );
      results.attention_engineering = error ? -1 : techniques.length;
      if (error) console.error("[SEED] attention_engineering error:", error);
      console.log(`[SEED] attention_engineering: ${results.attention_engineering} records`);
    }

    return new Response(JSON.stringify({ success: true, results, message: "Elite knowledge seeded successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("seed-elite-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
