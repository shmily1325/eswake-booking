BEGIN;

CREATE OR REPLACE FUNCTION public._can_manage_coach_designated_hours(
  p_coach_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.role() = 'service_role'
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.coaches c
      WHERE c.id = p_coach_id
        AND NULLIF(lower(c.user_email), '') =
            NULLIF(lower(auth.jwt() ->> 'email'), '')
    )
$$;

CREATE OR REPLACE FUNCTION public.get_admin_coach_designated_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coaches JSONB;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION '沒有權限查看指定課總覽'
      USING ERRCODE = '42501';
  END IF;

  WITH balances AS (
    SELECT
      e.coach_id,
      e.member_id,
      SUM(
        CASE e.entry_type WHEN 'credit' THEN e.regular_minutes ELSE -e.regular_minutes END
      )::INTEGER AS regular_balance,
      SUM(
        CASE e.entry_type WHEN 'credit' THEN e.gift_minutes ELSE -e.gift_minutes END
      )::INTEGER AS gift_balance,
      BOOL_OR(e.gift_minutes > 0) AS has_gift_entries,
      MAX(e.updated_at) AS last_activity_at,
      COUNT(*)::INTEGER AS entry_count
    FROM public.coach_designated_hour_entries e
    WHERE e.voided_at IS NULL
    GROUP BY e.coach_id, e.member_id
  ),
  latest_regular AS (
    SELECT DISTINCT ON (e.coach_id, e.member_id)
      e.coach_id,
      e.member_id,
      e.expires_on
    FROM public.coach_designated_hour_entries e
    WHERE e.entry_type = 'credit'
      AND e.regular_minutes > 0
      AND e.voided_at IS NULL
    ORDER BY e.coach_id, e.member_id, e.occurred_at DESC, e.id DESC
  ),
  latest_gift AS (
    SELECT DISTINCT ON (e.coach_id, e.member_id)
      e.coach_id,
      e.member_id,
      e.expires_on
    FROM public.coach_designated_hour_entries e
    WHERE e.entry_type = 'credit'
      AND e.gift_minutes > 0
      AND e.voided_at IS NULL
    ORDER BY e.coach_id, e.member_id, e.occurred_at DESC, e.id DESC
  ),
  student_rows AS (
    SELECT
      b.coach_id,
      b.member_id,
      m.name,
      m.nickname,
      m.membership_type,
      b.regular_balance,
      b.gift_balance,
      b.regular_balance + b.gift_balance AS balance,
      b.has_gift_entries,
      lr.expires_on AS regular_expires_on,
      lg.expires_on AS gift_expires_on,
      b.last_activity_at,
      b.entry_count
    FROM balances b
    JOIN public.members m ON m.id = b.member_id
    LEFT JOIN latest_regular lr
      ON lr.coach_id = b.coach_id
      AND lr.member_id = b.member_id
    LEFT JOIN latest_gift lg
      ON lg.coach_id = b.coach_id
      AND lg.member_id = b.member_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'coach_id', c.id,
      'coach_name', c.name,
      'students', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'member_id', sr.member_id,
            'name', sr.name,
            'nickname', sr.nickname,
            'membership_type', sr.membership_type,
            'balance', sr.balance,
            'regular_balance', sr.regular_balance,
            'gift_balance', sr.gift_balance,
            'has_gift_entries', sr.has_gift_entries,
            'regular_expires_on', sr.regular_expires_on,
            'gift_expires_on', sr.gift_expires_on,
            'last_activity_at', sr.last_activity_at,
            'entry_count', sr.entry_count
          )
          ORDER BY sr.last_activity_at DESC, COALESCE(sr.nickname, sr.name)
        )
        FROM student_rows sr
        WHERE sr.coach_id = c.id
      ), '[]'::jsonb)
    )
    ORDER BY lower(c.name), c.id
  ), '[]'::jsonb)
  INTO v_coaches
  FROM public.coaches c
  WHERE c.status = 'active';

  RETURN jsonb_build_object('success', true, 'coaches', v_coaches);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_coach_designated_overview()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_coach_designated_overview()
  TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT 'admin coach designated overview created' AS status;
