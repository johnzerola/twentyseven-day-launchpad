
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _amount integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_credits integer;
BEGIN
  -- Prevent cross-user credit drain: caller must be the target user
  IF auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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
$function$;
