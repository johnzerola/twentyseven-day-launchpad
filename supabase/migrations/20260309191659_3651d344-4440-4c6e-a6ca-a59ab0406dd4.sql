
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User channels table
CREATE TABLE public.user_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  youtube_channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  thumbnail TEXT,
  subscribers BIGINT DEFAULT 0,
  views BIGINT DEFAULT 0,
  videos INTEGER DEFAULT 0,
  niche TEXT,
  analysis_json JSONB,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own channels" ON public.user_channels FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own channels" ON public.user_channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own channels" ON public.user_channels FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own channels" ON public.user_channels FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Onboarding plans table
CREATE TABLE public.onboarding_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.user_channels(id) ON DELETE SET NULL,
  niche TEXT,
  goal TEXT,
  content_type TEXT,
  language TEXT,
  time_per_day TEXT,
  plan_json JSONB NOT NULL DEFAULT '{}',
  channel_analysis_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plans" ON public.onboarding_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plans" ON public.onboarding_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.onboarding_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Saved scripts table
CREATE TABLE public.saved_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  duration INTEGER DEFAULT 10,
  style TEXT,
  script_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scripts" ON public.saved_scripts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scripts" ON public.saved_scripts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own scripts" ON public.saved_scripts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create profile automatically on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
