-- =============================================================================
-- 249_split_coach_designated_regular_and_gift.sql
--
-- 將教練指定課擴充為同一份流水中的「一般／贈送」兩種餘額。
-- 既有紀錄全部視為一般指定課，不拆分、不改變總餘額。
--
-- 安全邊界：
-- - 不讀寫 transactions
-- - 不讀寫 members 的任何餘額欄位
-- - 不修改既有預約扣款流程
-- =============================================================================

BEGIN;

ALTER TABLE public.coach_designated_hour_entries
  ADD COLUMN IF NOT EXISTS regular_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_on DATE;

-- Existing credits and deductions remain entirely in the regular balance.
UPDATE public.coach_designated_hour_entries
SET regular_minutes = minutes,
    gift_minutes = 0
WHERE regular_minutes + gift_minutes IS DISTINCT FROM minutes;

ALTER TABLE public.coach_designated_hour_entries
  DROP CONSTRAINT IF EXISTS coach_designated_hour_entry_split_check;

ALTER TABLE public.coach_designated_hour_entries
  ADD CONSTRAINT coach_designated_hour_entry_split_check CHECK (
    regular_minutes >= 0
    AND gift_minutes >= 0
    AND regular_minutes + gift_minutes = minutes
  );

COMMENT ON COLUMN public.coach_designated_hour_entries.regular_minutes IS
  '本筆一般指定課分鐘；credit 為增加、report_deduction 為扣除';
COMMENT ON COLUMN public.coach_designated_hour_entries.gift_minutes IS
  '本筆贈送指定課分鐘；credit 為增加、report_deduction 為扣除';
COMMENT ON COLUMN public.coach_designated_hour_entries.expires_on IS
  '增加紀錄的使用期限提醒；不阻止逾期後使用';

CREATE OR REPLACE FUNCTION public.get_coach_designated_member_context(
  p_coach_id UUID,
  p_member_id UUID,
  p_booking_participant_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regular_balance INTEGER;
  v_gift_balance INTEGER;
  v_count INTEGER;
  v_has_gift_entries BOOLEAN;
  v_deduction INTEGER;
  v_deduction_regular INTEGER;
  v_deduction_gift INTEGER;
  v_skipped BOOLEAN := false;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);

  SELECT
    COALESCE(SUM(
      CASE e.entry_type WHEN 'credit' THEN e.regular_minutes ELSE -e.regular_minutes END
    ), 0)::INTEGER,
    COALESCE(SUM(
      CASE e.entry_type WHEN 'credit' THEN e.gift_minutes ELSE -e.gift_minutes END
    ), 0)::INTEGER,
    COUNT(*)::INTEGER,
    COALESCE(BOOL_OR(e.gift_minutes > 0), false)
  INTO v_regular_balance, v_gift_balance, v_count, v_has_gift_entries
  FROM public.coach_designated_hour_entries e
  WHERE e.coach_id = p_coach_id
    AND e.member_id = p_member_id
    AND e.voided_at IS NULL;

  IF p_booking_participant_id IS NOT NULL THEN
    SELECT e.minutes, e.regular_minutes, e.gift_minutes
    INTO v_deduction, v_deduction_regular, v_deduction_gift
    FROM public.coach_designated_hour_entries e
    WHERE e.booking_participant_id = p_booking_participant_id
      AND e.coach_id = p_coach_id
      AND e.member_id = p_member_id
      AND e.entry_type = 'report_deduction'
      AND e.voided_at IS NULL
    LIMIT 1;

    SELECT EXISTS (
      SELECT 1
      FROM public.coach_designated_hour_report_skips s
      WHERE s.booking_participant_id = p_booking_participant_id
        AND s.coach_id = p_coach_id
        AND s.member_id = p_member_id
    )
    INTO v_skipped;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_regular_balance + v_gift_balance,
    'regular_balance', v_regular_balance,
    'gift_balance', v_gift_balance,
    'has_gift_entries', v_has_gift_entries,
    'has_entries', v_count > 0,
    'deduction_minutes', v_deduction,
    'deduction_regular_minutes', v_deduction_regular,
    'deduction_gift_minutes', v_deduction_gift,
    'deduction_decided', v_deduction IS NOT NULL OR v_skipped,
    'explicit_no_deduction', v_skipped
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.get_coach_designated_student_detail(
  p_coach_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entries JSONB;
  v_regular_balance INTEGER;
  v_gift_balance INTEGER;
  v_regular_expires_on DATE;
  v_gift_expires_on DATE;
  v_has_gift_entries BOOLEAN;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);

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

  SELECT e.expires_on INTO v_regular_expires_on
  FROM public.coach_designated_hour_entries e
  WHERE e.coach_id = p_coach_id
    AND e.member_id = p_member_id
    AND e.entry_type = 'credit'
    AND e.regular_minutes > 0
    AND e.voided_at IS NULL
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT 1;

  SELECT e.expires_on INTO v_gift_expires_on
  FROM public.coach_designated_hour_entries e
  WHERE e.coach_id = p_coach_id
    AND e.member_id = p_member_id
    AND e.entry_type = 'credit'
    AND e.gift_minutes > 0
    AND e.voided_at IS NULL
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.coach_designated_hour_entries e
    WHERE e.coach_id = p_coach_id
      AND e.member_id = p_member_id
      AND e.gift_minutes > 0
      AND e.voided_at IS NULL
  ) INTO v_has_gift_entries;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'entry_type', e.entry_type,
      'minutes', e.minutes,
      'regular_minutes', e.regular_minutes,
      'gift_minutes', e.gift_minutes,
      'delta_minutes', CASE e.entry_type WHEN 'credit' THEN e.minutes ELSE -e.minutes END,
      'occurred_at', e.occurred_at,
      'expires_on', e.expires_on,
      'note', e.note,
      'booking_participant_id', e.booking_participant_id,
      'booking_id', bp.booking_id,
      'duration_min', bp.duration_min,
      'booking_start_at', b.start_at,
      'boat_name', boat.name,
      'created_at', e.created_at,
      'updated_at', e.updated_at
    )
    ORDER BY e.occurred_at DESC, e.id DESC
  ), '[]'::jsonb)
  INTO v_entries
  FROM public.coach_designated_hour_entries e
  LEFT JOIN public.booking_participants bp ON bp.id = e.booking_participant_id
  LEFT JOIN public.bookings b ON b.id = bp.booking_id
  LEFT JOIN public.boats boat ON boat.id = b.boat_id
  WHERE e.coach_id = p_coach_id
    AND e.member_id = p_member_id
    AND e.voided_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_regular_balance + v_gift_balance,
    'regular_balance', v_regular_balance,
    'gift_balance', v_gift_balance,
    'has_gift_entries', v_has_gift_entries,
    'regular_expires_on', v_regular_expires_on,
    'gift_expires_on', v_gift_expires_on,
    'entries', v_entries
  );
END;
$$;

-- Keep the original single-balance RPC compatible: old callers create regular minutes.
CREATE OR REPLACE FUNCTION public.create_coach_designated_credit(
  p_coach_id UUID,
  p_member_id UUID,
  p_minutes INTEGER,
  p_occurred_at TIMESTAMPTZ,
  p_note TEXT DEFAULT NULL,
  p_request_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.coach_designated_hour_entries;
  v_actor TEXT;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);
  IF p_minutes IS NULL OR p_minutes <= 0 THEN
    RAISE EXCEPTION '增加分鐘必須大於 0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id) THEN
    RAISE EXCEPTION '找不到會員資料';
  END IF;

  v_actor := public._coach_designated_actor_email();
  INSERT INTO public.coach_designated_hour_entries (
    coach_id, member_id, entry_type, minutes,
    regular_minutes, gift_minutes, occurred_at, note,
    request_key, created_by_email, updated_by_email
  ) VALUES (
    p_coach_id, p_member_id, 'credit', p_minutes,
    p_minutes, 0, COALESCE(p_occurred_at, CURRENT_TIMESTAMP),
    NULLIF(trim(p_note), ''), p_request_key, v_actor, v_actor
  )
  ON CONFLICT (request_key) WHERE request_key IS NOT NULL DO NOTHING
  RETURNING * INTO v_entry;

  IF v_entry.id IS NULL AND p_request_key IS NOT NULL THEN
    SELECT * INTO v_entry
    FROM public.coach_designated_hour_entries
    WHERE request_key = p_request_key;

    IF v_entry.coach_id IS DISTINCT FROM p_coach_id
      OR v_entry.member_id IS DISTINCT FROM p_member_id
      OR v_entry.entry_type IS DISTINCT FROM 'credit'
      OR v_entry.regular_minutes IS DISTINCT FROM p_minutes
      OR v_entry.gift_minutes IS DISTINCT FROM 0
      OR v_entry.occurred_at IS DISTINCT FROM COALESCE(p_occurred_at, v_entry.occurred_at)
      OR COALESCE(v_entry.note, '') IS DISTINCT FROM COALESCE(NULLIF(trim(p_note), ''), '')
    THEN
      RAISE EXCEPTION '重複請求識別與原紀錄不一致';
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'entry_id', v_entry.id);
END;
$$;

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

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
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

CREATE OR REPLACE FUNCTION public.create_coach_designated_credit_bundle(
  p_coach_id UUID,
  p_member_id UUID,
  p_regular_minutes INTEGER,
  p_gift_minutes INTEGER,
  p_occurred_at TIMESTAMPTZ,
  p_expires_on DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB,
  p_request_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.coach_designated_hour_entries;
  v_actor TEXT;
  v_total INTEGER;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);
  v_total := COALESCE(p_regular_minutes, 0) + COALESCE(p_gift_minutes, 0);
  IF COALESCE(p_regular_minutes, 0) < 0
    OR COALESCE(p_gift_minutes, 0) < 0
    OR v_total <= 0
  THEN
    RAISE EXCEPTION '一般或贈送分鐘必須大於 0';
  END IF;
  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION '扣除資料格式錯誤';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id) THEN
    RAISE EXCEPTION '找不到會員資料';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) item
    JOIN public.booking_participants bp
      ON bp.id = (item ->> 'participant_id')::INTEGER
    WHERE bp.member_id IS DISTINCT FROM p_member_id
  ) THEN
    RAISE EXCEPTION '選取的回報不屬於同一位學生';
  END IF;

  v_actor := public._coach_designated_actor_email();
  INSERT INTO public.coach_designated_hour_entries (
    coach_id, member_id, entry_type, minutes,
    regular_minutes, gift_minutes, occurred_at, expires_on, note,
    request_key, created_by_email, updated_by_email
  ) VALUES (
    p_coach_id, p_member_id, 'credit', v_total,
    COALESCE(p_regular_minutes, 0), COALESCE(p_gift_minutes, 0),
    COALESCE(p_occurred_at, CURRENT_TIMESTAMP), p_expires_on,
    NULLIF(trim(p_note), ''), p_request_key, v_actor, v_actor
  )
  ON CONFLICT (request_key) WHERE request_key IS NOT NULL DO NOTHING
  RETURNING * INTO v_entry;

  IF v_entry.id IS NULL AND p_request_key IS NOT NULL THEN
    SELECT * INTO v_entry
    FROM public.coach_designated_hour_entries
    WHERE request_key = p_request_key;

    IF v_entry.coach_id IS DISTINCT FROM p_coach_id
      OR v_entry.member_id IS DISTINCT FROM p_member_id
      OR v_entry.entry_type IS DISTINCT FROM 'credit'
      OR v_entry.regular_minutes IS DISTINCT FROM COALESCE(p_regular_minutes, 0)
      OR v_entry.gift_minutes IS DISTINCT FROM COALESCE(p_gift_minutes, 0)
      OR v_entry.occurred_at IS DISTINCT FROM COALESCE(p_occurred_at, v_entry.occurred_at)
      OR v_entry.expires_on IS DISTINCT FROM p_expires_on
      OR COALESCE(v_entry.note, '') IS DISTINCT FROM COALESCE(NULLIF(trim(p_note), ''), '')
    THEN
      RAISE EXCEPTION '重複請求識別與原紀錄不一致';
    END IF;
  END IF;

  PERFORM public.sync_coach_designated_report_deductions(p_coach_id, p_items);
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry.id,
    'deductions_synced', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_coach_designated_entry_split(
  p_entry_id BIGINT,
  p_regular_minutes INTEGER,
  p_gift_minutes INTEGER,
  p_occurred_at TIMESTAMPTZ DEFAULT NULL,
  p_expires_on DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.coach_designated_hour_entries;
  v_before JSONB;
  v_actor TEXT;
  v_total INTEGER;
BEGIN
  SELECT * INTO v_entry
  FROM public.coach_designated_hour_entries
  WHERE id = p_entry_id
    AND voided_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到可修改的指定課紀錄';
  END IF;
  PERFORM public._assert_can_manage_coach_designated_hours(v_entry.coach_id);

  v_total := COALESCE(p_regular_minutes, 0) + COALESCE(p_gift_minutes, 0);
  IF COALESCE(p_regular_minutes, 0) < 0
    OR COALESCE(p_gift_minutes, 0) < 0
    OR v_total <= 0
  THEN
    RAISE EXCEPTION '一般或贈送分鐘合計必須大於 0';
  END IF;
  v_before := to_jsonb(v_entry);
  v_actor := public._coach_designated_actor_email();

  UPDATE public.coach_designated_hour_entries
  SET minutes = v_total,
      regular_minutes = COALESCE(p_regular_minutes, 0),
      gift_minutes = COALESCE(p_gift_minutes, 0),
      occurred_at = CASE
        WHEN entry_type = 'credit' THEN COALESCE(p_occurred_at, occurred_at)
        ELSE occurred_at
      END,
      expires_on = CASE
        WHEN entry_type = 'credit' THEN p_expires_on
        ELSE expires_on
      END,
      note = CASE
        WHEN entry_type = 'credit' THEN NULLIF(trim(p_note), '')
        ELSE note
      END,
      updated_at = CURRENT_TIMESTAMP,
      updated_by_email = v_actor
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO public.coach_designated_hour_revisions (
    entry_id, coach_id, member_id, action,
    before_data, after_data, actor_email
  ) VALUES (
    v_entry.id, v_entry.coach_id, v_entry.member_id, 'update',
    v_before, to_jsonb(v_entry), v_actor
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- The original update RPC remains safe for old callers and keeps the current split
-- as much as possible when only a total is supplied.
CREATE OR REPLACE FUNCTION public.update_coach_designated_entry(
  p_entry_id BIGINT,
  p_minutes INTEGER,
  p_occurred_at TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.coach_designated_hour_entries;
  v_regular INTEGER;
  v_gift INTEGER;
BEGIN
  SELECT * INTO v_entry
  FROM public.coach_designated_hour_entries
  WHERE id = p_entry_id
    AND voided_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到可修改的指定課紀錄';
  END IF;
  IF p_minutes IS NULL OR p_minutes <= 0 THEN
    RAISE EXCEPTION '分鐘必須大於 0';
  END IF;

  v_gift := LEAST(v_entry.gift_minutes, p_minutes);
  v_regular := p_minutes - v_gift;
  RETURN public.update_coach_designated_entry_split(
    p_entry_id,
    v_regular,
    v_gift,
    p_occurred_at,
    v_entry.expires_on,
    p_note
  );
END;
$$;

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
      MAX(e.updated_at) AS last_activity_at
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
      OR MAX(e.updated_at) >= CURRENT_TIMESTAMP - INTERVAL '2 months'
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
    COUNT(*)::INTEGER,
    COALESCE(SUM(
      CASE e.entry_type WHEN 'credit' THEN e.regular_minutes ELSE -e.regular_minutes END
    ), 0)::INTEGER,
    COALESCE(SUM(
      CASE e.entry_type WHEN 'credit' THEN e.gift_minutes ELSE -e.gift_minutes END
    ), 0)::INTEGER
  INTO v_total, v_regular_balance, v_gift_balance
  FROM public.coach_designated_hour_entries e
  WHERE e.member_id = v_member_id
    AND e.coach_id = p_coach_id
    AND e.voided_at IS NULL;

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

REVOKE ALL ON FUNCTION public.create_coach_designated_credit_bundle(
  UUID, UUID, INTEGER, INTEGER, TIMESTAMPTZ, DATE, TEXT, JSONB, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_coach_designated_credit_bundle(
  UUID, UUID, INTEGER, INTEGER, TIMESTAMPTZ, DATE, TEXT, JSONB, UUID
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_coach_designated_entry_split(
  BIGINT, INTEGER, INTEGER, TIMESTAMPTZ, DATE, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_coach_designated_entry_split(
  BIGINT, INTEGER, INTEGER, TIMESTAMPTZ, DATE, TEXT
) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT 'coach designated regular/gift balances created' AS status;
