
-- 1) Lock down profiles.wallet_balance from direct client UPDATEs
REVOKE UPDATE (wallet_balance) ON public.profiles FROM authenticated;
REVOKE UPDATE (wallet_balance) ON public.profiles FROM anon;

-- Defense in depth: ensure UPDATE policy disallows changing wallet_balance even if grants change later
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND wallet_balance IS NOT DISTINCT FROM (SELECT p.wallet_balance FROM public.profiles p WHERE p.id = auth.uid())
);

-- 2) Tighten ad_events INSERT policy (was WITH CHECK true)
DROP POLICY IF EXISTS "Anyone can record ad events" ON public.ad_events;
CREATE POLICY "Record ad events for self or anon"
ON public.ad_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
);
