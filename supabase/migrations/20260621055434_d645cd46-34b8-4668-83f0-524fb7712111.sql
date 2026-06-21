
-- 1. Flat rent price ₹10 for all books
UPDATE public.books SET rent_price = 10;
ALTER TABLE public.books ALTER COLUMN rent_price SET DEFAULT 10;

-- 2. Default wallet ₹100 + top up existing under-funded wallets
ALTER TABLE public.profiles ALTER COLUMN wallet_balance SET DEFAULT 100;
UPDATE public.profiles SET wallet_balance = 100 WHERE wallet_balance < 100;

-- 3. Profile tag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tag text;

-- Update profile auto-creator to seed ₹100
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    100
  );
  RETURN NEW;
END;
$function$;

-- 4. Waitlist table
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  delivery_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own waitlist"
  ON public.waitlist FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS waitlist_book_created_idx ON public.waitlist(book_id, created_at);

-- 5. Auto-assign next person in waitlist when a rental is returned
CREATE OR REPLACE FUNCTION public.assign_next_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_row public.waitlist%ROWTYPE;
  book_price numeric;
BEGIN
  -- Only act when a rental transitions to returned
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

  SELECT rent_price INTO book_price FROM public.books WHERE id = NEW.book_id;

  INSERT INTO public.rentals (user_id, book_id, price_paid, delivery_address, tracking_status)
  VALUES (next_row.user_id, NEW.book_id, COALESCE(book_price, 10), next_row.delivery_address, 'confirmed');

  DELETE FROM public.waitlist WHERE id = next_row.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_next_waitlist ON public.rentals;
CREATE TRIGGER trg_assign_next_waitlist
AFTER UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.assign_next_waitlist();
