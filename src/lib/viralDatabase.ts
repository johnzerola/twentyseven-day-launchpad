// Viral Database — curated hooks, CTAs, title patterns, storytelling structures, SEO keywords

export interface ViralHook {
  id: string;
  text: string;
  style: string;
  niches: string[];
  estimatedRetention: number; // % retention at 30s
}

export interface CallToAction {
  id: string;
  text: string;
  placement: 'início' | 'meio' | 'fim' | 'pin_comment';
  type: 'inscrição' | 'like' | 'comentário' | 'compartilhar' | 'playlist' | 'produto';
  effectiveness: number; // 1-10
}

export interface TitlePattern {
  id: string;
  pattern: string;
  example: string;
  style: string;
  avgCTR: number;
}

export interface StoryStructure {
  id: string;
  name: string;
  description: string;
  phases: { name: string; duration: string; tip: string }[];
  bestFor: string[];
  retentionCurve: string;
}

export interface SEOKeywordPattern {
  id: string;
  pattern: string;
  examples: string[];
  searchVolume: 'alto' | 'médio' | 'baixo';
  competition: 'alta' | 'média' | 'baixa';
}

// ========== HOOKS ==========
export const VIRAL_HOOKS: ViralHook[] = [
  { id: 'h1', text: '"Isso pode mudar sua vida nos próximos 30 dias..."', style: 'curiosidade', niches: ['finanças', 'produtividade', 'saúde'], estimatedRetention: 85 },
  { id: 'h2', text: '"Ninguém te contou isso sobre [TEMA]..."', style: 'polêmica', niches: ['educação', 'tecnologia', 'finanças'], estimatedRetention: 82 },
  { id: 'h3', text: '"Eu perdi R$50.000 cometendo esse erro..."', style: 'storytelling', niches: ['finanças', 'empreendedorismo', 'investimentos'], estimatedRetention: 88 },
  { id: 'h4', text: '"PARE de fazer isso AGORA..."', style: 'urgência', niches: ['saúde', 'fitness', 'produtividade'], estimatedRetention: 80 },
  { id: 'h5', text: '"O que você vai ver nos próximos 2 minutos vai te chocar..."', style: 'choque', niches: ['curiosidades', 'true crime', 'ciência'], estimatedRetention: 87 },
  { id: 'h6', text: '"Quando eu tinha 18 anos, aconteceu algo que mudou tudo..."', style: 'storytelling', niches: ['motivação', 'lifestyle', 'empreendedorismo'], estimatedRetention: 84 },
  { id: 'h7', text: '"95% das pessoas não sabem disso..."', style: 'curiosidade', niches: ['educação', 'ciência', 'tecnologia'], estimatedRetention: 81 },
  { id: 'h8', text: '"Eu tentei [X] por 30 dias e o resultado foi..."', style: 'curiosidade', niches: ['lifestyle', 'fitness', 'produtividade'], estimatedRetention: 86 },
  { id: 'h9', text: '"Se você está assistindo isso, já pode ser tarde demais..."', style: 'urgência', niches: ['finanças', 'saúde', 'tecnologia'], estimatedRetention: 83 },
  { id: 'h10', text: '"Eu descobri o segredo que [PESSOA FAMOSA] esconde..."', style: 'polêmica', niches: ['celebridades', 'negócios', 'lifestyle'], estimatedRetention: 85 },
  { id: 'h11', text: '"Essa é a história mais perturbadora que eu já ouvi..."', style: 'choque', niches: ['true crime', 'mistério', 'curiosidades'], estimatedRetention: 89 },
  { id: 'h12', text: '"Você está fazendo [X] errado a vida inteira..."', style: 'contraintuitivo', niches: ['educação', 'culinária', 'tecnologia'], estimatedRetention: 82 },
  { id: 'h13', text: '"Meu médico me disse algo que eu nunca vou esquecer..."', style: 'empatia', niches: ['saúde', 'lifestyle', 'motivação'], estimatedRetention: 86 },
  { id: 'h14', text: '"Em 2026, quem não fizer isso vai ficar para trás..."', style: 'urgência', niches: ['tecnologia', 'IA', 'negócios'], estimatedRetention: 84 },
  { id: 'h15', text: '"Essa técnica secreta gera R$10.000 por mês..."', style: 'curiosidade', niches: ['finanças', 'marketing', 'renda extra'], estimatedRetention: 83 },
];

// ========== CTAs ==========
export const VIRAL_CTAS: CallToAction[] = [
  { id: 'c1', text: '"Se você chegou até aqui, você já é diferente de 90% das pessoas. Se inscreve que toda semana tem conteúdo que vai te colocar na frente."', placement: 'meio', type: 'inscrição', effectiveness: 9 },
  { id: 'c2', text: '"Comenta aqui embaixo qual desses te surpreendeu mais..."', placement: 'fim', type: 'comentário', effectiveness: 8 },
  { id: 'c3', text: '"Antes de continuar, me ajuda com um like. Leva 1 segundo e me ajuda a trazer mais conteúdo como esse."', placement: 'início', type: 'like', effectiveness: 7 },
  { id: 'c4', text: '"Se você conhece alguém que PRECISA ouvir isso, manda esse vídeo pra ela agora."', placement: 'fim', type: 'compartilhar', effectiveness: 8 },
  { id: 'c5', text: '"Quer o passo a passo completo? Assiste esse vídeo aqui ó [card]..."', placement: 'fim', type: 'playlist', effectiveness: 9 },
  { id: 'c6', text: '"📌 Comentário fixado com o link/recurso que eu mencionei..."', placement: 'pin_comment', type: 'produto', effectiveness: 8 },
  { id: 'c7', text: '"O YouTube não mostra esse vídeo pra todo mundo. Se inscreve e ativa o sino pra não perder."', placement: 'meio', type: 'inscrição', effectiveness: 7 },
  { id: 'c8', text: '"Agora comenta: Você concorda ou discorda? Quero saber sua opinião."', placement: 'fim', type: 'comentário', effectiveness: 9 },
  { id: 'c9', text: '"Esse é o tipo de conteúdo que o YouTube tenta esconder. Like pra mais vídeos assim."', placement: 'meio', type: 'like', effectiveness: 8 },
  { id: 'c10', text: '"Salva esse vídeo — você vai precisar revisitar isso."', placement: 'fim', type: 'like', effectiveness: 7 },
];

// ========== TITLE PATTERNS ==========
export const VIRAL_TITLE_PATTERNS: TitlePattern[] = [
  { id: 't1', pattern: 'Como [RESULTADO] em [TEMPO] (mesmo [OBJEÇÃO])', example: 'Como Ganhar R$5.000/mês em 30 Dias (mesmo sem experiência)', style: 'curiosidade', avgCTR: 12.5 },
  { id: 't2', pattern: '[NÚMERO] [COISAS] que [RESULTADO INESPERADO]', example: '7 Hábitos que Destroem seu Cérebro sem Você Perceber', style: 'números', avgCTR: 11.8 },
  { id: 't3', pattern: 'Por que [COISA BOA] está te [PREJUDICANDO]', example: 'Por que Dormir 8 Horas está te Deixando mais Cansado', style: 'contraintuitivo', avgCTR: 13.2 },
  { id: 't4', pattern: 'A Verdade sobre [TEMA] que Ninguém te Conta', example: 'A Verdade sobre o Mercado de IA que Ninguém te Conta', style: 'polêmica', avgCTR: 11.5 },
  { id: 't5', pattern: 'Eu [AÇÃO EXTREMA] por [TEMPO] — O Resultado é CHOCANTE', example: 'Eu Acordei às 4h por 90 Dias — O Resultado é CHOCANTE', style: 'storytelling', avgCTR: 14.1 },
  { id: 't6', pattern: 'PARE de [AÇÃO COMUM] AGORA (antes que seja tarde)', example: 'PARE de Guardar Dinheiro na Poupança AGORA', style: 'urgência', avgCTR: 12.0 },
  { id: 't7', pattern: 'O Dia que [EVENTO DRAMÁTICO]', example: 'O Dia que eu Perdi Tudo e Recomeçei do Zero', style: 'storytelling', avgCTR: 13.8 },
  { id: 't8', pattern: '[AUTORIDADE] Revela o Segredo de [RESULTADO]', example: 'Ex-Funcionário do Google Revela o Segredo do Algoritmo', style: 'polêmica', avgCTR: 12.3 },
  { id: 't9', pattern: 'Testei [X] vs [Y] — Qual é MELHOR?', example: 'Testei ChatGPT vs Gemini por 30 Dias — Qual é MELHOR?', style: 'curiosidade', avgCTR: 11.9 },
  { id: 't10', pattern: '[NÚMERO] Erros que te Impedem de [RESULTADO]', example: '5 Erros que te Impedem de Crescer no YouTube', style: 'números', avgCTR: 10.8 },
  { id: 't11', pattern: 'O que [PESSOA/EMPRESA] não quer que você saiba', example: 'O que os Bancos não querem que você saiba sobre investimentos', style: 'polêmica', avgCTR: 13.5 },
  { id: 't12', pattern: 'Fiz [DESAFIO] e aconteceu o IMPENSÁVEL', example: 'Fiz dieta do ovo por 7 dias e aconteceu o IMPENSÁVEL', style: 'storytelling', avgCTR: 14.5 },
];

// ========== STORY STRUCTURES ==========
export const STORY_STRUCTURES: StoryStructure[] = [
  {
    id: 's1',
    name: 'Hook → Mistério → Revelação',
    description: 'Estrutura clássica para vídeos informativos e curiosidades. Prende a atenção com uma promessa, cria mistério progressivo e entrega a revelação no final.',
    phases: [
      { name: 'Hook Poderoso', duration: '0-15s', tip: 'Comece com uma afirmação chocante ou pergunta impossível de ignorar' },
      { name: 'Contexto', duration: '15s-2min', tip: 'Dê contexto suficiente para o espectador entender a importância do tema' },
      { name: 'Mistério / Tensão', duration: '2-8min', tip: 'Apresente o problema ou mistério. Use loops abertos: "mas antes de te contar, preciso explicar..."' },
      { name: 'Revelações Progressivas', duration: '8-15min', tip: 'Entregue revelações em camadas, cada uma maior que a anterior' },
      { name: 'Clímax + CTA', duration: 'últimos 2min', tip: 'Maior revelação + CTA emocional conectado ao conteúdo' },
    ],
    bestFor: ['curiosidades', 'ciência', 'história', 'true crime'],
    retentionCurve: 'Alta retenção nos primeiros 30s, queda moderada no contexto, pico na revelação',
  },
  {
    id: 's2',
    name: 'Jornada do Herói (Simplificada)',
    description: 'Adaptação da Jornada do Herói para YouTube. Funciona para vlogs, desafios e conteúdo aspiracional.',
    phases: [
      { name: 'Mundo Comum', duration: '0-30s', tip: 'Mostre a situação atual / problema de forma relatable' },
      { name: 'Chamado à Aventura', duration: '30s-2min', tip: '"Decidi fazer algo diferente..." — momento de virada' },
      { name: 'Provações', duration: '2-10min', tip: 'Mostre dificuldades reais, fracassos, momentos difíceis' },
      { name: 'Transformação', duration: '10-14min', tip: 'O momento onde tudo muda — resultado, aprendizado' },
      { name: 'Retorno + Lição', duration: 'últimos 2min', tip: 'Volte ao ponto inicial mostrando a evolução + ensine algo' },
    ],
    bestFor: ['lifestyle', 'motivação', 'desafios', 'vlogs'],
    retentionCurve: 'Engajamento emocional crescente, pico na transformação',
  },
  {
    id: 's3',
    name: 'Lista Dopaminérgica',
    description: 'Estrutura de lista com interrupções de padrão a cada 2-3 minutos. Ideal para manter retenção em vídeos longos.',
    phases: [
      { name: 'Hook + Preview', duration: '0-20s', tip: 'Mostre o melhor item da lista como teaser: "O número 1 vai te chocar"' },
      { name: 'Items 5-3', duration: '20s-8min', tip: 'Comece pelos menos impactantes, crie escalada. Mini-hook antes de cada item' },
      { name: 'Interrupção de Padrão', duration: 'a cada 3min', tip: 'Mude o ritmo: música diferente, meme, pergunta ao espectador' },
      { name: 'Items 2-1', duration: '8-14min', tip: 'Melhores itens por último. Crie tensão: "você não vai acreditar..."' },
      { name: 'Bônus + CTA', duration: 'últimos 90s', tip: 'Item bônus surpresa + CTA forte' },
    ],
    bestFor: ['curiosidades', 'top 10', 'rankings', 'reviews'],
    retentionCurve: 'Formato de serra — pequenas quedas entre itens com picos em cada revelação',
  },
  {
    id: 's4',
    name: 'Tutorial Engajante',
    description: 'Tutorial que mantém retenção usando promessas progressivas e resultados parciais a cada etapa.',
    phases: [
      { name: 'Resultado Final (Preview)', duration: '0-15s', tip: 'Mostre o resultado final PRIMEIRO — o que o espectador vai conseguir fazer' },
      { name: 'Por que isso importa', duration: '15s-1min', tip: 'Conecte emocionalmente: dor/benefício de aprender isso' },
      { name: 'Etapas com Mini-Resultados', duration: '1-12min', tip: 'Cada etapa deve ter um resultado visível. "Pronto, já funciona. Mas agora vamos melhorar..."' },
      { name: 'Resultado Completo', duration: '12-14min', tip: 'Mostre o resultado final completo, compare com o início' },
      { name: 'Próximos Passos + CTA', duration: 'últimos 90s', tip: '"Agora que você sabe isso, assiste esse vídeo aqui para ir além"' },
    ],
    bestFor: ['tecnologia', 'programação', 'culinária', 'DIY'],
    retentionCurve: 'Retenção alta e estável — cada etapa renova o interesse',
  },
  {
    id: 's5',
    name: 'Documentário Narrativo (Long-form 40-60min)',
    description: 'Para vídeos longos tipo documentário. Usa múltiplos arcos narrativos e cliffhangers a cada 5 minutos.',
    phases: [
      { name: 'Teaser Cinematográfico', duration: '0-30s', tip: 'Cena mais impactante do vídeo como teaser. Voz grave, música tensa.' },
      { name: 'Ato 1: Apresentação', duration: '30s-12min', tip: 'Apresente personagens, contexto histórico, stakes. Termine com primeiro cliffhanger.' },
      { name: 'Ato 2: Conflito', duration: '12-30min', tip: 'Aprofunde o conflito. Revele informações progressivamente. Mini-cliffhanger a cada 5min.' },
      { name: 'Ato 3: Clímax', duration: '30-45min', tip: 'Intensifique ao máximo. Revelações bombásticas. Ritmo acelerado.' },
      { name: 'Ato 4: Resolução', duration: '45-60min', tip: 'Resolva, reflita, conecte com o presente. CTA emocional.' },
    ],
    bestFor: ['true crime', 'história', 'documentários', 'investigação'],
    retentionCurve: 'Retenção alta sustentada com cliffhangers mantendo engajamento por toda duração',
  },
];

// ========== SEO PATTERNS ==========
export const SEO_KEYWORD_PATTERNS: SEOKeywordPattern[] = [
  { id: 'seo1', pattern: 'como + [ação] + [resultado]', examples: ['como ganhar dinheiro online', 'como emagrecer rápido', 'como investir em ações'], searchVolume: 'alto', competition: 'alta' },
  { id: 'seo2', pattern: '[ano] + [tema]', examples: ['2026 tendências', 'melhor celular 2026', 'como investir em 2026'], searchVolume: 'alto', competition: 'média' },
  { id: 'seo3', pattern: '[tema] + para iniciantes', examples: ['programação para iniciantes', 'investimentos para iniciantes', 'yoga para iniciantes'], searchVolume: 'médio', competition: 'média' },
  { id: 'seo4', pattern: '[tema] + vale a pena', examples: ['nubank vale a pena', 'tesla vale a pena', 'curso X vale a pena'], searchVolume: 'médio', competition: 'baixa' },
  { id: 'seo5', pattern: '[X] vs [Y]', examples: ['iPhone vs Samsung', 'ChatGPT vs Gemini', 'React vs Vue'], searchVolume: 'alto', competition: 'média' },
  { id: 'seo6', pattern: 'o que é + [tema]', examples: ['o que é blockchain', 'o que é IA', 'o que é renda passiva'], searchVolume: 'alto', competition: 'alta' },
  { id: 'seo7', pattern: '[tema] + sem aparecer', examples: ['canal sem aparecer', 'ganhar dinheiro sem aparecer', 'vídeos sem aparecer'], searchVolume: 'médio', competition: 'baixa' },
  { id: 'seo8', pattern: 'melhores + [categoria] + [ano]', examples: ['melhores ações 2026', 'melhores notebooks 2026'], searchVolume: 'alto', competition: 'alta' },
];

// ========== ADDITIONAL TITLE PATTERNS (Viral Engine Master — Information Gap Theory) ==========
export const VIRAL_TITLE_PATTERNS_V2: TitlePattern[] = [
  { id: 't13', pattern: 'A verdade perturbadora que a [Indústria/Pessoa] escondeu', example: 'A verdade perturbadora que os bancos esconderam por 20 anos', style: 'segredo_oculto', avgCTR: 18.5 },
  { id: 't14', pattern: 'Por que 99% das pessoas erram ao [Ação Comum]', example: 'Por que 99% das pessoas erram ao investir em cripto', style: 'erro_fatal', avgCTR: 16.2 },
  { id: 't15', pattern: 'Como um [Objeto Simples] gerou [Resultado Milionário/Catastrófico]', example: 'Como um pen drive destruiu uma empresa de $2 bilhões', style: 'contraste_absurdo', avgCTR: 19.1 },
  { id: 't16', pattern: 'Eu testei [Ação] por 30 dias e meu corpo [Consequência]', example: 'Eu testei jejum de 72h por 30 dias e meu corpo mudou', style: 'desafio_tempo', avgCTR: 17.8 },
  { id: 't17', pattern: 'As imagens que [Autoridade] tentou apagar da internet', example: 'As imagens que o governo tentou apagar da internet', style: 'arquivos_nao_revelados', avgCTR: 21.3 },
];

// ========== ADDITIONAL HOOKS (Contraintuitivo + Arquivo Oculto) ==========
export const VIRAL_HOOKS_V2: ViralHook[] = [
  { id: 'h16', text: '"Você acha que a internet que usamos é segura? O que eu vou te mostrar agora foi classificado como Altamente Perigoso..."', style: 'arquivo_oculto', niches: ['tecnologia', 'segurança', 'mistério'], estimatedRetention: 91 },
  { id: 'h17', text: '"Esta é a substância mais cara do mundo. E não é o ouro. Apenas 1 grama disso custa 62 trilhões de dólares..."', style: 'contraintuitivo', niches: ['ciência', 'curiosidades', 'educação'], estimatedRetention: 90 },
  { id: 'h18', text: '"Nós achávamos que a resposta estava no espaço... até encontrarmos estas imagens no fundo do oceano."', style: 'arquivo_oculto', niches: ['ciência', 'mistério', 'documentário'], estimatedRetention: 92 },
  { id: 'h19', text: '"Ele depositou $847.000 numa conta que abriu com $50 de saldo. E ninguém percebeu por 3 anos."', style: 'contraintuitivo', niches: ['finanças', 'true crime', 'curiosidades'], estimatedRetention: 89 },
  { id: 'h20', text: '"O que eu vou te mostrar nos próximos 2 minutos... médicos estão pedindo para tirar do ar."', style: 'arquivo_oculto', niches: ['saúde', 'ciência', 'polêmica'], estimatedRetention: 88 },
];

// ========== BINGE LOOP CTAs (Never say goodbye — final is the next video's hook) ==========
export const BINGE_LOOP_CTAS: CallToAction[] = [
  { id: 'bl1', text: '"Isso explica como o evento X aconteceu. Mas existe um detalhe ainda mais bizarro sobre [Assunto Y]... Eu detalhei tudo no vídeo que está aparecendo na sua tela agora. Clica nele."', placement: 'fim', type: 'playlist', effectiveness: 10 },
  { id: 'bl2', text: '"A resolução desse mistério foi encontrada. Mas isso levantou uma questão ainda mais sombria... Eu explico todos os detalhes nesse vídeo aqui."', placement: 'fim', type: 'playlist', effectiveness: 10 },
  { id: 'bl3', text: '"Se você é uma das poucas pessoas que entende a gravidade deste arquivo, se inscreva agora — o algoritmo não vai te recomendar o próximo vazamento."', placement: 'meio', type: 'inscrição', effectiveness: 9 },
  { id: 'bl4', text: '"No minuto 3:15, um detalhe na foto muda toda a teoria. Você percebeu qual é? Comente a sua resposta abaixo."', placement: 'meio', type: 'comentário', effectiveness: 9 },
];

// ========== NARRATOR ARCHETYPES ==========
export interface NarratorArchetype {
  id: string;
  name: string;
  description: string;
  toneDirective: string;
  bestForNiches: string[];
  pacingBPM: string;
}

export const NARRATOR_ARCHETYPES: NarratorArchetype[] = [
  {
    id: 'investigator',
    name: 'O Investigador',
    description: 'Tom denso, pausas dramáticas, frases curtas, foco em detalhes lógicos e conspiratórios.',
    toneDirective: 'PERSONA: Investigador criminal analisando "arquivos obscuros". Tom sério, meticuloso, quase obsessivo. Pausas dramáticas antes de revelações. Frases curtas e cortantes. Cada dado é uma "evidência". Use linguagem forense: "as evidências indicam", "o padrão se repete", "o detalhe que a maioria não percebeu".',
    bestForNiches: ['true crime', 'mistério', 'conspiração', 'tecnologia', 'ciência'],
    pacingBPM: '70-90 BPM — Suspense eletrônico, drones sub-bass',
  },
  {
    id: 'sage',
    name: 'O Sábio / Avô',
    description: 'Tom acolhedor, ritmo pausado, foco em sabedoria, folclore e emoção familiar.',
    toneDirective: 'PERSONA: Contador de causos experiente. Tom caloroso, ritmo pausado mas envolvente. Voz que lembra um avô sábio narrando histórias à beira da fogueira. Use expressões regionais, metáforas da natureza. Faça o espectador SENTIR saudade de algo que nunca viveu.',
    bestForNiches: ['história', 'folclore', 'mitologia', 'superação', 'emocionante'],
    pacingBPM: '60-80 BPM — Violão acústico fingerstyle, tom nostálgico e melancólico',
  },
  {
    id: 'hacker',
    name: 'O Hacker de Informação',
    description: 'Ritmo frenético, humor ácido e inteligente, alta densidade de informação por segundo.',
    toneDirective: 'PERSONA: Dose de fatos rápidos e inteligentes. Ritmo FRENÉTICO. Humor ácido e esperto. Cada frase carrega 2-3 informações. Zero enrolação. Entrega dopamina a cada 10 segundos. Use analogias absurdas mas precisas. Linguagem de internet nativa.',
    bestForNiches: ['curiosidades', 'ciência', 'animais', 'tecnologia', 'gaming', 'entretenimento'],
    pacingBPM: '120-140 BPM — Synthwave acelerado, batida marcante e energética',
  },
  {
    id: 'journalist',
    name: 'O Jornalista Sombrio',
    description: 'Tom sério e factual, com revelações graduais. Cria credibilidade instantânea.',
    toneDirective: 'PERSONA: Jornalista investigativo revelando escândalos. Tom sério, factual, com gravidade na voz. Revelações graduais — cada fato mais pesado que o anterior. Cite fontes implícitas ("documentos internos mostram", "segundo fontes próximas"). Credibilidade como arma de retenção.',
    bestForNiches: ['escândalos', 'política', 'negócios', 'documentário', 'casos reais'],
    pacingBPM: '80-100 BPM — Piano tenso com strings sutis, tom jornalístico',
  },
  {
    id: 'cinematic',
    name: 'O Narrador Cinematográfico',
    description: 'Voz épica, com construção de tensão longa. Parece trailer de filme.',
    toneDirective: 'PERSONA: Narrador de trailer de filme épico. Voz GRANDIOSA, construção de tensão longa, cada frase é um frame cinematográfico. Pausas longas antes de revelações. Descreva cenários como IMAX: escala, luz, som, textura. O espectador deve VISUALIZAR cada cena como um filme de $200M.',
    bestForNiches: ['guerras', 'desastres', 'impérios', 'épicos', 'história', 'mitologia'],
    pacingBPM: '70-90 BPM — Orquestra cinematográfica, brass épico, percussão tribal',
  },
  {
    id: 'scientist',
    name: 'O Cientista Curioso',
    description: 'Tom entusiasmado, cheio de "você não vai acreditar". Simplifica o complexo.',
    toneDirective: 'PERSONA: Cientista que descobriu algo INCRÍVEL e precisa contar para alguém. Tom entusiasmado, surpreso, quase infantil na maravilha. Simplifica conceitos complexos com analogias do cotidiano. "Imagine que cada célula do seu corpo fosse uma cidade...". Dados específicos que chocam. Humor geek natural.',
    bestForNiches: ['ciência', 'biologia', 'física', 'química', 'espaço', 'astronomia', 'IA'],
    pacingBPM: '100-120 BPM — Electro-pop curioso, marimba, synths otimistas',
  },
];

// ========== SOUND DESIGN PROFILES ==========
export interface SoundDesignProfile {
  id: string;
  niche: string;
  bpmRange: string;
  trilhaStyle: string;
  sfxKeys: string[];
  silenceTactic: string;
}

export const SOUND_DESIGN_PROFILES: SoundDesignProfile[] = [
  { id: 'sd1', niche: 'terror', bpmRange: '50-70 BPM', trilhaStyle: 'Drone sub-bass, frequências graves 30-50Hz, cordas dissonantes', sfxKeys: ['Sub-bass drop 40Hz', 'Risers reversos', 'Batimento cardíaco crescente', 'Silêncio abrupto 1.5s'], silenceTactic: 'Cortar TODA música por 1.5s antes da revelação chave' },
  { id: 'sd2', niche: 'mistério', bpmRange: '60-80 BPM', trilhaStyle: 'Piano esparso, pads atmosféricos, clicks metálicos', sfxKeys: ['Whoosh sutil', 'Clock ticking', 'Glitch eletrônico', 'Boom/hit suave'], silenceTactic: 'Silêncio de 1s após cada revelação — ausência de som prende atenção' },
  { id: 'sd3', niche: 'tecnologia', bpmRange: '110-130 BPM', trilhaStyle: 'Synthwave futurista, arpejos eletrônicos, bass pulsante', sfxKeys: ['Glitch digital', 'Whoosh sci-fi', 'UI click sounds', 'Data stream SFX'], silenceTactic: 'Drop abrupto antes de dado estatístico impactante' },
  { id: 'sd4', niche: 'finanças', bpmRange: '100-120 BPM', trilhaStyle: 'Synthwave moderado, piano corporativo com edge, bass sutil', sfxKeys: ['Cash register', 'Stock ticker', 'Boom/hit nos números', 'Riser antes de revelação'], silenceTactic: 'Pausa de 1s antes de revelar valor em dólares' },
  { id: 'sd5', niche: 'história', bpmRange: '70-90 BPM', trilhaStyle: 'Orquestra cinematográfica, cordas épicas, percussão tribal', sfxKeys: ['Épico drums', 'Brass stabs', 'Choir pad', 'Wind/nature ambience'], silenceTactic: 'Silêncio total por 2s antes do clímax histórico' },
  { id: 'sd6', niche: 'curiosidades', bpmRange: '120-140 BPM', trilhaStyle: 'Upbeat electro, marimba pop, bass bouncy', sfxKeys: ['Pop/ding para cada fato', 'Whoosh entre itens', 'Wrong buzzer', 'Tada/fanfare mini'], silenceTactic: 'Música para abruptamente no fato mais chocante' },
  { id: 'sd7', niche: 'true_crime', bpmRange: '60-80 BPM', trilhaStyle: 'Piano sombrio, strings tensas, low hum constante', sfxKeys: ['Heartbeat', 'Door creak', 'Siren distant', 'Evidence camera click'], silenceTactic: 'Drop total 2s antes de nomear o suspeito/vítima' },
  { id: 'sd8', niche: 'motivacional', bpmRange: '90-110 BPM', trilhaStyle: 'Piano inspiracional crescente, strings emotivos, drums building', sfxKeys: ['Riser épico', 'Crowd cheer sutil', 'Heartbeat to drums transition'], silenceTactic: 'Silêncio breve antes da frase de transformação' },
];

// ========== VFX EDIT TAGS (to embed in scripts) ==========
export const VFX_EDIT_TAGS = {
  jCut: '[J-CUT: áudio da próxima cena entra antes do vídeo]',
  parallax3D: '[BLENDER: projeção de câmera 3D sobre imagem 2D — parallax profundo]',
  zoomIn: '[AFTER EFFECTS: zoom-in contínuo (100% → 115% em 10s) + Camera Shake sutil]',
  cutMusic: '[CORTAR TODA MÚSICA POR 1.5 SEGUNDOS — Silence Effect]',
  glitch: '[INSERIR B-ROLL ACELERADO + EFEITO DE GLITCH + ZOOM-IN RÁPIDO]',
  motionGraphics: '[AFTER EFFECTS: animação de mapa/diagrama com Trim Paths + Motion Blur]',
  filmGrain: '[AFTER EFFECTS: textura de filme Super 8 + partículas de poeira na composição]',
  screenDarken: '[TELA ESCURECE POR 0.5s — troca brusca de cenário]',
  heartbeat: '[SFX: batimento cardíaco crescente + frequência sub-bass 40Hz]',
  boomHit: '[SFX: Boom/Hit impacto + parada abrupta da música por 1s]',
} as const;

// ========== 48-HOUR REVIVAL STRATEGY ==========
export interface RevivalStrategy {
  triggerCondition: string;
  actions: string[];
  timing: string;
}

export const REVIVAL_48H_STRATEGY: RevivalStrategy = {
  triggerCondition: 'Vídeo com 3+ dias publicado e CTR abaixo da média do canal',
  actions: [
    'Gerar 3 novas variações de título mais amplas (menos nichadas)',
    'Gerar 2 novos conceitos de thumbnail com contraste de cores completamente diferente do original',
    'Trocar título/thumb no YouTube Studio no 3º dia exato após publicação',
    'Usar cores complementares opostas ao original para vencer "banner blindness"',
  ],
  timing: '3º dia após publicação — quando o YouTube testa com audiência ampla e CTR cai',
};

export const HOOK_STYLES = ['curiosidade', 'urgência', 'polêmica', 'storytelling', 'choque', 'empatia', 'contraintuitivo', 'arquivo_oculto'] as const;
export const CTA_PLACEMENTS = ['início', 'meio', 'fim', 'pin_comment'] as const;
export const CTA_TYPES = ['inscrição', 'like', 'comentário', 'compartilhar', 'playlist', 'produto'] as const;
export const TITLE_STYLES = ['curiosidade', 'urgência', 'números', 'contraintuitivo', 'storytelling', 'polêmica', 'segredo_oculto', 'erro_fatal', 'contraste_absurdo', 'desafio_tempo', 'arquivos_nao_revelados', 'negatividade_aviso', 'curiosidade_inversa', 'promessa_condicional'] as const;

// ========== ADDITIONAL TITLE PATTERNS V3 (Viral Engine v4.0 — Complete Formula Set) ==========
export const VIRAL_TITLE_PATTERNS_V3: TitlePattern[] = [
  { id: 't18', pattern: 'Pare de [Ação Comum] imediatamente', example: 'Pare de carregar seu celular à noite imediatamente', style: 'negatividade_aviso', avgCTR: 17.4 },
  { id: 't19', pattern: 'O que acontece quando você [Ação Bizarra] por 30 dias', example: 'O que acontece quando você bebe 5L de água por 30 dias', style: 'curiosidade_inversa', avgCTR: 16.8 },
  { id: 't20', pattern: 'Se você fizer isso 1× por dia, seu [Resultado] muda em [Tempo]', example: 'Se você fizer isso 1× por dia, seu sono muda em 2 semanas', style: 'promessa_condicional', avgCTR: 15.9 },
];

// ========== PSYCHOLOGICAL CTAs (Viral Engine v4.0) ==========
export interface PsychologicalCTA {
  id: string;
  label: string;
  text: string;
  psychologyBasis: string;
  bestPlacement: 'início' | 'meio' | 'fim';
}

export const PSYCHOLOGICAL_CTAS: PsychologicalCTA[] = [
  {
    id: 'pcta1',
    label: 'Escassez',
    text: '"Se você é uma das poucas pessoas que entende a gravidade deste arquivo oculto, já se inscreva — o algoritmo não vai te recomendar o próximo vazamento."',
    psychologyBasis: 'Escassez + Exclusividade: o espectador se sente parte de um grupo seleto.',
    bestPlacement: 'meio',
  },
  {
    id: 'pcta2',
    label: 'Emocional',
    text: '"Se você também ficou em choque ao ver que essa tecnologia já existe, se inscreva agora antes que este vídeo saia do ar."',
    psychologyBasis: 'Vinculação emocional: atrelar o CTA à emoção que o espectador acabou de sentir.',
    bestPlacement: 'meio',
  },
  {
    id: 'pcta3',
    label: 'Desafio Mental',
    text: '"No minuto 3:15, um detalhe na foto muda toda a teoria. Você percebeu qual é? Comente a sua resposta abaixo."',
    psychologyBasis: 'Gamificação: transforma o vídeo em desafio. Infla comentários para o algoritmo.',
    bestPlacement: 'meio',
  },
  {
    id: 'pcta4',
    label: 'Identidade',
    text: '"Só quem tem curiosidade acima da média chega até esse ponto do vídeo. Se você é um deles, o canal foi feito pra você."',
    psychologyBasis: 'Identidade tribal: o espectador se identifica com um grupo de "escolhidos".',
    bestPlacement: 'fim',
  },
];

// ========== ELITE REFERENCE CHANNELS ==========
export interface EliteReferenceChannel {
  id: string;
  name: string;
  country: 'US' | 'BR';
  niche: string;
  subscribers: string;
  revenue?: string;
  keyLessons: string[];
}

export const ELITE_REFERENCE_CHANNELS: EliteReferenceChannel[] = [
  // 5 US Channels
  {
    id: 'ref_us1', name: 'MrBallen', country: 'US', niche: 'Strange/Dark Stories', subscribers: '5M+',
    keyLessons: ['Storytelling em 3 atos com pacing milimétrico', 'Ganchos que confirmam o clique nos primeiros 10s', 'Persona sem rosto (voz = identidade)', 'Títulos com tagline de marca reconhecível'],
  },
  {
    id: 'ref_us2', name: 'The Infographics Show', country: 'US', niche: 'Educação Animada', subscribers: '15M', revenue: '$100K–$300K/mês',
    keyLessons: ['Consistência visual como identidade (cor única por canal)', 'Humor + clareza = retenção alta', 'Alta frequência sem perder qualidade', 'Thumbnails com fórmula repetível e reconhecível'],
  },
  {
    id: 'ref_us3', name: 'Mr. Nightmare', country: 'US', niche: 'Horror/True Crime', subscribers: '6M+',
    keyLessons: ['Sound design como co-narrador', 'Tom calmo cria mais medo que voz dramática', 'Histórias em 1ª pessoa aumentam imersão', 'Monetização via Patreon + Merch além do AdSense'],
  },
  {
    id: 'ref_us4', name: 'WatchMojo', country: 'US', niche: 'Listas/Pop Culture', subscribers: '26M', revenue: '$120K–$334K/mês',
    keyLessons: ['Templates repetíveis criam CTR previsível', 'Formato lista = alta retenção (curiosidade pelo #1)', 'Escalabilidade via sistema editorial', 'Sem personalidade central = liberdade total de nicho'],
  },
  {
    id: 'ref_us5', name: 'Daily Dose of Internet', country: 'US', niche: 'Curadoria Viral', subscribers: '20M', revenue: '$140K–$400K/mês',
    keyLessons: ['Curadoria de qualidade supera produção de quantidade', 'Tom neutro constrói confiança de longo prazo', 'Formato "mais um clip" = Binge Loop natural', 'Upload timing consistente treina o algoritmo'],
  },
  // 5 BR Channels
  {
    id: 'ref_br1', name: 'Fatos Desconhecidos', country: 'BR', niche: 'Curiosidades/Mistérios', subscribers: '17M+',
    keyLessons: ['Volume diário como estratégia de SEO e discovery', 'Thumbnails intrigantes com título-gancho na imagem', 'Conteúdo evergreen = vídeos crescem por anos', 'Presença multiplataforma como motor de inscritos'],
  },
  {
    id: 'ref_br2', name: 'Você Sabia?', country: 'BR', niche: 'Curiosidades/Ciência', subscribers: '14M+',
    keyLessons: ['Quadros fixos criam audiência fiel e expectativa', 'Interação com público infla comentários organicamente', 'Conteúdo atual + atemporal balanceados', 'Marca forte sem exposição de rosto'],
  },
  {
    id: 'ref_br3', name: 'INCRÍVEL', country: 'BR', niche: 'Listas/Dark Geral', subscribers: 'Milhões',
    keyLessons: ['Modelo escalável: 1-2 pessoas + edição terceirizada', 'Vídeos 8-12min = sweet spot para AdSense mid-roll', 'Identidade visual cria recall sem rosto', 'Alta frequência = teste contínuo de formatos'],
  },
  {
    id: 'ref_br4', name: 'Nostalgia', country: 'BR', niche: 'Cultura Pop/Documentário', subscribers: '14M+',
    keyLessons: ['Alta qualidade > alta frequência para base leal', 'Vídeos longos (20min+) aumentam Session Time', 'Narração com personalidade fideliza sem rosto', 'Nicho nostalgia = viés emocional forte'],
  },
  {
    id: 'ref_br5', name: 'Manual do Mundo', country: 'BR', niche: 'Ciência/Experimentos', subscribers: '15M+',
    keyLessons: ['15 anos = autoridade de domínio no algoritmo', 'Desafios visuais criam engagement espontâneo', 'Postagem diária como disciplina editorial', 'Educação + entretenimento = RPM elevado'],
  },
];
