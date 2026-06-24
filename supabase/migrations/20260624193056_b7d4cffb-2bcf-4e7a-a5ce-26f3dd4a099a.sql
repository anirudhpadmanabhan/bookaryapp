GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rentals TO authenticated;
GRANT ALL ON public.rentals TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;