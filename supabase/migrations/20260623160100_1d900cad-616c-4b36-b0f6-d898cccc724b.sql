
-- 1) Wallet integrity: prevent client-side wallet inflation
ALTER TABLE public.profiles ADD CONSTRAINT profiles_wallet_nonneg CHECK (wallet_balance >= 0);
REVOKE UPDATE (wallet_balance) ON public.profiles FROM anon, authenticated;

-- Top-up RPC with bounded amount (mock UPI cap)
CREATE OR REPLACE FUNCTION public.top_up_wallet(_amount numeric)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  RETURN new_bal;
END;
$$;

-- Rent RPC: server-side wallet debit + rental insert + optional profile updates
CREATE OR REPLACE FUNCTION public.rent_book(_book_id uuid, _address text DEFAULT NULL, _phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  bal numeric; price numeric; cur_addr text; existing_user uuid; clean_addr text; clean_phone text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;

  SELECT wallet_balance, address INTO bal, cur_addr
    FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  SELECT COALESCE(rent_price, 10) INTO price FROM public.books WHERE id = _book_id;
  IF price IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;

  SELECT user_id INTO existing_user
    FROM public.rentals WHERE book_id = _book_id AND returned_at IS NULL LIMIT 1;
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

  RETURN jsonb_build_object('ok', true, 'price', price);
END;
$$;

-- 2) Lock down SECURITY DEFINER function EXECUTE grants
-- Internal helpers and trigger functions: revoke entirely
REVOKE EXECUTE ON FUNCTION public._actor_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._book_meta(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._fanout_staff_notify(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_rental_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_rental_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_next_waitlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_book_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_rental_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_waitlist_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_admin_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rentals_restrict_user_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_card() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- User-callable RPCs: restrict to authenticated only (no anon)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role_in_library(uuid, public.app_role, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_phone(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_my_due_reminders() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reading_insights(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_user_summary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.librarian_mark_returned(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.library_members(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_librarians() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_staff_roles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_librarian(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_librarian(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_librarian_for_library(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_librarian_for_library(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(text, public.app_role, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.top_up_wallet(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rent_book(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_library(uuid, public.app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_my_due_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reading_insights(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_user_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_mark_returned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_librarians() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian_for_library(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian_for_library(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, public.app_role, boolean) TO authenticated;
