-- Safe availability check for book pages: reveals only availability, not who rented it.
CREATE OR REPLACE FUNCTION public.book_availability(_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  hold_due timestamptz;
BEGIN
  SELECT r.due_at
    INTO hold_due
    FROM public.rentals r
   WHERE r.book_id = _book_id
     AND r.returned_at IS NULL
     AND COALESCE(r.tracking_status, 'confirmed') <> 'reserved'
   ORDER BY r.rented_at DESC NULLS LAST
   LIMIT 1;

  RETURN jsonb_build_object(
    'out_of_stock', hold_due IS NOT NULL,
    'due_at', hold_due
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.book_availability(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_availability(uuid) TO anon, authenticated;

-- Normalize remaining genre labels so grids render English first and Malayalam second.
WITH map(ml, en) AS (VALUES
  ('സ്പോർട്സ്','Sports'),
  ('സ്‌പോര്‍ട്‌സ്','Sports'),
  ('കായികം','Sports'),
  ('അനുസ്മരണം','Commemoration'),
  ('ആക്ഷേപഹാസ്യം','Satire'),
  ('ആത്മീയം','Spirituality'),
  ('ഇയർബുക്ക്','Yearbook'),
  ('കത്തുകൾ','Letters'),
  ('കാഴചകൾ','Views'),
  ('കുട്ടികളുടെ ശാസ്ത്രം','Children''s science'),
  ('ക്രൈം ത്രില്ലർ','Crime thriller'),
  ('ഗണിതപഠനം','Mathematics studies'),
  ('ഗാനങ്ങൾ','Songs'),
  ('ചികിത്സ','Treatment'),
  ('നാടോടി കഥകൾ','Folk tales'),
  ('നാടോടിസാഹിത്യം','Folk literature'),
  ('നിരീക്ഷണം','Observation'),
  ('നോവൽപഠനം','Novel studies'),
  ('പഴഞ്ചൊല്ല്','Proverbs'),
  ('ഫിക്ഷ൯','Fiction'),
  ('ശാസ്ത്ര നോവൽ','Science novel'),
  ('ശാസ്ത്രകഥ','Science fiction'),
  ('സംഭാഷണം','Conversation'),
  ('ആട്ടക്കഥ','Attakatha'),
  ('ആയുർവ്വേദം','Ayurveda'),
  ('ആർക്കിടെക്ച്ചർ','Architecture'),
  ('ഉപനിഷത്ത്','Upanishad'),
  ('ഒറിഗാമി','Origami'),
  ('കഥാനുഭവം','Story experience'),
  ('കരിയർഗൈഡ്','Career guide'),
  ('കല','Art'),
  ('കലകൾ','Arts'),
  ('കവികളിലുടെ','Through poets'),
  ('കാ൪ഷികം','Agriculture'),
  ('കുട്ടി.നോവൽ','Children''s novel'),
  ('ജീവശാസ്ത്രം','Biology'),
  ('ഡി.കഥകൾ','Detective stories'),
  ('തത്വചിന്ത','Philosophy'),
  ('നാട൯പാട്ട്','Folk songs'),
  ('നിയമം','Law'),
  ('നിയമങ്ങൾ','Laws'),
  ('പരിസ്ഥിതി','Environment'),
  ('പാചകകുറിപ്പ്','Recipes'),
  ('പാട്ടുകൾ','Songs'),
  ('ബാല നാടകം','Children''s drama'),
  ('ബാലവൈജഞാനികം','Children''s knowledge'),
  ('ഭക്തികവിത','Devotional poetry'),
  ('മാ.നോവൽ','Magic novel'),
  ('മാജിക്','Magic'),
  ('മൊഴി','Language'),
  ('യോഗ','Yoga'),
  ('ലഘു ലേഖനം','Short essays'),
  ('ലിസ്റ്റ്','List'),
  ('വക്കീൽ കഥകൾ','Lawyer stories'),
  ('വാക്യങ്ങൾ','Sentences'),
  ('വായന','Reading'),
  ('വിശ്വ.നോവൽ','World novel'),
  ('വ്യാകരണം','Grammar'),
  ('വ്യാഖ്യാനം','Commentary'),
  ('സംഘടന','Organization'),
  ('സമാഹാരം','Collection'),
  ('സാമൂഹ്യം','Society'),
  ('സിദ്ധാന്തം','Theory')
)
UPDATE public.books b
   SET genre = m.en,
       genre_ml = m.ml
  FROM map m
 WHERE regexp_replace(normalize(b.genre, NFC), '[\u200B-\u200D\uFEFF]', '', 'g') = regexp_replace(normalize(m.ml, NFC), '[\u200B-\u200D\uFEFF]', '', 'g')
    OR regexp_replace(normalize(COALESCE(b.genre_ml, ''), NFC), '[\u200B-\u200D\uFEFF]', '', 'g') = regexp_replace(normalize(m.ml, NFC), '[\u200B-\u200D\uFEFF]', '', 'g');

-- Ensure any Latin-1/Mozhi-style Sports import is displayed as English + original label.
UPDATE public.books
   SET genre = 'Sports',
       genre_ml = COALESCE(NULLIF(genre_ml, ''), genre)
 WHERE lower(genre) IN ('kvt]mÀsvkv', 'kvt]mÀSvkv', 'sports')
    OR lower(COALESCE(genre_ml, '')) IN ('kvt]mÀsvkv', 'kvt]mÀSvkv', 'sports');