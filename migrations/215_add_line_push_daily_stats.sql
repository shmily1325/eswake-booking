-- Report successful LINE push requests by the calendar date on which they
-- were sent. Reminder logs are recorded per recipient, so rows written for
-- the same LINE user in one request are collapsed into one Push message.

BEGIN;

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
  distinct_pushes AS (
    SELECT DISTINCT
      (created_at AT TIME ZONE 'Asia/Taipei')::date AS sent_date,
      line_user_id,
      created_at
    FROM public.line_reminder_send_logs
    WHERE status = 'sent'
      AND created_at >= p_start_date::timestamp AT TIME ZONE 'Asia/Taipei'
  )
  SELECT
    date_range.sent_date,
    COUNT(distinct_pushes.line_user_id)::bigint AS push_count
  FROM date_range
  LEFT JOIN distinct_pushes USING (sent_date)
  GROUP BY date_range.sent_date
  ORDER BY date_range.sent_date;
$$;

REVOKE ALL ON FUNCTION public.get_line_reminder_push_daily_stats(DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_line_reminder_push_daily_stats(DATE)
  TO service_role;

COMMENT ON FUNCTION public.get_line_reminder_push_daily_stats(DATE) IS
  'Daily successful LINE Push counts in Asia/Taipei, available from 2026-08-28';

COMMIT;
