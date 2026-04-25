-- Atomic slot reservation: garante que nenhum outro projeto do mesmo canal
-- ocupe o mesmo slot (janela de tolerância) quando o usuário confirma o lançamento.

CREATE OR REPLACE FUNCTION public.claim_publish_slot(
  _user_id uuid,
  _project_id uuid,
  _channel_id uuid,
  _scheduled_at timestamptz,
  _topic text DEFAULT NULL,
  _slot_window_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _window interval := (_slot_window_minutes || ' minutes')::interval;
  _conflict record;
  _channel_owner uuid;
  _project_owner uuid;
BEGIN
  -- Authorization: caller (when not service-role) must be the same user
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _project_id IS NULL OR _channel_id IS NULL OR _scheduled_at IS NULL THEN
    RAISE EXCEPTION 'project_id, channel_id and scheduled_at are required';
  END IF;

  -- Ownership checks
  SELECT user_id INTO _project_owner FROM public.video_projects WHERE id = _project_id;
  IF _project_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'project_not_found');
  END IF;
  IF _project_owner IS DISTINCT FROM _user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'project_not_owned_by_user');
  END IF;

  SELECT user_id INTO _channel_owner FROM public.user_channels WHERE id = _channel_id;
  IF _channel_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'channel_not_found');
  END IF;
  IF _channel_owner IS DISTINCT FROM _user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'channel_not_owned_by_user');
  END IF;

  -- Lock the channel row briefly so two concurrent confirmations serialize
  PERFORM 1 FROM public.user_channels WHERE id = _channel_id FOR UPDATE;

  -- Conflict #1: another active/scheduled project in the same slot window
  SELECT id, title, topic, status, scheduled_at
    INTO _conflict
    FROM public.video_projects
   WHERE channel_id_ref = _channel_id
     AND id <> _project_id
     AND status IN (
       'ready_for_production','claimed','processing','waiting_videos',
       'assembling','rendered','uploading'
     )
     AND scheduled_at IS NOT NULL
     AND scheduled_at BETWEEN (_scheduled_at - _window) AND (_scheduled_at + _window)
   ORDER BY scheduled_at ASC
   LIMIT 1;

  IF _conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'slot_conflict_project',
      'conflicting_project_id', _conflict.id,
      'conflicting_status', _conflict.status,
      'conflicting_scheduled_at', _conflict.scheduled_at,
      'conflicting_title', COALESCE(_conflict.title, _conflict.topic),
      'window_minutes', _slot_window_minutes
    );
  END IF;

  -- Conflict #2: a scheduled entry in channel_schedule for the same slot
  SELECT cs.id, cs.project_id, cs.scheduled_at, cs.status, cs.title, cs.topic
    INTO _conflict
    FROM public.channel_schedule cs
   WHERE cs.channel_id = _channel_id
     AND COALESCE(cs.project_id, '00000000-0000-0000-0000-000000000000'::uuid) <> _project_id
     AND cs.status IN ('scheduled','running','rendering','uploading')
     AND cs.scheduled_at BETWEEN (_scheduled_at - _window) AND (_scheduled_at + _window)
   ORDER BY cs.scheduled_at ASC
   LIMIT 1;

  IF _conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'slot_conflict_schedule',
      'conflicting_schedule_id', _conflict.id,
      'conflicting_project_id', _conflict.project_id,
      'conflicting_status', _conflict.status,
      'conflicting_scheduled_at', _conflict.scheduled_at,
      'conflicting_title', COALESCE(_conflict.title, _conflict.topic),
      'window_minutes', _slot_window_minutes
    );
  END IF;

  -- All clear — apply the three operations atomically
  UPDATE public.video_projects
     SET status = 'ready_for_production',
         channel_id_ref = _channel_id,
         scheduled_at = _scheduled_at,
         error_message = NULL,
         updated_at = now()
   WHERE id = _project_id;

  -- Avoid duplicate schedule rows for this project (idempotent insert)
  IF NOT EXISTS (
    SELECT 1 FROM public.channel_schedule
     WHERE project_id = _project_id
       AND status IN ('scheduled','running','rendering','uploading')
  ) THEN
    INSERT INTO public.channel_schedule (
      user_id, channel_id, project_id, topic, scheduled_at, status
    ) VALUES (
      _user_id, _channel_id, _project_id, _topic, _scheduled_at, 'scheduled'
    );
  ELSE
    UPDATE public.channel_schedule
       SET scheduled_at = _scheduled_at,
           topic = COALESCE(_topic, topic),
           status = 'scheduled',
           updated_at = now()
     WHERE project_id = _project_id
       AND status IN ('scheduled','running','rendering','uploading');
  END IF;

  UPDATE public.user_channels
     SET next_slot_at = _scheduled_at
   WHERE id = _channel_id;

  RETURN jsonb_build_object(
    'ok', true,
    'project_id', _project_id,
    'channel_id', _channel_id,
    'scheduled_at', _scheduled_at
  );
END;
$$;

-- Helpful index for the conflict lookup
CREATE INDEX IF NOT EXISTS idx_video_projects_channel_scheduled
  ON public.video_projects (channel_id_ref, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_schedule_channel_scheduled
  ON public.channel_schedule (channel_id, scheduled_at);

REVOKE ALL ON FUNCTION public.claim_publish_slot(uuid, uuid, uuid, timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_publish_slot(uuid, uuid, uuid, timestamptz, text, integer) TO authenticated, service_role;