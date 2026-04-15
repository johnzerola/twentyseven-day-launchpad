
-- Squad templates (predefined squad configurations)
CREATE TABLE public.squad_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🤖',
  squad_type TEXT NOT NULL, -- 'production', 'viral_detector', 'shorts_factory'
  agents JSONB NOT NULL DEFAULT '[]', -- array of agent definitions [{name, role, icon, system_prompt}]
  pipeline_steps JSONB NOT NULL DEFAULT '[]', -- [{step_index, agent_name, task, checkpoint, output_type}]
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Squad runs (user executions of squads)
CREATE TABLE public.squad_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.squad_templates(id),
  squad_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, paused, completed, failed
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  input_params JSONB DEFAULT '{}',
  results JSONB DEFAULT '[]', -- accumulated outputs from each step
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Squad steps (individual agent executions within a run)
CREATE TABLE public.squad_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.squad_runs(id) ON DELETE CASCADE NOT NULL,
  step_index INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  agent_role TEXT,
  agent_icon TEXT DEFAULT '🤖',
  task_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, approved, rejected, skipped
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  requires_approval BOOLEAN DEFAULT false,
  user_feedback TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.squad_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_steps ENABLE ROW LEVEL SECURITY;

-- Templates are readable by all authenticated users
CREATE POLICY "Anyone can read squad templates" ON public.squad_templates
  FOR SELECT TO authenticated USING (true);

-- Runs: users can CRUD their own
CREATE POLICY "Users manage own squad runs" ON public.squad_runs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Steps: users can read/update steps of their own runs
CREATE POLICY "Users manage own squad steps" ON public.squad_steps
  FOR ALL TO authenticated
  USING (run_id IN (SELECT id FROM public.squad_runs WHERE user_id = auth.uid()))
  WITH CHECK (run_id IN (SELECT id FROM public.squad_runs WHERE user_id = auth.uid()));

-- Enable realtime for squad_steps so UI updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_steps;

-- Seed the 3 YouTube squad templates
INSERT INTO public.squad_templates (name, description, icon, squad_type, agents, pipeline_steps) VALUES
(
  'Squad Produção Completa',
  'Pipeline completo: pesquisa de tendências → estratégia → roteiro → thumbnail → SEO. Gera conteúdo de vídeo pronto para publicar.',
  '🎬',
  'production',
  '[
    {"name":"Pesquisador","role":"Trend Research Agent","icon":"🔍","system_prompt":"Você é um pesquisador especialista em tendências do YouTube. Analise o nicho fornecido, identifique tendências atuais, tópicos em alta, e gaps de conteúdo. Use dados reais quando possível. Retorne: 5 tendências identificadas, 3 gaps de conteúdo, análise de concorrência."},
    {"name":"Estrategista","role":"Content Strategy Agent","icon":"🧠","system_prompt":"Você é um estrategista de conteúdo YouTube. Com base na pesquisa recebida, defina: ângulo único do vídeo, público-alvo específico, formato ideal (long/short), tom de voz, e proposta de valor clara. Foque em diferenciação."},
    {"name":"Roteirista","role":"Script Writer Agent","icon":"✍️","system_prompt":"Você é um roteirista especialista em YouTube. Crie um roteiro completo com: hook nos primeiros 5 segundos, estrutura de retenção com open loops, climax emocional, e CTA final. Use técnicas de storytelling e linguagem conversacional."},
    {"name":"Designer","role":"Thumbnail & Visual Agent","icon":"🎨","system_prompt":"Você é um designer de thumbnails virais. Gere: 3 conceitos de thumbnail com descrição detalhada (cores, texto, composição, emoção), prompt para geração de imagem, e análise de CTR estimado baseado em padrões virais."},
    {"name":"SEO Master","role":"SEO & Packaging Agent","icon":"📊","system_prompt":"Você é um especialista em SEO YouTube. Otimize: 5 variações de título (com scores), descrição otimizada com timestamps, 30 tags relevantes, hashtags, e cards/end screen strategy. Maximize discoverability."}
  ]'::jsonb,
  '[
    {"step_index":0,"agent_name":"Pesquisador","task":"Pesquisar tendências e oportunidades no nicho","checkpoint":false,"output_type":"research"},
    {"step_index":1,"agent_name":"Estrategista","task":"Definir estratégia e ângulo do vídeo","checkpoint":true,"output_type":"strategy"},
    {"step_index":2,"agent_name":"Roteirista","task":"Criar roteiro completo do vídeo","checkpoint":true,"output_type":"script"},
    {"step_index":3,"agent_name":"Designer","task":"Criar conceitos de thumbnail","checkpoint":true,"output_type":"thumbnails"},
    {"step_index":4,"agent_name":"SEO Master","task":"Otimizar título, descrição e tags","checkpoint":true,"output_type":"seo"}
  ]'::jsonb
),
(
  'Squad Viral Detector',
  'Detecta oportunidades virais: scanner de tendências → análise de padrões → geração de ideias → validação de potencial.',
  '🔥',
  'viral_detector',
  '[
    {"name":"Scanner","role":"Trend Scanner Agent","icon":"📡","system_prompt":"Você é um scanner de tendências virais do YouTube. Monitore: tópicos em ascensão, vídeos com velocidade anormal de views, padrões de engajamento incomuns. Identifique 10 oportunidades com potencial viral no nicho fornecido."},
    {"name":"Analista","role":"Pattern Analyzer Agent","icon":"🔬","system_prompt":"Você é um analista de padrões virais. Para cada oportunidade identificada, analise: por que está viralizando, qual gatilho psicológico, qual janela de oportunidade, nível de saturação, e score de replicabilidade (1-10)."},
    {"name":"Idealizador","role":"Idea Generator Agent","icon":"💡","system_prompt":"Você é um gerador de ideias criativas para YouTube. Com base nos padrões analisados, crie 5 ideias de vídeo únicas que aproveitem as tendências sem copiar. Cada ideia deve ter: título provisório, ângulo diferenciado, formato sugerido, e estimativa de potencial."},
    {"name":"Validador","role":"Potential Validator Agent","icon":"✅","system_prompt":"Você é um validador de potencial viral. Para cada ideia, avalie: probabilidade de viralização (1-100), risco de saturação, esforço de produção, tempo de relevância, e recomendação final (GO/WAIT/SKIP) com justificativa."}
  ]'::jsonb,
  '[
    {"step_index":0,"agent_name":"Scanner","task":"Escanear tendências e oportunidades virais","checkpoint":false,"output_type":"trends"},
    {"step_index":1,"agent_name":"Analista","task":"Analisar padrões dos vídeos em ascensão","checkpoint":false,"output_type":"analysis"},
    {"step_index":2,"agent_name":"Idealizador","task":"Gerar ideias baseadas nos padrões","checkpoint":true,"output_type":"ideas"},
    {"step_index":3,"agent_name":"Validador","task":"Validar potencial de cada ideia","checkpoint":true,"output_type":"validation"}
  ]'::jsonb
),
(
  'Squad Shorts Factory',
  'Fábrica de Shorts: trend hunter → script generator → scene planner → packaging A/B. Produção em massa otimizada.',
  '⚡',
  'shorts_factory',
  '[
    {"name":"Trend Hunter","role":"Shorts Trend Hunter Agent","icon":"🎯","system_prompt":"Você é um caçador de tendências de Shorts/Reels. Identifique: sons em alta, formatos virais, hooks que funcionam em <3 segundos, temas com alto engajamento em formato curto. Foque no nicho fornecido."},
    {"name":"Roteirista Shorts","role":"Short Script Agent","icon":"⚡","system_prompt":"Você é um roteirista especialista em Shorts (< 60s). Para cada tendência, crie 3 roteiros com: hook de 1-2 segundos, desenvolvimento rápido, payoff satisfatório. Maximize retenção em formato ultra-curto. Use pattern interrupts."},
    {"name":"Scene Planner","role":"Visual Scene Agent","icon":"🎬","system_prompt":"Você é um planejador de cenas para Shorts. Para cada roteiro: defina cortes visuais (timing exato), transições, texto na tela, efeitos sugeridos, e direção de câmera. Formato vertical 9:16 sempre."},
    {"name":"Packaging Lab","role":"A/B Testing Agent","icon":"🧪","system_prompt":"Você é um especialista em A/B testing de Shorts. Para cada Short: gere 3 variações de título, 3 thumbnails concepts, 2 hooks alternativos, e hashtags otimizadas. Priorize por potencial de reach."}
  ]'::jsonb,
  '[
    {"step_index":0,"agent_name":"Trend Hunter","task":"Caçar tendências de Shorts no nicho","checkpoint":false,"output_type":"trends"},
    {"step_index":1,"agent_name":"Roteirista Shorts","task":"Criar roteiros curtos para cada tendência","checkpoint":true,"output_type":"scripts"},
    {"step_index":2,"agent_name":"Scene Planner","task":"Planejar cenas e cortes visuais","checkpoint":true,"output_type":"scenes"},
    {"step_index":3,"agent_name":"Packaging Lab","task":"Gerar variações A/B de título e thumbnail","checkpoint":true,"output_type":"packaging"}
  ]'::jsonb
);
