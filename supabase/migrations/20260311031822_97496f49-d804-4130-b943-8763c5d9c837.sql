
-- Table: saved_niche_analyses
CREATE TABLE public.saved_niche_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  niche text NOT NULL,
  country text DEFAULT 'BR',
  analysis_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.saved_niche_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own niche analyses" ON public.saved_niche_analyses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Table: saved_titles
CREATE TABLE public.saved_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text,
  niche text,
  titles_json jsonb DEFAULT '[]'::jsonb,
  ab_test_json jsonb,
  seo_json jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.saved_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saved titles" ON public.saved_titles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Table: monetization_plans
CREATE TABLE public.monetization_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_json jsonb DEFAULT '{}'::jsonb,
  chat_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.monetization_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own monetization plans" ON public.monetization_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
