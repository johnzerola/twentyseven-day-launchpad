
-- ========================================================
-- VALIDATION MODE: 3 users, 20 channels, 27 days
-- Budget: Brave $5, Claude $5, YouTube free, Perplexity $3
-- ========================================================

-- 1. Update API daily limits for budget stretching
UPDATE public.api_config SET daily_limit = 45, notes = 'Brave Search - $5 budget / 27 dias = ~45/dia (cache priorizado)' WHERE api_name = 'brave';
UPDATE public.api_config SET daily_limit = 8, notes = 'Claude - $5 budget / 27 dias = ~8/dia (apenas score-script e análise avançada)' WHERE api_name = 'claude';
UPDATE public.api_config SET daily_limit = 80, notes = 'YouTube Data API v3 - gratuito, 80 searches/dia (10K units budget)' WHERE api_name = 'youtube';
UPDATE public.api_config SET daily_limit = 80, notes = 'Gemini via Lovable Gateway - gratuito, 80/dia para pacing' WHERE api_name = 'gemini';
UPDATE public.api_config SET daily_limit = 60, notes = 'GPT-5 via Lovable AI Gateway - gratuito, 60/dia' WHERE api_name = 'openai';
UPDATE public.api_config SET daily_limit = 3, notes = 'Perplexity - $3 budget / 27 dias = ~3/dia (deep research only)' WHERE api_name = 'perplexity';
UPDATE public.api_config SET daily_limit = 5, notes = 'ElevenLabs TTS - minimizar uso, 5/dia max validação' WHERE api_name = 'elevenlabs';
UPDATE public.api_config SET daily_limit = 0, notes = 'ChatGPT direto desabilitado - usar via Lovable Gateway' WHERE api_name = 'chatgpt';

-- 2. Update existing user credits for validation period
UPDATE public.user_subscriptions 
SET credits_remaining = 600, 
    credits_monthly_limit = 600,
    tier = 'pro',
    max_devices = 3,
    updated_at = now()
WHERE user_id = 'a1b8f84b-2f02-4bf3-8111-1e2243a439fd';

-- 3. Create validation_config table for easy tuning
CREATE TABLE IF NOT EXISTS public.validation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.validation_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read validation_config" ON public.validation_config FOR SELECT TO authenticated USING (true);

-- 4. Insert validation parameters
INSERT INTO public.validation_config (config_key, config_value, description) VALUES
('validation_mode', '{"enabled": true, "start_date": "2026-03-12", "end_date": "2026-04-08", "users": 3, "channels": 20, "videos_per_week_per_channel": 2}', 'Modo validação: 27 dias, 3 users, 20 canais, 2 vídeos/semana'),
('credit_costs', '{"video_orchestrator": 8, "reverse_engineering": 5, "bulk_scan": 3, "generate_titles": 1, "generate_branding": 2, "niche_analysis": 2, "channel_scan": 1, "deep_scan": 3}', 'Custo em créditos por operação'),
('cache_ttl_hours', '{"brave_search": 48, "youtube_search": 24, "channel_analysis": 168, "niche_analysis": 168, "reverse_engineering": 720, "deep_research": 336}', 'TTL agressivo de cache por tipo de operação'),
('budget_alerts', '{"brave_daily_cost_limit": 0.18, "claude_daily_cost_limit": 0.18, "perplexity_daily_cost_limit": 0.11, "alert_at_percent": 80}', 'Alertas de budget: $5/27d Brave, $5/27d Claude, $3/27d Perplexity')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = now();
