
-- Daily tasks for 30-day monetization tracker
CREATE TABLE public.daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 30),
  title text NOT NULL,
  description text DEFAULT '',
  task_type text NOT NULL DEFAULT 'content',
  video_type text DEFAULT 'short',
  completed boolean DEFAULT false,
  completed_at timestamptz,
  target_shorts integer DEFAULT 0,
  target_longs integer DEFAULT 0,
  target_views integer DEFAULT 0,
  target_subs integer DEFAULT 0,
  actual_views integer DEFAULT 0,
  actual_subs integer DEFAULT 0,
  notes text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Monetization milestones  
CREATE TABLE public.monetization_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid,
  milestone_type text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  target_value integer NOT NULL DEFAULT 0,
  current_value integer DEFAULT 0,
  reached boolean DEFAULT false,
  reached_at timestamptz,
  day_expected integer,
  icon text DEFAULT '🎯',
  created_at timestamptz DEFAULT now()
);

-- 30-day plans
CREATE TABLE public.monetization_30day_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id uuid,
  niche text,
  language text DEFAULT 'pt',
  country text DEFAULT 'BR',
  strategy text DEFAULT 'shorts-first',
  status text DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  target_subs integer DEFAULT 1000,
  target_watch_hours numeric DEFAULT 4000,
  current_day integer DEFAULT 1,
  total_shorts_published integer DEFAULT 0,
  total_longs_published integer DEFAULT 0,
  total_views integer DEFAULT 0,
  plan_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_30day_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own daily_tasks" ON public.daily_tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own milestones" ON public.monetization_milestones FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own 30day plans" ON public.monetization_30day_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_daily_tasks_user_plan ON public.daily_tasks(user_id, plan_id);
CREATE INDEX idx_daily_tasks_day ON public.daily_tasks(plan_id, day_number);
CREATE INDEX idx_milestones_user ON public.monetization_milestones(user_id, plan_id);
CREATE INDEX idx_30day_plans_user ON public.monetization_30day_plans(user_id, status);
