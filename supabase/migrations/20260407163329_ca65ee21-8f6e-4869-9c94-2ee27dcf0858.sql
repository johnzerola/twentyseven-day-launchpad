
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;

CREATE POLICY "Users can update own media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
