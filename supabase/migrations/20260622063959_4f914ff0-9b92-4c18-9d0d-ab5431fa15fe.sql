
-- Allow admins to manage libraries
CREATE POLICY "Admins insert libraries" ON public.libraries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update libraries" ON public.libraries
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete libraries" ON public.libraries
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only function to grant librarian by email
CREATE OR REPLACE FUNCTION public.admin_grant_librarian(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can grant librarian access';
  END IF;
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email. Ask them to sign in first.');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (target_id, 'librarian'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'user_id', target_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_grant_librarian(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian(text) TO authenticated;

-- Admin-only function to revoke librarian by email
CREATE OR REPLACE FUNCTION public.admin_revoke_librarian(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can revoke librarian access';
  END IF;
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email.');
  END IF;
  DELETE FROM public.user_roles WHERE user_id = target_id AND role = 'librarian'::app_role;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revoke_librarian(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian(text) TO authenticated;

-- Admin-only function to list librarians (with email)
CREATE OR REPLACE FUNCTION public.admin_list_librarians()
RETURNS TABLE(user_id uuid, email text, display_name text, granted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can list librarians';
  END IF;
  RETURN QUERY
    SELECT ur.user_id, u.email::text, p.display_name, ur.created_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'librarian'::app_role
    ORDER BY ur.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_librarians() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_librarians() TO authenticated;

-- Staff helper: list rentals/diary/etc for any user
CREATE OR REPLACE FUNCTION public.staff_user_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = _user_id),
    'email', (SELECT u.email FROM auth.users u WHERE u.id = _user_id),
    'active_rentals', (SELECT COALESCE(jsonb_agg(to_jsonb(r) || jsonb_build_object('book', to_jsonb(b))), '[]'::jsonb)
                       FROM public.rentals r LEFT JOIN public.books b ON b.id=r.book_id
                       WHERE r.user_id = _user_id AND r.returned_at IS NULL),
    'past_rentals_count', (SELECT count(*) FROM public.rentals WHERE user_id=_user_id AND returned_at IS NOT NULL),
    'waitlist', (SELECT COALESCE(jsonb_agg(to_jsonb(w) || jsonb_build_object('book', to_jsonb(b))), '[]'::jsonb)
                 FROM public.waitlist w LEFT JOIN public.books b ON b.id=w.book_id
                 WHERE w.user_id = _user_id),
    'reviews_count', (SELECT count(*) FROM public.reviews WHERE user_id=_user_id),
    'diary_count', (SELECT count(*) FROM public.reading_diary WHERE user_id=_user_id)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_user_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_user_summary(uuid) TO authenticated;
