
-- Content queue for multichannel management
CREATE TABLE public.content_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id uuid REFERENCES public.user_channels(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'idea', -- idea, scripting, producing, scheduled, published
  priority text DEFAULT 'medium', -- low, medium, high, urgent
  niche text,
  language text DEFAULT 'pt',
  country text DEFAULT 'BR',
  script_id uuid,
  project_id uuid REFERENCES public.video_projects(id) ON DELETE SET NULL,
  template_id uuid,
  scheduled_date date,
  published_url text,
  notes text DEFAULT '',
  tags jsonb DEFAULT '[]',
  metadata_json jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_content_queue_user ON public.content_queue(user_id);
CREATE INDEX idx_content_queue_channel ON public.content_queue(channel_id);
CREATE INDEX idx_content_queue_status ON public.content_queue(status);
CREATE INDEX idx_content_queue_scheduled ON public.content_queue(scheduled_date);

ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own content queue"
  ON public.content_queue FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Channel groups for batch operations
CREATE TABLE public.channel_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#6366f1',
  channels jsonb DEFAULT '[]', -- array of channel_ids
  default_language text DEFAULT 'pt',
  default_country text DEFAULT 'BR',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_channel_groups_user ON public.channel_groups(user_id);

ALTER TABLE public.channel_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own channel groups"
  ON public.channel_groups FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Content templates for reuse across channels
CREATE TABLE public.content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'script', -- script, thumbnail, cta, title, description
  niche text,
  language text DEFAULT 'pt',
  template_json jsonb NOT NULL DEFAULT '{}',
  use_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_content_templates_user ON public.content_templates(user_id);
CREATE INDEX idx_content_templates_category ON public.content_templates(category);

ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own templates"
  ON public.content_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
