
-- Remove the broad anon policy that allows listing
DROP POLICY IF EXISTS "Public read media by direct path" ON storage.objects;
