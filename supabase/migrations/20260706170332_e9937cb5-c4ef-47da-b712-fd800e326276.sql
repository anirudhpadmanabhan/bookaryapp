CREATE POLICY "Readers can view library post photos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'library-posts');