CREATE POLICY "Staff can upload library post photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'library-posts'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'librarian'::public.app_role)
  )
);

CREATE POLICY "Staff can update library post photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'library-posts'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'librarian'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'library-posts'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'librarian'::public.app_role)
  )
);

CREATE POLICY "Staff can read library post photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'library-posts'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'librarian'::public.app_role)
  )
);