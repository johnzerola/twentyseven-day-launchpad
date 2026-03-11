-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('starter', 'pro', 'full');

-- Create user subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'starter',
  active_devices integer NOT NULL DEFAULT 0,
  max_devices integer NOT NULL DEFAULT 1,
  credits_remaining integer NOT NULL DEFAULT 100,
  credits_monthly_limit integer NOT NULL DEFAULT 100,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read own subscription
CREATE POLICY "Users can read own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update own subscription (for credits consumption)
CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check tier
CREATE OR REPLACE FUNCTION public.get_user_tier(_user_id uuid)
RETURNS subscription_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier FROM public.user_subscriptions WHERE user_id = _user_id),
    'starter'::subscription_tier
  )
$$;

-- Security definer function to consume credits
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
  SELECT credits_remaining INTO current_credits
  FROM public.user_subscriptions
  WHERE user_id = _user_id;
  
  IF current_credits IS NULL OR current_credits < _amount THEN
    RETURN false;
  END IF;
  
  UPDATE public.user_subscriptions
  SET credits_remaining = credits_remaining - _amount,
      updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN true;
END;
$$;

-- Auto-create starter subscription on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_subscriptions (user_id, tier, credits_remaining, credits_monthly_limit, max_devices)
  VALUES (NEW.id, 'starter', 100, 100, 1);
  
  RETURN NEW;
END;
$function$;

-- Insert starter subscriptions for existing users who don't have one
INSERT INTO public.user_subscriptions (user_id, tier, credits_remaining, credits_monthly_limit, max_devices)
SELECT p.user_id, 'starter', 100, 100, 1
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions s WHERE s.user_id = p.user_id
);