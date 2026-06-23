
-- 1. Schema additions
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_days int;

-- 2. Allow rental owner to claim/decline a reservation (update tracking_status to confirmed/cancelled)
CREATE OR REPLACE FUNCTION public.rentals_restrict_user_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'librarian'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Owner may transition a reservation: reserved -> confirmed (claim) or cancelled (decline)
  IF NEW.user_id = OLD.user_id
     AND OLD.tracking_status = 'reserved'
     AND NEW.tracking_status IN ('confirmed','cancelled')
     AND NEW.book_id = OLD.book_id
     AND NEW.rented_at = OLD.rented_at THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.book_id IS DISTINCT FROM OLD.book_id
     OR NEW.price_paid IS DISTINCT FROM OLD.price_paid
     OR NEW.tracking_status IS DISTINCT FROM OLD.tracking_status
     OR NEW.returned_at IS DISTINCT FROM OLD.returned_at
     OR NEW.due_at IS DISTINCT FROM OLD.due_at
     OR NEW.rented_at IS DISTINCT FROM OLD.rented_at THEN
    RAISE EXCEPTION 'Only staff can modify rental status, price, or dates';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Reserve (instead of immediately confirming) next waitlister on return
CREATE OR REPLACE FUNCTION public.assign_next_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_row public.waitlist%ROWTYPE;
  book_title text;
BEGIN
  IF NEW.returned_at IS NULL OR OLD.returned_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO next_row FROM public.waitlist
   WHERE book_id = NEW.book_id
   ORDER BY created_at ASC
   LIMIT 1;

  IF next_row.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title INTO book_title FROM public.books WHERE id = NEW.book_id;

  -- Create a reserved (unpaid) rental valid for 24 hours
  INSERT INTO public.rentals (user_id, book_id, price_paid, delivery_address, tracking_status, reserved_until)
  VALUES (next_row.user_id, NEW.book_id, 0, next_row.delivery_address, 'reserved', now() + interval '24 hours');

  DELETE FROM public.waitlist WHERE id = next_row.id;

  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (
    next_row.user_id,
    'reservation_offered',
    'Your book is ready — claim within 24 hours',
    COALESCE(book_title,'Your book') || ' is available. Open the book page and tap Claim within 24 hours, or it passes to the next reader.',
    NEW.book_id,
    '/profile'
  );

  RETURN NEW;
END;
$$;

-- 4. Helper: where am I in the queue for a book? 1 = next.
CREATE OR REPLACE FUNCTION public.waitlist_position(_book_id uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pos FROM (
    SELECT user_id, row_number() OVER (ORDER BY created_at ASC)::int AS pos
    FROM public.waitlist WHERE book_id = _book_id
  ) q WHERE user_id = auth.uid();
$$;

-- 5. Claim a reservation (charge wallet, flip to confirmed)
CREATE OR REPLACE FUNCTION public.claim_reservation(_rental_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.rentals%ROWTYPE;
  price numeric;
  bal numeric;
  btitle text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO r FROM public.rentals WHERE id = _rental_id FOR UPDATE;
  IF r.id IS NULL OR r.user_id <> auth.uid() THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF r.tracking_status <> 'reserved' THEN RAISE EXCEPTION 'Reservation already handled'; END IF;
  IF r.reserved_until IS NOT NULL AND r.reserved_until < now() THEN
    RAISE EXCEPTION 'Reservation expired';
  END IF;

  price := 10;
  SELECT wallet_balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < price THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE public.rentals
     SET tracking_status = 'confirmed',
         price_paid = price,
         reserved_until = NULL,
         rented_at = now(),
         due_at = now() + interval '20 days'
   WHERE id = _rental_id;

  UPDATE public.profiles SET wallet_balance = wallet_balance - price, updated_at = now() WHERE id = auth.uid();

  SELECT title INTO btitle FROM public.books WHERE id = r.book_id;
  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (auth.uid(), 'rental_confirmed', 'Claim confirmed — ' || COALESCE(btitle,'your book'),
          'Your reservation is now an active rental.', r.book_id, '/profile');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. Decline reservation: mark cancelled, fast-forward returned_at so assign_next_waitlist fires for the queue
CREATE OR REPLACE FUNCTION public.decline_reservation(_rental_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.rentals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO r FROM public.rentals WHERE id = _rental_id FOR UPDATE;
  IF r.id IS NULL OR r.user_id <> auth.uid() THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF r.tracking_status <> 'reserved' THEN RAISE EXCEPTION 'Reservation already handled'; END IF;
  -- Setting returned_at re-triggers assign_next_waitlist for the queue
  UPDATE public.rentals SET tracking_status = 'cancelled', returned_at = now() WHERE id = _rental_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. Sweep expired reservations (safe to call from any signed-in user; idempotent)
CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int := 0; r record;
BEGIN
  FOR r IN SELECT id FROM public.rentals
            WHERE tracking_status = 'reserved'
              AND reserved_until IS NOT NULL
              AND reserved_until < now()
              AND returned_at IS NULL
  LOOP
    UPDATE public.rentals SET tracking_status = 'expired', returned_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- 8. Rewrite due reminders: only after delivery, fire at 15/10/5/0 buckets, track via last_reminder_days
CREATE OR REPLACE FUNCTION public.enqueue_my_due_reminders()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int := 0; r record; days_left int; bucket int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  FOR r IN
    SELECT rt.id, rt.book_id, rt.due_at, rt.last_reminder_days, b.title
    FROM public.rentals rt
    LEFT JOIN public.books b ON b.id = rt.book_id
    WHERE rt.user_id = auth.uid()
      AND rt.returned_at IS NULL
      AND rt.tracking_status = 'delivered'
      AND rt.due_at IS NOT NULL
  LOOP
    days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.due_at - now())) / 86400)::int);
    -- pick the smallest bucket <= days_left from {15,10,5,0}
    bucket := CASE
      WHEN days_left >= 15 THEN 15
      WHEN days_left >= 10 THEN 10
      WHEN days_left >= 5  THEN 5
      WHEN days_left >= 0  THEN 0
      ELSE NULL
    END;
    IF bucket IS NULL THEN CONTINUE; END IF;
    -- Only send if we haven't sent this bucket already (last_reminder_days is null or larger)
    IF r.last_reminder_days IS NOT NULL AND r.last_reminder_days <= bucket THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
    VALUES (auth.uid(), 'rental_reminder',
            CASE WHEN bucket = 0 THEN 'Due today — ' ELSE 'Due in ' || bucket || ' days — ' END
              || COALESCE(r.title,'your rental'),
            'Return by ' || to_char(r.due_at,'DD Mon YYYY') || ' to avoid a ₹1/day late fee.',
            r.book_id, '/profile');
    UPDATE public.rentals SET last_reminder_days = bucket, reminder_sent_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- 9. Grants: re-grant only the RPCs clients call (security memory: execute is locked down)
REVOKE EXECUTE ON FUNCTION public.assign_next_waitlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rentals_restrict_user_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_reservations() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_stale_reservations() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.waitlist_position(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_reservation(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.decline_reservation(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.enqueue_my_due_reminders() TO authenticated;
