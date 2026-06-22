
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker = on) AS
  SELECT id, display_name, tag, created_at FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_next_waitlist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Reviews readable by all" ON public.reviews;
CREATE POLICY "Reviews readable by authenticated"
  ON public.reviews FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.reviews FROM anon;

REVOKE UPDATE ON public.rentals FROM authenticated;
GRANT UPDATE (delivery_address) ON public.rentals TO authenticated;
GRANT ALL ON public.rentals TO service_role;

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins assign non-admin roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'admin'::app_role);
CREATE POLICY "Admins update non-admin roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'admin'::app_role)
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'admin'::app_role);
CREATE POLICY "Admins delete non-admin roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'admin'::app_role);
