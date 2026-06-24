
CREATE TABLE public.ad_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression','click')),
  user_id uuid,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ad_events_ad_id_created_at_idx ON public.ad_events(ad_id, created_at DESC);
CREATE INDEX ad_events_ad_id_type_idx ON public.ad_events(ad_id, event_type);

GRANT SELECT, INSERT ON public.ad_events TO authenticated;
GRANT SELECT, INSERT ON public.ad_events TO anon;
GRANT ALL ON public.ad_events TO service_role;

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record ad events"
  ON public.ad_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can read ad events"
  ON public.ad_events FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'librarian'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.ad_stats(_ad_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  impressions bigint := 0;
  clicks bigint := 0;
  unique_viewers bigint := 0;
  last_seven jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::public.app_role)
          OR public.has_role(auth.uid(),'librarian'::public.app_role)) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;

  SELECT
    count(*) FILTER (WHERE event_type = 'impression'),
    count(*) FILTER (WHERE event_type = 'click'),
    count(DISTINCT COALESCE(user_id::text, session_id)) FILTER (WHERE event_type = 'impression')
  INTO impressions, clicks, unique_viewers
  FROM public.ad_events WHERE ad_id = _ad_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day', to_char(d.day, 'YYYY-MM-DD'),
    'impressions', COALESCE(e.imp, 0),
    'clicks', COALESCE(e.clk, 0)
  ) ORDER BY d.day), '[]'::jsonb)
  INTO last_seven
  FROM generate_series((current_date - interval '6 days')::date, current_date, interval '1 day') AS d(day)
  LEFT JOIN (
    SELECT date_trunc('day', created_at)::date AS day,
           count(*) FILTER (WHERE event_type='impression') AS imp,
           count(*) FILTER (WHERE event_type='click') AS clk
    FROM public.ad_events
    WHERE ad_id = _ad_id AND created_at >= (current_date - interval '6 days')
    GROUP BY 1
  ) e ON e.day = d.day;

  RETURN jsonb_build_object(
    'impressions', impressions,
    'clicks', clicks,
    'unique_viewers', unique_viewers,
    'ctr', CASE WHEN impressions > 0 THEN round((clicks::numeric / impressions) * 100, 2) ELSE 0 END,
    'daily', last_seven
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ad_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_stats(uuid) TO authenticated;
