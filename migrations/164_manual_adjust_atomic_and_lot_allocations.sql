-- =============================================================================
-- 164_manual_adjust_atomic_and_lot_allocations.sql
--
-- 1) 扣款 FIFO 回傳分年明細；transactions.lot_allocations 存檔
-- 2) 依明細精確還原（刪／編輯扣款）
-- 3) 手動記帳 create／edit／delete 單一 RPC（members + tx + lots 同交易）
--
-- 依賴：162、163
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) 交易上記錄 FIFO 分年扣減明細
-- ---------------------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS lot_allocations jsonb;

COMMENT ON COLUMN public.transactions.lot_allocations IS
  '扣款 FIFO 分年明細，例如 [{"voucher_year":2025,"qty":100},{"voucher_year":2026,"qty":50}]。入帳為 null。';

-- ---------------------------------------------------------------------------
-- 2) consume_credit_lots_fifo：改回傳 jsonb（含 allocations）
--    回傳型別變更需 DROP 再建
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consume_credit_lots_fifo(uuid, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.consume_credit_lots_fifo(
  p_member_id uuid,
  p_category text,
  p_qty numeric,
  p_expected_total_after numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_remaining_to_take numeric;
  v_lot RECORD;
  v_take numeric;
  v_lots_total numeric;
  v_lot_count integer;
  v_check_total numeric;
  v_alloc_map jsonb := '{}'::jsonb;
  v_allocations jsonb := '[]'::jsonb;
  v_year integer;
  v_year_qty numeric;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('applied', false, 'allocations', '[]'::jsonb);
  END IF;

  IF p_category NOT IN (
    'vip_voucher',
    'boat_voucher_g23',
    'boat_voucher_g21_panther'
  ) THEN
    RETURN jsonb_build_object('applied', false, 'allocations', '[]'::jsonb);
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

  IF v_lot_count = 0 THEN
    RETURN jsonb_build_object('applied', false, 'allocations', '[]'::jsonb);
  END IF;

  IF p_expected_total_after IS NOT NULL THEN
    v_check_total := p_expected_total_after + p_qty;
  ELSE
    v_check_total := public.credit_lot_member_total(p_member_id, p_category);
  END IF;

  IF abs(v_lots_total - v_check_total) >= 0.005 THEN
    RAISE NOTICE
      'consume_credit_lots_fifo skipped: member=% category=% lots=% expected=%',
      p_member_id, p_category, v_lots_total, v_check_total;
    RETURN jsonb_build_object('applied', false, 'allocations', '[]'::jsonb);
  END IF;

  v_remaining_to_take := p_qty;

  FOR v_lot IN
    SELECT id, voucher_year, remaining
    FROM credit_lots
    WHERE member_id = p_member_id
      AND category = p_category
      AND remaining > 0
    ORDER BY voucher_year ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_take <= 0;
    v_take := LEAST(v_lot.remaining, v_remaining_to_take);
    UPDATE credit_lots
    SET remaining = remaining - v_take,
        updated_at = now()
    WHERE id = v_lot.id;
    v_alloc_map := jsonb_set(
      v_alloc_map,
      ARRAY[v_lot.voucher_year::text],
      to_jsonb(
        COALESCE((v_alloc_map->>v_lot.voucher_year::text)::numeric, 0) + v_take
      )
    );
    v_remaining_to_take := v_remaining_to_take - v_take;
  END LOOP;

  IF v_remaining_to_take > 0 THEN
    SELECT id, voucher_year
    INTO v_lot
    FROM credit_lots
    WHERE member_id = p_member_id
      AND category = p_category
    ORDER BY voucher_year ASC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE credit_lots
      SET remaining = remaining - v_remaining_to_take,
          updated_at = now()
      WHERE id = v_lot.id;
      v_alloc_map := jsonb_set(
        v_alloc_map,
        ARRAY[v_lot.voucher_year::text],
        to_jsonb(
          COALESCE((v_alloc_map->>v_lot.voucher_year::text)::numeric, 0)
          + v_remaining_to_take
        )
      );
      v_remaining_to_take := 0;
    END IF;
  END IF;

  FOR v_year, v_year_qty IN
    SELECT key::integer, value::numeric
    FROM jsonb_each_text(v_alloc_map)
    ORDER BY key::integer
  LOOP
    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object('voucher_year', v_year, 'qty', v_year_qty)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'applied', v_remaining_to_take <= 0 AND jsonb_array_length(v_allocations) > 0,
    'allocations', v_allocations
  );
END;
$$;

COMMENT ON FUNCTION public.consume_credit_lots_fifo(uuid, text, numeric, numeric) IS
  '有一致 lot 時 FIFO 扣減；回傳 {applied, allocations:[{voucher_year,qty}]}。';

-- ---------------------------------------------------------------------------
-- 3) 依明細還原；無明細時加回最舊年（舊資料 fallback）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_credit_lots_from_allocations(
  p_member_id uuid,
  p_category text,
  p_allocations jsonb,
  p_fallback_qty numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_year integer;
  v_qty numeric;
  v_oldest integer;
  v_lot_count integer;
BEGIN
  IF p_category NOT IN (
    'vip_voucher',
    'boat_voucher_g23',
    'boat_voucher_g21_panther'
  ) THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM credit_lots
  WHERE member_id = p_member_id
    AND category = p_category
  FOR UPDATE;

  SELECT COUNT(*) INTO v_lot_count
  FROM credit_lots
  WHERE member_id = p_member_id
    AND category = p_category;

  IF v_lot_count = 0 THEN
    RETURN false;
  END IF;

  IF p_allocations IS NOT NULL
     AND jsonb_typeof(p_allocations) = 'array'
     AND jsonb_array_length(p_allocations) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      v_year := (v_elem->>'voucher_year')::integer;
      v_qty := (v_elem->>'qty')::numeric;
      IF v_year IS NULL OR v_qty IS NULL OR v_qty = 0 THEN
        CONTINUE;
      END IF;
      PERFORM public.adjust_credit_lot_remaining(
        p_member_id, p_category, v_year, v_qty
      );
    END LOOP;
    RETURN true;
  END IF;

  -- 舊扣款無明細：整筆加回最舊年（保 Σ，分年近似）
  IF p_fallback_qty IS NULL OR p_fallback_qty = 0 THEN
    RETURN false;
  END IF;

  SELECT voucher_year INTO v_oldest
  FROM credit_lots
  WHERE member_id = p_member_id
    AND category = p_category
  ORDER BY voucher_year ASC
  LIMIT 1;

  IF v_oldest IS NULL THEN
    RETURN false;
  END IF;

  PERFORM public.adjust_credit_lot_remaining(
    p_member_id, p_category, v_oldest, p_fallback_qty
  );
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.restore_credit_lots_from_allocations(uuid, text, jsonb, numeric) IS
  '依 lot_allocations 精確加回；無明細時用 fallback_qty 加到最舊年。';

GRANT EXECUTE ON FUNCTION public.consume_credit_lots_fifo(uuid, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_credit_lots_from_allocations(uuid, text, jsonb, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) 更新 process_deduction_transaction：寫入 lot_allocations
-- ---------------------------------------------------------------------------
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
  v_transaction_date DATE;
  v_result JSONB;
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
          RETURN jsonb_build_object('success', false, 'error', format('扣款金額無效（類別 %s）', v_category));
        END IF;
      WHEN v_category IN (
        'boat_voucher_g23', 'boat_voucher_g21_panther',
        'designated_lesson', 'gift_boat_hours'
      ) THEN
        IF v_minutes IS NULL OR v_minutes < 0 THEN
          RETURN jsonb_build_object('success', false, 'error', format('扣款時數無效（類別 %s）', v_category));
        END IF;
      ELSE
        RETURN jsonb_build_object('success', false, 'error', format('未知的扣款類別: %s', v_category));
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
    v_transaction_date := COALESCE((v_deduction->>'transactionDate')::DATE, CURRENT_DATE);
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
          adjust_type, amount, description, notes, transaction_date, operator_id, balance_after
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
        v_fifo := public.consume_credit_lots_fifo(
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
        v_fifo := public.consume_credit_lots_fifo(
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
        v_fifo := public.consume_credit_lots_fifo(
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

COMMENT ON FUNCTION public.process_deduction_transaction(UUID, INTEGER, UUID, JSONB)
  IS '原子處理 pending 回報扣款；FIFO 分年明細寫入 lot_allocations。';

-- ---------------------------------------------------------------------------
-- 5) 手動記帳：新增（原子）
-- ---------------------------------------------------------------------------
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

  IF p_adjust_type = 'increase'
     AND p_category IN ('vip_voucher', 'boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    v_year := p_voucher_year;
    IF v_year IS NULL THEN
      SELECT NULLIF(setting_value, '')::integer INTO v_year
      FROM system_settings
      WHERE setting_key = 'current_voucher_year';
      v_year := COALESCE(v_year, 2026);
    END IF;
    IF v_year < 2020 OR v_year > 2100 THEN
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
    IF p_adjust_type = 'increase' THEN
      PERFORM public.add_credit_lots(p_member_id, p_category, v_year, p_qty);
    ELSE
      -- members 已扣：expected_after = v_after
      v_fifo := public.consume_credit_lots_fifo(
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
    COALESCE(p_transaction_date, public.membership_venue_date()), p_operator_id,
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

-- ---------------------------------------------------------------------------
-- 6) 手動記帳：刪除（原子；扣款依 lot_allocations 還原）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_manual_member_adjust_delete(
  p_transaction_id bigint,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions%ROWTYPE;
  v_member members%ROWTYPE;
  v_abs numeric;
  v_delta numeric;
BEGIN
  PERFORM public.assert_membership_admin();

  SELECT * INTO v_tx
  FROM transactions
  WHERE id = p_transaction_id
    AND member_id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到交易');
  END IF;

  SELECT * INTO v_member FROM members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  v_abs := abs(COALESCE(v_tx.amount, v_tx.minutes, 0));
  -- 刪除增加 → 餘額減回；刪除減少 → 餘額加回
  v_delta := CASE
    WHEN v_tx.adjust_type = 'increase' THEN -v_abs
    ELSE v_abs
  END;

  CASE v_tx.category
    WHEN 'balance' THEN
      UPDATE members SET balance = COALESCE(balance, 0) + v_delta WHERE id = p_member_id;
    WHEN 'vip_voucher' THEN
      UPDATE members SET vip_voucher_amount = COALESCE(vip_voucher_amount, 0) + v_delta WHERE id = p_member_id;
    WHEN 'designated_lesson' THEN
      UPDATE members SET designated_lesson_minutes =
        (COALESCE(designated_lesson_minutes, 0) + v_delta)::integer WHERE id = p_member_id;
    WHEN 'boat_voucher_g23' THEN
      UPDATE members SET boat_voucher_g23_minutes =
        (COALESCE(boat_voucher_g23_minutes, 0) + v_delta)::integer WHERE id = p_member_id;
    WHEN 'boat_voucher_g21_panther' THEN
      UPDATE members SET boat_voucher_g21_panther_minutes =
        (COALESCE(boat_voucher_g21_panther_minutes, 0) + v_delta)::integer WHERE id = p_member_id;
    WHEN 'gift_boat_hours' THEN
      UPDATE members SET gift_boat_hours =
        (COALESCE(gift_boat_hours, 0) + v_delta)::integer WHERE id = p_member_id;
    ELSE
      NULL;
  END CASE;

  IF v_tx.category IN ('vip_voucher', 'boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    IF v_tx.adjust_type = 'increase' AND v_tx.voucher_year IS NOT NULL THEN
      PERFORM public.adjust_credit_lot_remaining(
        p_member_id, v_tx.category, v_tx.voucher_year, -v_abs
      );
    ELSIF v_tx.adjust_type IS DISTINCT FROM 'increase' THEN
      PERFORM public.restore_credit_lots_from_allocations(
        p_member_id, v_tx.category, v_tx.lot_allocations, v_abs
      );
    END IF;
  END IF;

  DELETE FROM transactions WHERE id = p_transaction_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) 手動記帳：編輯（原子：先還原舊效果再套用新效果）
-- ---------------------------------------------------------------------------
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
    IF v_year IS NULL THEN
      SELECT NULLIF(setting_value, '')::integer INTO v_year
      FROM system_settings WHERE setting_key = 'current_voucher_year';
      v_year := COALESCE(v_year, 2026);
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

  -- 還原舊 members 影響，再套用新影響（同欄或跨欄）
  -- 簡化：對舊 category -old_delta，對新 category +new_delta
  -- 若同 category：淨影響 = -old_delta + new_delta
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

  -- 套用新 lot
  IF p_category IN ('vip_voucher', 'boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    IF p_adjust_type = 'increase' AND v_year IS NOT NULL THEN
      IF v_tx.adjust_type = 'increase'
         AND v_tx.voucher_year IS NULL
         AND v_tx.category = p_category THEN
        -- 未標年歷史：只改標年不動 lot；金額變才加減差額
        IF p_qty <> v_old_abs THEN
          PERFORM public.adjust_credit_lot_remaining(
            p_member_id, p_category, v_year, p_qty - v_old_abs
          );
        END IF;
      ELSE
        PERFORM public.add_credit_lots(p_member_id, p_category, v_year, p_qty);
      END IF;
    ELSIF p_adjust_type = 'decrease' THEN
      v_fifo := public.consume_credit_lots_fifo(
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

REVOKE ALL ON FUNCTION public.process_manual_member_adjust(
  uuid, text, text, numeric, text, text, date, integer, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_manual_member_adjust_delete(bigint, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_manual_member_adjust_edit(
  bigint, uuid, text, text, numeric, text, text, date, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.process_manual_member_adjust(
  uuid, text, text, numeric, text, text, date, integer, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_manual_member_adjust_delete(bigint, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_manual_member_adjust_edit(
  bigint, uuid, text, text, numeric, text, text, date, integer
) TO authenticated;

COMMIT;
