
-- 1. Restrict profile_cards to authenticated users
DROP POLICY IF EXISTS "Profile cards readable by all" ON public.profile_cards;
REVOKE SELECT ON public.profile_cards FROM anon;
CREATE POLICY "Profile cards readable by authenticated"
  ON public.profile_cards FOR SELECT TO authenticated USING (true);

-- 2. Harden user_roles against admin escalation via UPDATE (defense in depth on top of existing WITH CHECK)
CREATE OR REPLACE FUNCTION public.prevent_admin_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role = 'admin'::public.app_role AND OLD.role <> 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Cannot escalate role to admin via UPDATE. Use admin_set_user_role().';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_prevent_escalation ON public.user_roles;
CREATE TRIGGER user_roles_prevent_escalation
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_role_escalation();

-- 3. Revoke EXECUTE on privileged SECURITY DEFINER functions from anon/authenticated.
--    These functions internally check has_role(admin) and raise on unauthorized callers, but we
--    also revoke direct EXECUTE so they are not callable as public RPCs. Service role retains access.
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(text, public.app_role, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_grant_librarian(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_librarian(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_librarians() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_staff_roles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.staff_user_summary(uuid) FROM PUBLIC, anon, authenticated;

-- Internal triggers/helpers should not be callable as RPCs either
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_next_waitlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_card() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rentals_restrict_user_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_admin_role_escalation() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies (runs as definer there); revoke direct client EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
