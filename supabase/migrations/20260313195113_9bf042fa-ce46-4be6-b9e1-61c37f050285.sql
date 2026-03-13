
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create a unified knowledge table for semantic search
-- This consolidates content from all knowledge tables into one searchable index
CREATE TABLE public.knowledge_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  content_text text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_table, source_id)
);

-- Create HNSW index for fast similarity search
CREATE INDEX knowledge_embeddings_embedding_idx 
  ON public.knowledge_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for source filtering
CREATE INDEX knowledge_embeddings_source_idx ON public.knowledge_embeddings(source_table);

-- RLS: authenticated can read
ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read knowledge_embeddings"
  ON public.knowledge_embeddings
  FOR SELECT TO authenticated
  USING (true);

-- Function to match knowledge by semantic similarity
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(768),
  match_count int DEFAULT 20,
  match_threshold float DEFAULT 0.3,
  filter_tables text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_table text,
  source_id uuid,
  content_text text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.source_table,
    ke.source_id,
    ke.content_text,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_embeddings ke
  WHERE 
    ke.embedding IS NOT NULL
    AND (filter_tables IS NULL OR ke.source_table = ANY(filter_tables))
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
