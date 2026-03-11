
-- Characters table for visual consistency
CREATE TABLE public.characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.video_projects(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    visual_prompt TEXT NOT NULL DEFAULT '',
    visual_attributes JSONB DEFAULT '{}',
    global_prompt_append TEXT DEFAULT '',
    reference_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enhanced scenes table (separate from video_segments for the new pipeline)
CREATE TABLE public.scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.video_projects(id) ON DELETE CASCADE NOT NULL,
    sequence_order INT NOT NULL,
    duration_sec INT DEFAULT 8,
    tts_text TEXT DEFAULT '',
    audio_url TEXT,
    media_url TEXT,
    character_ref TEXT,
    camera_movement TEXT,
    lighting TEXT,
    emotional_intent TEXT,
    style_tags JSONB DEFAULT '[]',
    veo3_prompt TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Prompts queue for AI generation
CREATE TABLE public.prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE NOT NULL,
    ai_model VARCHAR(50) DEFAULT 'veo3',
    raw_prompt TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- API usage logs for cost tracking
CREATE TABLE public.api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    service VARCHAR(50) NOT NULL,
    endpoint TEXT,
    cost NUMERIC(10,4) DEFAULT 0,
    tokens_used INT DEFAULT 0,
    response_code INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Outlier channels found by the finder
CREATE TABLE public.outlier_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    video_title TEXT NOT NULL,
    video_url TEXT,
    channel_name TEXT,
    channel_id TEXT,
    subscribers INT DEFAULT 0,
    views INT DEFAULT 0,
    multiplier NUMERIC(8,2) DEFAULT 0,
    niche TEXT,
    thumbnail_url TEXT,
    published_at TIMESTAMPTZ,
    found_at TIMESTAMPTZ DEFAULT now()
);

-- Playbook progress tracking
CREATE TABLE public.playbook_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    day_number INT NOT NULL,
    completed BOOLEAN DEFAULT false,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, day_number)
);

-- RLS policies
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlier_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_progress ENABLE ROW LEVEL SECURITY;

-- Characters: access via project ownership
CREATE POLICY "Users can manage own characters" ON public.characters FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.video_projects WHERE video_projects.id = characters.project_id AND video_projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.video_projects WHERE video_projects.id = characters.project_id AND video_projects.user_id = auth.uid()));

-- Scenes: access via project ownership
CREATE POLICY "Users can manage own scenes" ON public.scenes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.video_projects WHERE video_projects.id = scenes.project_id AND video_projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.video_projects WHERE video_projects.id = scenes.project_id AND video_projects.user_id = auth.uid()));

-- Prompts: access via scene -> project ownership
CREATE POLICY "Users can manage own prompts" ON public.prompts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.scenes JOIN public.video_projects ON video_projects.id = scenes.project_id WHERE scenes.id = prompts.scene_id AND video_projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.scenes JOIN public.video_projects ON video_projects.id = scenes.project_id WHERE scenes.id = prompts.scene_id AND video_projects.user_id = auth.uid()));

-- API logs: own only
CREATE POLICY "Users can manage own api_logs" ON public.api_logs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Outlier channels: own only
CREATE POLICY "Users can manage own outliers" ON public.outlier_channels FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Playbook progress: own only
CREATE POLICY "Users can manage own playbook" ON public.playbook_progress FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
