-- =============================================================================
-- 148_add_membership_lifecycle_rpcs.sql
--
-- Centralize membership changes in atomic, super-admin-only RPCs.
-- Board storage is independent from membership and is only accepted by the
-- create RPC so a failed board insert also rolls back the new member.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'Missing public.is_super_admin(); apply migration 114 first';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.assert_membership_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized to manage memberships'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_membership_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_membership_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_valid_membership_date(p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public
AS $$
BEGIN
  RETURN p_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     AND p_value = (p_value::date)::text;
EXCEPTION
  WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_membership_date(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_membership_date(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.membership_venue_date()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (statement_timestamp() AT TIME ZONE 'Asia/Taipei')::date
$$;

REVOKE ALL ON FUNCTION public.membership_venue_date() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.membership_venue_date() TO authenticated, service_role;

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

  IF v_type = 'dual' THEN
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
      format('與 %s 建立雙人會籍，至 %s', coalesce(nullif(btrim(p_nickname), ''), btrim(p_name)), v_end_date)
    );
  END IF;

  IF v_type <> 'guest' THEN
    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (
      v_member_id,
      coalesce(v_start_date, public.membership_venue_date()),
      '入會',
      CASE
        WHEN v_type = 'dual' THEN format('加入雙人會籍，至 %s', v_end_date)
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
      format('與 %s 解除雙人會籍配對，改為一般會員', coalesce(v_member.nickname, v_member.name))
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

    IF v_member.membership_partner_id IS DISTINCT FROM p_membership_partner_id THEN
      INSERT INTO member_notes (member_id, event_date, event_type, description)
      VALUES (
        p_membership_partner_id,
        public.membership_venue_date(),
        '備註',
        format('與 %s 建立雙人會籍，至 %s', coalesce(v_member.nickname, v_member.name), v_end_date)
      );
    ELSIF p_record_note
          AND v_member.membership_end_date IS DISTINCT FROM v_end_date::text THEN
      INSERT INTO member_notes (member_id, event_date, event_type, description)
      VALUES (
        p_membership_partner_id,
        public.membership_venue_date(),
        '備註',
        format('雙人會籍到期日同步調整至 %s', v_end_date)
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
  ELSE
    v_description := format(
      '會籍資料更新：%s → %s；日期 %s ～ %s',
      coalesce(v_member.membership_type, '未設定'),
      v_type,
      coalesce(v_start_date::text, '未設定'),
      coalesce(v_end_date::text, '未設定')
    );
  END IF;
  IF nullif(btrim(coalesce(p_memo, '')), '') IS NOT NULL THEN
    v_description := v_description || format('（%s）', btrim(p_memo));
  END IF;

  IF p_record_note
     OR v_type IS DISTINCT FROM v_member.membership_type
     OR p_membership_partner_id IS DISTINCT FROM v_member.membership_partner_id THEN
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

CREATE OR REPLACE FUNCTION public.renew_member_membership(
  p_member_id uuid,
  p_membership_end_date date,
  p_renew_both boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_partner members%ROWTYPE;
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
  IF p_membership_end_date IS NULL OR p_membership_end_date < public.membership_venue_date() THEN
    RAISE EXCEPTION 'New membership end date must not be in the past';
  END IF;

  -- Normalize legacy one-sided links before renewing a non-dual member.
  IF v_member.membership_type <> 'dual'
     AND v_member.membership_partner_id IS NOT NULL THEN
    SELECT * INTO v_partner
    FROM members
    WHERE id = v_member.membership_partner_id
    FOR UPDATE;

    IF FOUND AND v_partner.membership_partner_id = p_member_id THEN
      UPDATE members
      SET membership_type = CASE WHEN membership_type = 'dual' THEN 'general' ELSE membership_type END,
          membership_partner_id = NULL
      WHERE id = v_member.membership_partner_id;

      INSERT INTO member_notes (member_id, event_date, event_type, description)
      VALUES (
        v_member.membership_partner_id,
        public.membership_venue_date(),
        '備註',
        format('修正與 %s 的殘留會籍配對', coalesce(v_member.nickname, v_member.name))
      );
    ELSIF FOUND THEN
      RAISE EXCEPTION 'Existing membership link is not reciprocal; run the membership audit before renewing it';
    END IF;
  END IF;

  IF v_member.membership_type = 'dual' THEN
    IF v_member.membership_partner_id IS NULL THEN
      RAISE EXCEPTION 'Dual membership is missing its partner';
    END IF;
    SELECT * INTO v_partner
    FROM members
    WHERE id = v_member.membership_partner_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_partner.membership_type IS DISTINCT FROM 'dual'
       OR v_partner.membership_partner_id IS DISTINCT FROM p_member_id THEN
      RAISE EXCEPTION 'Dual membership pair is inconsistent';
    END IF;

    IF p_renew_both THEN
      IF v_member.membership_end_date = p_membership_end_date::text
         AND v_partner.membership_end_date = p_membership_end_date::text THEN
        RETURN;
      END IF;
      UPDATE members
      SET membership_end_date = p_membership_end_date::text
      WHERE id IN (p_member_id, v_member.membership_partner_id);

      INSERT INTO member_notes (member_id, event_date, event_type, description)
      VALUES
        (p_member_id, public.membership_venue_date(), '續約', format('續約至 %s（雙人會籍一起續約）', p_membership_end_date)),
        (v_member.membership_partner_id, public.membership_venue_date(), '續約', format('續約至 %s（與 %s 一起續約）', p_membership_end_date, coalesce(v_member.nickname, v_member.name)));
    ELSE
      UPDATE members
      SET membership_type = 'general',
          membership_partner_id = NULL,
          membership_end_date = p_membership_end_date::text
      WHERE id = p_member_id;

      UPDATE members
      SET membership_type = 'general',
          membership_partner_id = NULL
      WHERE id = v_member.membership_partner_id;

      INSERT INTO member_notes (member_id, event_date, event_type, description)
      VALUES
        (p_member_id, public.membership_venue_date(), '續約', format('單獨續約至 %s，解除雙人會籍配對，改為一般會員', p_membership_end_date)),
        (v_member.membership_partner_id, public.membership_venue_date(), '備註', format('配對會員 %s 單獨續約，解除配對，改為一般會員', coalesce(v_member.nickname, v_member.name)));
    END IF;
  ELSIF v_member.membership_type = 'guest' THEN
    UPDATE members
    SET membership_type = 'general',
        membership_start_date = public.membership_venue_date()::text,
        membership_end_date = p_membership_end_date::text,
        membership_partner_id = NULL
    WHERE id = p_member_id;

    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (p_member_id, public.membership_venue_date(), '入會', format('入會，會籍至 %s', p_membership_end_date));
  ELSE
    IF v_member.membership_end_date = p_membership_end_date::text THEN
      RETURN;
    END IF;
    UPDATE members
    SET membership_end_date = p_membership_end_date::text,
        membership_partner_id = NULL
    WHERE id = p_member_id;

    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (p_member_id, public.membership_venue_date(), '續約', format('續約至 %s', p_membership_end_date));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_member_active_status(
  p_member_id uuid,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
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

  IF p_active THEN
    IF v_member.status = 'active' THEN
      RETURN;
    END IF;
    UPDATE members SET status = 'active' WHERE id = p_member_id;
    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (p_member_id, public.membership_venue_date(), '備註', '會員恢復');
  ELSE
    IF v_member.status = 'inactive' THEN
      RETURN;
    END IF;
    IF v_member.membership_partner_id IS NOT NULL THEN
      PERFORM 1
      FROM members
      WHERE id = v_member.membership_partner_id
        AND membership_partner_id = p_member_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Existing membership link is not reciprocal; run the membership audit before archiving it';
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
        format('配對會員 %s 已隱藏，解除配對，改為一般會員', coalesce(v_member.nickname, v_member.name))
      );
    END IF;

    UPDATE members
    SET status = 'inactive',
        membership_type = CASE WHEN membership_type = 'dual' THEN 'general' ELSE membership_type END,
        membership_partner_id = NULL
    WHERE id = p_member_id;

    UPDATE line_bindings
    SET status = 'revoked'
    WHERE member_id = p_member_id
      AND status = 'active';

    INSERT INTO member_notes (member_id, event_date, event_type, description)
    VALUES (p_member_id, public.membership_venue_date(), '備註', '會員隱藏');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_member_with_membership(text, text, date, text, text, date, date, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_member_membership(uuid, text, date, date, uuid, text, boolean, jsonb, jsonb, integer[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renew_member_membership(uuid, date, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_active_status(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_member_with_membership(text, text, date, text, text, date, date, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_membership(uuid, text, date, date, uuid, text, boolean, jsonb, jsonb, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_member_membership(uuid, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_active_status(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
