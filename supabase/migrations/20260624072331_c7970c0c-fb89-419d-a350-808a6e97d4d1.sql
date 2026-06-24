
-- Flat ₹10 rental fee, idempotent debit, transaction audit
CREATE OR REPLACE FUNCTION public.rent_book(_book_id uuid, _address text DEFAULT NULL::text, _phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bal numeric;
  cur_addr text;
  existing_user uuid;
  clean_addr text;
  clean_phone text;
  btitle text;
  blib uuid;
  price constant numeric := 10;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;

  -- Lock the wallet row first to serialize concurrent Rent Now clicks
  SELECT wallet_balance, address INTO bal, cur_addr
    FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  SELECT title, library_id INTO btitle, blib FROM public.books WHERE id = _book_id;
  IF btitle IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;

  -- Block duplicate / concurrent rental of same copy
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

  IF bal < price THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  clean_addr := NULLIF(trim(COALESCE(_address, '')), '');
  clean_phone := NULLIF(trim(COALESCE(_phone, '')), '');

  INSERT INTO public.rentals (user_id, book_id, price_paid, delivery_address, tracking_status)
  VALUES (auth.uid(), _book_id, price, COALESCE(clean_addr, cur_addr), 'confirmed');

  UPDATE public.profiles
     SET wallet_balance = wallet_balance - price,
         address = COALESCE(clean_addr, address),
         phone = COALESCE(clean_phone, phone),
         updated_at = now()
   WHERE id = auth.uid();

  -- Audit the wallet debit
  INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, book_id, book_title, library_id, action, metadata)
  VALUES (auth.uid(), public._actor_name(auth.uid()), auth.uid(), public._actor_name(auth.uid()),
          _book_id, btitle, blib, 'wallet_debit',
          jsonb_build_object('amount', price, 'reason', 'rental', 'balance_after', bal - price));

  RETURN jsonb_build_object('ok', true, 'price', price, 'balance', bal - price);
END;
$function$;

-- Claim reservation: also flat ₹10 with audit
CREATE OR REPLACE FUNCTION public.claim_reservation(_rental_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.rentals%ROWTYPE;
  bal numeric;
  btitle text;
  blib uuid;
  price constant numeric := 10;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO r FROM public.rentals WHERE id = _rental_id FOR UPDATE;
  IF r.id IS NULL OR r.user_id <> auth.uid() THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF r.tracking_status <> 'reserved' THEN RAISE EXCEPTION 'Reservation already handled'; END IF;
  IF r.reserved_until IS NOT NULL AND r.reserved_until < now() THEN
    RAISE EXCEPTION 'Reservation expired';
  END IF;

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

  SELECT title, library_id INTO btitle, blib FROM public.books WHERE id = r.book_id;
  INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, book_id, book_title, library_id, action, metadata)
  VALUES (auth.uid(), public._actor_name(auth.uid()), auth.uid(), public._actor_name(auth.uid()),
          r.book_id, btitle, blib, 'wallet_debit',
          jsonb_build_object('amount', price, 'reason', 'reservation_claim', 'balance_after', bal - price));

  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (auth.uid(), 'rental_confirmed', 'Claim confirmed — ' || COALESCE(btitle,'your book'),
          'Your reservation is now an active rental.', r.book_id, '/profile');

  RETURN jsonb_build_object('ok', true, 'price', price, 'balance', bal - price);
END;
$function$;

-- Audit wallet top-ups too
CREATE OR REPLACE FUNCTION public.top_up_wallet(_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 5000 THEN
    RAISE EXCEPTION 'Top-up amount must be between 1 and 5000';
  END IF;
  UPDATE public.profiles
     SET wallet_balance = COALESCE(wallet_balance, 0) + _amount,
         updated_at = now()
   WHERE id = auth.uid()
   RETURNING wallet_balance INTO new_bal;

  INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, action, metadata)
  VALUES (auth.uid(), public._actor_name(auth.uid()), auth.uid(), public._actor_name(auth.uid()),
          'wallet_topup', jsonb_build_object('amount', _amount, 'balance_after', new_bal));

  RETURN new_bal;
END;
$function$;
