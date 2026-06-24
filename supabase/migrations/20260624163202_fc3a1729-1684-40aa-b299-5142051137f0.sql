
-- 1) Numeric shelf column for fast/correct ordering
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS shelf_no integer
  GENERATED ALWAYS AS (
    CASE WHEN shelf_code ~ '^[0-9]+$' THEN shelf_code::int ELSE NULL END
  ) STORED;

CREATE INDEX IF NOT EXISTS books_shelf_no_desc_idx
  ON public.books (shelf_no DESC NULLS LAST);

-- 2) Genre Malayalam -> English cleanup
WITH map(ml, en) AS (VALUES
  ('നോവൽ','Novel'),
  ('ഡി.നോവൽ','Detective novel'),
  ('ക്രൈം നോവൽ','Crime novel'),
  ('ലഘുനോവൽ','Short novel'),
  ('മാന്ത്രികനോവൽ','Magic novel'),
  ('നോവെല്ല','Novella'),
  ('കഥ','Stories'),
  ('ചെറുകഥ','Short stories'),
  ('നർമ്മകഥ','Humour stories'),
  ('ബാലസാഹിത്യം','Children''s literature'),
  ('കവിത','Poetry'),
  ('ലേഖനം','Essays'),
  ('ഉപന്യാസം','Essays'),
  ('പഠനം','Studies'),
  ('ജി.കെ.പഠനം','General knowledge'),
  ('നാടക പഠനം','Drama studies'),
  ('ചരിത്രം','History'),
  ('ജീവചരിത്രം','Biography'),
  ('ആത്മകഥ','Autobiography'),
  ('നാടകം','Drama'),
  ('ശാസ്ത്രം','Science'),
  ('വിജ്ഞാനം','Knowledge'),
  ('വൈജ്ഞാനികം','Informative'),
  ('ഓർമ്മകൾ','Memoirs'),
  ('ഓർമ്മകുറിപ്പ്','Memoir notes'),
  ('ഓ൪മ്മകുറിപ്പ്','Memoir notes'),
  ('യാത്രാവിവരണം','Travelogue'),
  ('പുരാണം','Mythology'),
  ('റഫറ൯സ്','Reference'),
  ('ക്വിസ്സ്','Quiz'),
  ('ആരോഗ്യം','Health'),
  ('നിരൂപണം','Criticism'),
  ('തിരക്കഥ','Screenplay'),
  ('വിവർത്തനം','Translation'),
  ('വിവരണം','Description'),
  ('സാഹിത്യം','Literature'),
  ('ഗണിതം','Mathematics'),
  ('വിശകലനം','Analysis'),
  ('കുറിപ്പുകൾ','Notes'),
  ('ഹാസ്യം','Humour'),
  ('കാറ്റലോക്','Catalogue'),
  ('മന:ശാസ്ത്രം','Psychology'),
  ('സിനിമ','Cinema'),
  ('ഇതിഹാസം','Epic'),
  ('നിഘണ്ടു','Dictionary'),
  ('അഭിമുഖം','Interview'),
  ('റിപ്പോർട്ട്','Report'),
  ('ഫലിതം','Jokes'),
  ('പ്രഭാഷണം','Lecture'),
  ('പ്രസംഗം','Speech'),
  ('വിദ്യാഭ്യാസം','Education'),
  ('ഫോക് ലോർ','Folklore'),
  ('നർമ്മം','Humour'),
  ('കടങ്കഥ','Riddles'),
  ('വിമർശനം','Review'),
  ('ഡയറി','Diary'),
  ('ഫിലോസഫി','Philosophy'),
  ('സോവിയറ്റ്സമീക്ഷ','Soviet review'),
  ('ജ്യോതിശാസ്ത്രം','Astronomy'),
  ('ക്ലാസ്സിക്','Classic'),
  ('അറിവ്','Knowledge'),
  ('പാചകം','Cooking'),
  ('കാർഷികം','Agriculture'),
  ('പൊതുവായ','General')
)
UPDATE public.books b
   SET genre = m.en,
       genre_ml = COALESCE(NULLIF(b.genre_ml, ''), b.genre)
  FROM map m
 WHERE b.genre = m.ml;

-- 3) Better reservation notification text
CREATE OR REPLACE FUNCTION public.assign_next_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_row public.waitlist%ROWTYPE;
  book_title text;
BEGIN
  IF NEW.returned_at IS NULL OR OLD.returned_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO next_row FROM public.waitlist
   WHERE book_id = NEW.book_id
   ORDER BY created_at ASC
   LIMIT 1;

  IF next_row.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title INTO book_title FROM public.books WHERE id = NEW.book_id;

  INSERT INTO public.rentals (user_id, book_id, price_paid, delivery_address, tracking_status, reserved_until)
  VALUES (next_row.user_id, NEW.book_id, 0, next_row.delivery_address, 'reserved', now() + interval '24 hours');

  DELETE FROM public.waitlist WHERE id = next_row.id;

  INSERT INTO public.notifications (user_id, kind, title, body, book_id, link_url)
  VALUES (
    next_row.user_id,
    'reservation_offered',
    'Good news! ''' || COALESCE(book_title,'Your book') || ''' is available.',
    'Reserve within 24 hours, or it passes to the next reader. Open the book page and tap Claim.',
    NEW.book_id,
    '/profile'
  );

  RETURN NEW;
END;
$function$;
