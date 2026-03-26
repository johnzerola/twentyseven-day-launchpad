
-- Track Veo3 prompt performance for feedback loop
CREATE TABLE IF NOT EXISTS public.prompt_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    project_id uuid REFERENCES public.video_projects(id) ON DELETE CASCADE,
    scene_index integer NOT NULL,
    prompt_text text NOT NULL,
    visual_style text,
    camera_angle text,
    lighting text,
    color_grading text,
    quality_rating integer CHECK (quality_rating BETWEEN 1 AND 10),
    coherence_rating integer CHECK (coherence_rating BETWEEN 1 AND 10),
    user_feedback text,
    tags text[] DEFAULT '{}',
    niche text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.prompt_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prompt_performance"
    ON public.prompt_performance
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_prompt_perf_user_niche ON public.prompt_performance(user_id, niche);
CREATE INDEX idx_prompt_perf_quality ON public.prompt_performance(quality_rating DESC) WHERE quality_rating >= 7;
