
ALTER TABLE public.book_suggestions ADD COLUMN IF NOT EXISTS publisher text;

CREATE OR REPLACE FUNCTION public.library_top_readers(_library_id uuid, _limit int DEFAULT 50)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  email text,
  rental_count bigint,
  books_read bigint,
  reviews_count bigint,
  favorite_genre text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role)
          OR public.has_role_in_library(auth.uid(),'librarian'::app_role, _library_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  WITH scoped_rentals AS (
    SELECT r.user_id, r.book_id
    FROM public.rentals r
    JOIN public.books b ON b.id = r.book_id
    WHERE _library_id IS NULL OR b.library_id = _library_id
  ),
  rc AS (
    SELECT user_id, count(*) AS c FROM scoped_rentals GROUP BY user_id
  ),
  br AS (
    SELECT d.user_id, count(*) AS c
    FROM public.reading_diary d
    LEFT JOIN public.books b ON b.id = d.book_id
    WHERE d.status = 'read' AND (_library_id IS NULL OR b.library_id = _library_id)
    GROUP BY d.user_id
  ),
  rv AS (
    SELECT rw.user_id, count(*) AS c
    FROM public.reviews rw
    LEFT JOIN public.books b ON b.id = rw.book_id
    WHERE _library_id IS NULL OR b.library_id = _library_id
    GROUP BY rw.user_id
  ),
  fg AS (
    SELECT sr.user_id,
      (SELECT b.genre
         FROM scoped_rentals sr2
         JOIN public.books b ON b.id = sr2.book_id
        WHERE sr2.user_id = sr.user_id AND b.genre IS NOT NULL
        GROUP BY b.genre ORDER BY count(*) DESC LIMIT 1) AS genre
    FROM scoped_rentals sr GROUP BY sr.user_id
  )
  SELECT
    u.id,
    p.display_name,
    u.email::text,
    COALESCE(rc.c,0),
    COALESCE(br.c,0),
    COALESCE(rv.c,0),
    fg.genre
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN rc ON rc.user_id = u.id
  LEFT JOIN br ON br.user_id = u.id
  LEFT JOIN rv ON rv.user_id = u.id
  LEFT JOIN fg ON fg.user_id = u.id
  WHERE COALESCE(rc.c,0) + COALESCE(br.c,0) + COALESCE(rv.c,0) > 0
  ORDER BY COALESCE(rc.c,0) DESC, COALESCE(br.c,0) DESC
  LIMIT COALESCE(_limit, 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_rental_history(_user_id uuid, _library_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  SELECT jsonb_build_object(
    'rentals', COALESCE(jsonb_agg(to_jsonb(r) || jsonb_build_object('book', to_jsonb(b)) ORDER BY r.rented_at DESC), '[]'::jsonb),
    'stats', (
      SELECT jsonb_build_object(
        'total', count(*),
        'active', count(*) FILTER (WHERE r2.returned_at IS NULL),
        'returned', count(*) FILTER (WHERE r2.returned_at IS NOT NULL),
        'reviews', (SELECT count(*) FROM public.reviews WHERE user_id=_user_id),
        'books_read', (SELECT count(*) FROM public.reading_diary WHERE user_id=_user_id AND status='read')
      )
      FROM public.rentals r2
      LEFT JOIN public.books b2 ON b2.id = r2.book_id
      WHERE r2.user_id = _user_id AND (_library_id IS NULL OR b2.library_id = _library_id)
    )
  ) INTO result
  FROM public.rentals r
  LEFT JOIN public.books b ON b.id = r.book_id
  WHERE r.user_id = _user_id AND (_library_id IS NULL OR b.library_id = _library_id);
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.library_top_readers(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_rental_history(uuid, uuid) TO authenticated;
