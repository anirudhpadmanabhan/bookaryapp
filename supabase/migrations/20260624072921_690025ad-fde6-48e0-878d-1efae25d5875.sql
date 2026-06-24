
CREATE OR REPLACE FUNCTION public.home_data(_library_id uuid DEFAULT NULL, _latest_limit int DEFAULT 60, _popular_limit int DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_books bigint;
  latest_books jsonb;
  popular_books jsonb;
  genres jsonb;
  writers jsonb;
  languages jsonb;
  popular_ids uuid[];
  out_ids uuid[];
BEGIN
  -- total
  SELECT count(*) INTO total_books
  FROM public.books
  WHERE _library_id IS NULL OR library_id = _library_id;

  -- currently out
  SELECT COALESCE(array_agg(DISTINCT book_id), ARRAY[]::uuid[]) INTO out_ids
  FROM public.rentals
  WHERE returned_at IS NULL AND tracking_status <> 'reserved';

  -- popularity ranking from rentals
  SELECT COALESCE(array_agg(book_id ORDER BY cnt DESC), ARRAY[]::uuid[])
    INTO popular_ids
  FROM (
    SELECT book_id, count(*) AS cnt FROM public.rentals
    GROUP BY book_id
  ) q
  WHERE NOT (book_id = ANY(out_ids))
  LIMIT _popular_limit * 3;

  -- popular books (preserve order)
  SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY array_position(popular_ids, b.id)), '[]'::jsonb)
    INTO popular_books
  FROM (
    SELECT b.* FROM public.books b
    WHERE b.id = ANY(popular_ids)
      AND (_library_id IS NULL OR b.library_id = _library_id)
    LIMIT _popular_limit
  ) b;

  -- top up popular with latest if short
  IF jsonb_array_length(popular_books) < _popular_limit THEN
    popular_books := popular_books || COALESCE((
      SELECT jsonb_agg(to_jsonb(b))
      FROM (
        SELECT * FROM public.books b
        WHERE (_library_id IS NULL OR b.library_id = _library_id)
          AND NOT (b.id = ANY(COALESCE(popular_ids, ARRAY[]::uuid[])))
          AND NOT (b.id = ANY(out_ids))
        ORDER BY created_at DESC
        LIMIT _popular_limit
      ) b
    ), '[]'::jsonb);
  END IF;

  -- latest books grid
  SELECT COALESCE(jsonb_agg(to_jsonb(b)), '[]'::jsonb) INTO latest_books
  FROM (
    SELECT id, title, title_ml, author, author_ml, original_author, genre, genre_ml,
           rating, rent_price, cover_color, pages, published_year, publisher,
           shelf_code, language, cover_url, created_at, library_id
    FROM public.books
    WHERE _library_id IS NULL OR library_id = _library_id
    ORDER BY
      CASE WHEN shelf_code ~ '^[0-9]+$' THEN 0 ELSE 1 END,
      CASE WHEN shelf_code ~ '^[0-9]+$' THEN shelf_code::int ELSE NULL END DESC NULLS LAST,
      created_at DESC
    LIMIT _latest_limit
  ) b;

  -- facet aggregates
  SELECT COALESCE(jsonb_agg(jsonb_build_object('key', genre, 'ml', genre_ml, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO genres
  FROM (
    SELECT genre, max(genre_ml) AS genre_ml, count(*) AS c
    FROM public.books
    WHERE genre IS NOT NULL AND (_library_id IS NULL OR library_id = _library_id)
    GROUP BY genre
  ) g;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('key', author, 'ml', author_ml, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO writers
  FROM (
    SELECT author, max(author_ml) AS author_ml, count(*) AS c
    FROM public.books
    WHERE author IS NOT NULL AND (_library_id IS NULL OR library_id = _library_id)
    GROUP BY author
  ) w;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('key', COALESCE(NULLIF(trim(language),''),'Unknown'), 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO languages
  FROM (
    SELECT COALESCE(NULLIF(trim(language),''),'Unknown') AS language, count(*) AS c
    FROM public.books
    WHERE (_library_id IS NULL OR library_id = _library_id)
    GROUP BY 1
  ) l;

  RETURN jsonb_build_object(
    'total', total_books,
    'latest', latest_books,
    'popular', popular_books,
    'genres', genres,
    'writers', writers,
    'languages', languages
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.home_data(uuid, int, int) TO anon, authenticated;

-- Index to make popularity aggregation fast
CREATE INDEX IF NOT EXISTS rentals_book_id_idx ON public.rentals(book_id);
