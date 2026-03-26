
-- Enable RLS on knowledge tables (public read, service role write)
ALTER TABLE public.youtube_algorithm_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read youtube_algorithm_knowledge" ON public.youtube_algorithm_knowledge FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.viral_mechanics_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read viral_mechanics_library" ON public.viral_mechanics_library FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.monetization_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read monetization_knowledge_base" ON public.monetization_knowledge_base FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.thumbnail_prompt_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read thumbnail_prompt_library" ON public.thumbnail_prompt_library FOR SELECT TO anon, authenticated USING (true);
