CREATE OR REPLACE FUNCTION public.check_tubebot_limit(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tier subscription_tier;
  _daily_limit integer;
  _used_today integer;
BEGIN
  SELECT COALESCE(
    (SELECT tier FROM public.user_subscriptions WHERE user_id = _user_id),
    'starter'::subscription_tier
  ) INTO _tier;

  CASE _tier
    WHEN 'starter' THEN _daily_limit := 20;
    WHEN 'pro' THEN _daily_limit := 9999;
    WHEN 'studio' THEN _daily_limit := 9999;
    ELSE _daily_limit := 20;
  END CASE;

  SELECT COUNT(*) INTO _used_today
  FROM public.api_logs
  WHERE user_id = _user_id
    AND service = 'tubebot'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');

  IF _used_today >= _daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', _used_today,
      'limit', _daily_limit,
      'tier', _tier::text
    );
  END IF;

  INSERT INTO public.api_logs (user_id, service, endpoint, response_code, cost, tokens_used)
  VALUES (_user_id, 'tubebot', '/chat-assistant', 200, 0, 0);

  RETURN jsonb_build_object(
    'allowed', true,
    'used', _used_today + 1,
    'limit', _daily_limit,
    'tier', _tier::text
  );
END;
$function$;