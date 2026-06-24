CREATE TABLE IF NOT EXISTS public._csv_books_stage (
  shelf text PRIMARY KEY,
  title text,
  title_ml text,
  author text,
  original_author text,
  genre_ml text,
  language text,
  cover_url text,
  publisher text
);
GRANT ALL ON public._csv_books_stage TO service_role;
ALTER TABLE public._csv_books_stage ENABLE ROW LEVEL SECURITY;