-- =============================================================================
-- 165_deduction_fifo_never_blocks.sql
--
-- 目的：日常扣款（process_deduction_transaction）與 151 行為一致的安全保障護欄。
-- - members 扣多少、寫哪筆交易、回報變 processed：邏輯不變
-- - FIFO 只更新 credit_lots（附加帳本）
-- - FIFO 任何錯誤／跳過都不得讓扣款失敗
--
-- 163/164 已上線後套用本 migration 即可。
-- =============================================================================

BEGIN;

-- 永不拋錯的 FIFO 包裝：失敗視為未套用
CREATE OR REPLACE FUNCTION public.try_consume_credit_lots_fifo(
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
  v_result jsonb;
BEGIN
  BEGIN
    v_result := public.consume_credit_lots_fifo(
      p_member_id,
      p_category,
      p_qty,
      p_expected_total_after
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE
        'try_consume_credit_lots_fifo ignored error member=% category=%: %',
        p_member_id, p_category, SQLERRM;
      RETURN jsonb_build_object('applied', false, 'allocations', '[]'::jsonb);
  END;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'allocations', '[]'::jsonb);
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.try_consume_credit_lots_fifo(uuid, text, numeric, numeric) IS
  '扣款專用：呼叫 consume_credit_lots_fifo，任何例外都吞掉，回傳未套用。';

GRANT EXECUTE ON FUNCTION public.try_consume_credit_lots_fifo(uuid, text, numeric, numeric)
  TO authenticated;

-- 僅把 process_deduction 內三處 FIFO 改成 try_*（其餘與 164 相同）
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

COMMENT ON FUNCTION public.process_deduction_transaction(UUID, INTEGER, UUID, JSONB)
  IS '原子處理 pending 回報扣款（與 151 同額／同流程）；FIFO 經 try_*，失敗不擋扣款。';

COMMIT;
