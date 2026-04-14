
-- ══════════════════════════════════════════════
-- 1. NICHE SKILL TEMPLATES
-- ══════════════════════════════════════════════
CREATE TABLE public.niche_skill_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'all',
  display_name TEXT NOT NULL,
  hook_guidelines TEXT,
  tone_rules TEXT,
  forbidden_patterns TEXT[],
  example_hooks TEXT[],
  system_prompt_addition TEXT,
  pacing_notes TEXT,
  emotional_arc_template TEXT,
  effectiveness_score NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(niche, style)
);

ALTER TABLE public.niche_skill_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read niche templates"
  ON public.niche_skill_templates FOR SELECT USING (true);

CREATE POLICY "Service role manages niche templates"
  ON public.niche_skill_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ══════════════════════════════════════════════
-- 2. VIRAL ALERTS
-- ══════════════════════════════════════════════
CREATE TABLE public.viral_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT,
  channel_name TEXT,
  pre_viral_score NUMERIC,
  alert_type TEXT DEFAULT 'email',
  sent_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, video_id, alert_type)
);

ALTER TABLE public.viral_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own alerts"
  ON public.viral_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role creates alerts"
  ON public.viral_alerts FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ══════════════════════════════════════════════
-- 3. CREDIT ENFORCEMENT FUNCTION (service_role)
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_credits(_user_id UUID, _operation TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tier subscription_tier;
  _credits_remaining INTEGER;
  _cost INTEGER;
BEGIN
  -- Get tier and credits
  SELECT tier, credits_remaining INTO _tier, _credits_remaining
  FROM public.user_subscriptions WHERE user_id = _user_id;

  IF _tier IS NULL THEN
    _tier := 'starter';
    _credits_remaining := 0;
  END IF;

  -- Cost per operation
  CASE _operation
    WHEN 'generate-script' THEN _cost := 5;
    WHEN 'refine-script' THEN _cost := 3;
    WHEN 'generate-synced-prompts' THEN _cost := 4;
    WHEN 'generate-veo3-prompts' THEN _cost := 8;
    WHEN 'viral-creation-engine' THEN _cost := 6;
    WHEN 'generate-ideas' THEN _cost := 1;
    WHEN 'generate-titles' THEN _cost := 1;
    WHEN 'generate-scenes-short' THEN _cost := 3;
    WHEN 'generate-script-short' THEN _cost := 3;
    ELSE _cost := 1;
  END CASE;

  -- Check
  IF _credits_remaining < _cost THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', _credits_remaining,
      'cost', _cost,
      'tier', _tier::text
    );
  END IF;

  -- Deduct
  UPDATE public.user_subscriptions
  SET credits_remaining = credits_remaining - _cost, updated_at = now()
  WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', _credits_remaining - _cost,
    'cost', _cost,
    'tier', _tier::text
  );
END;
$$;

-- Seed initial niche templates
INSERT INTO public.niche_skill_templates (niche, style, display_name, hook_guidelines, tone_rules, forbidden_patterns, example_hooks, system_prompt_addition) VALUES
('terror', 'all', '🎃 Terror/Horror', 
 'Comece com som ambiente + detalhe sensorial perturbador. Nunca revele o monstro nos primeiros 60s.',
 'Tom íntimo sussurrado. Frases curtas. Pausas longas. Narrador vulnerável.',
 ARRAY['jumpscares baratos', 'sangue gratuito', 'clichês de filme B'],
 ARRAY['Você já sentiu que alguém te observa enquanto dorme?', 'O último áudio que ele mandou... ninguém consegue ouvir até o final.'],
 'REGRAS DE TERROR: Use a técnica Hitchcock (mostre o perigo ao espectador antes do personagem). Construa tensão com detalhes sensoriais: temperatura caindo, cheiros estranhos, sons distantes. O medo vem do DESCONHECIDO, não do explícito.'),
('finanças', 'all', '💰 Finanças/Investimentos',
 'Abra com dado chocante ou comparação de escala. Ex: "Com R$50/mês investidos há 10 anos, você teria..."',
 'Tom autoritativo mas acessível. Use analogias do cotidiano. Dados REAIS obrigatórios.',
 ARRAY['promessas de enriquecimento rápido', 'fique rico', 'sem fonte de dados', 'renda passiva fácil'],
 ARRAY['95% dos brasileiros vão se aposentar dependendo do INSS. Os outros 5% fizeram UMA coisa diferente.', 'Seu banco lucra R$47 bilhões por ano. Sabe de onde vem esse dinheiro? De você.'],
 'REGRAS FINANÇAS: Todo dado deve ter fonte. Use comparações de escala (preço de café → investimento). Mostre cenários reais com números. Nunca prometa retornos. Tom: educador pragmático.'),
('história', 'all', '📜 História/Documentário',
 'Comece in media res no momento mais tenso. Depois volte no tempo para contextualizar.',
 'Tom de investigador curioso. Construa mistério com revelações em camadas.',
 ARRAY['resumo de Wikipedia', 'lista de datas', 'narração monótona'],
 ARRAY['Em 1945, um submarino alemão apareceu na costa da Argentina. Dentro, algo que ninguém esperava.', 'Essa cidade foi apagada de todos os mapas em 1952. O motivo? Classificado por 70 anos.'],
 'REGRAS HISTÓRIA: Humanize personagens históricos com detalhes pessoais. Use técnica de mystery box: plante a pergunta, responda 3 minutos depois. Conecte eventos passados com paralelos atuais.'),
('ciência', 'all', '🔬 Ciência/Tecnologia',
 'Comece com paradoxo ou fato contraintuitivo. A surpresa gera curiosidade.',
 'Tom Kurzgesagt: científico mas maravilhado. Simplifique sem infantilizar.',
 ARRAY['jargão sem explicação', 'dados sem contexto', 'tom de aula'],
 ARRAY['Seu corpo tem 37 trilhões de células. E nenhuma delas é "você".', 'A NASA encontrou algo no fundo do oceano que não deveria existir.'],
 'REGRAS CIÊNCIA: Transforme dados em imagens mentais (ex: "se o universo fosse do tamanho de uma sala, a Terra seria menor que um grão de areia"). Use analogias visuais. Construa do simples ao complexo.'),
('curiosidades', 'all', '🧠 Curiosidades/Facts',
 'Abra com o fato mais bizarro. Padrão: "Você sabia que X? Pois Y é ainda mais estranho."',
 'Tom energético e surpreendente. Ritmo rápido com pausas estratégicas.',
 ARRAY['fatos genéricos conhecidos', 'sem verificação', 'tom de lista chata'],
 ARRAY['Existe um lago na África que transforma animais em pedra. Literalmente.', 'O Japão tem uma ilha inteira proibida para mulheres. O motivo vai te chocar.'],
 'REGRAS CURIOSIDADES: Cada fato deve gerar um "não acredito". Agrupe por tema com transições surpreendentes. Plante curiosidade sobre o próximo fato antes de terminar o atual.'),
('true_crime', 'all', '🔍 True Crime',
 'Comece pelo momento do crime ou descoberta. Cold open com tensão imediata.',
 'Tom investigativo sério. Respeite vítimas. Construa suspense com revelações dosadas.',
 ARRAY['sensacionalismo gratuito', 'detalhes gore desnecessários', 'tom debochado'],
 ARRAY['Às 3:47 da manhã, uma câmera de segurança captou algo que a polícia não consegue explicar.', 'Ela mandou uma mensagem para a mãe às 22:15. Depois disso, seu celular nunca mais foi ligado.'],
 'REGRAS TRUE CRIME: Cronologia precisa. Respeite vítimas e famílias. Use técnica de revelação em camadas. O espectador deve se sentir como detetive descobrindo pistas junto com a narrativa.'),
('superação', 'all', '💪 Superação/Motivação',
 'Comece no momento mais baixo da história. O contraste com o sucesso gera impacto.',
 'Tom empático e inspirador. Mostre vulnerabilidade real, não frases motivacionais.',
 ARRAY['frases de coach genérico', 'sucesso fácil', 'ignore a dor'],
 ARRAY['Ele dormia no carro. Hoje fatura R$2 milhões por mês. Mas o que ninguém conta é o preço que ele pagou.', 'Os médicos deram 3 meses de vida. Isso foi há 7 anos.'],
 'REGRAS SUPERAÇÃO: A jornada REAL importa mais que o resultado. Mostre os momentos de dúvida, os fracassos intermediários. O herói deve ser falho e humano. Evite qualquer tom de coaching genérico.')
ON CONFLICT (niche, style) DO NOTHING;
