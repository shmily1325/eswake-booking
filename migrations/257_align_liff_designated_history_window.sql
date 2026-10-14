-- Keep LIFF coach-designated balances visible while non-zero, but limit
-- zero-balance visibility and history rows to the same recent 60-day window
-- used by the existing LIFF transaction ledger.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_liff_coach_designated_balances(
  p_line_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_balances JSONB;
  v_since_date DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE - 60;
BEGIN
  SELECT member_id INTO v_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到有效的會員綁定');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'coach_id', x.coach_id,
      'coach_name', x.coach_name,
      'balance', x.regular_balance + x.gift_balance,
      'regular_balance', x.regular_balance,
      'gift_balance', x.gift_balance,
      'has_gift_entries', x.has_gift_entries,
      'regular_expires_on', x.regular_expires_on,
      'gift_expires_on', x.gift_expires_on,
      'last_activity_at', x.last_activity_at
    )
    ORDER BY x.last_activity_at DESC, x.coach_name
  ), '[]'::jsonb)
  INTO v_balances
  FROM (
    SELECT
      e.coach_id,
      c.name AS coach_name,
      SUM(
        CASE e.entry_type WHEN 'credit' THEN e.regular_minutes ELSE -e.regular_minutes END
      )::INTEGER AS regular_balance,
      SUM(
        CASE e.entry_type WHEN 'credit' THEN e.gift_minutes ELSE -e.gift_minutes END
      )::INTEGER AS gift_balance,
      BOOL_OR(e.gift_minutes > 0) AS has_gift_entries,
      (
        SELECT latest_regular.expires_on
        FROM public.coach_designated_hour_entries latest_regular
        WHERE latest_regular.member_id = v_member_id
          AND latest_regular.coach_id = e.coach_id
          AND latest_regular.entry_type = 'credit'
          AND latest_regular.regular_minutes > 0
          AND latest_regular.voided_at IS NULL
        ORDER BY latest_regular.occurred_at DESC, latest_regular.id DESC
        LIMIT 1
      ) AS regular_expires_on,
      (
        SELECT latest_gift.expires_on
        FROM public.coach_designated_hour_entries latest_gift
        WHERE latest_gift.member_id = v_member_id
          AND latest_gift.coach_id = e.coach_id
          AND latest_gift.entry_type = 'credit'
          AND latest_gift.gift_minutes > 0
          AND latest_gift.voided_at IS NULL
        ORDER BY latest_gift.occurred_at DESC, latest_gift.id DESC
        LIMIT 1
      ) AS gift_expires_on,
      MAX(e.occurred_at) AS last_activity_at
    FROM public.coach_designated_hour_entries e
    JOIN public.coaches c ON c.id = e.coach_id
    WHERE e.member_id = v_member_id
      AND e.voided_at IS NULL
    GROUP BY e.coach_id, c.name
    HAVING
      SUM(
        CASE e.entry_type WHEN 'credit' THEN e.regular_minutes ELSE -e.regular_minutes END
      ) <> 0
      OR SUM(
        CASE e.entry_type WHEN 'credit' THEN e.gift_minutes ELSE -e.gift_minutes END
      ) <> 0
      OR MAX(e.occurred_at) >= (v_since_date::TIMESTAMP AT TIME ZONE 'Asia/Taipei')
  ) x;

  RETURN jsonb_build_object('success', true, 'balances', v_balances);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_liff_coach_designated_history(
  p_line_user_id TEXT,
  p_coach_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_entries JSONB;
  v_total INTEGER;
  v_regular_balance INTEGER;
  v_gift_balance INTEGER;
  v_regular_expires_on DATE;
  v_gift_expires_on DATE;
  v_has_gift_entries BOOLEAN;
  v_since_date DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE - 60;
BEGIN
  SELECT member_id INTO v_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到有效的會員綁定');
  END IF;

  SELECT
    COALESCE(SUM(
      CASE e.entry_type WHEN 'credit' THEN e.regular_minutes ELSE -e.regular_minutes END
    ), 0)::INTEGER,
    COALESCE(SUM(
      CASE e.entry_type WHEN 'credit' THEN e.gift_minutes ELSE -e.gift_minutes END
    ), 0)::INTEGER
  INTO v_regular_balance, v_gift_balance
  FROM public.coach_designated_hour_entries e
  WHERE e.member_id = v_member_id
    AND e.coach_id = p_coach_id
    AND e.voided_at IS NULL;

  SELECT COUNT(*)::INTEGER
  INTO v_total
  FROM public.coach_designated_hour_entries e
  WHERE e.member_id = v_member_id
    AND e.coach_id = p_coach_id
    AND e.voided_at IS NULL
    AND e.occurred_at >= (v_since_date::TIMESTAMP AT TIME ZONE 'Asia/Taipei');

  SELECT e.expires_on INTO v_regular_expires_on
  FROM public.coach_designated_hour_entries e
  WHERE e.member_id = v_member_id
    AND e.coach_id = p_coach_id
    AND e.entry_type = 'credit'
    AND e.regular_minutes > 0
    AND e.voided_at IS NULL
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT 1;

  SELECT e.expires_on INTO v_gift_expires_on
  FROM public.coach_designated_hour_entries e
  WHERE e.member_id = v_member_id
    AND e.coach_id = p_coach_id
    AND e.entry_type = 'credit'
    AND e.gift_minutes > 0
    AND e.voided_at IS NULL
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.coach_designated_hour_entries e
    WHERE e.member_id = v_member_id
      AND e.coach_id = p_coach_id
      AND e.gift_minutes > 0
      AND e.voided_at IS NULL
  ) INTO v_has_gift_entries;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY occurred_at DESC, id DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT
      e.id,
      e.entry_type,
      e.minutes,
      e.regular_minutes,
      e.gift_minutes,
      CASE e.entry_type WHEN 'credit' THEN e.minutes ELSE -e.minutes END AS delta_minutes,
      e.occurred_at,
      e.expires_on,
      e.note,
      b.start_at AS booking_start_at,
      boat.name AS boat_name
    FROM public.coach_designated_hour_entries e
    LEFT JOIN public.booking_participants bp ON bp.id = e.booking_participant_id
    LEFT JOIN public.bookings b ON b.id = bp.booking_id
    LEFT JOIN public.boats boat ON boat.id = b.boat_id
    WHERE e.member_id = v_member_id
      AND e.coach_id = p_coach_id
      AND e.voided_at IS NULL
      AND e.occurred_at >= (v_since_date::TIMESTAMP AT TIME ZONE 'Asia/Taipei')
    ORDER BY e.occurred_at DESC, e.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) row_data;

  RETURN jsonb_build_object(
    'success', true,
    'entries', v_entries,
    'total', v_total,
    'balance', v_regular_balance + v_gift_balance,
    'regular_balance', v_regular_balance,
    'gift_balance', v_gift_balance,
    'has_gift_entries', v_has_gift_entries,
    'regular_expires_on', v_regular_expires_on,
    'gift_expires_on', v_gift_expires_on
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_liff_coach_designated_balances(TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_liff_coach_designated_history(TEXT, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_liff_coach_designated_balances(TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_liff_coach_designated_history(TEXT, UUID, INTEGER, INTEGER)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
