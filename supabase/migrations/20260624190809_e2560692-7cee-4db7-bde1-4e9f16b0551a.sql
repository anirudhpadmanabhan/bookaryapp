
-- 1. Restrict direct rental inserts: force zero/default values; real rentals must go through rent_book RPC
DROP POLICY IF EXISTS "Users insert own rentals" ON public.rentals;
CREATE POLICY "Users insert own rentals"
  ON public.rentals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND price_paid = 0
    AND COALESCE(fine_amount, 0) = 0
    AND returned_at IS NULL
    AND tracking_status IN ('pending','reserved')
  );

-- 2. Revoke EXECUTE from anon/authenticated/PUBLIC on internal helpers + trigger functions
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    '_actor_name(uuid)',
    '_book_meta(uuid)',
    '_fanout_staff_notify(uuid,text,text,text,uuid,text)',
    'assign_next_waitlist()',
    'expire_stale_reservations()',
    'handle_new_user()',
    'has_role(uuid,public.app_role)',
    'has_role_in_library(uuid,public.app_role,uuid)',
    'log_book_change()',
    'log_rental_change()',
    'log_role_change()',
    'log_waitlist_change()',
    'my_librarian_library_ids(uuid)',
    'notify_rental_created()',
    'notify_rental_status()',
    'prevent_admin_role_escalation()',
    'rentals_restrict_user_updates()',
    'set_updated_at()',
    'sync_profile_card()',
    'admin_set_user_role(text,public.app_role,boolean)',
    'admin_grant_librarian(text)',
    'admin_revoke_librarian(text)',
    'admin_grant_librarian_for_library(text,uuid)',
    'admin_revoke_librarian_for_library(text,uuid)',
    'admin_list_librarians()',
    'admin_list_users()',
    'admin_list_staff_roles()',
    'library_members(uuid)',
    'staff_user_summary(uuid)',
    'librarian_mark_returned(uuid)',
    'librarian_decide_suggestion(uuid,text,text)'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip missing %', fn;
    END;
  END LOOP;
END$$;

-- 3. Re-grant EXECUTE to authenticated only for admin/librarian/staff RPCs (server validates role inside)
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text,public.app_role,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian_for_library(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian_for_library(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_librarians() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_user_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_mark_returned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid,text,text) TO authenticated;
