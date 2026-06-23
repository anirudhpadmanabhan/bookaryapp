
-- Notification flow improvements
-- 1. Add reminder_sent_at to rentals to debounce 5-day reminders
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS delivered_notified_at timestamptz;

-- 2. Trigger on rental INSERT: confirm to user
CREATE OR REPLACE FUNCTION public.notify_rental_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE btitle text;
BEGIN
  SELECT title INTO btitle FROM public.books WHERE id = NEW.book_id;
  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (NEW.user_id, 'rental_confirmed',
          'Rental confirmed — ' || COALESCE(btitle,'your book'),
          'We received your request. You''ll get a notification when the book is on its way and another when it''s delivered.',
          NEW.book_id, '/profile');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_rental_created() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_rental_created ON public.rentals;
CREATE TRIGGER trg_notify_rental_created
AFTER INSERT ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.notify_rental_created();

-- 3. Update notify_rental_status: when delivered, also push a due-date notification (once)
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
            'Status changed to "' || replace(NEW.tracking_status,'_',' ') || '".',
            NEW.book_id, '/profile');
    IF NEW.tracking_status = 'delivered' AND NEW.delivered_notified_at IS NULL THEN
      INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
      VALUES (NEW.user_id, 'rental_due',
              'Delivered — return by ' || to_char(NEW.due_at,'DD Mon YYYY'),
              'Enjoy! Please return "' || COALESCE(bmeta.title,'the book') || '" by ' ||
              to_char(NEW.due_at,'DD Mon YYYY') || '. Late fee: ₹1/day after 20 days.',
              NEW.book_id, '/profile');
      NEW.delivered_notified_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_rental_status ON public.rentals;
CREATE TRIGGER trg_notify_rental_status
BEFORE UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.notify_rental_status();

-- 4. Reminder dispatch: anyone authenticated may call; only inserts notifications for the caller's own rentals
CREATE OR REPLACE FUNCTION public.enqueue_my_due_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n_inserted int := 0; r record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  FOR r IN
    SELECT rt.id, rt.book_id, rt.due_at, b.title
    FROM public.rentals rt
    LEFT JOIN public.books b ON b.id = rt.book_id
    WHERE rt.user_id = auth.uid()
      AND rt.returned_at IS NULL
      AND rt.reminder_sent_at IS NULL
      AND rt.due_at <= now() + interval '5 days'
      AND rt.due_at >= now() - interval '1 day'
  LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
    VALUES (auth.uid(), 'rental_reminder',
            'Due soon — ' || COALESCE(r.title,'your rental'),
            'Return by ' || to_char(r.due_at,'DD Mon YYYY') || ' to avoid a ₹1/day late fee.',
            r.book_id, '/profile');
    UPDATE public.rentals SET reminder_sent_at = now() WHERE id = r.id;
    n_inserted := n_inserted + 1;
  END LOOP;
  RETURN n_inserted;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enqueue_my_due_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_my_due_reminders() TO authenticated;
