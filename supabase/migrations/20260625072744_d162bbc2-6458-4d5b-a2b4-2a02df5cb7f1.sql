-- Block direct rental inserts: rentals must go through rent_book/claim_reservation RPCs
DROP POLICY IF EXISTS "Users insert own rentals" ON public.rentals;

-- Allow librarians to view profiles (needed for member management)
CREATE POLICY "Librarians view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'librarian'::public.app_role));