
CREATE OR REPLACE FUNCTION public.enforce_credits(_user_id uuid, _operation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tier subscription_tier;
  _credits_remaining INTEGER;
  _cost INTEGER;
BEGIN
  -- Prevent cross-user credit drain: caller must be the target user
  -- auth.uid() is NULL for service-role callers, which we allow
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'unauthorized: caller does not own this account';
  END IF;

  SELECT tier, credits_remaining INTO _tier, _credits_remaining
  FROM public.user_subscriptions WHERE user_id = _user_id;

  IF _tier IS NULL THEN
    _tier := 'starter';
    _credits_remaining := 0;
  END IF;

  CASE _operation
    WHEN 'generate-script' THEN _cost := 5;
    WHEN 'refine-script' THEN _cost := 3;
    WHEN 'generate-synced-prompts' THEN _cost := 4;
    WHEN 'generate-veo3-prompts' THEN _cost := 8;
    WHEN 'viral-creation-engine' THEN _cost := 6;
    WHEN 'generate-ideas' THEN _cost := 1;
    WHEN 'generate-titles' THEN _cost := 1;
    WHEN 'generate-scenes-short' THEN _cost := 3;
    WHEN 'generate-script-short' THEN _cost := 3;
    ELSE _cost := 1;
  END CASE;

  IF _credits_remaining < _cost THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', _credits_remaining,
      'cost', _cost,
      'tier', _tier::text
    );
  END IF;

  UPDATE public.user_subscriptions
  SET credits_remaining = credits_remaining - _cost, updated_at = now()
  WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', _credits_remaining - _cost,
    'cost', _cost,
    'tier', _tier::text
  );
END;
$function$;
