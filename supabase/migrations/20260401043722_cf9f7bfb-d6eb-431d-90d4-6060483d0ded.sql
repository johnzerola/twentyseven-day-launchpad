
CREATE TABLE IF NOT EXISTS public.global_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'Personagem Principal',
  gender text DEFAULT 'male',
  age integer DEFAULT 30,
  photo_url text,
  visual_description text,
  appearance jsonb DEFAULT '{"skin_color":"light tan","hair_color":"dark brown","hair_style":"short","eye_color":"brown","body_type":"average","height":"1.75m"}'::jsonb,
  facial_features jsonb DEFAULT '{"eyebrows":"medium arched","nose":"straight medium","mouth":"medium lips","ears":"normal size","face_shape":"oval"}'::jsonb,
  clothing jsonb DEFAULT '{"shirt":"casual t-shirt","pants":"dark jeans","shoes":"sneakers","accessories":"none"}'::jsonb,
  personality text[] DEFAULT ARRAY['determined','curious'],
  is_main_character boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.global_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own characters"
  ON public.global_characters FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
