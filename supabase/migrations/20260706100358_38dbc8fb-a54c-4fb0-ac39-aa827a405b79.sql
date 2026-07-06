CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    0
  )
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'anirudhpkndl@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role), (NEW.id, 'librarian'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.librarian_add_member(_email text, _display_name text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _address text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE target_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  SELECT id INTO target_id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User has not signed in yet. Ask them to sign in once with this email first.');
  END IF;
  INSERT INTO public.profiles (id, display_name, phone, address, wallet_balance)
  VALUES (target_id, COALESCE(NULLIF(trim(_display_name),''), split_part(_email,'@',1)), NULLIF(trim(_phone),''), NULLIF(trim(_address),''), 0)
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(NULLIF(trim(EXCLUDED.display_name),''), public.profiles.display_name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        address = COALESCE(EXCLUDED.address, public.profiles.address),
        wallet_balance = 0,
        updated_at = now();
  RETURN jsonb_build_object('ok', true, 'user_id', target_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_email text, _role app_role, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  SELECT target_id, COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 0
  FROM auth.users
  WHERE id = target_id
  ON CONFLICT (id) DO UPDATE SET wallet_balance = 0, updated_at = now();

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
$function$;

DROP TRIGGER IF EXISTS trg_rentals_restrict_user_updates ON public.rentals;
UPDATE public.rentals SET price_paid = 0, fine_amount = 0;
CREATE TRIGGER trg_rentals_restrict_user_updates
  BEFORE UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.rentals_restrict_user_updates();
