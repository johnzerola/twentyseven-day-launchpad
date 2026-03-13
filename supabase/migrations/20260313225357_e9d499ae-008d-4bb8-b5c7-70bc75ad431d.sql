
CREATE TABLE public.channel_styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID REFERENCES public.user_channels(id) ON DELETE CASCADE,
  style_name TEXT NOT NULL,
  style_description TEXT DEFAULT '',
  visual_notes TEXT DEFAULT '',
  reference_images JSONB DEFAULT '[]'::jsonb,
  color_palette JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own channel styles"
ON public.channel_styles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
