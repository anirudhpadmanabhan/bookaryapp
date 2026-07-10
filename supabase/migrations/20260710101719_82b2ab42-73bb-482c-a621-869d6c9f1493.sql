
-- 1) Allow reserved->confirmed and reserved->cancelled transitions even when rented_at / returned_at change
CREATE OR REPLACE FUNCTION public.rentals_restrict_user_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'librarian'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Owner may transition a reservation: reserved -> confirmed (claim) or cancelled (decline).
  -- Claim resets rented_at + due_at; decline sets returned_at. Both are OK.
  IF NEW.user_id = OLD.user_id
     AND OLD.tracking_status = 'reserved'
     AND NEW.tracking_status IN ('confirmed','cancelled')
     AND NEW.book_id = OLD.book_id THEN
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
$function$;

-- 2) 20 -> 30 day loan window
CREATE OR REPLACE FUNCTION public.claim_reservation(_rental_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.rentals%ROWTYPE;
  btitle text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO r FROM public.rentals WHERE id = _rental_id FOR UPDATE;
  IF r.id IS NULL OR r.user_id <> auth.uid() THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF r.tracking_status <> 'reserved' THEN RAISE EXCEPTION 'Reservation already handled'; END IF;
  IF r.reserved_until IS NOT NULL AND r.reserved_until < now() THEN
    RAISE EXCEPTION 'Reservation expired';
  END IF;

  UPDATE public.rentals
     SET tracking_status = 'confirmed',
         price_paid = 0,
         reserved_until = NULL,
         rented_at = now(),
         due_at = now() + interval '30 days'
   WHERE id = _rental_id;

  SELECT title INTO btitle FROM public.books WHERE id = r.book_id;
  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (auth.uid(), 'rental_confirmed', 'Claim confirmed — ' || COALESCE(btitle,'your book'),
          'Your reservation is now an active free rental.', r.book_id, '/profile');

  RETURN jsonb_build_object('ok', true, 'price', 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.librarian_log_rental(_user_id uuid, _book_id uuid, _rented_at timestamp with time zone DEFAULT now(), _due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _returned_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid; due timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  due := COALESCE(_due_at, _rented_at + interval '30 days');
  INSERT INTO public.rentals (user_id, book_id, price_paid, fine_amount, tracking_status, rented_at, due_at, returned_at)
  VALUES (_user_id, _book_id, 0, 0, CASE WHEN _returned_at IS NOT NULL THEN 'returned' ELSE 'delivered' END, _rented_at, due, _returned_at)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', true, 'rental_id', new_id);
END;
$function$;

-- rent_book uses default due_at from column default; ensure books rented via UI get 30 days.
-- Look at rentals.due_at default:
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE public.rentals ALTER COLUMN due_at SET DEFAULT (now() + interval ''30 days'')';
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;
