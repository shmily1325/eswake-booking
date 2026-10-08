-- =============================================================================
-- 250_add_designated_expiry_to_student_list.sql
--
-- 在教練指定課學生清單回傳最近一筆一般／贈送指定課的使用期限，
-- 供清單顯示重要期限，取代資訊價值較低的「最近異動」文字。
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_coach_designated_students(
  p_coach_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_students JSONB;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'member_id', x.member_id,
      'name', x.name,
      'nickname', x.nickname,
      'membership_type', x.membership_type,
      'balance', x.regular_balance + x.gift_balance,
      'regular_balance', x.regular_balance,
      'gift_balance', x.gift_balance,
      'has_gift_entries', x.has_gift_entries,
      'regular_expires_on', (
        SELECT latest_regular.expires_on
        FROM public.coach_designated_hour_entries latest_regular
        WHERE latest_regular.coach_id = p_coach_id
          AND latest_regular.member_id = x.member_id
          AND latest_regular.entry_type = 'credit'
          AND latest_regular.regular_minutes > 0
          AND latest_regular.voided_at IS NULL
        ORDER BY latest_regular.occurred_at DESC, latest_regular.id DESC
        LIMIT 1
      ),
      'gift_expires_on', (
        SELECT latest_gift.expires_on
        FROM public.coach_designated_hour_entries latest_gift
        WHERE latest_gift.coach_id = p_coach_id
          AND latest_gift.member_id = x.member_id
          AND latest_gift.entry_type = 'credit'
          AND latest_gift.gift_minutes > 0
          AND latest_gift.voided_at IS NULL
        ORDER BY latest_gift.occurred_at DESC, latest_gift.id DESC
        LIMIT 1
      ),
      'last_activity_at', x.last_activity_at,
      'entry_count', x.entry_count
    )
    ORDER BY x.last_activity_at DESC, COALESCE(x.nickname, x.name)
  ), '[]'::jsonb)
  INTO v_students
  FROM (
    SELECT
      e.member_id,
      m.name,
      m.nickname,
      m.membership_type,
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
    JOIN public.members m ON m.id = e.member_id
    WHERE e.coach_id = p_coach_id
      AND e.voided_at IS NULL
    GROUP BY e.member_id, m.name, m.nickname, m.membership_type
  ) x;

  RETURN jsonb_build_object('success', true, 'students', v_students);
END;
$$;

REVOKE ALL ON FUNCTION public.get_coach_designated_students(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_designated_students(UUID)
  TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT 'coach designated student expiry summaries added' AS status;
