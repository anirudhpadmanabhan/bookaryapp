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

  INSERT INTO public.rentals (user_id, book_id, price_paid, delivery_address, tracking_status)
  VALUES (auth.uid(), _book_id, price, COALESCE(clean_addr, cur_addr), 'confirmed');

  UPDATE public.profiles
     SET address = COALESCE(clean_addr, address),
         phone = COALESCE(clean_phone, phone),
         updated_at = now()
   WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'price', price);
END;
$function$;

-- Also make reservation-claim free so users aren't charged when claiming.
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
          'Your reservation is now an active rental.', r.book_id, '/profile');

  RETURN jsonb_build_object('ok', true, 'price', 0);
END;
$function$;