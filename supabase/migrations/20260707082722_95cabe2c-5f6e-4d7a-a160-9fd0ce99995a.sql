GRANT EXECUTE ON FUNCTION public.has_role_in_library(uuid, public.app_role, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;