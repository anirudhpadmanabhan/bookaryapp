-- 1) Fix: the restrictive ALL policy was blocking users from SELECTing their own roles,
--    which hid admin/librarian links. Scope the restriction to write operations only.
DROP POLICY IF EXISTS "Block self-modification of roles" ON public.user_roles;

CREATE POLICY "Block self-insert of roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id <> auth.uid());

CREATE POLICY "Block self-update of roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (user_id <> auth.uid())
  WITH CHECK (user_id <> auth.uid());

CREATE POLICY "Block self-delete of roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (user_id <> auth.uid());

-- 2) Prevent duplicate (user, book) diary entries.
--    Collapse any pre-existing duplicates, keeping the most recently updated row.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, book_id
           ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
         ) AS rn
  FROM public.reading_diary
  WHERE book_id IS NOT NULL
)
DELETE FROM public.reading_diary d
USING ranked r
WHERE d.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS reading_diary_user_book_unique
  ON public.reading_diary (user_id, book_id)
  WHERE book_id IS NOT NULL;
