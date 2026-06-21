
-- Restrict execute on internal trigger functions (called only by triggers; not via API)
REVOKE EXECUTE ON FUNCTION public.assign_next_waitlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Keep profiles_public as a curated read-only window onto profiles.
-- The view is intentionally security-definer so only the four safe columns
-- (id, display_name, tag, created_at) are reachable; the base table keeps its
-- own RLS policy that restricts SELECT to the owning user.
COMMENT ON VIEW public.profiles_public IS
  'Public-safe projection of profiles. Intentionally SECURITY DEFINER: exposes only id/display_name/tag/created_at — phone, address, wallet stay private behind RLS on the base table.';
