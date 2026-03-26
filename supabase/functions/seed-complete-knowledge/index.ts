import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── YOUTUBE ALGORITHM KNOWLEDGE ──
const ALGORITHM_KNOWLEDGE = [
  // SHORTS
  { category: "shorts_algorithm", title: "Shorts: LOV ideal é 28-36 segundos", content: "O sweet spot de LOV (Length of View) para Shorts é 32 segundos. Shorts entre 28-36s têm distribuição máxima pelo algoritmo.", confidence_score: 9, applies_to_format: "shorts", priority: 10, data_json: { min_lov: 28, max_lov: 36, optimal_lov: 32, unit: "seconds" } },
  { category: "shorts_algorithm", title: "Shorts: Retenção mínima para distribuição", content: "Retenção mínima para distribuição = 100% (rewatches). Abaixo de 70% = shadowban de distribuição. O algoritmo prioriza Shorts que geram rewatches.", confidence_score: 9, applies_to_format: "shorts", priority: 10, data_json: { min_retention: 100, critical_threshold: 70, unit: "%" } },
  { category: "shorts_algorithm", title: "Shorts: Swipe ratio mínimo", content: "Swipe ratio mínimo = 81.1%. Abaixo disso o algoritmo para de distribuir o Short para novas audiências.", confidence_score: 9, applies_to_format: "shorts", priority: 9, data_json: { min_swipe_ratio: 81.1, unit: "%" } },
  { category: "shorts_algorithm", title: "Shorts: CV+RV para snowball effect", content: "Casual Viewers + Regular Viewers mínimo = 55% para snowball effect. Quando atingido, o multiplicador de distribuição é ~3.5x.", confidence_score: 9, applies_to_format: "shorts", priority: 9, data_json: { min_cv_rv: 55, snowball_multiplier_if_met: 3.5 } },
  { category: "shorts_algorithm", title: "Shorts: Primeiro 0.5s é decisivo", content: "O primeiro meio segundo determina se o espectador vai assistir. Se perder audiência ali, o Short não será distribuído pelo algoritmo.", confidence_score: 9, applies_to_format: "shorts", priority: 10, data_json: { critical_window: 0.5, unit: "seconds" } },
  { category: "shorts_algorithm", title: "Shorts: Não colocar CTA nos primeiros 3s", content: "Colocar CTA verbal nos primeiros 3 segundos mata o hook e a retenção. O CTA deve vir apenas no final ou overlay discreto.", confidence_score: 8, applies_to_format: "shorts", priority: 9, data_json: { no_cta_window: 3, unit: "seconds" } },
  { category: "shorts_algorithm", title: "Shorts: Hashtags máximo 3-5", content: "Hashtags: máximo 3-5 tags relevantes ao nicho. Mais que isso = penalidade de distribuição. Preferir tags de nicho específico.", confidence_score: 8, applies_to_format: "shorts", priority: 7, data_json: { max_hashtags: 5, optimal: 3 } },
  // LONGFORM
  { category: "longform_algorithm", title: "Longform: CTR ideal 4-10%", content: "Click-Through Rate (CTR) ideal = 4-10%. Abaixo de 2% o algoritmo para de recomendar o vídeo. Acima de 10% é excepcional.", confidence_score: 9, applies_to_format: "longform", priority: 10, data_json: { min_ctr: 2, optimal_min: 4, optimal_max: 10, unit: "%" } },
  { category: "longform_algorithm", title: "Longform: AVD ideal 40-60%", content: "Average View Duration ideal = 40-60% do vídeo. Abaixo de 30% = morte algorítmica. O algoritmo pesa AVD mais que views totais.", confidence_score: 9, applies_to_format: "longform", priority: 10, data_json: { critical_avd: 30, optimal_min: 40, optimal_max: 60, unit: "%" } },
  { category: "longform_algorithm", title: "Longform: Primeiros 30s = 70% da retenção", content: "Primeiros 30 segundos = 70% da retenção total. Se o hook não funcionar nos primeiros 30s, o vídeo inteiro sofre.", confidence_score: 9, applies_to_format: "longform", priority: 10, data_json: { critical_window: 30, retention_weight: 70, unit: "seconds" } },
  { category: "ctr_optimization", title: "Longform: Títulos 40-70 caracteres", content: "Títulos entre 40-70 caracteres performam 23% melhor em CTR. Curtos demais não geram curiosidade, longos demais são cortados.", confidence_score: 8, applies_to_format: "longform", priority: 8, data_json: { min_chars: 40, max_chars: 70, ctr_boost: 23 } },
  { category: "longform_algorithm", title: "Longform: Duração ideal 8-15 minutos", content: "Vídeos de 8-15 minutos têm melhor equilíbrio watch-time vs completions para monetização. Ideais para mid-roll ads.", confidence_score: 8, applies_to_format: "longform", priority: 8, data_json: { optimal_min: 8, optimal_max: 15, unit: "minutes" } },
  { category: "longform_algorithm", title: "Longform: Consistência > frequência", content: "Upload consistency importa MAIS que frequência. 1 vídeo/semana consistente > 3 vídeos/semana irregular. O algoritmo premia padrões.", confidence_score: 9, applies_to_format: "longform", priority: 9, data_json: {} },
  { category: "longform_algorithm", title: "Longform: Bolha dos 10-12 vídeos", content: "O algoritmo só entende o canal após 10-12 vídeos no mesmo nicho. Antes disso, distribuição é aleatória. Após, multiplicador de ~4x.", confidence_score: 8, applies_to_format: "longform", priority: 9, data_json: { video_threshold: 12, multiplier_after: 4 } },
  { category: "longform_algorithm", title: "Longform: End screen boost", content: "End screen com vídeo sugerido aumenta watch time do canal em 15-25%. Sempre incluir sugestão de vídeo no final.", confidence_score: 8, applies_to_format: "longform", priority: 7, data_json: { watch_time_boost_min: 15, watch_time_boost_max: 25 } },
  // YPP
  { category: "ypp_requirements", title: "YPP Longform: 1000 subs + 4000h", content: "YPP Longform: 1.000 subscribers + 4.000 horas assistidas nos últimos 12 meses. Caminho mais sustentável para monetização.", confidence_score: 10, applies_to_format: "longform", priority: 10, data_json: { subscribers_required: 1000, watch_hours_required: 4000, period_months: 12 } },
  { category: "ypp_requirements", title: "YPP Shorts: 1000 subs + 10M views", content: "YPP Shorts: 1.000 subscribers + 10.000.000 views em Shorts nos últimos 90 dias. Caminho mais difícil mas possível.", confidence_score: 10, applies_to_format: "shorts", priority: 10, data_json: { subscribers_required: 1000, shorts_views_required: 10000000, period_days: 90 } },
  { category: "ypp_requirements", title: "YPP: Tempo médio 3-6 meses", content: "Com estratégia consistente (3-4 vídeos/semana), tempo médio para YPP = 3-6 meses. Varia por nicho e qualidade.", confidence_score: 8, applies_to_format: "both", priority: 8, data_json: { min_months: 3, max_months: 6, videos_per_week: 3.5 } },
  { category: "ypp_requirements", title: "YPP: Mix Longform+Shorts é mais rápido", content: "Shorts sozinhos = caminho muito mais difícil para YPP. Mix Longform+Shorts = caminho mais rápido. Shorts trazem subs, Longform traz watch time.", confidence_score: 9, applies_to_format: "both", priority: 8, data_json: {} },
  // CTR
  { category: "ctr_optimization", title: "Thumbnail: Rostos com emoção extrema", content: "Rostos com emoção extrema (choque, medo, felicidade intensa) aumentam CTR em 30-40% vs thumbnails sem rosto ou com expressão neutra.", confidence_score: 9, applies_to_format: "both", priority: 9, data_json: { ctr_boost_min: 30, ctr_boost_max: 40 } },
  { category: "ctr_optimization", title: "Thumbnail: Contraste de cores", content: "Contraste de cores (ex: amarelo + azul escuro) aumenta scroll-stop 2.3x vs thumbnails monocromáticas. Usar combinações complementares.", confidence_score: 8, applies_to_format: "both", priority: 8, data_json: { scroll_stop_multiplier: 2.3 } },
  { category: "ctr_optimization", title: "Números ímpares em títulos", content: "Números ímpares em títulos têm 20% mais CTR que números pares. '7 motivos' > '10 motivos'. Nosso cérebro processa ímpares como mais autênticos.", confidence_score: 7, applies_to_format: "both", priority: 7, data_json: { odd_numbers_ctr_boost: 20 } },
  { category: "ctr_optimization", title: "Perguntas no título boost CTR", content: "Perguntas no título aumentam CTR em 15% vs afirmações. 'Por que X?' > 'X é assim'. Geram curiosidade gap automático.", confidence_score: 8, applies_to_format: "both", priority: 8, data_json: { question_ctr_boost: 15 } },
];

// ── VIRAL MECHANICS LIBRARY ──
const VIRAL_MECHANICS = [
  // HOOK FORMULAS
  { mechanic_name: "Hook In-Media-Res", category: "hook_formula", description: "Começar no momento mais intenso do vídeo. 38% dos vídeos virais usam esta técnica.", how_to_apply: "Grave a cena mais dramática/emocionante primeiro. Use como abertura. Depois volte ao contexto com 'Mas deixa eu explicar como chegamos aqui...'", effectiveness_score: 9.5, best_video_format: "both", difficulty: "medium", example_titles: ["O momento em que tudo mudou...", "Isso não deveria ter acontecido"], real_world_evidence: "38% dos vídeos com 10M+ views usam in-media-res como hook principal" },
  { mechanic_name: "Hook Contradição", category: "hook_formula", description: "'Todo mundo diz X, mas a verdade é Y'. Gera dissonância cognitiva imediata que prende a atenção.", how_to_apply: "Comece com uma crença popular no seu nicho e imediatamente contradiga com dados ou perspectiva inesperada. A dissonância cognitiva força o espectador a continuar.", effectiveness_score: 9.2, best_video_format: "both", difficulty: "easy", example_titles: ["Todo mundo está ERRADO sobre isso", "A mentira que te contaram sobre..."], real_world_evidence: "Títulos com contradição têm CTR 27% acima da média do nicho" },
  { mechanic_name: "Hook Número Específico Estranho", category: "hook_formula", description: "'2.347.891 pessoas não sabem disso' > 'Milhões de pessoas'. Números específicos são mais críveis.", how_to_apply: "Use números precisos e inesperados no hook. Quanto mais específico, mais crível. Evite números redondos — '2.347' > '2.000'.", effectiveness_score: 8.8, best_video_format: "both", difficulty: "easy", example_titles: ["Apenas 2.347 pessoas sabem disso", "97.3% das pessoas erram isso"], real_world_evidence: "Números específicos aumentam credibilidade percebida em 31%" },
  { mechanic_name: "Hook Confissão", category: "hook_formula", description: "'Eu nunca deveria ter descoberto isso...' Vulnerabilidade cria conexão imediata com o espectador.", how_to_apply: "Comece revelando algo pessoal ou algo que 'não deveria ser público'. Cria intimidade e sensação de acesso exclusivo.", effectiveness_score: 8.7, best_video_format: "longform", difficulty: "easy", example_titles: ["Eu não deveria estar mostrando isso...", "Preciso confessar uma coisa"], real_world_evidence: "Hooks de confissão retêm 22% mais que hooks informativos no mesmo nicho" },
  { mechanic_name: "Hook Promessa de Transformação em Tempo", category: "hook_formula", description: "'Em 47 segundos você vai entender por que...' CTR 22% acima da média. Tempo específico cria urgência.", how_to_apply: "Prometa uma revelação em tempo específico. Use segundos para Shorts, minutos para Longform. O número ímpar e preciso gera mais curiosidade.", effectiveness_score: 8.5, best_video_format: "both", difficulty: "easy", example_titles: ["Em 47 segundos você vai entender tudo", "Daqui a 3 minutos sua visão vai mudar"], real_world_evidence: "CTR 22% acima da média quando inclui tempo específico no hook" },
  { mechanic_name: "Hook Voz Interna", category: "hook_formula", description: "'Sabe aquela sensação de...?' Faz o espectador sentir que o vídeo foi feito para ele pessoalmente.", how_to_apply: "Descreva uma experiência universal mas raramente verbalizada no seu nicho. O espectador pensa 'isso sou eu!' e fica engajado.", effectiveness_score: 8.3, best_video_format: "both", difficulty: "medium", example_titles: ["Sabe quando você sente que...", "Você já teve aquela sensação de..."], real_world_evidence: "Comentários com 'eu me identifiquei' aumentam 4x com este hook" },
  // RETENTION LOOPS
  { mechanic_name: "Open Loop Triplo", category: "retention_loop", description: "Abrir 3 ganchos nos primeiros 60 segundos, fechar progressivamente. Retenção média 67% vs 43% sem loops.", how_to_apply: "Nos primeiros 60s, mencione 3 pontos intrigantes que serão revelados depois. Feche o 1o no meio do vídeo, o 2o no 3o terço, e o 3o no final. Cada fechamento gera dopamina.", effectiveness_score: 9.8, avg_retention_boost_pct: 24, best_video_format: "longform", difficulty: "hard", real_world_evidence: "Retenção média 67% vs 43% em vídeos sem open loops" },
  { mechanic_name: "Micro-Recompensa a cada 90s", category: "retention_loop", description: "Revelar pequeno insight ou twist a cada 90 segundos mantém dopamina ativa e previne drop-off.", how_to_apply: "Divida o conteúdo em blocos de 90s. Cada bloco deve ter uma mini-revelação, dado surpreendente, ou mudança visual significativa.", effectiveness_score: 9.2, avg_retention_boost_pct: 18, best_video_format: "longform", difficulty: "medium", real_world_evidence: "Vídeos com padrão de recompensa regular retêm 18% mais" },
  { mechanic_name: "Cliffhanger de Capítulo", category: "retention_loop", description: "Cada seção do vídeo termina com pergunta não respondida. Copia estrutura de série Netflix.", how_to_apply: "Antes de cada transição, plante uma pergunta ou deixe algo incompleto. 'Mas o que aconteceu depois foi ainda mais impressionante...' → corte para próxima seção.", effectiveness_score: 9.0, avg_retention_boost_pct: 15, best_video_format: "longform", difficulty: "medium", real_world_evidence: "Padrão usado por canais top de storytelling com 60%+ AVD" },
  { mechanic_name: "Padrão Iceberg", category: "retention_loop", description: "Revelar camada mais profunda que o espectador não esperava ter. Gera surpresa cognitiva e reward.", how_to_apply: "Comece com o que todos sabem → revele a 1a camada oculta → revele a 2a camada que realmente choca. Cada camada deve ser genuinamente surpreendente.", effectiveness_score: 8.7, avg_retention_boost_pct: 20, best_video_format: "longform", difficulty: "hard", real_world_evidence: "Vídeos 'iceberg' têm taxa de compartilhamento 3.2x maior" },
  // EMOTIONAL TRIGGERS
  { mechanic_name: "Curiosidade Gap", category: "emotional_trigger", description: "Dar informação suficiente para criar desconforto mas não suficiente para satisfazer. Mais eficaz nos primeiros 30s.", how_to_apply: "Revele 70% da história, mas deixe o detalhe crucial para depois. O cérebro não consegue parar com informação incompleta.", effectiveness_score: 9.6, best_video_format: "both", difficulty: "medium", real_world_evidence: "Técnica mais usada em títulos de vídeos com 50M+ views" },
  { mechanic_name: "Urgência de Identidade", category: "emotional_trigger", description: "'Se você faz X, você está perdendo...' Aciona medo de perder algo relacionado à identidade pessoal.", how_to_apply: "Conecte o conteúdo à identidade do espectador. 'Se você é [tipo de pessoa], precisa saber que...' Aciona FOMO + identidade.", effectiveness_score: 9.1, best_video_format: "both", difficulty: "easy", real_world_evidence: "Vídeos com identity triggers têm CTR 35% maior que vídeos informativos neutros" },
  { mechanic_name: "Justiça/Vingança", category: "emotional_trigger", description: "Narrativas de injustiça + resolução têm bilhões de views coletivos. MrBallen, true crime, investigação.", how_to_apply: "Estrutura: injustiça clara → investigação → resolução satisfatória. O espectador precisa sentir raiva primeiro, depois satisfação.", effectiveness_score: 9.4, best_video_format: "longform", difficulty: "medium", example_channels: ["MrBallen", "JCS Criminal Psychology"], real_world_evidence: "Narrativas de justiça têm taxa de completions 40% acima da média" },
  { mechanic_name: "Pertencimento Tribal", category: "emotional_trigger", description: "'Você que assiste isso é diferente de...' Cria grupo exclusivo de espectadores.", how_to_apply: "Faça o espectador sentir que faz parte de um grupo seleto por assistir seu conteúdo. 'A maioria das pessoas não sabe, mas você que está aqui...'", effectiveness_score: 8.6, best_video_format: "both", difficulty: "easy", real_world_evidence: "Comentários de fidelidade aumentam 5x com tribal framing" },
  { mechanic_name: "Nostalgia", category: "emotional_trigger", description: "Conectar presente com memória emocional positiva. Comentários explodem, compartilhamentos aumentam 3x.", how_to_apply: "Referência cultural do público-alvo. Use visual, música ou menções que ativem memórias positivas. Funciona melhor com público 25+.", effectiveness_score: 8.9, best_video_format: "both", difficulty: "medium", real_world_evidence: "Compartilhamentos aumentam 3x em conteúdo com elementos nostálgicos" },
  // THUMBNAIL CTR
  { mechanic_name: "Thumbnail: Regra do 1/3", category: "thumbnail_ctr", description: "Rosto ocupa 1/3 esquerdo, texto no 1/3 direito, objeto/contexto no centro. Composição que maximiza CTR.", how_to_apply: "Divida a thumbnail em 3 colunas. Rosto emocional à esquerda (onde o olho vai primeiro), contexto no centro, texto mínimo à direita.", effectiveness_score: 8.5, avg_ctr_boost_pct: 28, best_video_format: "longform", difficulty: "easy", real_world_evidence: "28% de boost em CTR vs composição aleatória" },
  { mechanic_name: "Thumbnail: Seta subliminar", category: "thumbnail_ctr", description: "Seta apontando para fora do frame cria curiosidade subliminar sobre o que está além.", how_to_apply: "Adicione seta ou elemento direcional apontando para algo fora do enquadramento. Cria desejo inconsciente de clicar para ver o que está fora.", effectiveness_score: 7.5, avg_ctr_boost_pct: 15, best_video_format: "both", difficulty: "easy", real_world_evidence: "15% de boost em CTR com elementos direcionais" },
  { mechanic_name: "Thumbnail: Fundo escuro + cor intensa", category: "thumbnail_ctr", description: "Fundo preto ou muito escuro com 1 elemento colorido intenso = maior scroll-stop.", how_to_apply: "Use fundo predominantemente escuro (#000-#1a1a1a) com UM elemento em cor vibrante (vermelho, amarelo, cyan). O contraste extremo para o scroll.", effectiveness_score: 8.0, avg_ctr_boost_pct: 22, best_video_format: "both", difficulty: "easy", real_world_evidence: "22% de boost em CTR vs thumbnails com fundo claro ou uniforme" },
];

// ── MONETIZATION KNOWLEDGE BASE ──
const MONETIZATION_KNOWLEDGE = [
  // RPM por país
  { topic: "rpm_by_country", title: "RPM EUA (US)", content: "RPM médio nos EUA varia de $6-15 dependendo do nicho. Finance/Insurance podem chegar a $30+. Entertainment fica em $4-8.", country_code: "US", data_json: { min_rpm: 6.0, max_rpm: 15.0, avg_rpm: 8.5, currency: "USD", difficulty: "high" }, confidence_score: 9 },
  { topic: "rpm_by_country", title: "RPM Brasil (BR)", content: "RPM médio no Brasil varia de $0.80-2.50. Nichos de finanças e tech podem chegar a $3-4. Entertainment fica em $0.50-1.50.", country_code: "BR", data_json: { min_rpm: 0.80, max_rpm: 2.50, avg_rpm: 1.50, currency: "USD", difficulty: "low" }, confidence_score: 9 },
  { topic: "rpm_by_country", title: "RPM Portugal (PT)", content: "RPM médio em Portugal varia de $2.50-5.00. Audiência europeia com RPM intermediário. Nichos tech/finance performam melhor.", country_code: "PT", data_json: { min_rpm: 2.50, max_rpm: 5.00, avg_rpm: 3.50, currency: "USD", difficulty: "medium" }, confidence_score: 8 },
  { topic: "rpm_by_country", title: "RPM Alemanha (DE)", content: "RPM médio na Alemanha varia de $4.50-9.00. Um dos mercados mais valiosos da Europa. Conteúdo em alemão tem RPM premium.", country_code: "DE", data_json: { min_rpm: 4.50, max_rpm: 9.00, avg_rpm: 6.00, currency: "USD", difficulty: "high" }, confidence_score: 8 },
  { topic: "rpm_by_country", title: "RPM Polônia (PL)", content: "RPM médio na Polônia varia de $1.50-3.50. Mercado em crescimento com RPM acima de países emergentes.", country_code: "PL", data_json: { min_rpm: 1.50, max_rpm: 3.50, avg_rpm: 2.20, currency: "USD", difficulty: "low" }, confidence_score: 8 },
  { topic: "rpm_by_country", title: "RPM Turquia (TR)", content: "RPM médio na Turquia varia de $0.50-1.80. Mercado com alto volume mas baixo RPM. Volume compensa.", country_code: "TR", data_json: { min_rpm: 0.50, max_rpm: 1.80, avg_rpm: 1.00, currency: "USD", difficulty: "low" }, confidence_score: 8 },
  { topic: "rpm_by_country", title: "RPM Suécia (SE)", content: "RPM médio na Suécia varia de $4.00-7.50. Mercado nórdico premium com audiência de alto poder aquisitivo.", country_code: "SE", data_json: { min_rpm: 4.00, max_rpm: 7.50, avg_rpm: 5.50, currency: "USD", difficulty: "medium" }, confidence_score: 8 },
  // Revenue diversification
  { topic: "revenue_diversification", title: "Infoproduto antes do YPP", content: "Vender produto digital R$17-47 via link na bio desde o vídeo 1. Não requer monetização do YouTube. Ebooks, checklists, templates do nicho. Com 500 views/vídeo e 1% conversão = R$85-235/vídeo.", country_code: "ALL", data_json: { min_price: 17, max_price: 47, conversion_rate: 0.01, currency: "BRL" }, confidence_score: 8 },
  { topic: "affiliate_strategy", title: "Afiliados Amazon no mês 2", content: "Programa de afiliados Amazon oferece 3-8% de comissão. Integrar naturalmente ao conteúdo do nicho. Link na descrição + menção sutil no vídeo. Funciona especialmente bem em nichos de review/tech/lifestyle.", country_code: "ALL", data_json: { commission_min: 3, commission_max: 8, unit: "%" }, confidence_score: 8 },
  { topic: "sponsorship_rates", title: "Micro-sponsorship com 1000 subs", content: "Micro-influencer marketing está em alta. Canais com 1000+ subs em nichos específicos podem cobrar $50-200 por vídeo. Em nichos de tecnologia, finanças e saúde o valor é maior. Plataformas: Collabstr, AspireIQ.", country_code: "ALL", data_json: { min_usd: 50, max_usd: 200, min_subs: 1000 }, confidence_score: 7 },
  { topic: "shorts_monetization", title: "Shorts RPM real", content: "Shorts RPM real: $0.04-0.07 por 1000 views. Canal de shorts com 1M views/mês = $40-70. Não é caminho principal de receita, mas excelente para crescimento de subs e awareness.", country_code: "ALL", data_json: { min_rpm: 0.04, max_rpm: 0.07, unit: "per_1000_views" }, confidence_score: 9 },
  { topic: "revenue_diversification", title: "Membership e Super Chat", content: "YouTube Memberships disponível após 1000 subs. Super Chat em lives. Receita recorrente de $1-25/mês por membro. Canais de nicho com comunidade forte convertem 2-5% da audiência.", country_code: "ALL", data_json: { min_price: 1, max_price: 25, conversion_rate_min: 0.02, conversion_rate_max: 0.05 }, confidence_score: 8 },
  { topic: "timeline_realistic", title: "Timeline realista de monetização", content: "Mês 1-2: Construir base (10-20 vídeos, 0 receita). Mês 3-4: Primeiros subs orgânicos, possível afiliado. Mês 5-6: YPP se consistente. Mês 7-12: Receita crescente + sponsorships. Ano 2: Receita significativa se persistiu.", country_code: "ALL", data_json: { phase_1_months: 2, phase_2_months: 4, phase_3_months: 6, ypp_expected_month: 5 }, confidence_score: 8 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tables } = await req.json().catch(() => ({ tables: ["all"] }));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const report: Record<string, { inserted: number; skipped: number; errors: number }> = {};
    const shouldSeed = (t: string) => tables.includes("all") || tables.includes(t);

    // 1. youtube_algorithm_knowledge
    if (shouldSeed("youtube_algorithm_knowledge")) {
      const stat = { inserted: 0, skipped: 0, errors: 0 };
      for (const item of ALGORITHM_KNOWLEDGE) {
        const { data: existing } = await sb.from("youtube_algorithm_knowledge").select("id").eq("title", item.title).maybeSingle();
        if (existing) { stat.skipped++; continue; }
        const { error } = await sb.from("youtube_algorithm_knowledge").insert({
          ...item,
          source: "seed-complete-knowledge",
          valid_until: "2026-Q4",
        });
        if (error) { console.error("yak insert error:", error); stat.errors++; } else { stat.inserted++; }
      }
      report.youtube_algorithm_knowledge = stat;
      console.log("youtube_algorithm_knowledge:", stat);
    }

    // 2. viral_mechanics_library
    if (shouldSeed("viral_mechanics_library")) {
      const stat = { inserted: 0, skipped: 0, errors: 0 };
      for (const item of VIRAL_MECHANICS) {
        const { data: existing } = await sb.from("viral_mechanics_library").select("id").eq("mechanic_name", item.mechanic_name).maybeSingle();
        if (existing) { stat.skipped++; continue; }
        const { error } = await sb.from("viral_mechanics_library").insert({
          ...item,
          best_niches: item.best_niches || [],
          example_titles: item.example_titles || [],
          example_channels: item.example_channels || [],
        });
        if (error) { console.error("vml insert error:", error); stat.errors++; } else { stat.inserted++; }
      }
      report.viral_mechanics_library = stat;
      console.log("viral_mechanics_library:", stat);
    }

    // 3. monetization_knowledge_base
    if (shouldSeed("monetization_knowledge_base")) {
      const stat = { inserted: 0, skipped: 0, errors: 0 };
      for (const item of MONETIZATION_KNOWLEDGE) {
        const { data: existing } = await sb.from("monetization_knowledge_base").select("id").eq("title", item.title).maybeSingle();
        if (existing) { stat.skipped++; continue; }
        const { error } = await sb.from("monetization_knowledge_base").insert({
          ...item,
          source: "seed-complete-knowledge",
        });
        if (error) { console.error("mkb insert error:", error); stat.errors++; } else { stat.inserted++; }
      }
      report.monetization_knowledge_base = stat;
      console.log("monetization_knowledge_base:", stat);
    }

    // Log
    await sb.from("execution_logs").insert({
      function_name: "seed-complete-knowledge",
      success: true,
      metadata: report,
    });

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-complete-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
