
-- 1. Wallet balance lockdown
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, tag, phone, address, avatar_url) ON public.profiles TO authenticated;

-- 2. Block javascript: / data: URLs for ad CTAs
ALTER TABLE public.advertisements DROP CONSTRAINT IF EXISTS ads_cta_url_safe;
ALTER TABLE public.advertisements ADD CONSTRAINT ads_cta_url_safe
  CHECK (cta_url IS NULL OR cta_url ~* '^https?://');

-- 3. Only admins can manage global (library_id IS NULL) ads
DROP POLICY IF EXISTS "Staff can insert ads" ON public.advertisements;
DROP POLICY IF EXISTS "Staff can update ads" ON public.advertisements;
DROP POLICY IF EXISTS "Staff can delete ads" ON public.advertisements;

CREATE POLICY "Staff can insert ads" ON public.advertisements
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE
      WHEN library_id IS NULL THEN has_role(auth.uid(), 'admin'::app_role)
      ELSE has_role(auth.uid(), 'admin'::app_role)
        OR has_role_in_library(auth.uid(), 'librarian'::app_role, library_id)
    END
  );

CREATE POLICY "Staff can update ads" ON public.advertisements
  FOR UPDATE TO authenticated
  USING (
    CASE
      WHEN library_id IS NULL THEN has_role(auth.uid(), 'admin'::app_role)
      ELSE has_role(auth.uid(), 'admin'::app_role)
        OR has_role_in_library(auth.uid(), 'librarian'::app_role, library_id)
    END
  )
  WITH CHECK (
    CASE
      WHEN library_id IS NULL THEN has_role(auth.uid(), 'admin'::app_role)
      ELSE has_role(auth.uid(), 'admin'::app_role)
        OR has_role_in_library(auth.uid(), 'librarian'::app_role, library_id)
    END
  );

CREATE POLICY "Staff can delete ads" ON public.advertisements
  FOR DELETE TO authenticated
  USING (
    CASE
      WHEN library_id IS NULL THEN has_role(auth.uid(), 'admin'::app_role)
      ELSE has_role(auth.uid(), 'admin'::app_role)
        OR has_role_in_library(auth.uid(), 'librarian'::app_role, library_id)
    END
  );

-- 4. Avatars: owner-only reads (avatars are only displayed on own profile in this app)
DROP POLICY IF EXISTS avatars_read_any_authenticated ON storage.objects;
CREATE POLICY avatars_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- 5. Revoke EXECUTE on user-facing SECURITY DEFINER RPCs from anon
REVOKE EXECUTE ON FUNCTION public.claim_reservation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decline_reservation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rent_book(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.top_up_wallet(numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_phone(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_my_due_reminders() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.waitlist_position(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reading_insights(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_user_summary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.library_members(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.librarian_mark_returned(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.librarian_decide_suggestion(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(text, app_role, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_librarian(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_librarian(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_librarian_for_library(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_librarian_for_library(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_librarians() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_staff_roles() FROM PUBLIC, anon;

-- Revoke EXECUTE on internal trigger/maintenance functions from end-user roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_rental_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_rental_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_card() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rentals_restrict_user_updates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_next_waitlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_admin_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_book_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_rental_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_waitlist_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._fanout_staff_notify(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_reservations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._book_meta(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._actor_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
