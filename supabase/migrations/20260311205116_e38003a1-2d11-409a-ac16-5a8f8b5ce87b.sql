
-- Indexes on user_id for all user-owned tables
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON public.api_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_generated_branding_user_id ON public.generated_branding (user_id);
CREATE INDEX IF NOT EXISTS idx_monetization_plans_user_id ON public.monetization_plans (user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_plans_user_id ON public.onboarding_plans (user_id);
CREATE INDEX IF NOT EXISTS idx_outlier_channels_user_id ON public.outlier_channels (user_id);
CREATE INDEX IF NOT EXISTS idx_planner_cards_user_id ON public.planner_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_playbook_progress_user_id ON public.playbook_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_niche_analyses_user_id ON public.saved_niche_analyses (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_scripts_user_id ON public.saved_scripts (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_titles_user_id ON public.saved_titles (user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_channels_user_id ON public.tracked_channels (user_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_user_id ON public.user_channels (user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_user_id ON public.video_projects (user_id);

-- Indexes on project_id / scene_id for nested tables
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON public.scenes (project_id);
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON public.characters (project_id);
CREATE INDEX IF NOT EXISTS idx_prompts_scene_id ON public.prompts (scene_id);

-- Indexes on niche for intelligence/knowledge tables
CREATE INDEX IF NOT EXISTS idx_channel_intelligence_niche ON public.channel_intelligence (niche);
CREATE INDEX IF NOT EXISTS idx_viral_titles_db_niche ON public.viral_titles_db (niche);
CREATE INDEX IF NOT EXISTS idx_niche_database_name ON public.niche_database (name);
CREATE INDEX IF NOT EXISTS idx_outlier_channels_niche ON public.outlier_channels (niche);

-- Indexes on category for knowledge tables
CREATE INDEX IF NOT EXISTS idx_scene_prompt_knowledge_category ON public.scene_prompt_knowledge (category);
CREATE INDEX IF NOT EXISTS idx_script_knowledge_category ON public.script_knowledge (category);
CREATE INDEX IF NOT EXISTS idx_youtube_knowledge_category ON public.youtube_knowledge (category);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_scenes_project_order ON public.scenes (project_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_video_projects_user_status ON public.video_projects (user_id, status);
CREATE INDEX IF NOT EXISTS idx_planner_cards_user_column ON public.planner_cards (user_id, column_id);
