
-- Advertisements table
CREATE TABLE public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('popup','banner')),
  image_url text NOT NULL,
  image_path text,
  title text,
  description text,
  cta_text text,
  cta_url text,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive')),
  start_date timestamptz,
  end_date timestamptz,
  banner_position text CHECK (banner_position IN ('top','bottom','middle')),
  auto_close_seconds integer NOT NULL DEFAULT 3,
  library_id uuid REFERENCES public.libraries(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.advertisements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Public can read currently active ads
CREATE POLICY "Anyone can view active ads"
ON public.advertisements FOR SELECT
USING (
  status = 'active'
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
);

-- Staff (admin or any librarian) can read all ads they manage
CREATE POLICY "Staff can read all ads"
ON public.advertisements FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'librarian'::public.app_role)
    AND (library_id IS NULL OR public.has_role_in_library(auth.uid(), 'librarian'::public.app_role, library_id))
  )
);

CREATE POLICY "Staff can insert ads"
ON public.advertisements FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'librarian'::public.app_role)
    AND (library_id IS NULL OR public.has_role_in_library(auth.uid(), 'librarian'::public.app_role, library_id))
  )
);

CREATE POLICY "Staff can update ads"
ON public.advertisements FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'librarian'::public.app_role)
    AND (library_id IS NULL OR public.has_role_in_library(auth.uid(), 'librarian'::public.app_role, library_id))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'librarian'::public.app_role)
    AND (library_id IS NULL OR public.has_role_in_library(auth.uid(), 'librarian'::public.app_role, library_id))
  )
);

CREATE POLICY "Staff can delete ads"
ON public.advertisements FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'librarian'::public.app_role)
    AND (library_id IS NULL OR public.has_role_in_library(auth.uid(), 'librarian'::public.app_role, library_id))
  )
);

CREATE TRIGGER advertisements_updated_at
BEFORE UPDATE ON public.advertisements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX advertisements_type_status_idx ON public.advertisements(type, status);

-- Storage policies for 'ads' bucket
CREATE POLICY "Anyone can read ad images"
ON storage.objects FOR SELECT
USING (bucket_id = 'ads');

CREATE POLICY "Staff can upload ad images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ads'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'librarian'::public.app_role)
  )
);

CREATE POLICY "Staff can update ad images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ads'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'librarian'::public.app_role)
  )
);

CREATE POLICY "Staff can delete ad images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ads'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'librarian'::public.app_role)
  )
);
