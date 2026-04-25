-- ============================================================
-- 1) video_projects: claim/lease + idempotency + final asset
-- ============================================================
ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rendered_video_url text,
  ADD COLUMN IF NOT EXISTS rendered_video_sha256 text,
  ADD COLUMN IF NOT EXISTS total_render_cost_usd numeric(10,4) DEFAULT 0;

-- Backfill idempotency_key for existing rows
UPDATE public.video_projects
   SET idempotency_key = gen_random_uuid()
 WHERE idempotency_key IS NULL;

-- Index for the worker claim query (status + scheduled_at + claim_expires_at)
CREATE INDEX IF NOT EXISTS idx_video_projects_claim_lookup
  ON public.video_projects (status, scheduled_at, claim_expires_at)
  WHERE status IN ('ready_for_production', 'claimed');

CREATE INDEX IF NOT EXISTS idx_video_projects_worker
  ON public.video_projects (worker_id) WHERE worker_id IS NOT NULL;

-- ============================================================
-- 2) worker_heartbeats
-- ============================================================
CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
  worker_id text PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now(),
  current_project_id uuid REFERENCES public.video_projects(id) ON DELETE SET NULL,
  current_stage text,
  progress_pct int CHECK (progress_pct >= 0 AND progress_pct <= 100),
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_seen
  ON public.worker_heartbeats (last_seen DESC);

ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_heartbeats_for_their_projects" ON public.worker_heartbeats;
CREATE POLICY "users_view_heartbeats_for_their_projects"
  ON public.worker_heartbeats FOR SELECT
  TO authenticated
  USING (
    current_project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.video_projects vp
       WHERE vp.id = worker_heartbeats.current_project_id
         AND vp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3) project_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  worker_id text,
  stage text NOT NULL,
  status text NOT NULL CHECK (status IN ('started','completed','failed','progress')),
  message text,
  cost_usd numeric(10,4) DEFAULT 0,
  duration_ms int,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_events_project
  ON public.project_events (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_events_worker
  ON public.project_events (worker_id, created_at DESC) WHERE worker_id IS NOT NULL;

ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_events_for_their_projects" ON public.project_events;
CREATE POLICY "users_view_events_for_their_projects"
  ON public.project_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.video_projects vp
       WHERE vp.id = project_events.project_id
         AND vp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4) Storage bucket for rendered videos (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('rendered-videos', 'rendered-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Users can read only files under their own user_id folder
DROP POLICY IF EXISTS "users_read_own_rendered_videos" ON storage.objects;
CREATE POLICY "users_read_own_rendered_videos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'rendered-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role bypasses RLS so the worker can write/list/delete.