-- Restore access to the home catalog summary used by the home page.
GRANT EXECUTE ON FUNCTION public.home_data(uuid, int, int) TO anon, authenticated;

-- Availability is only needed after sign-in for waitlist/rent decisions.
REVOKE EXECUTE ON FUNCTION public.book_availability(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_availability(uuid) TO authenticated;