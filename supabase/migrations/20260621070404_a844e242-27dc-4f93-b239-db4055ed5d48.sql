
-- 1. Public profile view (safe columns only). security_invoker=off so RLS on profiles doesn't apply.
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker=off) AS
SELECT id, display_name, tag, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 2. Rating column on reading_diary
ALTER TABLE public.reading_diary
  ADD COLUMN IF NOT EXISTS rating integer CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

-- 3. Notifications inbox
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,                       -- 'waitlist_assigned' | 'rental_due_soon' | 'rental_returned' | 'tracking_update' | 'general'
  title text NOT NULL,
  body text,
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  link_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC);

-- 4. Update waitlist assignment trigger to also notify
CREATE OR REPLACE FUNCTION public.assign_next_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  next_row public.waitlist%ROWTYPE;
  book_price numeric;
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

  SELECT rent_price, title INTO book_price, book_title FROM public.books WHERE id = NEW.book_id;

  INSERT INTO public.rentals (user_id, book_id, price_paid, delivery_address, tracking_status)
  VALUES (next_row.user_id, NEW.book_id, COALESCE(book_price, 10), next_row.delivery_address, 'confirmed');

  DELETE FROM public.waitlist WHERE id = next_row.id;

  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (
    next_row.user_id,
    'waitlist_assigned',
    'A waitlisted book is now yours',
    COALESCE(book_title, 'Your book') || ' has been returned and assigned to you. Tracking is in your profile.',
    NEW.book_id,
    '/profile'
  );

  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists on rentals (was inferred but let's be explicit)
DROP TRIGGER IF EXISTS rentals_assign_waitlist ON public.rentals;
CREATE TRIGGER rentals_assign_waitlist
  AFTER UPDATE OF returned_at ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_next_waitlist();
