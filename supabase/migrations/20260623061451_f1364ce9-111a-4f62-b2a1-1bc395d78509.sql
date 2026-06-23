
-- 1. Add optional library scope to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS library_id uuid NULL REFERENCES public.libraries(id) ON DELETE CASCADE;

-- Replace (user_id, role) uniqueness with (user_id, role, library_id) so a
-- librarian can be granted across multiple libraries. NULLs are treated as
-- distinct values, which is fine for the admin role (always NULL library_id).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_role_key;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_library_uidx
  ON public.user_roles (user_id, role, COALESCE(library_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2. Helper: is this user a librarian (or admin) for this library?
CREATE OR REPLACE FUNCTION public.has_role_in_library(_user_id uuid, _role public.app_role, _library_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (library_id IS NULL OR library_id = _library_id)
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role
  );
$$;

-- 3. Admin RPC: grant librarian for a specific library by email
CREATE OR REPLACE FUNCTION public.admin_grant_librarian_for_library(_email text, _library_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  lib_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can manage librarian access';
  END IF;

  SELECT name INTO lib_name FROM public.libraries WHERE id = _library_id;
  IF lib_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Library not found.');
  END IF;

  SELECT id INTO target_id
  FROM auth.users
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email. Ask them to sign in once first.');
  END IF;

  INSERT INTO public.profiles (id, display_name, wallet_balance)
  SELECT target_id,
         COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', split_part(email,'@',1)),
         100
  FROM auth.users WHERE id = target_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, library_id)
  VALUES (target_id, 'librarian'::public.app_role, _library_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'user_id', target_id, 'library_id', _library_id, 'library_name', lib_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_librarian_for_library(_email text, _library_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can manage librarian access';
  END IF;

  SELECT id INTO target_id
  FROM auth.users
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email.');
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_id
    AND role = 'librarian'::public.app_role
    AND library_id = _library_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Update admin_list_staff_roles to include library scope info
DROP FUNCTION IF EXISTS public.admin_list_staff_roles();

CREATE OR REPLACE FUNCTION public.admin_list_staff_roles()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  library_id uuid,
  library_name text,
  granted_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can view staff roles';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      p.display_name,
      ur.role,
      ur.library_id,
      l.name,
      ur.created_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    LEFT JOIN public.libraries l ON l.id = ur.library_id
    WHERE ur.role IN ('admin'::public.app_role, 'librarian'::public.app_role)
    ORDER BY ur.created_at DESC;
END;
$$;
