
-- Profile avatars + library admin scoping prereqs

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Storage policies for avatars bucket (private; users manage their own folder = auth.uid())
CREATE POLICY "avatars_read_any_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Helper: list library ids a user has librarian access to (NULL row = all libraries)
CREATE OR REPLACE FUNCTION public.my_librarian_library_ids(_user_id uuid)
RETURNS TABLE(library_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT library_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'librarian'::public.app_role
$$;
GRANT EXECUTE ON FUNCTION public.my_librarian_library_ids(uuid) TO authenticated;
