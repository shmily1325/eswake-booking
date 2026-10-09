BEGIN;

-- Preserve the existing report-sync behavior while making multi-report lock
-- acquisition deterministic for every caller.
CREATE OR REPLACE FUNCTION public.sync_coach_designated_report_deductions(
  p_coach_id UUID,
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
  v_minutes INTEGER;
  v_regular_minutes INTEGER;
  v_gift_minutes INTEGER;
  v_deduct BOOLEAN;
  v_actor TEXT;
  v_occurred_at TIMESTAMPTZ;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);
  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION '扣除資料格式錯誤';
  END IF;
  v_actor := public._coach_designated_actor_email();

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    ORDER BY (value ->> 'participant_id')::INTEGER
  LOOP
    SELECT * INTO v_participant
    FROM public.booking_participants
    WHERE id = (v_item ->> 'participant_id')::INTEGER
    FOR UPDATE;

    IF NOT FOUND OR v_participant.coach_id IS DISTINCT FROM p_coach_id THEN
      RAISE EXCEPTION '找不到指定教練的參與者回報';
    END IF;

    v_deduct := COALESCE((v_item ->> 'deduct')::BOOLEAN, false);
    IF v_item ? 'regular_minutes' OR v_item ? 'gift_minutes' THEN
      v_regular_minutes := GREATEST(COALESCE((v_item ->> 'regular_minutes')::INTEGER, 0), 0);
      v_gift_minutes := GREATEST(COALESCE((v_item ->> 'gift_minutes')::INTEGER, 0), 0);
      v_minutes := v_regular_minutes + v_gift_minutes;
    ELSE
      v_minutes := COALESCE((v_item ->> 'minutes')::INTEGER, 0);
      v_regular_minutes := GREATEST(v_minutes, 0);
      v_gift_minutes := 0;
    END IF;

    SELECT * INTO v_existing
    FROM public.coach_designated_hour_entries
    WHERE booking_participant_id = v_participant.id
      AND entry_type = 'report_deduction'
      AND voided_at IS NULL
    FOR UPDATE;

    IF v_deduct THEN
      IF v_participant.member_id IS NULL
        OR v_participant.lesson_type IS DISTINCT FROM 'designated_free'
        OR COALESCE(v_participant.is_deleted, false)
      THEN
        RAISE EXCEPTION '此回報不符合指定不收費扣除條件';
      END IF;
      IF v_minutes <= 0 THEN
        RAISE EXCEPTION '扣除分鐘必須大於 0';
      END IF;

      DELETE FROM public.coach_designated_hour_report_skips
      WHERE booking_participant_id = v_participant.id;

      SELECT NULLIF(b.start_at, '')::TIMESTAMPTZ
      INTO v_occurred_at
      FROM public.bookings b
      WHERE b.id = v_participant.booking_id;
      v_occurred_at := COALESCE(v_occurred_at, CURRENT_TIMESTAMP);

      IF v_existing.id IS NULL THEN
        INSERT INTO public.coach_designated_hour_entries (
          coach_id, member_id, entry_type, minutes,
          regular_minutes, gift_minutes, occurred_at,
          booking_participant_id, created_by_email, updated_by_email
        ) VALUES (
          p_coach_id, v_participant.member_id, 'report_deduction', v_minutes,
          v_regular_minutes, v_gift_minutes, v_occurred_at,
          v_participant.id, v_actor, v_actor
        );
      ELSIF v_existing.minutes IS DISTINCT FROM v_minutes
        OR v_existing.regular_minutes IS DISTINCT FROM v_regular_minutes
        OR v_existing.gift_minutes IS DISTINCT FROM v_gift_minutes
        OR v_existing.member_id IS DISTINCT FROM v_participant.member_id
        OR v_existing.coach_id IS DISTINCT FROM p_coach_id
      THEN
        INSERT INTO public.coach_designated_hour_revisions (
          entry_id, coach_id, member_id, action,
          before_data, after_data, actor_email
        ) VALUES (
          v_existing.id, v_existing.coach_id, v_existing.member_id, 'update',
          to_jsonb(v_existing),
          jsonb_build_object(
            'coach_id', p_coach_id,
            'member_id', v_participant.member_id,
            'minutes', v_minutes,
            'regular_minutes', v_regular_minutes,
            'gift_minutes', v_gift_minutes
          ),
          v_actor
        );

        UPDATE public.coach_designated_hour_entries
        SET coach_id = p_coach_id,
            member_id = v_participant.member_id,
            minutes = v_minutes,
            regular_minutes = v_regular_minutes,
            gift_minutes = v_gift_minutes,
            occurred_at = v_occurred_at,
            updated_at = CURRENT_TIMESTAMP,
            updated_by_email = v_actor
        WHERE id = v_existing.id;
      END IF;
    ELSE
      IF v_participant.member_id IS NOT NULL
        AND v_participant.lesson_type = 'designated_free'
        AND NOT COALESCE(v_participant.is_deleted, false)
      THEN
        INSERT INTO public.coach_designated_hour_report_skips (
          booking_participant_id, coach_id, member_id,
          created_by_email, updated_by_email
        ) VALUES (
          v_participant.id, p_coach_id, v_participant.member_id,
          v_actor, v_actor
        )
        ON CONFLICT (booking_participant_id) DO UPDATE
        SET coach_id = EXCLUDED.coach_id,
            member_id = EXCLUDED.member_id,
            updated_at = CURRENT_TIMESTAMP,
            updated_by_email = EXCLUDED.updated_by_email;
      ELSE
        DELETE FROM public.coach_designated_hour_report_skips
        WHERE booking_participant_id = v_participant.id;
      END IF;

      IF v_existing.id IS NOT NULL THEN
        INSERT INTO public.coach_designated_hour_revisions (
          entry_id, coach_id, member_id, action,
          before_data, after_data, actor_email
        ) VALUES (
          v_existing.id, v_existing.coach_id, v_existing.member_id, 'void',
          to_jsonb(v_existing), NULL, v_actor
        );
        UPDATE public.coach_designated_hour_entries
        SET voided_at = CURRENT_TIMESTAMP,
            voided_by_email = v_actor,
            updated_at = CURRENT_TIMESTAMP,
            updated_by_email = v_actor
        WHERE id = v_existing.id;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

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
  v_regular_total INTEGER := 0;
  v_gift_total INTEGER := 0;
  v_regular_balance INTEGER := 0;
  v_gift_balance INTEGER := 0;
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

  -- Lock every selected report before validating its current owner. This prevents
  -- a concurrent report edit from moving the deduction to another member.
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

    SELECT * INTO v_existing
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
      CONTINUE;
    END IF;

    v_regular_total := v_regular_total + v_regular_minutes;
    v_gift_total := v_gift_total + v_gift_minutes;
  END LOOP;

  -- Serialize standalone backfills and credit edits for this coach/member before
  -- checking the current split balance. Existing report settlement remains unchanged.
  PERFORM e.id
  FROM public.coach_designated_hour_entries e
  WHERE e.coach_id = p_coach_id
    AND e.member_id = p_member_id
    AND e.voided_at IS NULL
  ORDER BY e.id
  FOR UPDATE;

  SELECT
    COALESCE(SUM(
      CASE e.entry_type WHEN 'credit' THEN e.regular_minutes ELSE -e.regular_minutes END
    ), 0)::INTEGER,
    COALESCE(SUM(
      CASE e.entry_type WHEN 'credit' THEN e.gift_minutes ELSE -e.gift_minutes END
    ), 0)::INTEGER
  INTO v_regular_balance, v_gift_balance
  FROM public.coach_designated_hour_entries e
  WHERE e.coach_id = p_coach_id
    AND e.member_id = p_member_id
    AND e.voided_at IS NULL;

  IF v_regular_total > v_regular_balance OR v_gift_total > v_gift_balance THEN
    RAISE EXCEPTION '扣除分鐘不能超過目前剩餘時數';
  END IF;

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

SELECT 'safe coach designated backfill created' AS status;
