
CREATE TABLE public.libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  name_ml text,
  location text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.libraries TO anon, authenticated;
GRANT ALL ON public.libraries TO service_role;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Libraries are public" ON public.libraries FOR SELECT USING (true);

INSERT INTO public.libraries (slug, name, name_ml, location, is_default)
VALUES ('cherukad-naduvil', 'Cherukad Smaraka Vayanasala & Grandhalayam Naduvil', 'ചെറുകാട് സ്മാരക വായനശാല & ഗ്രന്ഥാലയം', 'Naduvil', true);

ALTER TABLE public.books ADD COLUMN library_id uuid REFERENCES public.libraries(id) ON DELETE SET NULL;
UPDATE public.books SET library_id = (SELECT id FROM public.libraries WHERE slug = 'cherukad-naduvil');
CREATE INDEX idx_books_library_id ON public.books(library_id);
