
-- ============ TRANSACTION LOG ============
CREATE TABLE IF NOT EXISTS public.transaction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  subject_user_id uuid,
  subject_user_name text,
  book_id uuid,
  book_title text,
  library_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.transaction_log TO authenticated;
GRANT ALL ON public.transaction_log TO service_role;

ALTER TABLE public.transaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read transaction log"
  ON public.transaction_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'librarian'::public.app_role));

CREATE INDEX IF NOT EXISTS transaction_log_created_at_idx ON public.transaction_log (created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_log_subject_idx ON public.transaction_log (subject_user_id);
CREATE INDEX IF NOT EXISTS transaction_log_book_idx ON public.transaction_log (book_id);

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public._actor_name(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    (SELECT display_name FROM public.profiles WHERE id = _uid),
    (SELECT split_part(email,'@',1) FROM auth.users WHERE id = _uid),
    'system'
  );
$$;

CREATE OR REPLACE FUNCTION public._book_meta(_book_id uuid)
RETURNS TABLE(title text, library_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT title, library_id FROM public.books WHERE id = _book_id;
$$;

CREATE OR REPLACE FUNCTION public._fanout_staff_notify(_library_id uuid, _kind text, _title text, _body text, _book_id uuid, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE ur.role IN ('admin'::public.app_role,'librarian'::public.app_role)
  LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
    VALUES (r.user_id, _kind, _title, _body, _book_id, _link);
  END LOOP;
END;
$$;

-- ============ Trigger functions ============
CREATE OR REPLACE FUNCTION public.log_rental_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  actor_uid uuid := auth.uid();
  actor text := public._actor_name(auth.uid());
  subj text := public._actor_name(COALESCE(NEW.user_id, OLD.user_id));
  bmeta record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT title, library_id INTO bmeta FROM public.books WHERE id = NEW.book_id;
    INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, book_id, book_title, library_id, action, metadata)
    VALUES (actor_uid, actor, NEW.user_id, subj, NEW.book_id, bmeta.title, bmeta.library_id, 'rental_created',
            jsonb_build_object('price_paid', NEW.price_paid, 'due_at', NEW.due_at));
    PERFORM public._fanout_staff_notify(bmeta.library_id, 'rental_created',
      'New rental: ' || COALESCE(bmeta.title,'book'),
      subj || ' rented "' || COALESCE(bmeta.title,'book') || '".',
      NEW.book_id, '/admin');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
      SELECT title, library_id INTO bmeta FROM public.books WHERE id = NEW.book_id;
      INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, book_id, book_title, library_id, action, metadata)
      VALUES (actor_uid, actor, NEW.user_id, subj, NEW.book_id, bmeta.title, bmeta.library_id, 'rental_returned', '{}'::jsonb);
      PERFORM public._fanout_staff_notify(bmeta.library_id, 'rental_returned',
        'Returned: ' || COALESCE(bmeta.title,'book'),
        subj || ' returned "' || COALESCE(bmeta.title,'book') || '".',
        NEW.book_id, '/admin');
    ELSIF OLD.tracking_status IS DISTINCT FROM NEW.tracking_status THEN
      SELECT title, library_id INTO bmeta FROM public.books WHERE id = NEW.book_id;
      INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, book_id, book_title, library_id, action, metadata)
      VALUES (actor_uid, actor, NEW.user_id, subj, NEW.book_id, bmeta.title, bmeta.library_id, 'rental_status',
              jsonb_build_object('from', OLD.tracking_status, 'to', NEW.tracking_status));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_rental_change ON public.rentals;
CREATE TRIGGER trg_log_rental_change
AFTER INSERT OR UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.log_rental_change();

CREATE OR REPLACE FUNCTION public.log_waitlist_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  actor_uid uuid := auth.uid();
  actor text := public._actor_name(auth.uid());
  subj text;
  bmeta record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    subj := public._actor_name(NEW.user_id);
    SELECT title, library_id INTO bmeta FROM public.books WHERE id = NEW.book_id;
    INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, book_id, book_title, library_id, action)
    VALUES (actor_uid, actor, NEW.user_id, subj, NEW.book_id, bmeta.title, bmeta.library_id, 'waitlist_joined');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    subj := public._actor_name(OLD.user_id);
    SELECT title, library_id INTO bmeta FROM public.books WHERE id = OLD.book_id;
    INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, book_id, book_title, library_id, action)
    VALUES (actor_uid, actor, OLD.user_id, subj, OLD.book_id, bmeta.title, bmeta.library_id,
            CASE WHEN actor_uid = OLD.user_id THEN 'waitlist_cancelled' ELSE 'waitlist_assigned' END);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_waitlist_change ON public.waitlist;
CREATE TRIGGER trg_log_waitlist_change
AFTER INSERT OR DELETE ON public.waitlist
FOR EACH ROW EXECUTE FUNCTION public.log_waitlist_change();

CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  actor_uid uuid := auth.uid();
  actor text := public._actor_name(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, action, metadata)
    VALUES (actor_uid, actor, NEW.user_id, public._actor_name(NEW.user_id), 'role_granted',
            jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.transaction_log (actor_id, actor_name, subject_user_id, subject_user_name, action, metadata)
    VALUES (actor_uid, actor, OLD.user_id, public._actor_name(OLD.user_id), 'role_revoked',
            jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_change ON public.user_roles;
CREATE TRIGGER trg_log_role_change
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

CREATE OR REPLACE FUNCTION public.log_book_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  actor_uid uuid := auth.uid();
  actor text := public._actor_name(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transaction_log (actor_id, actor_name, book_id, book_title, library_id, action)
    VALUES (actor_uid, actor, NEW.id, NEW.title, NEW.library_id, 'book_created');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.transaction_log (actor_id, actor_name, book_id, book_title, library_id, action, metadata)
    VALUES (actor_uid, actor, NEW.id, NEW.title, NEW.library_id, 'book_updated',
            jsonb_build_object('shelf_code', NEW.shelf_code));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.transaction_log (actor_id, actor_name, book_id, book_title, library_id, action)
    VALUES (actor_uid, actor, OLD.id, OLD.title, OLD.library_id, 'book_deleted');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_book_change ON public.books;
CREATE TRIGGER trg_log_book_change
AFTER INSERT OR UPDATE OR DELETE ON public.books
FOR EACH ROW EXECUTE FUNCTION public.log_book_change();

-- Lock down helper functions
REVOKE EXECUTE ON FUNCTION public._actor_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._book_meta(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._fanout_staff_notify(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_rental_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_waitlist_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_book_change() FROM PUBLIC, anon, authenticated;

-- ============ admin_list_users ============
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  wallet_balance numeric,
  roles public.app_role[],
  created_at timestamptz,
  active_rentals bigint,
  total_rentals bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can list users';
  END IF;
  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      p.display_name,
      COALESCE(p.wallet_balance, 0)::numeric,
      COALESCE((SELECT array_agg(ur.role ORDER BY ur.role) FROM public.user_roles ur WHERE ur.user_id = u.id), ARRAY[]::public.app_role[]),
      u.created_at,
      (SELECT count(*) FROM public.rentals r WHERE r.user_id = u.id AND r.returned_at IS NULL),
      (SELECT count(*) FROM public.rentals r WHERE r.user_id = u.id)
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ============ Realtime ============
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rentals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_log;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
