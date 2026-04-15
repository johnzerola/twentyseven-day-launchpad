
-- Remove the insecure anon SELECT policy
DROP POLICY IF EXISTS "Public can view media" ON storage.objects;

-- Ensure authenticated users can only read their own files
-- (drop first to avoid duplicate)
DROP POLICY IF EXISTS "Authenticated users can view their media" ON storage.objects;

CREATE POLICY "Authenticated users can view their media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
