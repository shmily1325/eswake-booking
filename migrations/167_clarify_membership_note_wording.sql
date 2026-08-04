-- =============================================================================
-- 167_clarify_membership_note_wording.sql
--
-- Make auto-generated membership notes human-readable:
-- - Dual pairing notes name the partner on BOTH sides
-- - Avoid "general → general" / raw English type codes
-- - Skip notes when nothing meaningful changed (unless custom memo)
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.membership_type_label(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(p_type, ''))
    WHEN 'general' THEN '一般會員'
    WHEN 'dual' THEN '雙人會員'
    WHEN 'guest' THEN '非會員'
    WHEN 'es' THEN 'ES'
    WHEN '' THEN '未設定'
    ELSE coalesce(p_type, '未設定')
  END
$$;

REVOKE ALL ON FUNCTION public.membership_type_label(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.membership_type_label(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.member_display_name(p_nickname text, p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(nullif(btrim(coalesce(p_nickname, '')), ''), nullif(btrim(coalesce(p_name, '')), ''), '（未命名）')
$$;

REVOKE ALL ON FUNCTION public.member_display_name(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_display_name(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_member_with_membership(
  p_name text,
  p_nickname text DEFAULT NULL,
  p_birthday date DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_membership_type text DEFAULT 'general',
  p_membership_start_date date DEFAULT NULL,
  p_membership_end_date date DEFAULT NULL,
  p_membership_partner_id uuid DEFAULT NULL,
  p_boards jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_partner members%ROWTYPE;
  v_board jsonb;
  v_slot_number integer;
  v_type text := lower(coalesce(p_membership_type, 'general'));
  v_start_date date := p_membership_start_date;
  v_end_date date := p_membership_end_date;
  v_new_display text;
  v_partner_display text;
BEGIN
  PERFORM public.assert_membership_admin();
  PERFORM pg_advisory_xact_lock(hashtext('membership_lifecycle'));

  IF nullif(btrim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Member name is required';
  END IF;
  IF v_type NOT IN ('general', 'dual', 'guest', 'es') THEN
    RAISE EXCEPTION 'Invalid membership type: %', v_type;
  END IF;

  IF p_phone IS NOT NULL AND btrim(p_phone) <> ''
     AND btrim(p_phone) !~ '^09[0-9]{8}$' THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;
  IF v_start_date IS NOT NULL AND v_end_date IS NOT NULL
     AND v_start_date > v_end_date THEN
    RAISE EXCEPTION 'Membership start date cannot be after end date';
  END IF;

  IF v_type = 'guest' THEN
    v_start_date := NULL;
    v_end_date := NULL;
    p_membership_partner_id := NULL;
  ELSIF v_type IN ('general', 'es') THEN
    p_membership_partner_id := NULL;
  ELSIF p_membership_partner_id IS NULL THEN
    RAISE EXCEPTION 'Dual membership requires a partner';
  ELSIF v_end_date IS NULL THEN
    RAISE EXCEPTION 'Dual membership requires an end date';
  END IF;

  IF v_type = 'dual' THEN
    SELECT *
    INTO v_partner
    FROM members
    WHERE id = p_membership_partner_id
    FOR UPDATE;

    IF NOT FOUND OR v_partner.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Selected partner is not active';
    END IF;
    IF v_partner.membership_partner_id IS NOT NULL THEN
      RAISE EXCEPTION 'Selected partner already has a partner';
    END IF;
    IF v_partner.membership_type = 'es' THEN
      RAISE EXCEPTION 'ES membership cannot be converted to a dual membership partner';
    END IF;
  END IF;

  INSERT INTO members (
    name,
    nickname,
    birthday,
    phone,
    membership_type,
    membership_start_date,
    membership_end_date,
    membership_partner_id,
    free_hours,
    free_hours_used,
    balance,
    designated_lesson_minutes,
    boat_voucher_g23_minutes,
    boat_voucher_g21_panther_minutes,
    status,
    created_at
  )
  VALUES (
    btrim(p_name),
    nullif(btrim(coalesce(p_nickname, '')), ''),
    p_birthday,
    nullif(btrim(coalesce(p_phone, '')), ''),
    v_type,
    v_start_date::text,
    v_end_date::text,
    p_membership_partner_id,
    0,
    0,
    0,
    0,
    0,
    0,
    'active',
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD"T"HH24:MI:SS')
  )
  RETURNING id INTO v_member_id;

  v_new_display := public.member_display_name(p_nickname, p_name);

  IF v_type = 'dual' THEN
    v_partner_display := public.member_display_name(v_partner.nickname, v_partner.name);

    UPDATE members
    SET membership_type = 'dual',
        membership_partner_id = v_member_id,
        membership_start_date = coalesce(membership_start_date, v_start_date::text),
        membership_end_date = v_end_date::text
    WHERE id = p_membership_partner_id;

    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (
      p_membership_partner_id,
      coalesce(v_start_date, public.membership_venue_date()),
      '入會',
      format('與 %s 建立雙人會籍，至 %s', v_new_display, v_end_date)
    );
  END IF;

  IF v_type <> 'guest' THEN
    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (
      v_member_id,
      coalesce(v_start_date, public.membership_venue_date()),
      '入會',
      CASE
        WHEN v_type = 'dual' THEN
          format('與 %s 建立雙人會籍，至 %s', v_partner_display, v_end_date)
        ELSE '入會'
      END
    );
  END IF;

  IF jsonb_typeof(coalesce(p_boards, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Boards must be a JSON array';
  END IF;

  FOR v_board IN
    SELECT value FROM jsonb_array_elements(coalesce(p_boards, '[]'::jsonb))
  LOOP
    v_slot_number := nullif(v_board ->> 'slot_number', '')::integer;
    IF v_slot_number IS NULL OR v_slot_number NOT BETWEEN 1 AND 145 THEN
      RAISE EXCEPTION 'Board slot number must be between 1 and 145';
    END IF;
    IF nullif(v_board ->> 'expires_at', '') IS NOT NULL
       AND NOT public.is_valid_membership_date(v_board ->> 'expires_at') THEN
      RAISE EXCEPTION 'Invalid board expiry date';
    END IF;

    INSERT INTO board_storage (
      member_id,
      slot_number,
      start_date,
      expires_at,
      notes,
      status
    )
    VALUES (
      v_member_id,
      v_slot_number,
      nullif(v_board ->> 'start_date', '')::date,
      nullif(v_board ->> 'expires_at', ''),
      nullif(btrim(coalesce(v_board ->> 'notes', '')), ''),
      'active'
    );

    IF nullif(v_board ->> 'start_date', '') IS NOT NULL THEN
      INSERT INTO member_notes (member_id, event_date, event_type, description)
      VALUES (
        v_member_id,
        (v_board ->> 'start_date')::date,
        '備註',
        format('置板開始 #%s', v_slot_number)
      );
    END IF;
  END LOOP;

  RETURN v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_member_membership(
  p_member_id uuid,
  p_membership_type text,
  p_membership_start_date date DEFAULT NULL,
  p_membership_end_date date DEFAULT NULL,
  p_membership_partner_id uuid DEFAULT NULL,
  p_memo text DEFAULT NULL,
  p_record_note boolean DEFAULT true,
  p_profile jsonb DEFAULT NULL,
  p_boards jsonb DEFAULT NULL,
  p_deleted_board_ids integer[] DEFAULT '{}'::integer[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_old_partner members%ROWTYPE;
  v_new_partner members%ROWTYPE;
  v_type text := lower(coalesce(p_membership_type, ''));
  v_start_date date := p_membership_start_date;
  v_end_date date := p_membership_end_date;
  v_description text;
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_type_changed boolean;
  v_partner_changed boolean;
  v_dates_changed boolean;
  v_board jsonb;
  v_board_id integer;
  v_slot_number integer;
BEGIN
  PERFORM public.assert_membership_admin();
  PERFORM pg_advisory_xact_lock(hashtext('membership_lifecycle'));

  SELECT * INTO v_member
  FROM members
  WHERE id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_type NOT IN ('general', 'dual', 'guest', 'es') THEN
    RAISE EXCEPTION 'Invalid membership type: %', v_type;
  END IF;
  IF v_type = 'guest'
     AND v_member.membership_type = 'guest'
     AND v_member.membership_start_date IS NULL
     AND v_member.membership_end_date IS NULL
     AND v_member.membership_partner_id IS NULL
     AND p_profile IS NULL
     AND p_boards IS NULL
     AND cardinality(p_deleted_board_ids) = 0 THEN
    RETURN;
  END IF;
  IF v_start_date IS NOT NULL AND v_end_date IS NOT NULL
     AND v_start_date > v_end_date THEN
    RAISE EXCEPTION 'Membership start date cannot be after end date';
  END IF;

  IF v_type = 'guest' THEN
    v_start_date := NULL;
    v_end_date := NULL;
    p_membership_partner_id := NULL;
  ELSIF v_type IN ('general', 'es') THEN
    p_membership_partner_id := NULL;
  ELSIF p_membership_partner_id IS NULL THEN
    RAISE EXCEPTION 'Dual membership requires a partner';
  ELSIF p_membership_partner_id = p_member_id THEN
    RAISE EXCEPTION 'A member cannot be paired with themselves';
  ELSIF v_end_date IS NULL THEN
    RAISE EXCEPTION 'Dual membership requires an end date';
  END IF;

  IF v_member.membership_partner_id IS NOT NULL THEN
    SELECT * INTO v_old_partner
    FROM members
    WHERE id = v_member.membership_partner_id
    FOR UPDATE;
  END IF;

  IF p_membership_partner_id IS NOT NULL THEN
    SELECT * INTO v_new_partner
    FROM members
    WHERE id = p_membership_partner_id
    FOR UPDATE;
    IF NOT FOUND OR v_new_partner.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Selected partner is not active';
    END IF;
    IF v_new_partner.membership_partner_id IS NOT NULL
       AND v_new_partner.membership_partner_id <> p_member_id THEN
      RAISE EXCEPTION 'Selected partner already has another partner';
    END IF;
    IF v_new_partner.membership_type = 'es'
       AND v_new_partner.id IS DISTINCT FROM v_member.membership_partner_id THEN
      RAISE EXCEPTION 'ES membership cannot be converted to a dual membership partner';
    END IF;
  END IF;

  v_type_changed := v_type IS DISTINCT FROM v_member.membership_type;
  v_partner_changed := p_membership_partner_id IS DISTINCT FROM v_member.membership_partner_id;
  v_dates_changed :=
    (v_start_date::text IS DISTINCT FROM v_member.membership_start_date)
    OR (v_end_date::text IS DISTINCT FROM v_member.membership_end_date);

  IF v_member.membership_partner_id IS NOT NULL
     AND v_member.membership_partner_id IS DISTINCT FROM p_membership_partner_id THEN
    IF v_old_partner.membership_partner_id IS DISTINCT FROM p_member_id THEN
      RAISE EXCEPTION 'Existing membership link is not reciprocal; run the membership audit before changing it';
    END IF;

    UPDATE members
    SET membership_type = 'general',
        membership_partner_id = NULL
    WHERE id = v_member.membership_partner_id;

    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (
      v_member.membership_partner_id,
      public.membership_venue_date(),
      '備註',
      format(
        '與 %s 解除雙人會籍配對，改為一般會員',
        public.member_display_name(v_member.nickname, v_member.name)
      )
    );
  END IF;

  UPDATE members
  SET membership_type = v_type,
      membership_start_date = v_start_date::text,
      membership_end_date = v_end_date::text,
      membership_partner_id = p_membership_partner_id
  WHERE id = p_member_id;

  IF v_type = 'dual' THEN
    UPDATE members
    SET membership_type = 'dual',
        membership_partner_id = p_member_id,
        membership_start_date = coalesce(membership_start_date, v_start_date::text),
        membership_end_date = v_end_date::text
    WHERE id = p_membership_partner_id;

    IF v_partner_changed THEN
      INSERT INTO member_notes (member_id, event_date, event_type, description)
      VALUES (
        p_membership_partner_id,
        public.membership_venue_date(),
        '備註',
        format(
          '與 %s 建立雙人會籍，至 %s',
          public.member_display_name(v_member.nickname, v_member.name),
          v_end_date
        )
      );
    ELSIF p_record_note AND v_dates_changed THEN
      INSERT INTO member_notes (member_id, event_date, event_type, description)
      VALUES (
        p_membership_partner_id,
        public.membership_venue_date(),
        '備註',
        format('雙人會籍效期同步調整為 %s ～ %s',
          coalesce(v_start_date::text, '未設定'),
          coalesce(v_end_date::text, '未設定'))
      );
    END IF;
  END IF;

  IF v_type = 'guest' THEN
    IF v_member.membership_type = 'guest' THEN
      v_description := '修正非會員資料，清除殘留會籍日期與配對';
    ELSE
      v_description := format(
        '會籍不續約，轉非會員%s',
        CASE
          WHEN v_member.membership_end_date IS NOT NULL
            THEN format('（原到期：%s）', v_member.membership_end_date)
          ELSE ''
        END
      );
    END IF;
  ELSIF v_type = 'dual' AND v_partner_changed THEN
    v_description := format(
      '與 %s 建立雙人會籍，至 %s',
      public.member_display_name(v_new_partner.nickname, v_new_partner.name),
      v_end_date
    );
  ELSIF v_type_changed THEN
    v_description := format(
      '會籍類型變更：%s → %s',
      public.membership_type_label(v_member.membership_type),
      public.membership_type_label(v_type)
    );
    IF v_start_date IS NOT NULL OR v_end_date IS NOT NULL THEN
      v_description := v_description || format(
        '；效期 %s ～ %s',
        coalesce(v_start_date::text, '未設定'),
        coalesce(v_end_date::text, '未設定')
      );
    END IF;
  ELSIF v_dates_changed THEN
    v_description := format(
      '%s效期調整為 %s ～ %s',
      CASE WHEN v_type = 'dual' THEN '雙人會籍' ELSE '會籍' END,
      coalesce(v_start_date::text, '未設定'),
      coalesce(v_end_date::text, '未設定')
    );
  ELSIF v_memo IS NOT NULL THEN
    v_description := v_memo;
  ELSE
    v_description := NULL;
  END IF;

  IF v_description IS NOT NULL
     AND v_memo IS NOT NULL
     AND v_description IS DISTINCT FROM v_memo THEN
    v_description := v_description || format('（%s）', v_memo);
  END IF;

  IF v_description IS NOT NULL
     AND (
       p_record_note
       OR v_type_changed
       OR v_partner_changed
     ) THEN
    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (p_member_id, public.membership_venue_date(), '備註', v_description);
  END IF;

  IF p_profile IS NOT NULL THEN
    IF nullif(btrim(coalesce(p_profile ->> 'name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Member name is required';
    END IF;
    IF nullif(btrim(coalesce(p_profile ->> 'phone', '')), '') IS NOT NULL
       AND btrim(p_profile ->> 'phone') !~ '^09[0-9]{8}$' THEN
      RAISE EXCEPTION 'Invalid phone number';
    END IF;

    UPDATE members
    SET name = btrim(p_profile ->> 'name'),
        nickname = nullif(btrim(coalesce(p_profile ->> 'nickname', '')), ''),
        birthday = nullif(p_profile ->> 'birthday', ''),
        phone = nullif(btrim(coalesce(p_profile ->> 'phone', '')), '')
    WHERE id = p_member_id;
  END IF;

  IF cardinality(p_deleted_board_ids) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM board_storage
      WHERE id = ANY(p_deleted_board_ids)
        AND member_id <> p_member_id
    ) THEN
      RAISE EXCEPTION 'Cannot delete another member''s board slot';
    END IF;
    DELETE FROM board_storage
    WHERE member_id = p_member_id
      AND id = ANY(p_deleted_board_ids);
  END IF;

  IF p_boards IS NOT NULL THEN
    IF jsonb_typeof(p_boards) <> 'array' THEN
      RAISE EXCEPTION 'Boards must be a JSON array';
    END IF;

    -- Temporarily free existing slot numbers so two slots can be swapped in
    -- one atomic save without hitting the UNIQUE constraint midway through.
    UPDATE board_storage
    SET slot_number = -id
    WHERE member_id = p_member_id
      AND id IN (
        SELECT nullif(value ->> 'id', '')::integer
        FROM jsonb_array_elements(p_boards)
        WHERE nullif(value ->> 'id', '') IS NOT NULL
      );

    FOR v_board IN SELECT value FROM jsonb_array_elements(p_boards)
    LOOP
      v_board_id := nullif(v_board ->> 'id', '')::integer;
      v_slot_number := nullif(v_board ->> 'slot_number', '')::integer;
      IF v_slot_number IS NULL OR v_slot_number NOT BETWEEN 1 AND 145 THEN
        RAISE EXCEPTION 'Board slot number must be between 1 and 145';
      END IF;
      IF nullif(v_board ->> 'expires_at', '') IS NOT NULL
         AND NOT public.is_valid_membership_date(v_board ->> 'expires_at') THEN
        RAISE EXCEPTION 'Invalid board expiry date';
      END IF;

      IF v_board_id IS NULL THEN
        INSERT INTO board_storage (
          member_id, slot_number, start_date, expires_at, status
        )
        VALUES (
          p_member_id,
          v_slot_number,
          nullif(v_board ->> 'start_date', '')::date,
          nullif(v_board ->> 'expires_at', ''),
          'active'
        );
      ELSE
        UPDATE board_storage
        SET slot_number = v_slot_number,
            start_date = nullif(v_board ->> 'start_date', '')::date,
            expires_at = nullif(v_board ->> 'expires_at', ''),
            status = 'active'
        WHERE id = v_board_id
          AND member_id = p_member_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Board slot does not belong to this member';
        END IF;
      END IF;
    END LOOP;
  END IF;

END;
$$;

COMMIT;
