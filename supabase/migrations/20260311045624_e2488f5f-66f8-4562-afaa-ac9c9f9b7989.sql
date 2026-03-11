-- Create saved_searches table for DubSpy persistence
CREATE TABLE public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  tab TEXT NOT NULL DEFAULT 'videos',
  filters_json JSONB DEFAULT '{}'::jsonb,
  results_json JSONB DEFAULT '[]'::jsonb,
  channel_info_json JSONB DEFAULT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own searches"
  ON public.saved_searches FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);