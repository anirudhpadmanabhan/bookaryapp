CREATE TABLE IF NOT EXISTS public.profile_cards (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Reader',
  tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profile_cards TO anon, authenticated;
GRANT ALL ON public.profile_cards TO service_role;

ALTER TABLE public.profile_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile cards readable by all" ON public.profile_cards;
CREATE POLICY "Profile cards readable by all"
  ON public.profile_cards FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.profile_cards (id, display_name, tag, created_at, updated_at)
SELECT id, display_name, tag, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    tag = EXCLUDED.tag,
    updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION public.sync_profile_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_cards (id, display_name, tag, created_at, updated_at)
  VALUES (NEW.id, NEW.display_name, NEW.tag, NEW.created_at, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      tag = EXCLUDED.tag,
      updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_profile_card ON public.profiles;
CREATE TRIGGER profiles_sync_profile_card
AFTER INSERT OR UPDATE OF display_name, tag, updated_at ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_card();

REVOKE ALL ON FUNCTION public.sync_profile_card() FROM PUBLIC, anon, authenticated;

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker = on) AS
  SELECT id, display_name, tag, created_at FROM public.profile_cards;
GRANT SELECT ON public.profiles_public TO anon, authenticated;