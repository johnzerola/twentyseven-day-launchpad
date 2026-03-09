
CREATE TABLE public.video_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  script text DEFAULT '',
  status text DEFAULT 'draft',
  niche text,
  duration_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.video_projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.video_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.video_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.video_projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.video_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.video_projects(id) ON DELETE CASCADE NOT NULL,
  segment_index integer NOT NULL,
  text_content text DEFAULT '',
  visual_prompt text DEFAULT '',
  reference_image_url text,
  status text DEFAULT 'pending',
  audio_url text,
  video_clip_url text,
  duration_ms integer DEFAULT 8000,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.video_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own segments" ON public.video_segments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.video_projects WHERE id = video_segments.project_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own segments" ON public.video_segments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.video_projects WHERE id = video_segments.project_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update own segments" ON public.video_segments FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.video_projects WHERE id = video_segments.project_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own segments" ON public.video_segments FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.video_projects WHERE id = video_segments.project_id AND user_id = auth.uid())
);
