
CREATE OR REPLACE FUNCTION public.staff_users_by_ids(_ids uuid[])
RETURNS TABLE(user_id uuid, email text, display_name text, phone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, p.display_name, p.phone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = ANY(_ids);
END;
$$;
