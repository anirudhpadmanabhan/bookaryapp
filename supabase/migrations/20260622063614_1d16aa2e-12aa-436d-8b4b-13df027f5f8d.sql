
REVOKE UPDATE (delivery_address) ON public.rentals FROM authenticated;
GRANT UPDATE ON public.rentals TO authenticated;

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
REVOKE ALL ON FUNCTION public.rentals_restrict_user_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rentals_restrict_user_updates ON public.rentals;
CREATE TRIGGER trg_rentals_restrict_user_updates
  BEFORE UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.rentals_restrict_user_updates();
