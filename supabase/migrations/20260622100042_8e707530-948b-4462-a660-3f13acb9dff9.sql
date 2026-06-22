
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, public.app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_librarians() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_user_summary(uuid) TO authenticated;
-- has_role is needed by client-side checks in some flows; safe (read-only existence check on caller's row scope is fine, but it can check any uuid). Keep revoked from anon; allow authenticated.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
