
-- Tabela de nichos
CREATE TABLE public.niche_database (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rpm_estimate numeric DEFAULT 0,
  faceless_friendly boolean DEFAULT false,
  saturation text DEFAULT 'média',
  difficulty text DEFAULT 'médio',
  sub_niches jsonb DEFAULT '[]',
  country text DEFAULT 'BR',
  language text DEFAULT 'pt',
  created_at timestamptz DEFAULT now()
);

-- Planner cards
CREATE TABLE public.planner_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  column_id text NOT NULL DEFAULT 'ideas',
  title text NOT NULL,
  priority text DEFAULT 'média',
  due_date text,
  tags jsonb DEFAULT '[]',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.niche_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read niches" ON public.niche_database FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own cards" ON public.planner_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
