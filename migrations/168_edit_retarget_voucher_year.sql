-- =============================================================================
-- 168: 編輯改入帳年時，用 adjust_credit_lot_remaining 寫回新年
-- （add_credit_lots 遇 Σ≠members 會靜默跳過，改年看起來像沒存到 lot）
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_manual_member_adjust_edit(
  p_transaction_id bigint,
  p_member_id uuid,
  p_category text,
  p_adjust_type text,
  p_qty numeric,
  p_description text,
  p_notes text DEFAULT NULL,
  p_transaction_date date DEFAULT NULL,
  p_voucher_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions%ROWTYPE;
  v_member members%ROWTYPE;
  v_old_abs numeric;
  v_old_delta numeric;
  v_new_delta numeric;
  v_after numeric;
  v_year integer;
  v_fifo jsonb;
  v_alloc jsonb := NULL;
  v_is_amount boolean;
  v_amount numeric;
  v_minutes integer;
  v_field_after numeric;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_adjust_type NOT IN ('increase', 'decrease') THEN
    RETURN jsonb_build_object('success', false, 'error', '操作類型無效');
  END IF;
  IF p_qty IS NULL OR p_qty < 0 THEN
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

  SELECT * INTO v_tx
  FROM transactions
  WHERE id = p_transaction_id AND member_id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到交易');
  END IF;

  SELECT * INTO v_member FROM members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  v_old_abs := abs(COALESCE(v_tx.amount, v_tx.minutes, 0));
  v_old_delta := CASE WHEN v_tx.adjust_type = 'increase' THEN v_old_abs ELSE -v_old_abs END;
  v_new_delta := CASE WHEN p_adjust_type = 'increase' THEN p_qty ELSE -p_qty END;

  v_is_amount := p_category IN ('balance', 'vip_voucher');
  v_amount := CASE WHEN v_is_amount THEN p_qty ELSE NULL END;
  v_minutes := CASE WHEN v_is_amount THEN NULL ELSE p_qty::integer END;

  IF p_adjust_type = 'increase'
     AND p_category IN ('vip_voucher', 'boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    v_year := p_voucher_year;
    IF v_year IS NOT NULL AND (v_year < 2020 OR v_year > 2100) THEN
      RETURN jsonb_build_object('success', false, 'error', '入帳年無效');
    END IF;
  ELSE
    v_year := NULL;
  END IF;

  -- 還原舊 lot
  IF v_tx.category IN ('vip_voucher', 'boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    IF v_tx.adjust_type = 'increase' AND v_tx.voucher_year IS NOT NULL THEN
      PERFORM public.adjust_credit_lot_remaining(
        p_member_id, v_tx.category, v_tx.voucher_year, -v_old_abs
      );
    ELSIF v_tx.adjust_type IS DISTINCT FROM 'increase' THEN
      PERFORM public.restore_credit_lots_from_allocations(
        p_member_id, v_tx.category, v_tx.lot_allocations, v_old_abs
      );
    END IF;
  END IF;

  CASE v_tx.category
    WHEN 'balance' THEN
      UPDATE members SET balance = COALESCE(balance, 0) - v_old_delta WHERE id = p_member_id;
    WHEN 'vip_voucher' THEN
      UPDATE members SET vip_voucher_amount = COALESCE(vip_voucher_amount, 0) - v_old_delta WHERE id = p_member_id;
    WHEN 'designated_lesson' THEN
      UPDATE members SET designated_lesson_minutes =
        (COALESCE(designated_lesson_minutes, 0) - v_old_delta)::integer WHERE id = p_member_id;
    WHEN 'boat_voucher_g23' THEN
      UPDATE members SET boat_voucher_g23_minutes =
        (COALESCE(boat_voucher_g23_minutes, 0) - v_old_delta)::integer WHERE id = p_member_id;
    WHEN 'boat_voucher_g21_panther' THEN
      UPDATE members SET boat_voucher_g21_panther_minutes =
        (COALESCE(boat_voucher_g21_panther_minutes, 0) - v_old_delta)::integer WHERE id = p_member_id;
    WHEN 'gift_boat_hours' THEN
      UPDATE members SET gift_boat_hours =
        (COALESCE(gift_boat_hours, 0) - v_old_delta)::integer WHERE id = p_member_id;
    ELSE NULL;
  END CASE;

  CASE p_category
    WHEN 'balance' THEN
      UPDATE members SET balance = COALESCE(balance, 0) + v_new_delta WHERE id = p_member_id
      RETURNING balance INTO v_field_after;
    WHEN 'vip_voucher' THEN
      UPDATE members SET vip_voucher_amount = COALESCE(vip_voucher_amount, 0) + v_new_delta WHERE id = p_member_id
      RETURNING vip_voucher_amount INTO v_field_after;
    WHEN 'designated_lesson' THEN
      UPDATE members SET designated_lesson_minutes =
        (COALESCE(designated_lesson_minutes, 0) + v_new_delta)::integer WHERE id = p_member_id
      RETURNING designated_lesson_minutes INTO v_field_after;
    WHEN 'boat_voucher_g23' THEN
      UPDATE members SET boat_voucher_g23_minutes =
        (COALESCE(boat_voucher_g23_minutes, 0) + v_new_delta)::integer WHERE id = p_member_id
      RETURNING boat_voucher_g23_minutes INTO v_field_after;
    WHEN 'boat_voucher_g21_panther' THEN
      UPDATE members SET boat_voucher_g21_panther_minutes =
        (COALESCE(boat_voucher_g21_panther_minutes, 0) + v_new_delta)::integer WHERE id = p_member_id
      RETURNING boat_voucher_g21_panther_minutes INTO v_field_after;
    WHEN 'gift_boat_hours' THEN
      UPDATE members SET gift_boat_hours =
        (COALESCE(gift_boat_hours, 0) + v_new_delta)::integer WHERE id = p_member_id
      RETURNING gift_boat_hours INTO v_field_after;
  END CASE;

  v_after := v_field_after;

  IF p_category IN ('vip_voucher', 'boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    IF p_adjust_type = 'increase' AND v_year IS NOT NULL THEN
      IF v_tx.adjust_type = 'increase'
         AND v_tx.voucher_year IS NULL
         AND v_tx.category = p_category THEN
        -- 未標年歷史：只改標年不動 lot（lot 多半已用總剩餘種子）；金額有變才調差額
        IF p_qty <> v_old_abs THEN
          PERFORM public.adjust_credit_lot_remaining(
            p_member_id, p_category, v_year, p_qty - v_old_abs
          );
        END IF;
      ELSE
        -- 改年／一般加點編輯：直接加減指定年（不走 add_credit_lots 一致性門檻）
        PERFORM public.adjust_credit_lot_remaining(
          p_member_id, p_category, v_year, p_qty
        );
      END IF;
    ELSIF p_adjust_type = 'decrease' THEN
      v_fifo := public.try_consume_credit_lots_fifo(
        p_member_id, p_category, p_qty, v_after
      );
      IF COALESCE((v_fifo->>'applied')::boolean, false) THEN
        v_alloc := v_fifo->'allocations';
      END IF;
    END IF;
  END IF;

  UPDATE transactions t SET
    category = p_category,
    adjust_type = p_adjust_type,
    amount = v_amount,
    minutes = v_minutes,
    description = btrim(p_description),
    notes = nullif(btrim(p_notes), ''),
    transaction_date = COALESCE(p_transaction_date, t.transaction_date),
    voucher_year = v_year,
    lot_allocations = v_alloc,
    balance_after = m.balance,
    vip_voucher_amount_after = m.vip_voucher_amount,
    designated_lesson_minutes_after = m.designated_lesson_minutes,
    boat_voucher_g23_minutes_after = m.boat_voucher_g23_minutes,
    boat_voucher_g21_panther_minutes_after = m.boat_voucher_g21_panther_minutes,
    gift_boat_hours_after = m.gift_boat_hours
  FROM members m
  WHERE t.id = p_transaction_id
    AND m.id = p_member_id;

  RETURN jsonb_build_object('success', true, 'balance_after', v_after);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.process_manual_member_adjust_edit(
  bigint, uuid, text, text, numeric, text, text, date, integer
) IS
  '手動記帳編輯（原子）。改入帳年用 adjust_credit_lot_remaining；入帳年可為 NULL。';

COMMIT;
