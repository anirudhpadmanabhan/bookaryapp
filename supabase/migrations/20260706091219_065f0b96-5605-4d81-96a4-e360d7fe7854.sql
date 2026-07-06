
-- Availability column on books
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'available';
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_availability_check;
ALTER TABLE public.books ADD CONSTRAINT books_availability_check CHECK (availability IN ('available','out_of_stock','rented'));

-- library_posts
CREATE TABLE IF NOT EXISTS public.library_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text,
  body text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_posts TO authenticated;
GRANT ALL ON public.library_posts TO service_role;
ALTER TABLE public.library_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view library posts" ON public.library_posts FOR SELECT USING (true);
CREATE POLICY "Staff can insert library posts" ON public.library_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role_in_library(auth.uid(),'librarian'::app_role, library_id));
CREATE POLICY "Staff can update library posts" ON public.library_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role_in_library(auth.uid(),'librarian'::app_role, library_id));
CREATE POLICY "Staff can delete library posts" ON public.library_posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role_in_library(auth.uid(),'librarian'::app_role, library_id));

CREATE TRIGGER library_posts_touch BEFORE UPDATE ON public.library_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- library_post_likes
CREATE TABLE IF NOT EXISTS public.library_post_likes (
  post_id uuid NOT NULL REFERENCES public.library_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.library_post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.library_post_likes TO authenticated;
GRANT ALL ON public.library_post_likes TO service_role;
ALTER TABLE public.library_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view likes" ON public.library_post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like" ON public.library_post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.library_post_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- library_post_comments
CREATE TABLE IF NOT EXISTS public.library_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.library_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_post_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_post_comments TO authenticated;
GRANT ALL ON public.library_post_comments TO service_role;
ALTER TABLE public.library_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments" ON public.library_post_comments FOR SELECT USING (true);
CREATE POLICY "Users can comment" ON public.library_post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit own comment" ON public.library_post_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comment or staff" ON public.library_post_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role));

-- librarian_add_member: create a profile row for an existing auth user by email; if not present, return not_found
CREATE OR REPLACE FUNCTION public.librarian_add_member(_email text, _display_name text DEFAULT NULL, _phone text DEFAULT NULL, _address text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
        updated_at = now();
  RETURN jsonb_build_object('ok', true, 'user_id', target_id);
END; $$;

-- librarian_log_rental: staff-only, no wallet debit
CREATE OR REPLACE FUNCTION public.librarian_log_rental(_user_id uuid, _book_id uuid, _rented_at timestamptz DEFAULT now(), _due_at timestamptz DEFAULT NULL, _returned_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; due timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  due := COALESCE(_due_at, _rented_at + interval '20 days');
  INSERT INTO public.rentals (user_id, book_id, price_paid, tracking_status, rented_at, due_at, returned_at)
  VALUES (_user_id, _book_id, 0, CASE WHEN _returned_at IS NOT NULL THEN 'returned' ELSE 'delivered' END, _rented_at, due, _returned_at)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', true, 'rental_id', new_id);
END; $$;

-- librarian_set_return: staff-only edit of returned_at
CREATE OR REPLACE FUNCTION public.librarian_set_return(_rental_id uuid, _returned_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  UPDATE public.rentals SET returned_at = _returned_at,
                            tracking_status = CASE WHEN _returned_at IS NULL THEN 'delivered' ELSE 'returned' END
   WHERE id = _rental_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- librarian_set_availability
CREATE OR REPLACE FUNCTION public.librarian_set_availability(_book_id uuid, _availability text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'librarian'::app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  IF _availability NOT IN ('available','out_of_stock','rented') THEN
    RAISE EXCEPTION 'Invalid availability';
  END IF;
  UPDATE public.books SET availability = _availability, updated_at = now() WHERE id = _book_id;
  RETURN jsonb_build_object('ok', true);
END; $$;
