
-- 1) Rent period starts when librarian marks delivered.
--    Trigger sets rented_at = now() and due_at = now()+30d on transition to 'delivered'
--    (only if not already delivered). This applies to rent_book/log_rental flows.
CREATE OR REPLACE FUNCTION public.rentals_reset_dates_on_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_status = 'delivered'
     AND (OLD.tracking_status IS DISTINCT FROM 'delivered')
     AND OLD.returned_at IS NULL THEN
    NEW.rented_at := now();
    NEW.due_at := now() + interval '30 days';
    NEW.last_reminder_days := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rentals_reset_dates_on_delivered ON public.rentals;
CREATE TRIGGER trg_rentals_reset_dates_on_delivered
BEFORE UPDATE ON public.rentals
FOR EACH ROW
EXECUTE FUNCTION public.rentals_reset_dates_on_delivered();

-- 2) Allow the trigger to reset rented_at/due_at even when a librarian/admin updates
--    via the restrict trigger. It already permits staff full access, so it's fine.

-- 3) Fix ads RLS: allow librarians to insert ads (with any library_id, since our
--    current app uses a single library scope per session). Keep policy check
--    permissive for staff, since staff already gate insert via UI.
DROP POLICY IF EXISTS "Staff can insert ads" ON public.advertisements;
CREATE POLICY "Staff can insert ads"
ON public.advertisements
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'librarian'::app_role)
);

DROP POLICY IF EXISTS "Staff can update ads" ON public.advertisements;
CREATE POLICY "Staff can update ads"
ON public.advertisements
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'librarian'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'librarian'::app_role)
);

DROP POLICY IF EXISTS "Staff can delete ads" ON public.advertisements;
CREATE POLICY "Staff can delete ads"
ON public.advertisements
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'librarian'::app_role)
);
