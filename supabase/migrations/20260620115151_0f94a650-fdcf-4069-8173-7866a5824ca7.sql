
-- Books: new columns for full CSV import
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS shelf_code text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'Malayalam',
  ADD COLUMN IF NOT EXISTS original_author text;

CREATE INDEX IF NOT EXISTS books_shelf_code_idx ON public.books (shelf_code);
CREATE INDEX IF NOT EXISTS books_author_idx ON public.books (author);
CREATE INDEX IF NOT EXISTS books_genre_idx ON public.books (genre);

-- Favorites: prevent duplicates (fixes Loved page issue)
DELETE FROM public.favorites a
  USING public.favorites b
  WHERE a.id > b.id AND a.user_id = b.user_id AND a.book_id = b.book_id;

CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_book_uniq
  ON public.favorites (user_id, book_id);

-- Reading diary: track edits
ALTER TABLE public.reading_diary
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reading_diary_set_updated_at ON public.reading_diary;
CREATE TRIGGER reading_diary_set_updated_at
  BEFORE UPDATE ON public.reading_diary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews readable by all"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Users insert own reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own reviews"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS reviews_set_updated_at ON public.reviews;
CREATE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS reviews_book_idx ON public.reviews (book_id);
