-- Update existing 'full' subscriptions to 'studio'
UPDATE public.user_subscriptions SET tier = 'studio' WHERE tier = 'full';

-- Recreate handle_new_user to use 'studio'
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
  VALUES (NEW.id, 'studio', 1000, 1000, 3);
  
  RETURN NEW;
END;
$function$;