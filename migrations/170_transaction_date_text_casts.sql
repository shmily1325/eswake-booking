-- =============================================================================
-- 170: transactions.transaction_date 一律以 text (YYYY-MM-DD) 寫入
-- 修 COALESCE(date, text) 同類問題，並把新增記帳／扣款／商店結帳寫入改成明確 text
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.as_transaction_date_text(p_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_date IS NULL THEN NULL
    ELSE to_char(p_date, 'YYYY-MM-DD')
  END;
$$;

COMMENT ON FUNCTION public.as_transaction_date_text(date) IS
  '將 date 轉成 transactions.transaction_date 用的 YYYY-MM-DD text';

GRANT EXECUTE ON FUNCTION public.as_transaction_date_text(date) TO authenticated, service_role;

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

  -- 入帳年：前端傳幾年就用幾年；NULL = 明確「無」，不自動填販售年
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
      PERFORM public.add_credit_lots(p_member_id, p_category, v_year, p_qty);
    ELSIF p_adjust_type = 'decrease' THEN
      v_fifo := public.try_consume_credit_lots_fifo(
        p_member_id, p_category, p_qty, v_after
      );
      IF COALESCE((v_fifo->>'applied')::boolean, false) THEN
        v_alloc := v_fifo->'allocations';
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
    'balance_after', v_after
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

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
    transaction_date = COALESCE(public.as_transaction_date_text(p_transaction_date), t.transaction_date),
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

CREATE OR REPLACE FUNCTION public.process_deduction_transaction(
  p_member_id UUID,
  p_participant_id INTEGER,
  p_operator_id UUID,
  p_deductions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_participant booking_participants%ROWTYPE;
  v_member members%ROWTYPE;
  v_deduction JSONB;
  v_cumulative_balances JSONB;
  v_category TEXT;
  v_amount NUMERIC;
  v_minutes INTEGER;
  v_description TEXT;
  v_notes TEXT;
  v_plan_name TEXT;
  v_transaction_date TEXT;
  v_balance_after NUMERIC;
  v_fifo JSONB;
  v_alloc JSONB;
BEGIN
  IF p_deductions IS NULL OR jsonb_typeof(p_deductions) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', '扣款項目格式無效');
  END IF;
  IF jsonb_array_length(p_deductions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '未指定扣款項目');
  END IF;

  SELECT * INTO v_participant
  FROM booking_participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到回報資料');
  END IF;

  IF v_participant.status IS DISTINCT FROM 'pending'
     OR COALESCE(v_participant.is_deleted, false)
     OR v_participant.replaced_by_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '此回報已處理、已被取代或不需扣款');
  END IF;

  SELECT * INTO v_member
  FROM members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員資料');
  END IF;

  v_cumulative_balances := jsonb_build_object(
    'balance', COALESCE(v_member.balance, 0),
    'vip_voucher_amount', COALESCE(v_member.vip_voucher_amount, 0),
    'boat_voucher_g23_minutes', COALESCE(v_member.boat_voucher_g23_minutes, 0),
    'boat_voucher_g21_panther_minutes', COALESCE(v_member.boat_voucher_g21_panther_minutes, 0),
    'designated_lesson_minutes', COALESCE(v_member.designated_lesson_minutes, 0),
    'gift_boat_hours', COALESCE(v_member.gift_boat_hours, 0)
  );

  FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_deductions)
  LOOP
    v_category := v_deduction->>'category';
    v_amount := (v_deduction->>'amount')::NUMERIC;
    v_minutes := (v_deduction->>'minutes')::INTEGER;

    CASE
      WHEN v_category = 'plan' THEN NULL;
      WHEN v_category IN ('balance', 'vip_voucher') THEN
        IF v_amount IS NULL
           OR lower(v_amount::TEXT) IN ('nan', 'infinity', '-infinity')
           OR v_amount < 0 THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', format('扣款金額無效（類別 %s）', v_category)
          );
        END IF;
      WHEN v_category IN (
        'boat_voucher_g23', 'boat_voucher_g21_panther',
        'designated_lesson', 'gift_boat_hours'
      ) THEN
        IF v_minutes IS NULL OR v_minutes < 0 THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', format('扣款時數無效（類別 %s）', v_category)
          );
        END IF;
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'error', format('未知的扣款類別: %s', v_category)
        );
    END CASE;
  END LOOP;

  FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_deductions)
  LOOP
    v_category := v_deduction->>'category';
    v_amount := (v_deduction->>'amount')::NUMERIC;
    v_minutes := (v_deduction->>'minutes')::INTEGER;
    v_description := v_deduction->>'description';
    v_notes := v_deduction->>'notes';
    v_plan_name := v_deduction->>'planName';
    v_transaction_date := public.as_transaction_date_text(
      COALESCE((v_deduction->>'transactionDate')::DATE, CURRENT_DATE)
    );
    v_alloc := NULL;

    CASE v_category
      WHEN 'plan' THEN
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          adjust_type, amount, minutes, description, notes, transaction_date, operator_id
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category, 'decrease',
          0, 0, v_description,
          COALESCE(v_plan_name || COALESCE(' - ' || v_notes, ''), v_notes),
          v_transaction_date, p_operator_id
        );

      WHEN 'balance' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances, '{balance}',
          to_jsonb((v_cumulative_balances->>'balance')::NUMERIC - v_amount)
        );
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          adjust_type, amount, description, notes, transaction_date, operator_id,
          balance_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category, 'decrease',
          v_amount, v_description, v_notes, v_transaction_date, p_operator_id,
          (v_cumulative_balances->>'balance')::NUMERIC
        );

      WHEN 'vip_voucher' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances, '{vip_voucher_amount}',
          to_jsonb((v_cumulative_balances->>'vip_voucher_amount')::NUMERIC - v_amount)
        );
        v_balance_after := (v_cumulative_balances->>'vip_voucher_amount')::NUMERIC;
        -- FIFO 失敗不得擋扣款
        v_fifo := public.try_consume_credit_lots_fifo(
          p_member_id, 'vip_voucher', v_amount, v_balance_after
        );
        IF COALESCE((v_fifo->>'applied')::boolean, false) THEN
          v_alloc := v_fifo->'allocations';
        END IF;
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          adjust_type, amount, description, notes, transaction_date, operator_id,
          vip_voucher_amount_after, lot_allocations
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category, 'decrease',
          v_amount, v_description, v_notes, v_transaction_date, p_operator_id,
          v_balance_after, v_alloc
        );

      WHEN 'boat_voucher_g23' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances, '{boat_voucher_g23_minutes}',
          to_jsonb((v_cumulative_balances->>'boat_voucher_g23_minutes')::INTEGER - v_minutes)
        );
        v_balance_after := (v_cumulative_balances->>'boat_voucher_g23_minutes')::NUMERIC;
        v_fifo := public.try_consume_credit_lots_fifo(
          p_member_id, 'boat_voucher_g23', v_minutes::numeric, v_balance_after
        );
        IF COALESCE((v_fifo->>'applied')::boolean, false) THEN
          v_alloc := v_fifo->'allocations';
        END IF;
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          adjust_type, minutes, description, notes, transaction_date, operator_id,
          boat_voucher_g23_minutes_after, lot_allocations
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category, 'decrease',
          v_minutes, v_description, v_notes, v_transaction_date, p_operator_id,
          v_balance_after::INTEGER, v_alloc
        );

      WHEN 'boat_voucher_g21_panther' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances, '{boat_voucher_g21_panther_minutes}',
          to_jsonb(
            (v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::INTEGER - v_minutes
          )
        );
        v_balance_after :=
          (v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::NUMERIC;
        v_fifo := public.try_consume_credit_lots_fifo(
          p_member_id, 'boat_voucher_g21_panther', v_minutes::numeric, v_balance_after
        );
        IF COALESCE((v_fifo->>'applied')::boolean, false) THEN
          v_alloc := v_fifo->'allocations';
        END IF;
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          adjust_type, minutes, description, notes, transaction_date, operator_id,
          boat_voucher_g21_panther_minutes_after, lot_allocations
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category, 'decrease',
          v_minutes, v_description, v_notes, v_transaction_date, p_operator_id,
          v_balance_after::INTEGER, v_alloc
        );

      WHEN 'designated_lesson' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances, '{designated_lesson_minutes}',
          to_jsonb((v_cumulative_balances->>'designated_lesson_minutes')::INTEGER - v_minutes)
        );
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          adjust_type, minutes, description, notes, transaction_date, operator_id,
          designated_lesson_minutes_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category, 'decrease',
          v_minutes, v_description, v_notes, v_transaction_date, p_operator_id,
          (v_cumulative_balances->>'designated_lesson_minutes')::INTEGER
        );

      WHEN 'gift_boat_hours' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances, '{gift_boat_hours}',
          to_jsonb((v_cumulative_balances->>'gift_boat_hours')::INTEGER - v_minutes)
        );
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          adjust_type, minutes, description, notes, transaction_date, operator_id,
          gift_boat_hours_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category, 'decrease',
          v_minutes, v_description, v_notes, v_transaction_date, p_operator_id,
          (v_cumulative_balances->>'gift_boat_hours')::INTEGER
        );

      ELSE
        RAISE EXCEPTION '未知的扣款類別: %', v_category;
    END CASE;
  END LOOP;

  UPDATE members
  SET
    balance = (v_cumulative_balances->>'balance')::NUMERIC,
    vip_voucher_amount = (v_cumulative_balances->>'vip_voucher_amount')::NUMERIC,
    boat_voucher_g23_minutes = (v_cumulative_balances->>'boat_voucher_g23_minutes')::INTEGER,
    boat_voucher_g21_panther_minutes =
      (v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::INTEGER,
    designated_lesson_minutes =
      (v_cumulative_balances->>'designated_lesson_minutes')::INTEGER,
    gift_boat_hours = (v_cumulative_balances->>'gift_boat_hours')::INTEGER
  WHERE id = p_member_id;

  UPDATE booking_participants
  SET status = 'processed'
  WHERE id = p_participant_id
    AND status = 'pending'
    AND NOT COALESCE(is_deleted, false)
    AND replaced_by_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '回報狀態已變更，扣款已取消';
  END IF;

  RETURN jsonb_build_object('success', true, 'balances', v_cumulative_balances);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 商店結帳
CREATE OR REPLACE FUNCTION public.settle_shop_order(
  p_order_id UUID,
  p_items JSONB,
  p_charge_member_id UUID,
  p_payment_method TEXT,
  p_operator_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order shop_orders%ROWTYPE;
  v_row JSONB;
  v_item_id UUID;
  v_qty_settle INTEGER;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_item shop_order_items%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_amount_total NUMERIC := 0;
  v_snapshot JSONB := '[]'::jsonb;
  v_member members%ROWTYPE;
  v_balance_after NUMERIC;
  v_settlement_id UUID;
  v_desc TEXT;
  v_operator_id UUID;
  v_operator_email TEXT;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may settle shop orders'
      USING ERRCODE = '42501';
  END IF;

  v_operator_id := COALESCE(auth.uid(), p_operator_id);
  v_operator_email := COALESCE(
    NULLIF(lower(auth.jwt() ->> 'email'), ''),
    NULLIF(trim(p_operator_email), '')
  );

  IF p_payment_method NOT IN ('balance', 'transfer', 'cash') THEN
    RETURN jsonb_build_object('success', false, 'error', '付款方式無效');
  END IF;

  IF p_payment_method = 'balance' AND p_charge_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '扣儲值需指定會員');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', '結帳品項格式無效');
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '未指定結帳品項');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS requested(row_data)
    GROUP BY requested.row_data->>'item_id'
    HAVING count(*) > 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '結帳品項不可重複');
  END IF;

  SELECT *
  INTO v_order
  FROM shop_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;
  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

  -- Lock all requested item rows in a deterministic order.
  PERFORM item.id
  FROM shop_order_items AS item
  JOIN (
    SELECT DISTINCT (requested.row_data->>'item_id')::UUID AS item_id
    FROM jsonb_array_elements(p_items) AS requested(row_data)
  ) AS requested_items
    ON requested_items.item_id = item.id
  WHERE item.order_id = p_order_id
  ORDER BY item.id
  FOR UPDATE OF item;

  -- Lock all affected variants before validation and mutation.
  PERFORM variant.id
  FROM product_variants AS variant
  JOIN shop_order_items AS item
    ON item.variant_id = variant.id
  JOIN (
    SELECT DISTINCT (requested.row_data->>'item_id')::UUID AS item_id
    FROM jsonb_array_elements(p_items) AS requested(row_data)
  ) AS requested_items
    ON requested_items.item_id = item.id
  WHERE item.order_id = p_order_id
  ORDER BY variant.id
  FOR UPDATE OF variant;

  IF p_payment_method = 'balance' THEN
    SELECT *
    INTO v_member
    FROM members
    WHERE id = p_charge_member_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '找不到扣款會員');
    END IF;
  END IF;

  -- Preflight every line. No inventory changes are allowed in this loop.
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_settle := (v_row->>'qty')::INTEGER;
    v_unit_price := (v_row->>'unit_price')::NUMERIC;
    v_line_total := (v_row->>'line_total')::NUMERIC;

    IF v_item_id IS NULL OR v_qty_settle IS NULL OR v_qty_settle <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', '品項或數量無效');
    END IF;
    IF v_unit_price IS NULL
       OR lower(v_unit_price::TEXT) IN ('nan', 'infinity', '-infinity')
       OR v_unit_price < 0
       OR v_line_total IS NULL
       OR lower(v_line_total::TEXT) IN ('nan', 'infinity', '-infinity')
       OR v_line_total < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', '金額無效');
    END IF;

    SELECT *
    INTO v_item
    FROM shop_order_items
    WHERE id = v_item_id AND order_id = p_order_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '品項不屬於此訂單');
    END IF;

    IF v_qty_settle <> v_item.qty_pending_bill THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format(
          'v1 需整批結清待結帳數量（品項 %s：待結帳 %s，傳入 %s）',
          v_item_id,
          v_item.qty_pending_bill,
          v_qty_settle
        )
      );
    END IF;

    SELECT *
    INTO v_variant
    FROM product_variants
    WHERE id = v_item.variant_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '找不到商品規格');
    END IF;
    IF v_variant.reserved_qty < v_qty_settle THEN
      RETURN jsonb_build_object('success', false, 'error', '保留庫存異常，請聯絡管理員');
    END IF;
    IF v_variant.stock < v_qty_settle THEN
      RETURN jsonb_build_object('success', false, 'error', '庫存異常，請聯絡管理員');
    END IF;

    v_amount_total := v_amount_total + v_line_total;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id,
      'variant_id', v_item.variant_id,
      'qty', v_qty_settle,
      'unit_price', v_unit_price,
      'line_total', v_line_total,
      'description', NULLIF(trim(v_row->>'description'), '')
    ));
  END LOOP;

  -- Mutation phase: any unexpected mismatch raises and rolls everything back.
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_settle := (v_row->>'qty')::INTEGER;

    SELECT *
    INTO v_item
    FROM shop_order_items
    WHERE id = v_item_id AND order_id = p_order_id;

    UPDATE shop_order_items
    SET
      qty_pending_bill = qty_pending_bill - v_qty_settle,
      qty_paid = qty_paid + v_qty_settle
    WHERE id = v_item_id
      AND order_id = p_order_id
      AND qty_pending_bill = v_qty_settle;

    IF NOT FOUND THEN
      RAISE EXCEPTION '結帳品項狀態已變更（品項 %）', v_item_id;
    END IF;

    UPDATE product_variants
    SET
      stock = stock - v_qty_settle,
      reserved_qty = reserved_qty - v_qty_settle
    WHERE id = v_item.variant_id
      AND stock >= v_qty_settle
      AND reserved_qty >= v_qty_settle;

    IF NOT FOUND THEN
      RAISE EXCEPTION '結帳庫存狀態已變更（品項 %）', v_item_id;
    END IF;
  END LOOP;

  INSERT INTO shop_order_settlements (
    order_id,
    payment_method,
    charge_member_id,
    amount_total,
    items_snapshot,
    notes,
    settled_by
  ) VALUES (
    p_order_id,
    p_payment_method,
    CASE WHEN p_payment_method = 'balance' THEN p_charge_member_id ELSE NULL END,
    v_amount_total,
    v_snapshot,
    p_notes,
    v_operator_id
  )
  RETURNING id INTO v_settlement_id;

  IF p_payment_method = 'balance' THEN
    v_balance_after := COALESCE(v_member.balance, 0);

    FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_line_total := (v_row->>'line_total')::NUMERIC;
      v_desc := NULLIF(trim(v_row->>'description'), '');
      IF v_desc IS NULL THEN
        v_desc := format('商品訂單 %s', v_order.order_no);
      END IF;

      v_balance_after := v_balance_after - v_line_total;

      INSERT INTO transactions (
        member_id,
        booking_participant_id,
        shop_order_id,
        transaction_type,
        category,
        adjust_type,
        amount,
        description,
        notes,
        transaction_date,
        operator_id,
        balance_after
      ) VALUES (
        p_charge_member_id,
        NULL,
        p_order_id,
        'consume',
        'balance',
        'decrease',
        v_line_total,
        v_desc,
        NULL,
        public.as_transaction_date_text(CURRENT_DATE),
        v_operator_id,
        v_balance_after
      );
    END LOOP;
  END IF;

  UPDATE shop_orders
  SET updated_by = v_operator_email
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', v_settlement_id,
    'amount_total', v_amount_total
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;
