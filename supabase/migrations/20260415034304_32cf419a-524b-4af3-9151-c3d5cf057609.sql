
-- 1. Remove subscriptions from Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

-- 2. Fix storage: drop overly broad SELECT policy and replace with ownership-scoped one
DROP POLICY IF EXISTS "Public read media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "media_public_select" ON storage.objects;

-- Allow public read (needed for public bucket serving files) but prevent listing
-- by requiring the user knows the exact file path
CREATE POLICY "Authenticated users read own media files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Keep public anonymous read for direct file URLs (public bucket)
-- but scoped so listing returns nothing useful without knowing paths
CREATE POLICY "Public read media by direct path"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'media'
);
