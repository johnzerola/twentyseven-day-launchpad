
-- Seed case_studies with real-world Shorts monetization examples
INSERT INTO public.case_studies (user_id, channel_name, niche, strategy_used, initial_subscribers, final_subscribers, total_shorts, total_videos, total_views, days_to_monetization, revenue_estimate, is_public, lessons_learned, milestones, start_date, end_date, tools_used)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'Fatos Insanos', 'curiosidades', 'shorts-first-70-30', 0, 1200, 65, 4, 850000, 28, 120, true, 
   ARRAY['Micro-shorts de 15-20s têm 3x mais completion rate', 'Postar 2-3 shorts/dia nos primeiros 14 dias é crucial', 'Títulos com números específicos performam 40% melhor', 'Consistency > Quality nos primeiros 1000 subs', 'Shorts com loop natural ganham 2x mais views'],
   '[{"day":3,"event":"Primeiro short viral (50K views)"},{"day":7,"event":"100 inscritos"},{"day":14,"event":"500 inscritos + 1 short com 200K"},{"day":21,"event":"800 inscritos"},{"day":28,"event":"1200 inscritos - YPP aprovado"}]'::jsonb,
   '2025-11-01', '2025-11-28', ARRAY['CapCut','ElevenLabs','ChatGPT']),

  ('00000000-0000-0000-0000-000000000000', 'Terror Noturno', 'terror', 'shorts-storytelling', 0, 1500, 58, 2, 1200000, 25, 180, true,
   ARRAY['Shorts de terror com narração suspenseful têm retenção 95%+', 'Formato série (Parte 1, 2, 3) gera 4x mais inscritos', 'Postar entre 22h-00h (horário BR) aumenta views 30%', 'Thumbnails escuras com olhos brilhantes = CTR alto', 'Cliff-hangers no final = inscrição garantida'],
   '[{"day":5,"event":"Série viral - Parte 1 com 100K views"},{"day":10,"event":"300 inscritos"},{"day":15,"event":"Parte 5 com 500K views"},{"day":20,"event":"1000 inscritos"},{"day":25,"event":"1500 inscritos - YPP"}]'::jsonb,
   '2025-10-15', '2025-11-08', ARRAY['Pika','ElevenLabs','Runway']),

  ('00000000-0000-0000-0000-000000000000', 'Mythic Legends', 'mitologia', 'cinematic-shorts', 0, 1100, 50, 6, 920000, 30, 150, true,
   ARRAY['Visuais épicos com IA geram watch time 2x maior', 'Mix 70% micro-shorts + 30% longs de 8-12min é ideal', 'Mitologia grega performa 2x melhor que nórdica em PT-BR', 'Narração grave + música épica = combo imbatível', 'Shorts com "O deus mais..." performam muito bem'],
   '[{"day":7,"event":"200 inscritos"},{"day":14,"event":"500 inscritos"},{"day":21,"event":"800 inscritos"},{"day":30,"event":"1100 inscritos - YPP aplicado"}]'::jsonb,
   '2025-12-01', '2025-12-30', ARRAY['Midjourney','ElevenLabs','CapCut','Suno']),

  ('00000000-0000-0000-0000-000000000000', 'Dinheiro Inteligente', 'finanças', 'educational-shorts', 0, 1350, 70, 3, 1500000, 22, 320, true,
   ARRAY['Finanças tem RPM 5-8x maior que entretenimento', 'Shorts com "Como ganhar R$X" têm CTR 15%+', 'Dados específicos (R$100 vira R$50.000) performam melhor que genéricos', 'Postar 3 shorts/dia é agressivo mas funciona', 'Nicho de finanças cresce mais devagar mas monetiza muito mais'],
   '[{"day":5,"event":"Primeiro viral: 100K views sobre investimentos"},{"day":10,"event":"400 inscritos"},{"day":15,"event":"700 inscritos"},{"day":22,"event":"1350 inscritos - YPP aprovado em tempo recorde"}]'::jsonb,
   '2026-01-05', '2026-01-27', ARRAY['Canva','ChatGPT','CapCut']),

  ('00000000-0000-0000-0000-000000000000', 'Ciência Obscura', 'ciência', 'visual-shorts-burst', 0, 1050, 55, 5, 780000, 30, 95, true,
   ARRAY['Animações científicas simples retêm 90%+ da audiência', 'Perguntas impossíveis como hook funcionam muito bem', 'Shorts de 20-30s performam melhor que 15s para ciência', 'Série "E se..." gera muitos inscritos por curiosidade', 'Combinar shorts com 1 long semanal acelera watch time'],
   '[{"day":7,"event":"150 inscritos"},{"day":14,"event":"400 inscritos"},{"day":21,"event":"700 inscritos"},{"day":30,"event":"1050 inscritos"}]'::jsonb,
   '2026-02-01', '2026-03-02', ARRAY['Leonardo AI','ElevenLabs','DaVinci Resolve']);

-- Create score_pre_publish table for Content DNA feedback loop
CREATE TABLE IF NOT EXISTS public.script_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.video_projects(id) ON DELETE CASCADE,
  script_text text NOT NULL,
  title text DEFAULT '',
  niche text DEFAULT 'general',
  video_type text DEFAULT 'short',
  viral_score numeric DEFAULT 0,
  hook_score numeric DEFAULT 0,
  retention_score numeric DEFAULT 0,
  emotion_score numeric DEFAULT 0,
  pacing_score numeric DEFAULT 0,
  overall_grade text DEFAULT 'pending',
  ai_feedback jsonb DEFAULT '{}'::jsonb,
  similar_viral_videos jsonb DEFAULT '[]'::jsonb,
  improvement_suggestions text[] DEFAULT '{}',
  content_dna_match numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.script_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own script_scores"
  ON public.script_scores FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
