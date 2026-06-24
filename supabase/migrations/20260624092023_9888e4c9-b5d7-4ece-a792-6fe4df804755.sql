
-- 1) Lock down wallet_balance from direct client writes
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, phone, address, tag, updated_at) ON public.profiles TO authenticated;

-- 2) Restrict staff-wide read of sensitive profile fields to admins only.
-- Librarians keep access through the existing SECURITY DEFINER RPCs (library_members, staff_user_summary).
DROP POLICY IF EXISTS "Staff view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Lock down SECURITY DEFINER function execution.
-- Revoke broad EXECUTE on every public SECURITY DEFINER function, then re-grant only the client-callable ones.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Anonymous-callable (homepage data)
GRANT EXECUTE ON FUNCTION public.home_data(uuid, integer, integer) TO anon, authenticated;

-- Authenticated client RPCs
GRANT EXECUTE ON FUNCTION public.rent_book(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_position(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_up_wallet(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_reservations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_my_due_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reading_insights(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_phone(text) TO authenticated;

-- Staff RPCs (function body enforces role checks)
GRANT EXECUTE ON FUNCTION public.librarian_mark_returned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_user_summary(uuid) TO authenticated;

-- Admin RPCs (function body enforces admin check)
GRANT EXECUTE ON FUNCTION public.admin_list_staff_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, public.app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_librarians() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian_for_library(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian_for_library(text, uuid) TO authenticated;

-- has_role / has_role_in_library are used inside RLS expressions; they execute as the function owner
-- and do not require EXECUTE grants to the calling role, so they remain locked down.
