BEGIN;

-- 教練可能先補扣歷史課程，再於時數用完的日期補登新指定課。
-- 保留回報歸屬、重複扣除與輸入格式驗證，但允許指定課流水暫時為負數。
CREATE OR REPLACE FUNCTION public.backfill_coach_designated_report_deductions(
  p_coach_id UUID,
  p_member_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_participant public.booking_participants;
  v_existing public.coach_designated_hour_entries;
  v_regular_minutes INTEGER;
  v_gift_minutes INTEGER;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);

  IF p_member_id IS NULL
    OR jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0
  THEN
    RAISE EXCEPTION '補扣資料格式錯誤';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item
    GROUP BY (item ->> 'participant_id')::INTEGER
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '同一筆回報不可重複補扣';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
    ORDER BY (value ->> 'participant_id')::INTEGER
  LOOP
    SELECT *
    INTO v_participant
    FROM public.booking_participants
    WHERE id = (v_item ->> 'participant_id')::INTEGER
    FOR UPDATE;

    IF NOT FOUND
      OR v_participant.coach_id IS DISTINCT FROM p_coach_id
      OR v_participant.member_id IS DISTINCT FROM p_member_id
      OR v_participant.lesson_type IS DISTINCT FROM 'designated_free'
      OR NOT COALESCE(v_participant.is_teaching, false)
      OR COALESCE(v_participant.is_deleted, false)
    THEN
      RAISE EXCEPTION '上課紀錄已變更，請重新載入後再試';
    END IF;

    v_regular_minutes := COALESCE((v_item ->> 'regular_minutes')::INTEGER, 0);
    v_gift_minutes := COALESCE((v_item ->> 'gift_minutes')::INTEGER, 0);
    IF NOT COALESCE((v_item ->> 'deduct')::BOOLEAN, false)
      OR v_regular_minutes < 0
      OR v_gift_minutes < 0
      OR v_regular_minutes + v_gift_minutes <= 0
    THEN
      RAISE EXCEPTION '扣除分鐘必須大於 0';
    END IF;

    SELECT *
    INTO v_existing
    FROM public.coach_designated_hour_entries e
    WHERE e.booking_participant_id = v_participant.id
      AND e.entry_type = 'report_deduction'
      AND e.voided_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing.coach_id IS DISTINCT FROM p_coach_id
        OR v_existing.member_id IS DISTINCT FROM p_member_id
        OR v_existing.regular_minutes IS DISTINCT FROM v_regular_minutes
        OR v_existing.gift_minutes IS DISTINCT FROM v_gift_minutes
      THEN
        RAISE EXCEPTION '這筆上課紀錄已經扣除指定課';
      END IF;
    END IF;
  END LOOP;

  RETURN public.sync_coach_designated_report_deductions(p_coach_id, p_items);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_coach_designated_report_deductions(
  UUID, UUID, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_coach_designated_report_deductions(
  UUID, UUID, JSONB
) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT 'negative designated backfill enabled' AS status;
