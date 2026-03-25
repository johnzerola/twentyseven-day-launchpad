ALTER TABLE public.script_knowledge ADD CONSTRAINT script_knowledge_title_key UNIQUE (title);
ALTER TABLE public.content_models ADD CONSTRAINT content_models_model_name_key UNIQUE (model_name);
ALTER TABLE public.attention_engineering ADD CONSTRAINT attention_engineering_pattern_name_key UNIQUE (pattern_name);