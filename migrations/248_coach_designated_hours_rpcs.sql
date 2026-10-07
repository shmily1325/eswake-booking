-- =============================================================================
-- 248_coach_designated_hours_rpcs.sql
--
-- 教練個別指定課時數專用 RPC。
-- 僅讀寫 247 新增的資料表；不寫 transactions 或 members 餘額。
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._coach_designated_actor_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(lower(auth.jwt() ->> 'email'), ''),
    CASE WHEN auth.role() = 'service_role' THEN 'service_role' END,
    'unknown'
  )
$$;

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
    OR public.is_allowed_staff()
    OR EXISTS (
      SELECT 1
      FROM public.coaches c
      WHERE c.id = p_coach_id
        AND NULLIF(lower(c.user_email), '') =
            NULLIF(lower(auth.jwt() ->> 'email'), '')
    )
$$;

CREATE OR REPLACE FUNCTION public._assert_can_manage_coach_designated_hours(
  p_coach_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._can_manage_coach_designated_hours(p_coach_id) THEN
    RAISE EXCEPTION '沒有權限管理此教練的指定課時數'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

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
  v_balance INTEGER;
  v_count INTEGER;
  v_deduction INTEGER;
  v_skipped BOOLEAN := false;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);

  SELECT
    COALESCE(SUM(
      CASE e.entry_type
        WHEN 'credit' THEN e.minutes
        ELSE -e.minutes
      END
    ), 0)::INTEGER,
    COUNT(*)::INTEGER
  INTO v_balance, v_count
  FROM public.coach_designated_hour_entries e
  WHERE e.coach_id = p_coach_id
    AND e.member_id = p_member_id
    AND e.voided_at IS NULL;

  IF p_booking_participant_id IS NOT NULL THEN
    SELECT e.minutes
    INTO v_deduction
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
    'balance', v_balance,
    'has_entries', v_count > 0,
    'deduction_minutes', v_deduction,
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
      'balance', x.balance,
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
      SUM(CASE e.entry_type WHEN 'credit' THEN e.minutes ELSE -e.minutes END)::INTEGER AS balance,
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
  v_balance INTEGER;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);

  SELECT
    COALESCE(SUM(CASE e.entry_type WHEN 'credit' THEN e.minutes ELSE -e.minutes END), 0)::INTEGER
  INTO v_balance
  FROM public.coach_designated_hour_entries e
  WHERE e.coach_id = p_coach_id
    AND e.member_id = p_member_id
    AND e.voided_at IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'entry_type', e.entry_type,
      'minutes', e.minutes,
      'delta_minutes', CASE e.entry_type WHEN 'credit' THEN e.minutes ELSE -e.minutes END,
      'occurred_at', e.occurred_at,
      'note', e.note,
      'booking_participant_id', e.booking_participant_id,
      'booking_id', bp.booking_id,
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
    'balance', v_balance,
    'entries', v_entries
  );
END;
$$;

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
    coach_id, member_id, entry_type, minutes, occurred_at, note,
    request_key, created_by_email, updated_by_email
  ) VALUES (
    p_coach_id, p_member_id, 'credit', p_minutes,
    COALESCE(p_occurred_at, CURRENT_TIMESTAMP), NULLIF(trim(p_note), ''),
    p_request_key, v_actor, v_actor
  )
  ON CONFLICT (request_key) WHERE request_key IS NOT NULL DO NOTHING
  RETURNING * INTO v_entry;

  IF v_entry.id IS NULL AND p_request_key IS NOT NULL THEN
    SELECT *
    INTO v_entry
    FROM public.coach_designated_hour_entries
    WHERE request_key = p_request_key;

    IF v_entry.coach_id IS DISTINCT FROM p_coach_id
      OR v_entry.member_id IS DISTINCT FROM p_member_id
      OR v_entry.entry_type IS DISTINCT FROM 'credit'
      OR v_entry.minutes IS DISTINCT FROM p_minutes
      OR v_entry.occurred_at IS DISTINCT FROM COALESCE(p_occurred_at, v_entry.occurred_at)
      OR COALESCE(v_entry.note, '') IS DISTINCT FROM COALESCE(NULLIF(trim(p_note), ''), '')
    THEN
      RAISE EXCEPTION '重複請求識別與原紀錄不一致';
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'entry_id', v_entry.id);
END;
$$;

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
  v_before JSONB;
  v_actor TEXT;
BEGIN
  SELECT *
  INTO v_entry
  FROM public.coach_designated_hour_entries
  WHERE id = p_entry_id
    AND voided_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到可修改的指定課紀錄';
  END IF;
  PERFORM public._assert_can_manage_coach_designated_hours(v_entry.coach_id);
  IF p_minutes IS NULL OR p_minutes <= 0 THEN
    RAISE EXCEPTION '分鐘必須大於 0';
  END IF;

  v_before := to_jsonb(v_entry);
  v_actor := public._coach_designated_actor_email();

  UPDATE public.coach_designated_hour_entries
  SET
    minutes = p_minutes,
    occurred_at = CASE
      WHEN entry_type = 'credit' THEN COALESCE(p_occurred_at, occurred_at)
      ELSE occurred_at
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

CREATE OR REPLACE FUNCTION public.void_coach_designated_entry(
  p_entry_id BIGINT
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
  SELECT *
  INTO v_entry
  FROM public.coach_designated_hour_entries
  WHERE id = p_entry_id
    AND voided_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true);
  END IF;
  PERFORM public._assert_can_manage_coach_designated_hours(v_entry.coach_id);
  v_actor := public._coach_designated_actor_email();

  IF v_entry.entry_type = 'report_deduction' THEN
    INSERT INTO public.coach_designated_hour_report_skips (
      booking_participant_id, coach_id, member_id,
      created_by_email, updated_by_email
    )
    SELECT
      bp.id, v_entry.coach_id, v_entry.member_id,
      v_actor, v_actor
    FROM public.booking_participants bp
    WHERE bp.id = v_entry.booking_participant_id
      AND bp.coach_id = v_entry.coach_id
      AND bp.member_id = v_entry.member_id
      AND bp.lesson_type = 'designated_free'
      AND NOT COALESCE(bp.is_deleted, false)
    ON CONFLICT (booking_participant_id) DO UPDATE
    SET coach_id = EXCLUDED.coach_id,
        member_id = EXCLUDED.member_id,
        updated_at = CURRENT_TIMESTAMP,
        updated_by_email = EXCLUDED.updated_by_email;
  END IF;

  INSERT INTO public.coach_designated_hour_revisions (
    entry_id, coach_id, member_id, action,
    before_data, after_data, actor_email
  ) VALUES (
    v_entry.id, v_entry.coach_id, v_entry.member_id, 'void',
    to_jsonb(v_entry), NULL, v_actor
  );

  UPDATE public.coach_designated_hour_entries
  SET voided_at = CURRENT_TIMESTAMP,
      voided_by_email = v_actor,
      updated_at = CURRENT_TIMESTAMP,
      updated_by_email = v_actor
  WHERE id = p_entry_id;

  RETURN jsonb_build_object('success', true);
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
    SELECT *
    INTO v_participant
    FROM public.booking_participants
    WHERE id = (v_item ->> 'participant_id')::INTEGER
    FOR UPDATE;

    IF NOT FOUND OR v_participant.coach_id IS DISTINCT FROM p_coach_id THEN
      RAISE EXCEPTION '找不到指定教練的參與者回報';
    END IF;

    v_deduct := COALESCE((v_item ->> 'deduct')::BOOLEAN, false);
    v_minutes := COALESCE((v_item ->> 'minutes')::INTEGER, 0);

    SELECT *
    INTO v_existing
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
          coach_id, member_id, entry_type, minutes, occurred_at,
          booking_participant_id, created_by_email, updated_by_email
        ) VALUES (
          p_coach_id, v_participant.member_id, 'report_deduction',
          v_minutes, v_occurred_at, v_participant.id, v_actor, v_actor
        );
      ELSIF v_existing.minutes IS DISTINCT FROM v_minutes
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
            'minutes', v_minutes
          ),
          v_actor
        );

        UPDATE public.coach_designated_hour_entries
        SET coach_id = p_coach_id,
            member_id = v_participant.member_id,
            minutes = v_minutes,
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

-- Add a credit and apply selected historical reports in one transaction. This prevents
-- a retry from creating a duplicate credit if one of the selected reports is invalid.
CREATE OR REPLACE FUNCTION public.create_coach_designated_credit_with_reports(
  p_coach_id UUID,
  p_member_id UUID,
  p_minutes INTEGER,
  p_occurred_at TIMESTAMPTZ,
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
  v_credit JSONB;
  v_sync JSONB;
BEGIN
  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION '扣除資料格式錯誤';
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

  v_credit := public.create_coach_designated_credit(
    p_coach_id, p_member_id, p_minutes, p_occurred_at, p_note, p_request_key
  );
  v_sync := public.sync_coach_designated_report_deductions(p_coach_id, p_items);
  RETURN v_credit || jsonb_build_object('deductions_synced', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_coach_designated_eligible_reports(
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
  v_reports JSONB;
BEGIN
  PERFORM public._assert_can_manage_coach_designated_hours(p_coach_id);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'participant_id', bp.id,
      'duration_min', bp.duration_min,
      'booking_start_at', b.start_at,
      'boat_name', boat.name
    )
    ORDER BY NULLIF(b.start_at, '')::TIMESTAMPTZ DESC, bp.id DESC
  ), '[]'::jsonb)
  INTO v_reports
  FROM public.booking_participants bp
  JOIN public.bookings b ON b.id = bp.booking_id
  LEFT JOIN public.boats boat ON boat.id = b.boat_id
  WHERE bp.coach_id = p_coach_id
    AND bp.member_id = p_member_id
    AND bp.lesson_type = 'designated_free'
    AND bp.is_teaching = true
    AND bp.is_deleted = false
    AND NOT EXISTS (
      SELECT 1
      FROM public.coach_designated_hour_entries e
      WHERE e.booking_participant_id = bp.id
        AND e.entry_type = 'report_deduction'
        AND e.voided_at IS NULL
    );

  RETURN jsonb_build_object('success', true, 'reports', v_reports);
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
      'balance', x.balance,
      'last_activity_at', x.last_activity_at
    )
    ORDER BY x.last_activity_at DESC, x.coach_name
  ), '[]'::jsonb)
  INTO v_balances
  FROM (
    SELECT
      e.coach_id,
      c.name AS coach_name,
      SUM(CASE e.entry_type WHEN 'credit' THEN e.minutes ELSE -e.minutes END)::INTEGER AS balance,
      MAX(e.updated_at) AS last_activity_at
    FROM public.coach_designated_hour_entries e
    JOIN public.coaches c ON c.id = e.coach_id
    WHERE e.member_id = v_member_id
      AND e.voided_at IS NULL
    GROUP BY e.coach_id, c.name
    HAVING
      SUM(CASE e.entry_type WHEN 'credit' THEN e.minutes ELSE -e.minutes END) <> 0
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
BEGIN
  SELECT member_id INTO v_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到有效的會員綁定');
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_total
  FROM public.coach_designated_hour_entries e
  WHERE e.member_id = v_member_id
    AND e.coach_id = p_coach_id
    AND e.voided_at IS NULL;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY occurred_at DESC, id DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT
      e.id,
      e.entry_type,
      e.minutes,
      CASE e.entry_type WHEN 'credit' THEN e.minutes ELSE -e.minutes END AS delta_minutes,
      e.occurred_at,
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
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public._coach_designated_actor_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._can_manage_coach_designated_hours(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_can_manage_coach_designated_hours(UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_coach_designated_member_context(UUID, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_coach_designated_students(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_coach_designated_student_detail(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_coach_designated_credit(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_coach_designated_entry(BIGINT, INTEGER, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_coach_designated_entry(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_coach_designated_report_deductions(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_coach_designated_credit_with_reports(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_coach_designated_eligible_reports(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_coach_designated_member_context(UUID, UUID, INTEGER)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_coach_designated_students(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_coach_designated_student_detail(UUID, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_coach_designated_credit(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_coach_designated_entry(BIGINT, INTEGER, TIMESTAMPTZ, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_coach_designated_entry(BIGINT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_coach_designated_report_deductions(UUID, JSONB)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_coach_designated_credit_with_reports(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT, JSONB, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_coach_designated_eligible_reports(UUID, UUID)
  TO authenticated, service_role;

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

SELECT 'coach designated-hour RPCs created' AS status;
