-- Add a numeric sort key for shelf_code so "New on shelf" can order by rack number
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS shelf_code_num integer
  GENERATED ALWAYS AS (
    CASE
      WHEN shelf_code ~ '^[0-9]+$' THEN shelf_code::int
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS books_shelf_code_num_desc_idx
  ON public.books (shelf_code_num DESC NULLS LAST);
