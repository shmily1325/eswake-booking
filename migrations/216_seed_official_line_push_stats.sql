-- Seed the official LINE Manager Push figures supplied for 2026-08-28
-- through 2026-09-07. From 2026-09-08 onward, successful reminder Push
-- requests are counted automatically from the append-only send log.

BEGIN;

CREATE TABLE IF NOT EXISTS public.line_push_daily_official (
  sent_date DATE PRIMARY KEY,
  push_count INTEGER NOT NULL CHECK (push_count >= 0),
  source TEXT NOT NULL DEFAULT 'LINE Official Account Manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.line_push_daily_official (sent_date, push_count)
VALUES
  (DATE '2026-08-28', 6),
  (DATE '2026-08-29', 10),
  (DATE '2026-08-30', 4),
  (DATE '2026-08-31', 7),
  (DATE '2026-09-01', 6),
  (DATE '2026-09-02', 11),
  (DATE '2026-09-03', 4),
  (DATE '2026-09-04', 18),
  (DATE '2026-09-05', 11),
  (DATE '2026-09-06', 4),
  (DATE '2026-09-07', 4)
ON CONFLICT (sent_date) DO UPDATE
SET
  push_count = EXCLUDED.push_count,
  updated_at = NOW();

ALTER TABLE public.line_push_daily_official ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_push_daily_official FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.line_push_daily_official
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_push_daily_official
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_line_reminder_push_daily_stats(
  p_start_date DATE DEFAULT DATE '2026-08-28'
)
RETURNS TABLE (
  sent_date DATE,
  push_count BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH date_range AS (
    SELECT day::date AS sent_date
    FROM generate_series(
      p_start_date::timestamp,
      (NOW() AT TIME ZONE 'Asia/Taipei')::date::timestamp,
      INTERVAL '1 day'
    ) AS day
  ),
  distinct_logged_pushes AS (
    SELECT DISTINCT
      (created_at AT TIME ZONE 'Asia/Taipei')::date AS sent_date,
      line_user_id,
      created_at
    FROM public.line_reminder_send_logs
    WHERE status = 'sent'
      AND created_at >= TIMESTAMPTZ '2026-09-07 16:00:00+00'
  ),
  logged_daily AS (
    SELECT sent_date, COUNT(*)::bigint AS push_count
    FROM distinct_logged_pushes
    GROUP BY sent_date
  )
  SELECT
    date_range.sent_date,
    (
      COALESCE(official.push_count, 0)::bigint
      + COALESCE(logged.push_count, 0)::bigint
    ) AS push_count
  FROM date_range
  LEFT JOIN public.line_push_daily_official AS official USING (sent_date)
  LEFT JOIN logged_daily AS logged USING (sent_date)
  ORDER BY date_range.sent_date;
$$;

REVOKE ALL ON FUNCTION public.get_line_reminder_push_daily_stats(DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_line_reminder_push_daily_stats(DATE)
  TO service_role;

COMMENT ON TABLE public.line_push_daily_official IS
  'Official historical Push figures copied from LINE Official Account Manager';

COMMIT;
