
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, tag, address, phone) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_library(uuid, public.app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_up_wallet(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rent_book(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_my_due_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reading_insights(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_user_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_mark_returned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_librarians() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, public.app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian_for_library(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian_for_library(text, uuid) TO authenticated;
