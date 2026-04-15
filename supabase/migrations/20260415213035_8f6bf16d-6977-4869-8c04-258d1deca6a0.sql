
-- Add tool_context to link squads to specific pages
ALTER TABLE public.squad_templates ADD COLUMN IF NOT EXISTS tool_context TEXT DEFAULT 'general';

-- Update existing squads
UPDATE public.squad_templates SET tool_context = 'general' WHERE squad_type = 'production';
UPDATE public.squad_templates SET tool_context = 'general' WHERE squad_type = 'viral_detector';
UPDATE public.squad_templates SET tool_context = 'general' WHERE squad_type = 'shorts_factory';

-- Squad Roteiro Viral
INSERT INTO public.squad_templates (name, description, icon, squad_type, tool_context, agents, pipeline_steps) VALUES
(
  'Squad Roteiro Viral',
  'Pipeline de roteiro otimizado: pesquisa → retenção → escrita → hook review → pacing. Cria roteiros com máxima retenção.',
  '✍️',
  'script_viral',
  'scripts',
  '[
    {"name":"Pesquisador","role":"Topic Research Agent","icon":"🔍","system_prompt":"Você é um pesquisador de tópicos virais para YouTube. Analise o tema/nicho fornecido: identifique ângulos únicos, dados surpreendentes, histórias reais, e gaps que ninguém cobriu. Retorne 5 ângulos com justificativa e potencial de retenção."},
    {"name":"Analista de Retenção","role":"Retention Analyst Agent","icon":"📊","system_prompt":"Você é especialista em retenção de audiência YouTube. Para cada ângulo recebido, projete: curva de retenção esperada, pontos de drop-off, técnicas de recuperação (open loops, pattern interrupts, cliffhangers). Recomende o melhor ângulo com estrutura de retenção ideal."},
    {"name":"Roteirista","role":"Script Writer Agent","icon":"✍️","system_prompt":"Você é um roteirista viral de YouTube. Com base na análise de retenção, escreva um roteiro completo em português. Use: hook poderoso nos primeiros 5s, open loops a cada 60-90s, linguagem conversacional, storytelling emocional, climax no terço final, CTA natural. Formato: texto corrido, sem marcações técnicas."},
    {"name":"Revisor de Hook","role":"Hook Reviewer Agent","icon":"🎣","system_prompt":"Você é especialista em hooks de YouTube. Revise o roteiro recebido focando nos primeiros 30 segundos. Gere 5 variações de hook rankeadas por potencial de retenção. Para cada: texto exato, gatilho psicológico usado, retenção estimada nos primeiros 30s."},
    {"name":"Otimizador de Pacing","role":"Pacing Optimizer Agent","icon":"⚡","system_prompt":"Você é especialista em ritmo e pacing de vídeos YouTube. Revise o roteiro: identifique trechos lentos, sugira cortes, adicione marcações de intensidade emocional, e otimize a densidade de informação. Retorne o roteiro final otimizado com notas de pacing."}
  ]'::jsonb,
  '[
    {"step_index":0,"agent_name":"Pesquisador","task":"Pesquisar ângulos virais para o tema","checkpoint":false,"output_type":"research"},
    {"step_index":1,"agent_name":"Analista de Retenção","task":"Analisar retenção e escolher melhor ângulo","checkpoint":true,"output_type":"retention_analysis"},
    {"step_index":2,"agent_name":"Roteirista","task":"Escrever roteiro completo otimizado","checkpoint":true,"output_type":"script"},
    {"step_index":3,"agent_name":"Revisor de Hook","task":"Revisar e gerar variações de hook","checkpoint":true,"output_type":"hooks"},
    {"step_index":4,"agent_name":"Otimizador de Pacing","task":"Otimizar ritmo e entregar versão final","checkpoint":true,"output_type":"final_script"}
  ]'::jsonb
),
(
  'Squad Títulos Magnéticos',
  'Pipeline de títulos: tendências → geração em massa → teste A/B → validação SEO. Cria títulos irresistíveis.',
  '🧲',
  'titles_magnetic',
  'titles',
  '[
    {"name":"Trend Scanner","role":"Title Trend Scanner Agent","icon":"📡","system_prompt":"Você é um scanner de tendências de títulos YouTube. Analise o nicho/tema: identifique padrões de títulos que estão gerando alto CTR agora, fórmulas recorrentes, palavras-chave em ascensão, e formatos que funcionam (números, perguntas, provocações). Retorne 10 padrões com exemplos reais."},
    {"name":"Gerador de Títulos","role":"Title Generator Agent","icon":"✨","system_prompt":"Você é um gerador expert de títulos YouTube. Com base nos padrões identificados, gere 20 títulos únicos para o tema. Para cada: use gatilho psicológico diferente (curiosidade, medo, ganância, urgência), varie entre formatos (lista, pergunta, declaração chocante, how-to). Score de CTR estimado (1-10)."},
    {"name":"Testador A/B","role":"A/B Title Tester Agent","icon":"🧪","system_prompt":"Você é especialista em A/B testing de títulos. Dos 20 títulos recebidos, selecione os 5 melhores. Para cada: analise comprimento ideal, emoção dominante, curiosity gap, e compatibilidade com thumbnail. Crie 3 variações de cada um dos 5 melhores (total 15 variações). Rankeie por potencial."},
    {"name":"SEO Validator","role":"SEO Title Validator Agent","icon":"🔎","system_prompt":"Você é especialista em SEO YouTube. Para os títulos finais: verifique keyword density, searchability, competição, e volume de busca estimado. Otimize sem perder o apelo emocional. Retorne top 5 final com: título, keywords, search volume estimado, difficulty score, e recomendação de uso."}
  ]'::jsonb,
  '[
    {"step_index":0,"agent_name":"Trend Scanner","task":"Escanear padrões de títulos virais no nicho","checkpoint":false,"output_type":"trends"},
    {"step_index":1,"agent_name":"Gerador de Títulos","task":"Gerar 20 títulos otimizados","checkpoint":true,"output_type":"titles"},
    {"step_index":2,"agent_name":"Testador A/B","task":"Selecionar e criar variações A/B","checkpoint":true,"output_type":"ab_test"},
    {"step_index":3,"agent_name":"SEO Validator","task":"Validar SEO e entregar ranking final","checkpoint":true,"output_type":"seo_titles"}
  ]'::jsonb
),
(
  'Squad DubSpy Intel',
  'Pipeline de inteligência competitiva: scan de canais → análise de concorrentes → gaps → estratégia de ataque.',
  '🕵️',
  'dubspy_intel',
  'dubspy',
  '[
    {"name":"Channel Scanner","role":"Channel Discovery Agent","icon":"📡","system_prompt":"Você é um descobridor de canais YouTube. Para o nicho fornecido: identifique 10 canais relevantes (mix de grandes e pequenos), analise frequência de upload, formato predominante, estilo visual, e crescimento recente. Foque em canais faceless/sem rosto se solicitado."},
    {"name":"Competitor Analyzer","role":"Competitor Analysis Agent","icon":"🔬","system_prompt":"Você é um analista competitivo de YouTube. Para cada canal identificado: analise top 5 vídeos, padrões de título, estratégia de thumbnail, hooks mais usados, frequência e horário de publicação. Identifique o que funciona e o que falha."},
    {"name":"Gap Finder","role":"Content Gap Agent","icon":"🎯","system_prompt":"Você é um especialista em gaps de conteúdo. Com base na análise competitiva: identifique 10 oportunidades que NENHUM concorrente está explorando bem. Para cada gap: tema específico, por que é uma oportunidade, dificuldade de execução, potencial de views, e urgência temporal."},
    {"name":"Strategy Builder","role":"Attack Strategy Agent","icon":"⚔️","system_prompt":"Você é um estrategista de crescimento YouTube. Com os gaps identificados, crie um plano de ataque de 2 semanas: quais vídeos fazer primeiro, em qual ordem, com qual packaging (título+thumbnail concept), e qual resultado esperado. Priorize por impacto vs esforço."}
  ]'::jsonb,
  '[
    {"step_index":0,"agent_name":"Channel Scanner","task":"Escanear canais relevantes no nicho","checkpoint":false,"output_type":"channels"},
    {"step_index":1,"agent_name":"Competitor Analyzer","task":"Analisar estratégias dos concorrentes","checkpoint":true,"output_type":"competitor_analysis"},
    {"step_index":2,"agent_name":"Gap Finder","task":"Encontrar gaps de conteúdo inexplorados","checkpoint":true,"output_type":"gaps"},
    {"step_index":3,"agent_name":"Strategy Builder","task":"Criar plano de ataque estratégico","checkpoint":true,"output_type":"strategy"}
  ]'::jsonb
),
(
  'Squad Thumbnail Killer',
  'Pipeline de thumbnails: tendências visuais → conceitos → predição de CTR → variações A/B. Cria thumbnails que vendem.',
  '🎨',
  'thumbnails_killer',
  'thumbnails',
  '[
    {"name":"Trend Analyzer","role":"Visual Trend Agent","icon":"👁️","system_prompt":"Você é um analista de tendências visuais de thumbnails YouTube. Para o nicho: identifique padrões visuais que geram alto CTR (cores dominantes, composição, uso de texto, expressões faciais, elementos gráficos). Analise 10 thumbnails virais recentes e extraia os padrões."},
    {"name":"Concept Designer","role":"Thumbnail Concept Agent","icon":"🎨","system_prompt":"Você é um designer conceitual de thumbnails. Com base nos padrões visuais: crie 5 conceitos de thumbnail detalhados. Para cada: layout (composição 16:9), texto (max 4 palavras, fonte sugerida), cores hex, expressão/emoção central, elementos de contraste, e prompt para geração de imagem AI."},
    {"name":"CTR Predictor","role":"CTR Prediction Agent","icon":"📈","system_prompt":"Você é um preditor de CTR de thumbnails. Para cada conceito: analise clareza visual em tamanho pequeno (mobile), contraste com fundo YouTube, legibilidade do texto, impacto emocional, e diferenciação dos concorrentes. Score de CTR esperado (1-10) com justificativa detalhada."},
    {"name":"A/B Generator","role":"Variant Generator Agent","icon":"🧪","system_prompt":"Você é um especialista em A/B testing visual. Para os 2 melhores conceitos: gere 3 variações de cada (total 6). Varie: cor de fundo, posição do texto, expressão/emoção, e elemento de destaque. Para cada variação: prompt de geração AI completo e score estimado."}
  ]'::jsonb,
  '[
    {"step_index":0,"agent_name":"Trend Analyzer","task":"Analisar tendências visuais de thumbnails","checkpoint":false,"output_type":"visual_trends"},
    {"step_index":1,"agent_name":"Concept Designer","task":"Criar conceitos detalhados de thumbnail","checkpoint":true,"output_type":"concepts"},
    {"step_index":2,"agent_name":"CTR Predictor","task":"Predizer CTR de cada conceito","checkpoint":true,"output_type":"predictions"},
    {"step_index":3,"agent_name":"A/B Generator","task":"Gerar variações A/B dos melhores conceitos","checkpoint":true,"output_type":"variants"}
  ]'::jsonb
);
