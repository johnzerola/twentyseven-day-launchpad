import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
        // ── FILM/SERIES DNA ──
        { category: "hollywood_technique", title: "Breaking Bad — Transformation Arc", content: "O protagonista começa como vítima das circunstâncias e gradualmente se torna o vilão. A transformação é TÃO gradual que o espectador só percebe quando é tarde demais. Técnica: plante decisões morais cada vez menores — cada uma parece justificável isoladamente, mas o acumulado é devastador. Chekhov's Gun é usado obsessivamente: cada detalhe insignificante retorna com peso narrativo. A 'ticking clock' (prazo, doença, perseguição) mantém urgência constante." },
        { category: "hollywood_technique", title: "Breaking Bad — Moral Ambiguity Escalation", content: "Nunca apresente personagens como 100% bons ou maus. O herói tem falhas genuínas. O vilão tem motivações compreensíveis. Cada decisão moral do protagonista deve fazer o espectador pensar 'eu faria o mesmo?'. Escalação: atos questionáveis → moralmente cinzentos → claramente errados → monstruosos. O espectador fica preso porque JÁ investiu emocionalmente antes de perceber a transformação." },
        { category: "hollywood_technique", title: "Game of Thrones — Stakes & Mortality", content: "Regra #1: QUALQUER personagem pode morrer. Quando o espectador sabe que ninguém está seguro, CADA cena de tensão é genuinamente aterrorizante. Aplique em roteiros: quando estabelecer que as consequências são REAIS e irreversíveis, a audiência não pode desligar. Múltiplos POVs criam investimento em todos os lados de um conflito — o espectador torce por personagens que estão em lados opostos." },
        { category: "hollywood_technique", title: "Game of Thrones — World-Building Through Conflict", content: "Nunca pare a narrativa para explicar o mundo. Revele o contexto ATRAVÉS de conflitos, decisões e diálogos. O espectador absorve o world-building sem perceber que está aprendendo. Intrigas políticas funcionam como hooks: alianças secretas, traições e jogos de poder são universalmente fascinantes porque espelham dinâmicas sociais reais." },
        { category: "hollywood_technique", title: "The Sopranos — Antihero Psychology", content: "O antihero funciona porque o espectador SE IDENTIFICA com a parte humana antes de confrontar a parte monstruosa. Tony Soprano é pai amoroso E assassino — essa contradição é magneticamente impossível de ignorar. Técnica 'terapia como narrativa': use momentos de vulnerabilidade para revelar a psicologia profunda. O mundano-to-violento whiplash (jantar em família → assassinato) cria impacto por CONTRASTE." },
        { category: "hollywood_technique", title: "The Sopranos — Subtext Over Text", content: "O que NÃO é dito é mais poderoso que o que é dito. Personagens mentem, omitem, negam. O espectador entende a verdade pela linguagem corporal, pelo silêncio, pelo que é evitado. Em roteiros: não DIGA que alguém está com medo — mostre as mãos tremendo, a voz falhando, o olhar que desvia. O subtexto cria PARTICIPAÇÃO ATIVA do espectador — ele decodifica significados." },
        { category: "hollywood_technique", title: "The Wire — Systemic Storytelling", content: "Não conte histórias de heróis vs vilões. Conte histórias de SISTEMAS que trituram indivíduos. O traficante é tão preso no sistema quanto o policial. Essa abordagem cria empatia universal — ninguém é completamente culpado. Detalhes procedurais (como funciona a burocracia, como opera a rua) criam IMERSÃO e autoridade narrativa. A paciência na construção é RECOMPENSADA com payoffs devastadores." },
        { category: "hollywood_technique", title: "Chernobyl — Dread Through Inevitability", content: "Quando a audiência SABE o desfecho, o terror vem do COMO, não do QUÊ. Cada decisão errada, cada mentira burocrática, cada alerta ignorado AMPLIFICA o horror porque sabemos para onde isso leva. A burocracia como vilão é universalmente aterrorizante porque é REAL. A precisão científica NÃO torna a história seca — torna o horror TANGÍVEL. Silêncio e contenção emocional > gritos e drama." },
        { category: "hollywood_technique", title: "The Godfather — Power Dynamics & Restraint", content: "O poder não grita — sussurra. As cenas mais impactantes são as mais contidas. A cena do batismo (montagem paralela: sacramento religioso + assassinatos) funciona porque o CONTRASTE faz o trabalho emocional. Lealdade familiar vs moralidade é um conflito eterno que ressoa em qualquer cultura. RESTRAINT = IMPACT: quanto menos emoção visível, mais o espectador projeta a sua própria." },
        { category: "hollywood_technique", title: "Wolf of Wall Street — Excess as Spectacle", content: "O excesso pode ser usado como ferramenta narrativa quando serve para EXPOR, não glorificar. Quebrar a 4ª parede (olhar diretamente para a câmera/espectador) cria cumplicidade — o espectador vira cúmplice. Escalonamento de dopamina: cada cena mais extrema, cada aposta maior, cada festa mais insana — até que o castelo desmorona. Comédia mascarando tragédia: o humor faz o espectador baixar a guarda para o impacto emocional." },
        { category: "hollywood_technique", title: "Dark Knight — Chaos as Philosophy", content: "O vilão mais aterrorizante é aquele que tem um PONTO VÁLIDO. O Joker expõe verdades incômodas sobre a natureza humana — e o espectador não consegue descartá-las completamente. Escolhas impossíveis (dilema moral sem resposta certa) criam engajamento máximo — o espectador debate internamente. Escalonamento SEM alívio: a tensão NUNCA diminui, cada solução cria um problema maior." },
        { category: "hollywood_technique", title: "Titanic — Known Ending, Intimate Focus", content: "Quando todos SABEM o final, o foco muda para o COMO e para os detalhes humanos DENTRO do evento épico. Uma história íntima (romance) dentro de um evento monumental (naufrágio) cria DUAS camadas de engajamento simultâneas. Contraste de classes (rico/pobre, privilégio/injustiça) é universalmente ressonante. O espectador chora não pelo navio, mas pelas mãos que se soltam." },
        { category: "hollywood_technique", title: "Schindler's List — Specificity Creates Universality", content: "Paradoxo: quanto mais ESPECÍFICO o detalhe, mais UNIVERSAL a emoção. A menina do casaco vermelho (um detalhe em meio ao caos) concentra toda a tragédia em uma imagem. A escolha de UM indivíduo contra um sistema inteiro é a narrativa mais poderosa que existe. Contenção na representação do horror (mostrar MENOS é mais devastador) — o cérebro preenche o que não é mostrado com algo PIOR." },
        { category: "hollywood_technique", title: "Korean Dramas — Emotional Precision", content: "K-dramas dominam o YouTube por um motivo: precisão emocional cirúrgica. Slow-burn payoff — investimento emocional gradual que explode em cenas catárticas. Visual storytelling: cada quadro comunica emoção antes das palavras. Especificidade cultural como gancho universal: detalhes culturais únicos (comida, rituais, hierarquia social) FASCINAM audiências globais porque são NOVOS e AUTÊNTICOS. Cliffhangers de episódio são estudados pela Netflix como padrão-ouro." },
        { category: "hollywood_technique", title: "Netflix Series Formula — Binge Architecture", content: "Cada episódio termina com uma pergunta NÃO respondida. Os primeiros 5 minutos de cada episódio respondem uma pergunta E abrem duas novas. Personagens são apresentados em AÇÃO (não em descrição). O 'twist' do meio da temporada reconfigura tudo que o espectador achava que sabia. Ritmo: tensão → micro-alívio → tensão maior → micro-alívio menor → tensão máxima." },

        // ── YOUTUBE CHANNEL DNA ──
        { category: "youtube_elite_dna", title: "MrBeast — Escalation Formula", content: "Promise-in-thumbnail: o espectador sabe EXATAMENTE o que vai ver. Escalonamento a cada 30 segundos (nunca mais de 30s sem algo NOVO acontecer). Linguagem simples — 6ª série de complexidade. Challenge format com stakes impossíveis ('$1 vs $1.000.000'). O segredo: a SIMPLICIDADE do conceito permite que a EXECUÇÃO seja épica. Aplique: conceito simples + execução extraordinária = viral." },
        { category: "youtube_elite_dna", title: "MrBallen — Strange Dark Mysterious Formula", content: "Fórmula '3-Act True Story': Setup detalhado (quem, onde, quando com ESPECIFICIDADE) → Evento perturbador com escalonamento → Resolução chocante ou mistério sem resposta. O CONTRASTE entre a entrega CALMA e o conteúdo PERTURBADOR é o que prende. Detalhes sensoriais que colocam o espectador NA CENA ('às 3:47 da manhã, um barulho de vidro quebrando'). Nunca sensacionalismo — respeito pelas vítimas AUMENTA a confiança da audiência." },
        { category: "youtube_elite_dna", title: "Bailey Sarian — True Crime + Personality", content: "True crime funciona melhor quando filtrado por uma PERSONALIDADE. Tom casual sobre temas dark cria intimidade parasocial — 'amiga que conta história de crime'. Profundidade de pesquisa (detalhes que outros criadores não têm) constrói autoridade. O formato makeup + crime é genial porque dá atividade VISUAL constante durante narração longa. Aplique: personalidade autêntica + pesquisa profunda + casual sobre sério = retenção." },
        { category: "youtube_elite_dna", title: "That Chapter — Humor in Darkness", content: "Humor Irish usado como mecanismo de coping e pattern interrupt em true crime. Interação com a audiência ('Let's give it a goo!') cria comunidade e formato reconhecível. Consistência de formato = confiança = retention. O charme pessoal funciona como 'âncora emocional' que permite explorar temas perturbadores sem alienar. Aplique: tom pessoal consistente + humor dosado + formato reconhecível." },
        { category: "youtube_elite_dna", title: "Coffeehouse Crime — Documentary Precision", content: "Autoridade vem de PRECISÃO: timelines exatas, fontes citadas, evidências apresentadas logicamente. Tom calmo e medido (sem gritar, sem sensacionalismo) constrói credibilidade que RETÉM. Especulação baseada em evidências (não gratuita) engaja o 'detetive interno' do espectador. Aplique: dados verificáveis + timeline detalhada + especulação inteligente = true crime premium." },
        { category: "youtube_elite_dna", title: "Dhar Mann Studios — Moral Lesson Format", content: "Setup→Twist→Lesson em cada vídeo. Vilões RELATABLE (o espectador reconhece atitudes reais). Resolução EMOCIONAL (não apenas narrativa — alguém aprende, cresce, se transforma). O poder está na IDENTIFICAÇÃO: o espectador vê situações que já viveu. Aplique: apresente dilemas reais + mostre consequências + ofereça resolução emocional satisfatória." },
        { category: "youtube_elite_dna", title: "Bright Side — Curiosity Gap Mastery", content: "Títulos que criam COMPULSÃO de clicar ('O Que Acontece Se Você Colocar Sal no Olho'). Escalação dentro de listas (item 1 = ok, item 5 = interessante, item 10 = IMPOSSÍVEL). Simplificação visual (animações que explicam conceitos complexos). Apelo broad (temas que interessam a QUALQUER pessoa). Aplique: título irresistível + escalação + simplificação = views massivas." },
      ];

      const { error } = await sb.from("script_knowledge").upsert(
        hollywoodDNA.map(item => ({
          ...item,
          effectiveness_score: 95,
          source: "seed-elite-knowledge-v3.1",
        })),
        { onConflict: "title" }
      );
      results.script_knowledge = error ? -1 : hollywoodDNA.length;
      console.log(`[SEED] script_knowledge: ${results.script_knowledge} records`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PART 2: CONTENT MODELS — Hollywood/YouTube structural models
    // ═══════════════════════════════════════════════════════════════
    if (target === "all" || target === "content_models") {
      const eliteModels = [
        {
          model_name: "Breaking Bad Arc",
          model_type: "narrative_arc",
          description: "Arco de transformação moral gradual. O protagonista começa simpático e termina como antagonista — mas o espectador nunca consegue parar de torcer.",
          hook_pattern: "Cold open no momento de consequência máxima → flashback para 'como chegamos aqui'",
          pacing_guide: "Setup simpático (20%) → Primeira decisão moralmente cinzenta (30%) → Escalada de comprometimento (50%) → Ponto sem retorno (70%) → Consequências inevitáveis (85%) → Resolução ambígua (100%)",
          structure_json: { acts: 5, key_beats: ["sympathetic_setup", "first_moral_compromise", "escalation", "point_of_no_return", "consequences"], techniques: ["chekhov_gun", "moral_ambiguity", "ticking_clock", "transformation_arc"] },
          retention_profile: { "0-10%": 95, "10-30%": 85, "30-50%": 80, "50-70%": 85, "70-90%": 92, "90-100%": 88 },
          best_for_niches: ["true_crime", "psychology", "business", "biography"],
          effectiveness_score: 96,
          video_type: "longform" as const,
        },
        {
          model_name: "MrBallen 3-Act Mystery",
          model_type: "story_structure",
          description: "Estrutura de mistério em 3 atos com entrega calma e conteúdo perturbador. Setup detalhado → Evento perturbador → Resolução chocante.",
          hook_pattern: "Declaração inquietante específica ('Em 14 de março de 2019, às 3:47 da manhã...') → promessa de que 'ninguém esperava o que aconteceu depois'",
          pacing_guide: "Setup com detalhes sensoriais (25%) → Primeiro sinal de que algo está errado (35%) → Escalada de estranheza/perigo (50%) → Revelação parcial (65%) → Plot twist (80%) → Resolução ou mistério sem resposta (100%)",
          structure_json: { acts: 3, key_beats: ["specific_setup", "first_anomaly", "escalation", "partial_reveal", "twist", "resolution_or_mystery"], techniques: ["sensory_details", "calm_delivery_contrast", "timeline_precision", "respect_for_subjects"] },
          retention_profile: { "0-10%": 93, "10-30%": 82, "30-50%": 78, "50-70%": 83, "70-90%": 90, "90-100%": 85 },
          best_for_niches: ["true_crime", "mystery", "horror", "unexplained"],
          effectiveness_score: 94,
          video_type: "longform" as const,
        },
        {
          model_name: "Chernobyl Dread Engine",
          model_type: "tension_structure",
          description: "Tensão por inevitabilidade. O espectador SABE o desfecho — o horror vem de assistir cada erro, cada decisão errada, cada alerta ignorado.",
          hook_pattern: "Resultado final revelado primeiro (flashforward) → 'Como chegamos a ISSO foi uma sequência de erros que parece ficção'",
          pacing_guide: "Resultado revelado (5%) → Volte ao início pacífico (10%) → Primeiro alerta ignorado (25%) → Segundo alerta ignorado (40%) → Consequências começam (55%) → Tentativas desesperadas de correção (70%) → Catástrofe completa (85%) → Reflexão sobre responsabilidade (100%)",
          structure_json: { acts: 4, key_beats: ["flash_forward_result", "peaceful_beginning", "ignored_warnings", "cascade_failure", "desperate_measures", "full_catastrophe", "accountability"], techniques: ["dramatic_irony", "bureaucracy_as_villain", "scientific_precision_as_horror", "restraint"] },
          retention_profile: { "0-10%": 90, "10-30%": 78, "30-50%": 82, "50-70%": 88, "70-90%": 95, "90-100%": 87 },
          best_for_niches: ["history", "science", "disaster", "documentary"],
          effectiveness_score: 93,
          video_type: "longform" as const,
        },
        {
          model_name: "Netflix Binge Architecture",
          model_type: "retention_structure",
          description: "Arquitetura de retenção baseada em loops abertos sobrepostos — cada bloco responde UMA pergunta e abre DUAS novas.",
          hook_pattern: "Ação imediata (in medias res) + personagem em crise → corte para '48 horas antes'",
          pacing_guide: "Cold open em crise (5%) → Flashback setup (15%) → Pergunta 1 respondida + Perguntas 2-3 abertas (30%) → Mid-season twist que reconfigura tudo (50%) → Escalada acelerada (65%) → Revelação que muda perspectiva (80%) → Clímax + uma pergunta final aberta (100%)",
          structure_json: { acts: 5, key_beats: ["cold_open", "setup_flashback", "layered_questions", "mid_twist", "accelerated_escalation", "perspective_shift", "open_question_ending"], techniques: ["nested_loops", "mid_season_twist", "perspective_shift", "cliffhanger_blocks"] },
          retention_profile: { "0-10%": 92, "10-30%": 80, "30-50%": 83, "50-70%": 86, "70-90%": 91, "90-100%": 88 },
          best_for_niches: ["drama", "thriller", "mystery", "true_crime"],
          effectiveness_score: 92,
          video_type: "longform" as const,
        },
        {
          model_name: "K-Drama Emotional Precision",
          model_type: "emotional_structure",
          description: "Slow-burn com payoff catártico. Investimento emocional gradual que explode em momentos precisamente construídos.",
          hook_pattern: "Momento catártico futuro (flash forward emocional) → 'Tudo começou com um gesto simples que ninguém notou'",
          pacing_guide: "Detalhe aparentemente insignificante (5%) → Construção de vínculo emocional (20%) → Primeiro obstáculo (35%) → Sacrifício silencioso (50%) → Revelação de motivação oculta (65%) → Crise que testa tudo (80%) → Payoff emocional catártico (90%) → Eco silencioso (100%)",
          structure_json: { acts: 4, key_beats: ["insignificant_detail", "emotional_bonding", "obstacle", "silent_sacrifice", "hidden_motivation_reveal", "crisis", "cathartic_payoff", "quiet_echo"], techniques: ["slow_burn", "visual_storytelling", "cultural_specificity", "emotional_precision", "delayed_gratification"] },
          retention_profile: { "0-10%": 85, "10-30%": 78, "30-50%": 80, "50-70%": 85, "70-90%": 93, "90-100%": 90 },
          best_for_niches: ["emotional", "romance", "family", "inspiration"],
          effectiveness_score: 91,
          video_type: "longform" as const,
        },
        {
          model_name: "MrBeast Challenge Escalation",
          model_type: "engagement_structure",
          description: "Conceito simples + execução épica. Escalação a cada 30 segundos. Linguagem de 6ª série.",
          hook_pattern: "Premissa IMPOSSÍVEL em 1 frase ('Eu dei $1.000.000 para quem ficasse mais tempo...') + visual que PROVA",
          pacing_guide: "Premissa chocante (3%) → Regras simples (8%) → Primeiro desafio (15%) → Segundo mais difícil (25%) → Falha dramática de alguém (35%) → Twist nas regras (45%) → Desafio impossível (55%) → Momento emocional (65%) → Eliminações rápidas (75%) → Final entre 2 (85%) → Vencedor + reação (95%) → Teaser próximo (100%)",
          structure_json: { acts: 3, key_beats: ["impossible_premise", "simple_rules", "escalating_challenges", "dramatic_failure", "rule_twist", "emotional_moment", "final_showdown"], techniques: ["30s_escalation", "simple_language", "impossible_stakes", "emotional_contrast"] },
          retention_profile: { "0-10%": 96, "10-30%": 88, "30-50%": 85, "50-70%": 87, "70-90%": 92, "90-100%": 90 },
          best_for_niches: ["entertainment", "challenge", "social_experiment"],
          effectiveness_score: 95,
          video_type: "longform" as const,
        },
        {
          model_name: "Godfather Power Dynamics",
          model_type: "narrative_arc",
          description: "Dinâmicas de poder, lealdade familiar vs moralidade. A contenção emocional amplifica o impacto.",
          hook_pattern: "Pedido de favor que revela relações de poder → 'O que aconteceu naquela sala mudou o destino de três famílias'",
          pacing_guide: "Estabelecer hierarquia de poder (15%) → Desafio ao poder (25%) → Alianças e traições (40%) → Montagem paralela de contraste (55%) → Golpe de poder (70%) → Consequências pessoais (85%) → Novo equilíbrio (95%) → Custo emocional revelado (100%)",
          structure_json: { acts: 5, key_beats: ["power_establishment", "challenge", "alliances_betrayals", "parallel_montage", "power_move", "personal_cost", "new_order"], techniques: ["restraint_as_impact", "parallel_editing", "family_loyalty_dilemma", "power_whispers"] },
          retention_profile: { "0-10%": 88, "10-30%": 82, "30-50%": 80, "50-70%": 85, "70-90%": 92, "90-100%": 86 },
          best_for_niches: ["crime", "business", "politics", "history"],
          effectiveness_score: 90,
          video_type: "longform" as const,
        },
        {
          model_name: "Wolf of Wall Street — Excess Arc",
          model_type: "narrative_arc",
          description: "Ascensão meteórica → excesso → queda. Quebra de 4ª parede para cumplicidade. Comédia mascarando tragédia.",
          hook_pattern: "Cena de excesso máximo + narrador olha para câmera: 'Sim, eu sei o que você tá pensando. E você tem razão.'",
          pacing_guide: "Origem humilde (10%) → Descoberta do 'atalho' (20%) → Primeiro sucesso (30%) → Escalonamento de excesso (45%) → Pico de poder/riqueza (55%) → Primeiros sinais de queda (65%) → Queda em câmera lenta (80%) → Consequências reais (90%) → Reflexão (100%)",
          structure_json: { acts: 3, key_beats: ["humble_origin", "shortcut_discovery", "excess_escalation", "peak", "fall_signs", "slow_motion_fall", "consequences"], techniques: ["4th_wall_break", "comedy_masking_tragedy", "dopamine_escalation", "excess_as_exposure"] },
          retention_profile: { "0-10%": 93, "10-30%": 85, "30-50%": 82, "50-70%": 86, "70-90%": 90, "90-100%": 84 },
          best_for_niches: ["finance", "crime", "biography", "business"],
          effectiveness_score: 91,
          video_type: "longform" as const,
        },
      ];

      const { error } = await sb.from("content_models").upsert(
        eliteModels.map(m => ({ ...m, source: "seed-elite-knowledge-v3.1" })),
        { onConflict: "model_name" }
      );
      results.content_models = error ? -1 : eliteModels.length;
      console.log(`[SEED] content_models: ${results.content_models} records`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PART 3: PROMPT LIBRARY — Production-ready templates
    // ═══════════════════════════════════════════════════════════════
    if (target === "all" || target === "prompt_library") {
      const prompts = [
        // ── HOOK TEMPLATES ──
        { name: "Cold Open — Flashforward", category: "hook", template_json: { template: "Às [HORA ESPECÍFICA], [PERSONAGEM] fez algo que mudaria [CONSEQUÊNCIA] para sempre. [DETALHE SENSORIAL]. Mas para entender como chegamos aqui, precisamos voltar [TEMPO] — quando tudo ainda parecia [ESTADO NORMAL].", niche: "universal", psychology: "curiosity_gap + temporal_displacement" }, niche: "universal", language: "pt-BR" },
        { name: "Dato Impossível", category: "hook", template_json: { template: "[NÚMERO ESPECÍFICO E ESTRANHO]. Esse é o [CONTEXTO DO NÚMERO]. E o mais perturbador? [IMPLICAÇÃO CHOCANTE]. [PAUSA]. Ninguém te contou isso porque [RAZÃO].", niche: "universal", psychology: "cognitive_dissonance + information_gap" }, niche: "universal", language: "pt-BR" },
        { name: "Conflito Imediato", category: "hook", template_json: { template: "[FORÇA A] contra [FORÇA B]. [CONSEQUÊNCIA ESPECÍFICA]. E no meio disso tudo, [PERSONAGEM VULNERÁVEL] que só queria [DESEJO SIMPLES]. [DETALHE QUE HUMANIZA].", niche: "universal", psychology: "conflict_tension + empathy" }, niche: "universal", language: "pt-BR" },
        { name: "MrBallen Mystery Opener", category: "hook", template_json: { template: "Em [DATA ESPECÍFICA], [PESSOA] de [CIDADE] decidiu [AÇÃO COTIDIANA]. [DETALHE NORMAL]. [DETALHE NORMAL 2]. O que [ELE/ELA] não sabia é que nas próximas [TEMPO], [EVENTO PERTURBADOR QUE MUDA TUDO].", niche: "true_crime", psychology: "normalcy_disruption + dread" }, niche: "true_crime", language: "pt-BR" },
        { name: "Chernobyl Inevitability Hook", category: "hook", template_json: { template: "[RESULTADO DEVASTADOR EM 1 FRASE]. [PAUSA]. Isso não deveria ter acontecido. E não teria, se [ALGUÉM] tivesse ouvido [ALERTA ESPECÍFICO] [TEMPO] antes. Mas [RAZÃO BUROCRÁTICA/HUMANA]. E assim começou [CATÁSTROFE].", niche: "history", psychology: "dramatic_irony + inevitability_dread" }, niche: "history", language: "pt-BR" },
        { name: "Breaking Bad Moral Hook", category: "hook", template_json: { template: "[PERSONAGEM] era [DESCRIÇÃO SIMPÁTICA]. [DETALHE QUE GERA EMPATIA]. Até que um dia, [EVENTO] forçou uma escolha: [OPÇÃO A MORAL] ou [OPÇÃO B IMORAL MAS COMPREENSÍVEL]. [ELE/ELA] escolheu [B]. E depois... não conseguiu parar.", niche: "psychology", psychology: "moral_ambiguity + identification" }, niche: "psychology", language: "pt-BR" },

        // ── HOOK TEMPLATES (English) ──
        { name: "Cold Open — Flashforward (EN)", category: "hook", template_json: { template: "At [SPECIFIC TIME], [CHARACTER] did something that would change [CONSEQUENCE] forever. [SENSORY DETAIL]. But to understand how we got here, we need to go back [TIME] — when everything still seemed [NORMAL STATE].", niche: "universal", psychology: "curiosity_gap + temporal_displacement" }, niche: "universal", language: "en" },
        { name: "Impossible Stat Hook (EN)", category: "hook", template_json: { template: "[SPECIFIC ODD NUMBER]. That's the [CONTEXT]. And the most disturbing part? [SHOCKING IMPLICATION]. [PAUSE]. Nobody told you this because [REASON].", niche: "universal", psychology: "cognitive_dissonance" }, niche: "universal", language: "en" },

        // ── TRANSITION FORMULAS ──
        { name: "Bridge — Consequence Chain", category: "transition", template_json: { template: "E foi exatamente isso que desencadeou [PRÓXIMO EVENTO]. Porque quando [CONSEQUÊNCIA], [REAÇÃO INESPERADA].", psychology: "causal_chain" }, niche: "universal", language: "pt-BR" },
        { name: "Bridge — Temporal Shift", category: "transition", template_json: { template: "[TEMPO] depois, [MUDANÇA DRÁSTICA]. Ninguém esperava. Especialmente [PERSONAGEM].", psychology: "temporal_curiosity" }, niche: "universal", language: "pt-BR" },
        { name: "Bridge — Contrast Cut", category: "transition", template_json: { template: "Enquanto [CENA A ACONTECIA], do outro lado [CENA B CONTRASTANTE]. E nenhum dos dois sabia do outro.", psychology: "dramatic_irony" }, niche: "universal", language: "pt-BR" },
        { name: "Pattern Interrupt — Direct Address", category: "transition", template_json: { template: "Agora, eu sei o que você tá pensando. [PENSAMENTO PROVÁVEL DO ESPECTADOR]. E sinceramente? Eu também pensei isso. Até que [DADO/FATO QUE MUDA TUDO].", psychology: "4th_wall + validation" }, niche: "universal", language: "pt-BR" },
        { name: "Pattern Interrupt — Narrator Doubt", category: "transition", template_json: { template: "Espera. [PAUSA]. Isso não faz sentido. A menos que... [NOVA PERSPECTIVA QUE RECONFIGURA TUDO].", psychology: "narrator_vulnerability + reframe" }, niche: "universal", language: "pt-BR" },

        // ── EMOTIONAL ESCALATION ──
        { name: "Emotional Escalation — Empathy Build", category: "emotional_escalation", template_json: { template: "[SITUAÇÃO DIFÍCIL DO PERSONAGEM]. [DETALHE QUE HUMANIZA — família, sonho, medo]. [AÇÃO QUE MOSTRA RESILIÊNCIA]. Mas [OBSTÁCULO MAIOR]. E dessa vez, [CONSEQUÊNCIA PESSOAL].", psychology: "empathy_escalation" }, niche: "emotional", language: "pt-BR" },
        { name: "Emotional Whiplash — Joy to Devastation", category: "emotional_escalation", template_json: { template: "[MOMENTO DE FELICIDADE GENUÍNA]. [DETALHE QUE CONFIRMA FELICIDADE]. [PAUSA CURTA — FRASE ISOLADA]. [EVENTO DEVASTADOR EM CONTRASTE MÁXIMO]. [SILÊNCIO NARRATIVO].", psychology: "emotional_whiplash" }, niche: "universal", language: "pt-BR" },
        { name: "Slow Burn to Catharsis (K-Drama Style)", category: "emotional_escalation", template_json: { template: "Ninguém notou quando [GESTO PEQUENO]. Era insignificante. [TEMPO DEPOIS], quando [CRISE], esse mesmo gesto se tornou [SIGNIFICADO TRANSFORMADO]. E [PERSONAGEM] finalmente entendeu: [REVELAÇÃO EMOCIONAL].", psychology: "delayed_gratification + recontextualization" }, niche: "emotional", language: "pt-BR" },

        // ── TENSION BUILDING ──
        { name: "Ticking Clock", category: "tension", template_json: { template: "[PERSONAGEM] tinha [TEMPO ESPECÍFICO]. Depois disso, [CONSEQUÊNCIA IRREVERSÍVEL]. [DETALHE SOBRE O RELÓGIO/PRAZO]. Cada [UNIDADE DE TEMPO] que passava, [ESCALADA DA PRESSÃO].", psychology: "urgency + scarcity" }, niche: "universal", language: "pt-BR" },
        { name: "Nested Loop — Triple", category: "tension", template_json: { template: "Mas antes de explicar [LOOP 1 — o mais interessante], preciso te contar sobre [LOOP 2 — contexto essencial]. E [LOOP 2] só faz sentido quando você entende [LOOP 3 — base]. Então vamos lá.", psychology: "nested_curiosity_loops" }, niche: "universal", language: "pt-BR" },
        { name: "Chekhov's Gun Plant", category: "tension", template_json: { template: "[DETALHE APARENTEMENTE INSIGNIFICANTE]. [PERSONAGEM] nem pensou duas vezes sobre isso. [TRANSIÇÃO PARA OUTRO ASSUNTO]. [... muito depois ...] E então [PERSONAGEM] olhou para [DETALHE] e tudo fez sentido.", psychology: "chekhov_gun + inevitability" }, niche: "universal", language: "pt-BR" },

        // ── CHARACTER INTRODUCTION ──
        { name: "Character Intro — Contradiction", category: "character", template_json: { template: "[NOME], [IDADE], [CIDADE]. [DETALHE SIMPÁTICO]. [PAUSA]. Mas [NOME] tinha um [SEGREDO/CONTRADIÇÃO] que [CONSEQUÊNCIA]. E [ELE/ELA] sabia que era questão de tempo.", psychology: "contradiction + curiosity" }, niche: "universal", language: "pt-BR" },
        { name: "Character Intro — Action First", category: "character", template_json: { template: "[AÇÃO EM ANDAMENTO — sem contexto]. [DETALHE SENSORIAL DA AÇÃO]. [NOME] fazia isso todo [FREQUÊNCIA]. Não porque queria. Porque [MOTIVAÇÃO PROFUNDA QUE REVELA CARÁTER].", psychology: "in_medias_res + character_reveal" }, niche: "universal", language: "pt-BR" },

        // ── CTA TEMPLATES ──
        { name: "CTA — Circular Echo", category: "cta", template_json: { template: "Lembra do [ELEMENTO DO HOOK]? Agora você sabe [O QUE MUDOU]. E se essa história te fez pensar em [REFLEXÃO], talvez valha compartilhar com [ALGUÉM QUE PRECISA OUVIR].", psychology: "circular_structure + social_sharing" }, niche: "universal", language: "pt-BR" },
        { name: "CTA — Open Question", category: "cta", template_json: { template: "E aqui é onde eu fico sem resposta. [PERGUNTA GENUÍNA QUE NÃO TEM RESPOSTA FÁCIL]. Me conta nos comentários o que você acha. Porque sinceramente... [CONFISSÃO DO NARRADOR].", psychology: "genuine_engagement + vulnerability" }, niche: "universal", language: "pt-BR" },
        { name: "CTA — Teaser Next", category: "cta", template_json: { template: "Mas essa é só a primeira parte da história. O que [PERSONAGEM] fez depois... [TEASER SEM SPOILER]. [FRASE CURTA DE IMPACTO]. Eu conto no próximo vídeo.", psychology: "cliffhanger + anticipation" }, niche: "universal", language: "pt-BR" },

        // ── NICHE-SPECIFIC HOOKS ──
        { name: "Horror Atmospheric Hook", category: "hook", template_json: { template: "[SOM ESPECÍFICO]. [SILÊNCIO]. [PERSONAGEM] acordou às [HORA]. O quarto estava [TEMPERATURA]. [DETALHE VISUAL PERTURBADOR MAS SUTIL]. E então, [SENSAÇÃO CORPORAL DE MEDO — arrepio, boca seca, coração].", niche: "horror", psychology: "sensory_dread + isolation" }, niche: "horror", language: "pt-BR" },
        { name: "Western Survival Hook", category: "hook", template_json: { template: "[NÚMERO] de água. [NÚMERO] de balas. [DISTÂNCIA] até [DESTINO]. [PERSONAGEM] olhou para o horizonte e fez as contas. Não fechavam. Não tinham como fechar.", niche: "western", psychology: "scarcity + calculation + desperation" }, niche: "western", language: "pt-BR" },
        { name: "Restoration Transformation Hook", category: "hook", template_json: { template: "Quando [PERSONAGEM] encontrou [OBJETO], ninguém daria [VALOR BAIXO] por ele. [DETALHE DO ESTADO DE DETERIORAÇÃO]. [TEMPO] e [NÚMERO] horas de trabalho depois... [PAUSA]. Você não vai reconhecer.", niche: "restoration", psychology: "transformation_anticipation" }, niche: "restoration", language: "pt-BR" },
        { name: "Animal Rescue Hook", category: "hook", template_json: { template: "[ANIMAL] estava [SITUAÇÃO DE PERIGO ESPECÍFICA]. [DETALHE SENSORIAL — som, olhar, posição]. Já fazia [TEMPO]. E a cada [UNIDADE], [ESCALADA DO PERIGO]. Mas a [DISTÂNCIA], alguém tinha acabado de [AÇÃO QUE INICIA RESGATE].", niche: "animal_rescue", psychology: "empathy + urgency + hope" }, niche: "animal_rescue", language: "pt-BR" },
        { name: "Finance Shock Hook", category: "hook", template_json: { template: "$[NÚMERO ESPECÍFICO E ESTRANHO]. Em [TEMPO CURTO]. [PAUSA]. Não, não é clickbait. [NOME/FONTE VERIFICÁVEL] documentou cada centavo. E o método que [ELE/ELA] usou? [1 FRASE QUE CONTRADIZ SENSO COMUM].", niche: "finance", psychology: "specific_proof + contrarian" }, niche: "finance", language: "pt-BR" },
        { name: "Science Mind-Blow Hook", category: "hook", template_json: { template: "Se [CONDIÇÃO CIENTÍFICA SURPREENDENTE], então [IMPLICAÇÃO QUE MUDA PERSPECTIVA]. [PAUSA]. Sim, [CONFIRMAÇÃO COM DADO]. E a maioria dos [ESPECIALISTAS/PESSOAS] ainda não processou o que isso significa para [CONSEQUÊNCIA COTIDIANA].", niche: "science", psychology: "paradigm_shift + expert_gap" }, niche: "science", language: "pt-BR" },
        { name: "Conspiracy Evidence Hook", category: "hook", template_json: { template: "Em [ANO], [DOCUMENTO/FATO VERIFICÁVEL] foi [DESCOBERTO/VAZADO/DESCLASSIFICADO]. Página [NÚMERO], parágrafo [NÚMERO]: '[CITAÇÃO OU RESUMO]'. Ninguém deu atenção. [TEMPO] depois, [EVENTO QUE CONECTA]. Coincidência?", niche: "conspiracy", psychology: "pattern_recognition + verification" }, niche: "conspiracy", language: "pt-BR" },
        { name: "Mythology Epic Hook", category: "hook", template_json: { template: "Quando [DEUS/HERÓI] desceu até [LOCAL MÍTICO], o [ELEMENTO NATURAL — sol/céu/terra/mar] parou. [DETALHE ÉPICO SENSORIAL]. Não por medo. Por [EMOÇÃO COMPLEXA]. Porque [RAZÃO MITOLÓGICA QUE CONECTA COM HUMANIDADE].", niche: "mythology", psychology: "epic_scale + human_connection" }, niche: "mythology", language: "pt-BR" },
      ];

      const { error } = await sb.from("prompt_library").upsert(
        prompts.map(p => ({ ...p, user_id: "00000000-0000-0000-0000-000000000000", source: "seed-elite-knowledge-v3.1" })),
        { onConflict: "name" }
      );
      results.prompt_library = error ? -1 : prompts.length;
      console.log(`[SEED] prompt_library: ${results.prompt_library} records`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PART 4: ATTENTION ENGINEERING — Film/Series techniques
    // ═══════════════════════════════════════════════════════════════
    if (target === "all" || target === "attention_engineering") {
      const techniques = [
        { pattern_name: "Breaking Bad Transformation Escalation", category: "narrative_technique", technique: "Each moral compromise slightly worse than the last. The audience stays because they already invested emotionally before the character crossed the line.", retention_impact: 92, psychological_basis: "Sunk cost fallacy + gradual normalization", applicable_niches: ["true_crime", "psychology", "biography", "drama"] },
        { pattern_name: "Game of Thrones Anyone Can Die", category: "stakes_technique", technique: "Establish early that consequences are REAL and PERMANENT. Kill a beloved character or destroy something important in the first 20%. After that, every tense scene has genuine stakes.", retention_impact: 94, psychological_basis: "Genuine uncertainty + emotional investment at risk", applicable_niches: ["drama", "thriller", "true_crime", "action"] },
        { pattern_name: "Chernobyl Dramatic Irony Engine", category: "tension_technique", technique: "Reveal the outcome FIRST, then show the path. The audience watches in horror as each mistake, each ignored warning, each bureaucratic decision leads to the known catastrophe.", retention_impact: 90, psychological_basis: "Dramatic irony + helplessness tension", applicable_niches: ["history", "documentary", "disaster", "science"] },
        { pattern_name: "Sopranos Mundane-to-Violent Whiplash", category: "emotional_technique", technique: "Juxtapose completely mundane scenes (dinner, shopping, school pickup) with sudden violence or revelation. The CONTRAST amplifies both the normalcy and the horror.", retention_impact: 91, psychological_basis: "Contrast effect + pattern disruption", applicable_niches: ["crime", "psychology", "drama", "thriller"] },
        { pattern_name: "Godfather Parallel Montage", category: "structural_technique", technique: "Show two contrasting scenes simultaneously (sacred/profane, celebration/destruction, love/death). The juxtaposition creates meaning neither scene has alone.", retention_impact: 89, psychological_basis: "Cognitive dissonance + meaning through contrast", applicable_niches: ["crime", "drama", "history", "religion"] },
        { pattern_name: "Wolf of Wall Street 4th Wall Complicity", category: "engagement_technique", technique: "Have the narrator speak directly to the audience, making them co-conspirators. 'I know what you're thinking. And you're right.' Creates parasocial intimacy and engagement.", retention_impact: 88, psychological_basis: "Parasocial relationship + complicity", applicable_niches: ["finance", "biography", "comedy", "entertainment"] },
        { pattern_name: "Dark Knight Impossible Choice", category: "stakes_technique", technique: "Present a dilemma with no good answer. Both options have devastating consequences. The audience debates internally, creating deep engagement and post-video discussion.", retention_impact: 93, psychological_basis: "Moral dilemma + active cognitive engagement", applicable_niches: ["philosophy", "ethics", "drama", "psychology"] },
        { pattern_name: "Titanic Intimate Epic", category: "structural_technique", technique: "Place a small, intimate human story inside a massive event. The epic scale provides spectacle; the intimate story provides emotional investment. Together they're unstoppable.", retention_impact: 87, psychological_basis: "Dual-layer engagement + scale contrast", applicable_niches: ["history", "disaster", "romance", "biography"] },
        { pattern_name: "Schindler Red Coat Detail", category: "emotional_technique", technique: "Use ONE hyper-specific visual detail to concentrate all the emotion of a massive event. The brain needs a focal point to process overwhelming tragedy. One detail > thousand statistics.", retention_impact: 95, psychological_basis: "Focal point theory + specificity creates universality", applicable_niches: ["history", "documentary", "emotional", "true_crime"] },
        { pattern_name: "K-Drama Delayed Gratification Bomb", category: "emotional_technique", technique: "Plant an emotional seed early (a gesture, a promise, a small kindness). Let 60-70% of the story pass. Then DETONATE it: reveal the true significance. The payoff is exponentially more powerful because of the wait.", retention_impact: 90, psychological_basis: "Delayed gratification + recontextualization", applicable_niches: ["emotional", "romance", "family", "drama"] },
        { pattern_name: "Netflix Mid-Season Perspective Shift", category: "structural_technique", technique: "At exactly 50% of the content, reveal information that makes the audience RE-INTERPRET everything they've seen so far. 'Wait, HE was the one who...?' The audience mentally replays the first half.", retention_impact: 93, psychological_basis: "Cognitive reappraisal + replay value", applicable_niches: ["mystery", "thriller", "true_crime", "drama"] },
        { pattern_name: "MrBeast 30-Second Escalation Clock", category: "pacing_technique", technique: "Never go more than 30 seconds without something NEW happening: new challenge, new revelation, new failure, new person, new twist. The brain craves novelty every 30s.", retention_impact: 91, psychological_basis: "Novelty seeking + dopamine refresh cycle", applicable_niches: ["entertainment", "challenge", "education", "curiosity"] },
        { pattern_name: "MrBallen Calm-Horror Contrast", category: "delivery_technique", technique: "Deliver genuinely disturbing content in a calm, measured tone. The MISMATCH between delivery and content creates cognitive dissonance that the brain can't ignore. The calmness makes the horror MORE real, not less.", retention_impact: 92, psychological_basis: "Cognitive dissonance + authenticity signal", applicable_niches: ["true_crime", "horror", "mystery", "unexplained"] },
        { pattern_name: "Bailey Sarian Parasocial Intimacy", category: "engagement_technique", technique: "Talk about dark/serious topics as if telling a friend over coffee. Use personal reactions ('this one really got to me'), casual language, and genuine emotion. The contrast between the tone and the topic creates addictive viewing.", retention_impact: 89, psychological_basis: "Parasocial relationship + casual-serious contrast", applicable_niches: ["true_crime", "mystery", "gossip", "culture"] },
        { pattern_name: "Wire Systemic Revelation", category: "narrative_technique", technique: "Don't blame individuals — reveal the SYSTEM that creates the problem. Show how each person is trapped by forces bigger than them. This creates empathy for all sides and intellectual engagement.", retention_impact: 86, psychological_basis: "Systems thinking + universal empathy", applicable_niches: ["documentary", "social", "politics", "economics"] },
        { pattern_name: "Coffeehouse Crime Evidence Chain", category: "structural_technique", technique: "Present evidence like a detective building a case: fact → implication → connection to next fact → bigger implication. Each piece of evidence BUILDS on the previous one. The audience becomes an active investigator.", retention_impact: 88, psychological_basis: "Active participation + logical chain satisfaction", applicable_niches: ["true_crime", "mystery", "investigation", "science"] },

        // ── ADDITIONAL FILM TECHNIQUES ──
        { pattern_name: "Rashomon Multi-Perspective", category: "structural_technique", technique: "Tell the SAME event from 2-3 different perspectives. Each perspective adds new information that changes the interpretation. The audience pieces together the 'truth' from contradictory accounts.", retention_impact: 87, psychological_basis: "Unreliable narrator + active interpretation", applicable_niches: ["mystery", "true_crime", "psychology", "history"] },
        { pattern_name: "Hitchcock Bomb Under Table", category: "tension_technique", technique: "SHOW the danger to the audience but NOT to the characters. The audience screams 'DON'T OPEN THAT DOOR!' internally. This creates 10x more tension than a surprise. Dramatic irony is the most powerful tension tool.", retention_impact: 94, psychological_basis: "Dramatic irony + helplessness + anticipation", applicable_niches: ["thriller", "horror", "true_crime", "suspense"] },
        { pattern_name: "Tarantino Non-Linear Payoff", category: "structural_technique", technique: "Tell events OUT OF ORDER so that the MEANING of each scene changes based on what the audience already knows (or doesn't). Scene A means one thing alone, but after seeing Scene C, Scene A becomes devastating.", retention_impact: 88, psychological_basis: "Recontextualization + cognitive pleasure", applicable_niches: ["crime", "thriller", "drama", "mystery"] },
        { pattern_name: "Pixar Emotional Sucker Punch", category: "emotional_technique", technique: "Build joy, humor, and warmth for 70% of the content. Then hit with ONE devastating emotional moment that leverages ALL the positive investment. (Up montage, Toy Story 3 furnace, Inside Out Bing Bong). The joy makes the sadness 10x more powerful.", retention_impact: 96, psychological_basis: "Emotional investment leverage + contrast amplification", applicable_niches: ["emotional", "family", "animation", "inspiration"] },
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
