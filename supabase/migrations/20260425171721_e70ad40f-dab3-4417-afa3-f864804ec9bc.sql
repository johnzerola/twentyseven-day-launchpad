CREATE OR REPLACE FUNCTION public.increment_video_check_count(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.video_performance
     SET check_count = COALESCE(check_count, 0) + 1
   WHERE id = _id;
$$;