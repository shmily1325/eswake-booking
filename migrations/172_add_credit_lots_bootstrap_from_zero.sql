-- =============================================================================
-- 172_add_credit_lots_bootstrap_from_zero.sql
--
-- add_credit_lots：若該會員該類尚無 lot，且加帳後 members 總額 = 本次入帳量
-- （亦即加帳前為 0），則自動開年帳，勿再靜默跳過。
--
-- 仍有「舊餘額、卻從沒開年帳」時：繼續 skip，但 process_manual_member_adjust
-- 回傳 lots_updated=false，讓後台可提示。
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.add_credit_lots(
  p_member_id uuid,
  p_category text,
  p_voucher_year integer,
  p_qty numeric
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lot_count integer;
  v_lots_total numeric;
  v_members_total numeric;
BEGIN
  IF p_qty IS NULL OR p_qty = 0 THEN
    RETURN false;
  END IF;

  IF p_category NOT IN (
    'vip_voucher',
    'boat_voucher_g23',
    'boat_voucher_g21_panther'
  ) THEN
    RETURN false;
  END IF;

  IF p_voucher_year IS NULL
     OR p_voucher_year < 2020
     OR p_voucher_year > 2100 THEN
    RAISE EXCEPTION '無效的 voucher_year: %', p_voucher_year;
  END IF;

  PERFORM 1
  FROM credit_lots
  WHERE member_id = p_member_id
    AND category = p_category
  FOR UPDATE;

  SELECT COUNT(*), COALESCE(SUM(remaining), 0)
  INTO v_lot_count, v_lots_total
  FROM credit_lots
  WHERE member_id = p_member_id
    AND category = p_category;

  v_members_total := public.credit_lot_member_total(p_member_id, p_category);

  -- 尚未建立年帳本
  IF v_lot_count = 0 THEN
    -- 加帳前餘額為 0（加帳後 total ≈ 本次 qty）→ 自動開第一本年帳
    IF abs(v_members_total - p_qty) < 0.005 THEN
      INSERT INTO credit_lots (member_id, category, voucher_year, remaining)
      VALUES (p_member_id, p_category, p_voucher_year, p_qty);
      RETURN true;
    END IF;

    RAISE NOTICE
      'add_credit_lots skipped (no existing lots, prior balance nonzero): member=% category=% members=% qty=%',
      p_member_id, p_category, v_members_total, p_qty;
    RETURN false;
  END IF;

  -- 呼叫端應已先更新 members；lots 應對齊「加之前」= members - qty
  IF abs(v_lots_total - (v_members_total - p_qty)) >= 0.005 THEN
    RAISE NOTICE
      'add_credit_lots skipped: member=% category=% lots=% members_before_expected=%',
      p_member_id, p_category, v_lots_total, (v_members_total - p_qty);
    RETURN false;
  END IF;

  INSERT INTO credit_lots (member_id, category, voucher_year, remaining)
  VALUES (p_member_id, p_category, p_voucher_year, p_qty)
  ON CONFLICT (member_id, category, voucher_year)
  DO UPDATE SET
    remaining = credit_lots.remaining + EXCLUDED.remaining,
    updated_at = now();

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.add_credit_lots(uuid, text, integer, numeric) IS
  '將入帳加到指定年。已有 lot 且 Σ 對得上才加；無 lot 且加帳前餘額為 0 則開第一本年帳。';

-- 編輯路徑：無 lot、正數差額、且 members 恰等於該差額時，同樣允許開第一本
CREATE OR REPLACE FUNCTION public.adjust_credit_lot_remaining(
  p_member_id uuid,
  p_category text,
  p_voucher_year integer,
  p_delta numeric
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lot_count integer;
  v_members_total numeric;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RETURN false;
  END IF;

  IF p_category NOT IN (
    'vip_voucher',
    'boat_voucher_g23',
    'boat_voucher_g21_panther'
  ) THEN
    RETURN false;
  END IF;

  IF p_voucher_year IS NULL
     OR p_voucher_year < 2020
     OR p_voucher_year > 2100 THEN
    RAISE EXCEPTION '無效的 voucher_year: %', p_voucher_year;
  END IF;

  PERFORM 1
  FROM credit_lots
  WHERE member_id = p_member_id
    AND category = p_category
  FOR UPDATE;

  SELECT COUNT(*)
  INTO v_lot_count
  FROM credit_lots
  WHERE member_id = p_member_id
    AND category = p_category;

  IF v_lot_count = 0 THEN
    IF p_delta > 0 THEN
      v_members_total := public.credit_lot_member_total(p_member_id, p_category);
      IF abs(v_members_total - p_delta) < 0.005 THEN
        INSERT INTO credit_lots (member_id, category, voucher_year, remaining)
        VALUES (p_member_id, p_category, p_voucher_year, p_delta);
        RETURN true;
      END IF;
    END IF;
    RETURN false;
  END IF;

  INSERT INTO credit_lots (member_id, category, voucher_year, remaining)
  VALUES (p_member_id, p_category, p_voucher_year, p_delta)
  ON CONFLICT (member_id, category, voucher_year)
  DO UPDATE SET
    remaining = credit_lots.remaining + EXCLUDED.remaining,
    updated_at = now();

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.adjust_credit_lot_remaining(uuid, text, integer, numeric) IS
  '對指定年 remaining 加減；無 lot 且正數差額恰等於 members 總額時可開第一本年帳。';

CREATE OR REPLACE FUNCTION public.process_manual_member_adjust(
  p_member_id uuid,
  p_category text,
  p_adjust_type text,
  p_qty numeric,
  p_description text,
  p_notes text DEFAULT NULL,
  p_transaction_date date DEFAULT NULL,
  p_voucher_year integer DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_delta numeric;
  v_after numeric;
  v_fifo jsonb;
  v_alloc jsonb := NULL;
  v_year integer;
  v_tx_id bigint;
  v_is_amount boolean;
  v_amount numeric;
  v_minutes integer;
  v_lots_updated boolean := NULL;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_adjust_type NOT IN ('increase', 'decrease') THEN
    RETURN jsonb_build_object('success', false, 'error', '操作類型無效');
  END IF;
  IF p_qty IS NULL OR p_qty < 0
     OR lower(p_qty::text) IN ('nan', 'infinity', '-infinity') THEN
    RETURN jsonb_build_object('success', false, 'error', '數值無效');
  END IF;
  IF nullif(btrim(p_description), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '請輸入說明');
  END IF;
  IF p_category NOT IN (
    'balance', 'vip_voucher', 'designated_lesson',
    'boat_voucher_g23', 'boat_voucher_g21_panther', 'gift_boat_hours'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '未知類別');
  END IF;

  v_is_amount := p_category IN ('balance', 'vip_voucher');
  v_amount := CASE WHEN v_is_amount THEN p_qty ELSE NULL END;
  v_minutes := CASE WHEN v_is_amount THEN NULL ELSE p_qty::integer END;
  v_delta := CASE WHEN p_adjust_type = 'increase' THEN p_qty ELSE -p_qty END;

  IF p_adjust_type = 'increase'
     AND p_category IN ('vip_voucher', 'boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    v_year := p_voucher_year;
    IF v_year IS NOT NULL AND (v_year < 2020 OR v_year > 2100) THEN
      RETURN jsonb_build_object('success', false, 'error', '入帳年無效');
    END IF;
  ELSE
    v_year := NULL;
  END IF;

  SELECT * INTO v_member FROM members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  CASE p_category
    WHEN 'balance' THEN
      v_after := COALESCE(v_member.balance, 0) + v_delta;
      UPDATE members SET balance = v_after WHERE id = p_member_id;
    WHEN 'vip_voucher' THEN
      v_after := COALESCE(v_member.vip_voucher_amount, 0) + v_delta;
      UPDATE members SET vip_voucher_amount = v_after WHERE id = p_member_id;
    WHEN 'designated_lesson' THEN
      v_after := COALESCE(v_member.designated_lesson_minutes, 0) + v_delta;
      UPDATE members SET designated_lesson_minutes = v_after::integer WHERE id = p_member_id;
    WHEN 'boat_voucher_g23' THEN
      v_after := COALESCE(v_member.boat_voucher_g23_minutes, 0) + v_delta;
      UPDATE members SET boat_voucher_g23_minutes = v_after::integer WHERE id = p_member_id;
    WHEN 'boat_voucher_g21_panther' THEN
      v_after := COALESCE(v_member.boat_voucher_g21_panther_minutes, 0) + v_delta;
      UPDATE members SET boat_voucher_g21_panther_minutes = v_after::integer WHERE id = p_member_id;
    WHEN 'gift_boat_hours' THEN
      v_after := COALESCE(v_member.gift_boat_hours, 0) + v_delta;
      UPDATE members SET gift_boat_hours = v_after::integer WHERE id = p_member_id;
  END CASE;

  IF p_category IN ('vip_voucher', 'boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    IF p_adjust_type = 'increase' AND v_year IS NOT NULL THEN
      v_lots_updated := public.add_credit_lots(p_member_id, p_category, v_year, p_qty);
    ELSIF p_adjust_type = 'decrease' THEN
      v_fifo := public.try_consume_credit_lots_fifo(
        p_member_id, p_category, p_qty, v_after
      );
      IF COALESCE((v_fifo->>'applied')::boolean, false) THEN
        v_alloc := v_fifo->'allocations';
        v_lots_updated := true;
      ELSE
        v_lots_updated := false;
      END IF;
    END IF;
  END IF;

  INSERT INTO transactions (
    member_id, transaction_type, category, adjust_type,
    amount, minutes, description, notes, transaction_date, operator_id,
    voucher_year, lot_allocations,
    balance_after, vip_voucher_amount_after, designated_lesson_minutes_after,
    boat_voucher_g23_minutes_after, boat_voucher_g21_panther_minutes_after,
    gift_boat_hours_after
  )
  SELECT
    p_member_id, 'adjust', p_category, p_adjust_type,
    v_amount, v_minutes, btrim(p_description), nullif(btrim(p_notes), ''),
    COALESCE(public.as_transaction_date_text(p_transaction_date), public.as_transaction_date_text(public.membership_venue_date())), p_operator_id,
    v_year, v_alloc,
    m.balance, m.vip_voucher_amount, m.designated_lesson_minutes,
    m.boat_voucher_g23_minutes, m.boat_voucher_g21_panther_minutes,
    m.gift_boat_hours
  FROM members m WHERE m.id = p_member_id
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'balance_after', v_after,
    'lots_updated', v_lots_updated
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_credit_lots(uuid, text, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_credit_lot_remaining(uuid, text, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_manual_member_adjust(uuid, text, text, numeric, text, text, date, integer, uuid) TO authenticated;

COMMIT;
