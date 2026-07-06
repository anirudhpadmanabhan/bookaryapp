CREATE OR REPLACE FUNCTION public.rent_book(_book_id uuid, _address text DEFAULT NULL::text, _phone text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cur_addr text;
  existing_user uuid;
  clean_addr text;
  clean_phone text;
  btitle text;
  blib uuid;
  price constant numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;

  SELECT address INTO cur_addr FROM public.profiles WHERE id = auth.uid() FOR UPDATE;

  SELECT title, library_id INTO btitle, blib FROM public.books WHERE id = _book_id;
  IF btitle IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;

  SELECT user_id INTO existing_user
    FROM public.rentals
   WHERE book_id = _book_id AND returned_at IS NULL AND tracking_status <> 'reserved'
   FOR UPDATE
   LIMIT 1;
  IF existing_user IS NOT NULL THEN
    IF existing_user = auth.uid() THEN
      RAISE EXCEPTION 'You already have this book rented';
    END IF;
    RAISE EXCEPTION 'Book is currently rented out';
  END IF;

  clean_addr := NULLIF(trim(COALESCE(_address, '')), '');
  clean_phone := NULLIF(trim(COALESCE(_phone, '')), '');

  INSERT INTO public.rentals (user_id, book_id, price_paid, fine_amount, delivery_address, tracking_status)
  VALUES (auth.uid(), _book_id, price, 0, COALESCE(clean_addr, cur_addr), 'confirmed');

  UPDATE public.profiles
     SET address = COALESCE(clean_addr, address),
         phone = COALESCE(clean_phone, phone),
         wallet_balance = 0,
         updated_at = now()
   WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'price', price);
END;
$function$;

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
         due_at = now() + interval '20 days'
   WHERE id = _rental_id;

  SELECT title INTO btitle FROM public.books WHERE id = r.book_id;
  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (auth.uid(), 'rental_confirmed', 'Claim confirmed — ' || COALESCE(btitle,'your book'),
          'Your reservation is now an active free rental.', r.book_id, '/profile');

  RETURN jsonb_build_object('ok', true, 'price', 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_next_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.rentals (user_id, book_id, price_paid, fine_amount, delivery_address, tracking_status, reserved_until)
  VALUES (next_row.user_id, NEW.book_id, 0, 0, next_row.delivery_address, 'reserved', now() + interval '24 hours');

  DELETE FROM public.waitlist WHERE id = next_row.id;

  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (
    next_row.user_id,
    'reservation_offered',
    'Good news! ''' || COALESCE(book_title,'Your book') || ''' is available.',
    'Reserve within 24 hours, or it passes to the next reader. Open the book page and tap Claim.',
    NEW.book_id,
    '/profile'
  );

  RETURN NEW;
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
  due := COALESCE(_due_at, _rented_at + interval '20 days');
  INSERT INTO public.rentals (user_id, book_id, price_paid, fine_amount, tracking_status, rented_at, due_at, returned_at)
  VALUES (_user_id, _book_id, 0, 0, CASE WHEN _returned_at IS NOT NULL THEN 'returned' ELSE 'delivered' END, _rented_at, due, _returned_at)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', true, 'rental_id', new_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.librarian_mark_returned(_rental_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.rentals%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  SELECT * INTO r FROM public.rentals WHERE id = _rental_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Rental not found'; END IF;
  IF r.returned_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Already returned'); END IF;

  UPDATE public.rentals
     SET returned_at = now(), fine_amount = 0, tracking_status = 'returned'
   WHERE id = _rental_id;

  RETURN jsonb_build_object('ok', true, 'fine', 0, 'days_over', 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.librarian_set_return(_rental_id uuid, _returned_at timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  UPDATE public.rentals SET returned_at = _returned_at,
                            fine_amount = 0,
                            tracking_status = CASE WHEN _returned_at IS NULL THEN 'delivered' ELSE 'returned' END
   WHERE id = _rental_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_rental_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE bmeta record;
BEGIN
  IF OLD.tracking_status IS DISTINCT FROM NEW.tracking_status THEN
    SELECT title, library_id INTO bmeta FROM public.books WHERE id = NEW.book_id;
    INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
    VALUES (NEW.user_id, 'rental_status',
            'Update: ' || COALESCE(bmeta.title,'your rental'),
            'Status changed to "' || replace(NEW.tracking_status,'_',' ') || '".',
            NEW.book_id, '/profile');
    IF NEW.tracking_status = 'delivered' AND NEW.delivered_notified_at IS NULL THEN
      INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
      VALUES (NEW.user_id, 'rental_due',
              'Delivered — return by ' || to_char(NEW.due_at,'DD Mon YYYY'),
              'Enjoy! Please return "' || COALESCE(bmeta.title,'the book') || '" by ' ||
              to_char(NEW.due_at,'DD Mon YYYY') || '.',
              NEW.book_id, '/profile');
      NEW.delivered_notified_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_my_due_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    bucket := CASE
      WHEN days_left >= 15 THEN 15
      WHEN days_left >= 10 THEN 10
      WHEN days_left >= 5  THEN 5
      WHEN days_left >= 0  THEN 0
      ELSE NULL
    END;
    IF bucket IS NULL THEN CONTINUE; END IF;
    IF r.last_reminder_days IS NOT NULL AND r.last_reminder_days <= bucket THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
    VALUES (auth.uid(), 'rental_reminder',
            CASE WHEN bucket = 0 THEN 'Due today — ' ELSE 'Due in ' || bucket || ' days — ' END
              || COALESCE(r.title,'your rental'),
            'Return by ' || to_char(r.due_at,'DD Mon YYYY') || '.',
            r.book_id, '/profile');
    UPDATE public.rentals SET last_reminder_days = bucket, reminder_sent_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.top_up_wallet(_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Wallet top-up is disabled because rentals are free';
END;
$function$;

UPDATE public.profiles SET wallet_balance = 0, updated_at = now();
