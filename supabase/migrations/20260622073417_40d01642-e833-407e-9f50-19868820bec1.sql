-- Backfill the known owner account immediately so the admin panel appears after sign-in.
DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id
  FROM auth.users
  WHERE lower(email) = 'anirudhpkndl@gmail.com'
  LIMIT 1;

  IF owner_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, display_name, wallet_balance)
    VALUES (owner_id, 'Anirudh PK', 100)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (owner_id, 'admin'::public.app_role), (owner_id, 'librarian'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Keep the signup/profile helper current and ensure the owner account always receives both staff roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    100
  )
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'anirudhpkndl@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role), (NEW.id, 'librarian'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Admin role-management list: shows every user who has admin and/or librarian access.
CREATE OR REPLACE FUNCTION public.admin_list_staff_roles()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  roles public.app_role[],
  granted_at timestamptz
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
      array_agg(ur.role ORDER BY ur.role)::public.app_role[] AS roles,
      min(ur.created_at) AS granted_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('admin'::public.app_role, 'librarian'::public.app_role)
    GROUP BY u.id, u.email, p.display_name
    ORDER BY min(ur.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_staff_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_roles() TO authenticated;

-- Admin role-management action: grants or revokes admin/librarian by email.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_email text, _role public.app_role, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  admin_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can manage roles';
  END IF;

  IF _role NOT IN ('admin'::public.app_role, 'librarian'::public.app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admin and librarian roles can be managed here.');
  END IF;

  SELECT id INTO target_id
  FROM auth.users
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user with that email. Ask them to sign in once first.');
  END IF;

  INSERT INTO public.profiles (id, display_name, wallet_balance)
  SELECT target_id, COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 100
  FROM auth.users
  WHERE id = target_id
  ON CONFLICT (id) DO NOTHING;

  IF _enabled THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF _role = 'admin'::public.app_role THEN
      SELECT count(*) INTO admin_count
      FROM public.user_roles
      WHERE role = 'admin'::public.app_role;

      IF admin_count <= 1 AND EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = target_id AND role = 'admin'::public.app_role
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Cannot remove the final admin account.');
      END IF;
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = target_id AND role = _role;
  END IF;

  RETURN jsonb_build_object('ok', true, 'user_id', target_id, 'role', _role, 'enabled', _enabled);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(text, public.app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, public.app_role, boolean) TO authenticated;

-- Keep old librarian-only buttons working through the new role manager.
CREATE OR REPLACE FUNCTION public.admin_grant_librarian(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_set_user_role(_email, 'librarian'::public.app_role, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_librarian(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_set_user_role(_email, 'librarian'::public.app_role, false);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_librarian(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_librarian(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_librarian(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_librarian(text) TO authenticated;