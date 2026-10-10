-- 業績報表：指定課賣課明細與常用查詢索引
BEGIN;

CREATE INDEX IF NOT EXISTS idx_transactions_booking_participant
  ON public.transactions (booking_participant_id)
  WHERE booking_participant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_designated_credit_report
  ON public.coach_designated_hour_entries (coach_id, occurred_at DESC, id DESC)
  WHERE entry_type = 'credit' AND voided_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_coach_designated_credit_report(
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_coach_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entries JSONB;
  v_email TEXT := NULLIF(lower(auth.jwt() ->> 'email'), '');
BEGIN
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_start_at > p_end_at THEN
    RAISE EXCEPTION '查詢期間錯誤';
  END IF;

  IF auth.role() <> 'service_role'
    AND NOT public.is_allowed_staff()
    AND NOT (
      p_coach_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.coaches c
        WHERE c.id = p_coach_id
          AND NULLIF(lower(c.user_email), '') = v_email
      )
    )
  THEN
    RAISE EXCEPTION '沒有權限查看指定課業績'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'coach_id', e.coach_id,
      'coach_name', c.name,
      'member_id', e.member_id,
      'member_name', COALESCE(NULLIF(m.nickname, ''), m.name),
      'regular_minutes', e.regular_minutes,
      'gift_minutes', e.gift_minutes,
      'total_minutes', e.minutes,
      'occurred_at', e.occurred_at,
      'note', e.note
    )
    ORDER BY e.occurred_at DESC, e.id DESC
  ), '[]'::jsonb)
  INTO v_entries
  FROM public.coach_designated_hour_entries e
  JOIN public.coaches c ON c.id = e.coach_id
  JOIN public.members m ON m.id = e.member_id
  WHERE e.entry_type = 'credit'
    AND e.voided_at IS NULL
    AND e.occurred_at >= p_start_at
    AND e.occurred_at <= p_end_at
    AND (p_coach_id IS NULL OR e.coach_id = p_coach_id);

  RETURN jsonb_build_object('success', true, 'entries', v_entries);
END;
$$;

REVOKE ALL ON FUNCTION public.get_coach_designated_credit_report(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_coach_designated_credit_report(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID
) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
