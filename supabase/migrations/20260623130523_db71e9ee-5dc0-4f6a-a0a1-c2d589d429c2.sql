
-- 1. profiles.phone (private)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2. rentals.fine_amount
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS fine_amount numeric NOT NULL DEFAULT 0;

-- 3. book_suggestions: add status + decided_by + decided_at + notes
ALTER TABLE public.book_suggestions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note text;

-- 4. Tighten profiles SELECT: keep "self" + staff (already added), but also allow staff to update wallet via RPC only (no policy change needed since RPC is SECURITY DEFINER).

-- 5. RPC: member sets their phone
CREATE OR REPLACE FUNCTION public.set_my_phone(_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  UPDATE public.profiles SET phone = NULLIF(trim(_phone), ''), updated_at = now() WHERE id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_my_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_phone(text) TO authenticated;

-- 6. RPC: librarian marks rental returned (computes fine, debits wallet)
CREATE OR REPLACE FUNCTION public.librarian_mark_returned(_rental_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.rentals%ROWTYPE;
  days_over integer;
  fine numeric := 0;
  book_title text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  SELECT * INTO r FROM public.rentals WHERE id = _rental_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Rental not found'; END IF;
  IF r.returned_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Already returned'); END IF;

  days_over := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - r.due_at))/86400)::int);
  fine := days_over * 1;

  UPDATE public.rentals
     SET returned_at = now(), fine_amount = fine, tracking_status = 'returned'
   WHERE id = _rental_id;

  IF fine > 0 THEN
    UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance,0) - fine, updated_at = now()
     WHERE id = r.user_id;
    SELECT title INTO book_title FROM public.books WHERE id = r.book_id;
    INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, book_id, book_title, action, metadata)
    VALUES (auth.uid(), public._actor_name(auth.uid()), r.user_id, public._actor_name(r.user_id), r.book_id, book_title, 'fine_charged',
            jsonb_build_object('days_over', days_over, 'fine', fine));
    INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
    VALUES (r.user_id, 'fine_charged', 'Late return fine: ₹' || fine,
            'Returned ' || days_over || ' day(s) late. ₹' || fine || ' was deducted from your wallet.',
            r.book_id, '/profile');
  END IF;

  RETURN jsonb_build_object('ok', true, 'fine', fine, 'days_over', days_over);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.librarian_mark_returned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.librarian_mark_returned(uuid) TO authenticated;

-- 7. RPC: librarian decides on a book suggestion
CREATE OR REPLACE FUNCTION public.librarian_decide_suggestion(_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s public.book_suggestions%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  IF _decision NOT IN ('approved','rejected','available') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;
  UPDATE public.book_suggestions
     SET status = _decision, decided_by = auth.uid(), decided_at = now(), decision_note = _note
   WHERE id = _id
   RETURNING * INTO s;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Suggestion not found'; END IF;

  INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, action, metadata)
  VALUES (auth.uid(), public._actor_name(auth.uid()), s.user_id, public._actor_name(s.user_id), 'suggestion_decided',
          jsonb_build_object('decision', _decision, 'title', s.title));

  INSERT INTO public.notifications (user_id, kind, title, body, link_url)
  VALUES (s.user_id, 'suggestion_decided',
          'Suggestion ' || _decision || ': ' || COALESCE(s.title,'your book'),
          COALESCE(_note, 'Your library reviewed your suggestion.'),
          '/profile');

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) TO authenticated;

-- 8. RPC: members of a library (anyone who has rented a book of this library)
CREATE OR REPLACE FUNCTION public.library_members(_library_id uuid)
RETURNS TABLE(user_id uuid, display_name text, email text, phone text, rental_count bigint, last_rental timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role)
          OR public.has_role_in_library(auth.uid(),'librarian'::app_role, _library_id)) THEN
    RAISE EXCEPTION 'Not authorized for this library';
  END IF;
  RETURN QUERY
    SELECT p.id, p.display_name, u.email::text, p.phone,
           count(r.id) AS rental_count,
           max(r.rented_at) AS last_rental
    FROM public.rentals r
    JOIN public.books b ON b.id = r.book_id AND b.library_id = _library_id
    JOIN public.profiles p ON p.id = r.user_id
    JOIN auth.users u ON u.id = r.user_id
    GROUP BY p.id, u.email, p.display_name, p.phone
    ORDER BY last_rental DESC NULLS LAST;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.library_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.library_members(uuid) TO authenticated;

-- 9. RPC: reading insights for a user (public-safe aggregates)
CREATE OR REPLACE FUNCTION public.reading_insights(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  read_count int;
  reading_count int;
  want_count int;
  fav_genre text;
  streak int := 0;
  d date;
  has_entry boolean;
BEGIN
  SELECT count(*) INTO read_count FROM public.reading_diary WHERE user_id=_user_id AND status='read';
  SELECT count(*) INTO reading_count FROM public.reading_diary WHERE user_id=_user_id AND status='reading';
  SELECT count(*) INTO want_count FROM public.reading_diary WHERE user_id=_user_id AND status='want';

  SELECT b.genre INTO fav_genre
    FROM public.reading_diary d
    JOIN public.books b ON b.id = d.book_id
   WHERE d.user_id=_user_id AND d.status='read' AND b.genre IS NOT NULL
   GROUP BY b.genre
   ORDER BY count(*) DESC
   LIMIT 1;

  -- streak: consecutive days back from today with any diary update
  d := current_date;
  LOOP
    SELECT EXISTS (SELECT 1 FROM public.reading_diary
                    WHERE user_id=_user_id AND date_trunc('day', updated_at) = d) INTO has_entry;
    EXIT WHEN NOT has_entry;
    streak := streak + 1;
    d := d - 1;
  END LOOP;

  RETURN jsonb_build_object(
    'read', read_count, 'reading', reading_count, 'want', want_count,
    'favorite_genre', fav_genre, 'streak', streak
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reading_insights(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reading_insights(uuid) TO anon, authenticated;

-- 10. Notify on rental status changes (extend existing trigger logic via additional notify on tracking change)
CREATE OR REPLACE FUNCTION public.notify_rental_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bmeta record;
BEGIN
  IF OLD.tracking_status IS DISTINCT FROM NEW.tracking_status THEN
    SELECT title, library_id INTO bmeta FROM public.books WHERE id = NEW.book_id;
    INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
    VALUES (NEW.user_id, 'rental_status',
            'Update: ' || COALESCE(bmeta.title,'your rental'),
            'Status changed to "' || NEW.tracking_status || '".',
            NEW.book_id, '/profile');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_rental_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_rental_status ON public.rentals;
CREATE TRIGGER trg_notify_rental_status
AFTER UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.notify_rental_status();

-- 11. Profile self-update should allow phone too (no schema change; existing self-UPDATE policy on profiles allows this).

-- 12. Index for sorting
CREATE INDEX IF NOT EXISTS idx_books_shelf_code ON public.books(shelf_code);
CREATE INDEX IF NOT EXISTS idx_rentals_returned_at ON public.rentals(returned_at);
