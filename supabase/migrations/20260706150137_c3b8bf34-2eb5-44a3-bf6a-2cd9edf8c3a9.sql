
-- Allow staff to explicitly mark a rental as 'rented' (checked out) or other statuses via an RPC that also refreshes updated_at.
CREATE OR REPLACE FUNCTION public.librarian_mark_rented(_rental_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  UPDATE public.rentals
     SET tracking_status = 'rented',
         returned_at = NULL
   WHERE id = _rental_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Search members by display name (as well as email) for the "Log rental" dialog.
CREATE OR REPLACE FUNCTION public.staff_search_members(_query text, _limit int DEFAULT 8)
RETURNS TABLE(user_id uuid, email text, display_name text, phone text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
    WHERE _query IS NULL OR trim(_query) = ''
       OR p.display_name ILIKE '%' || _query || '%'
       OR u.email ILIKE '%' || _query || '%'
    ORDER BY p.display_name NULLS LAST
    LIMIT COALESCE(_limit, 8);
END;
$$;
