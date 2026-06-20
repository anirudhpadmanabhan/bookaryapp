
-- Fixed rental price and 20-day period
ALTER TABLE public.books ALTER COLUMN rent_price SET DEFAULT 10;
UPDATE public.books SET rent_price = 10;

-- Publisher column
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS publisher TEXT;
UPDATE public.books SET publisher = COALESCE(publisher, 'DC Books');

-- 20-day rental due window
ALTER TABLE public.rentals ALTER COLUMN due_at SET DEFAULT (now() + interval '20 days');

-- Book suggestions from readers
CREATE TABLE IF NOT EXISTS public.book_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_suggestions TO authenticated;
GRANT ALL ON public.book_suggestions TO service_role;

ALTER TABLE public.book_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own suggestions" ON public.book_suggestions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own suggestions" ON public.book_suggestions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own suggestions" ON public.book_suggestions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
