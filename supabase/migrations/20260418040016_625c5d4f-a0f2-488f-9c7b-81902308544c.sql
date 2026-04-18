-- Add CHECK constraint allowing the 4 existing roles plus 3 new ones (competitor, benchmark, anti-model).
-- Column user_reference_channels.role is plain text, so this enforces the allowed set without enum migration cost.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_reference_channels'
      AND constraint_name = 'user_reference_channels_role_check'
  ) THEN
    ALTER TABLE public.user_reference_channels DROP CONSTRAINT user_reference_channels_role_check;
  END IF;
END $$;

ALTER TABLE public.user_reference_channels
  ADD CONSTRAINT user_reference_channels_role_check
  CHECK (role IN ('model','style','hook','format','competitor','benchmark','anti-model'));

-- Index to speed up RAG retrieval filtered by source_table + user metadata
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_source_table_meta
  ON public.knowledge_embeddings (source_table)
  WHERE source_table = 'user_reference_channels';