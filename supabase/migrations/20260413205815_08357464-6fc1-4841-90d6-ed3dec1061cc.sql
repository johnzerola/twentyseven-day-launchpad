
-- Function to check and increment TubeBot daily usage
CREATE OR REPLACE FUNCTION public.check_tubebot_limit(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tier subscription_tier;
  _daily_limit integer;
  _used_today integer;
BEGIN
  -- Get user tier
  SELECT COALESCE(
    (SELECT tier FROM public.user_subscriptions WHERE user_id = _user_id),
    'starter'::subscription_tier
  ) INTO _tier;

  -- Set limits per tier
  CASE _tier
    WHEN 'starter' THEN _daily_limit := 10;
    WHEN 'pro' THEN _daily_limit := 30;
    WHEN 'studio' THEN _daily_limit := 100;
    ELSE _daily_limit := 10;
  END CASE;

  -- Count today's messages
  SELECT COUNT(*) INTO _used_today
  FROM public.api_logs
  WHERE user_id = _user_id
    AND service = 'tubebot'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');

  -- Check limit
  IF _used_today >= _daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', _used_today,
      'limit', _daily_limit,
      'tier', _tier::text
    );
  END IF;

  -- Log usage
  INSERT INTO public.api_logs (user_id, service, endpoint, response_code, cost, tokens_used)
  VALUES (_user_id, 'tubebot', '/chat-assistant', 200, 0, 0);

  RETURN jsonb_build_object(
    'allowed', true,
    'used', _used_today + 1,
    'limit', _daily_limit,
    'tier', _tier::text
  );
END;
$$;
