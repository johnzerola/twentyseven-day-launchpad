
-- Performance indexes for most-queried tables
CREATE INDEX IF NOT EXISTS idx_vtd_niche_views ON public.viral_titles_db(niche, views DESC);
CREATE INDEX IF NOT EXISTS idx_vtd_country_niche ON public.viral_titles_db(country, niche);
CREATE INDEX IF NOT EXISTS idx_vtd_published ON public.viral_titles_db(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_hl_niche_retention ON public.hook_library(niche, retention_score DESC);
CREATE INDEX IF NOT EXISTS idx_hl_type_score ON public.hook_library(hook_type, retention_score DESC);

CREATE INDEX IF NOT EXISTS idx_sk_category_score ON public.script_knowledge(category, effectiveness_score DESC);

CREATE INDEX IF NOT EXISTS idx_ds_user_channel ON public.dotti_suggestions(user_id, channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ke_source_table ON public.knowledge_embeddings(source_table);

CREATE INDEX IF NOT EXISTS idx_spl_user_date ON public.script_performance_link(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dap_user_week ON public.daily_adaptive_plan(user_id, plan_date DESC);
