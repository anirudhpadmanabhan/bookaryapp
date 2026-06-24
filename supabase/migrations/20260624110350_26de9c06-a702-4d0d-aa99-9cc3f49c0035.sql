
-- ===== 1) Avatars: allow authenticated users to read any avatar =====
DROP POLICY IF EXISTS "avatars_read_authenticated" ON storage.objects;
CREATE POLICY "avatars_read_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- ===== 2) user_roles: forbid self-modification (defense in depth) =====
-- Admin role grants go through admin_set_user_role / admin_*_librarian* (SECURITY DEFINER), which bypass RLS.
DROP POLICY IF EXISTS "Block self-modification of roles" ON public.user_roles;
CREATE POLICY "Block self-modification of roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (user_id <> auth.uid())
  WITH CHECK (user_id <> auth.uid());

-- ===== 3) Lock down SECURITY DEFINER functions =====
-- Trigger / internal helpers: not meant to be called over the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_rental_status()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_rental_created()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_card()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_admin_role_escalation()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rentals_restrict_user_updates()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_next_waitlist()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_waitlist_change()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_role_change()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_book_change()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_rental_change()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._actor_name(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._fanout_staff_notify(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._book_meta(uuid)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_reservations()             FROM PUBLIC, anon, authenticated;

-- User-facing RPCs: restrict to signed-in users only (revoke from anon/PUBLIC).
REVOKE EXECUTE ON FUNCTION public.rent_book(uuid, text, text)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_reservation(uuid)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decline_reservation(uuid)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.top_up_wallet(numeric)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_my_due_reminders()              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_phone(text)                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.waitlist_position(uuid)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reading_insights(uuid)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_user_summary(uuid)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.library_members(uuid)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.librarian_mark_returned(uuid)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(text, app_role, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_librarian(text)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_librarian(text)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_librarian_for_library(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_librarian_for_library(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_librarians()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users()                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_staff_roles()                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_librarian_library_ids(uuid)          FROM PUBLIC, anon;

-- Ensure the authenticated grants remain (idempotent).
GRANT EXECUTE ON FUNCTION public.rent_book(uuid, text, text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reservation(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_reservation(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_up_wallet(numeric)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_my_due_reminders()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_phone(text)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_position(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.reading_insights(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_user_summary(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_members(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_mark_returned(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian(text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian(text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian_for_library(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian_for_library(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_librarians()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_roles()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_librarian_library_ids(uuid)          TO authenticated;

-- Shared helpers that RLS uses or the public homepage needs: keep callable by anon + authenticated.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_library(uuid, app_role, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_data(uuid, integer, integer)        TO anon, authenticated;
