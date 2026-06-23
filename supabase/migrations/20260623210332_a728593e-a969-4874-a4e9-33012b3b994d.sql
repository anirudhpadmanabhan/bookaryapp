
CREATE OR REPLACE FUNCTION public.notify_rental_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE btitle text;
BEGIN
  IF NEW.tracking_status = 'reserved' THEN
    RETURN NEW;
  END IF;
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
