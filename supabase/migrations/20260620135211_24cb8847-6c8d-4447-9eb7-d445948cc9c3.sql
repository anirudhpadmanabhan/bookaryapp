
CREATE INDEX IF NOT EXISTS idx_books_author ON public.books(author);
CREATE INDEX IF NOT EXISTS idx_books_genre ON public.books(genre);
CREATE INDEX IF NOT EXISTS idx_books_shelf_code ON public.books(shelf_code);
