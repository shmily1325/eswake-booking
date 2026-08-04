-- =============================================================================
-- 163_credit_lots_fifo_and_credit.sql
--
-- 階段 E（有 lot 才啟用）：
-- - consume_credit_lots_fifo：扣款時依年份由舊到新扣 remaining
-- - add_credit_lots：入帳時加到指定年（僅當該會員該類已有 lot）
-- - 更新 process_deduction_transaction：VIP／G23／G21 扣款後呼叫 FIFO
--
-- 規則：
-- - 沒有 credit_lots → 行為與以前相同（只改 members）
-- - 有 lot 但 Σ remaining ≠ members 該欄 → 跳過 FIFO（避免越改越歪）
-- - 扣到不夠時允許最舊年變負（與 members 允許負餘額一致）
-- - 不提供切換 2027 的管理 UI；仍靠 system_settings.current_voucher_year
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: member 該類目前總額（與 members 欄位對齊）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_lot_member_total(
  p_member_id uuid,
  p_category text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  CASE p_category
    WHEN 'vip_voucher' THEN
      SELECT COALESCE(vip_voucher_amount, 0)::numeric INTO v_total
      FROM members WHERE id = p_member_id;
    WHEN 'boat_voucher_g23' THEN
      SELECT COALESCE(boat_voucher_g23_minutes, 0)::numeric INTO v_total
      FROM members WHERE id = p_member_id;
    WHEN 'boat_voucher_g21_panther' THEN
      SELECT COALESCE(boat_voucher_g21_panther_minutes, 0)::numeric INTO v_total
      FROM members WHERE id = p_member_id;
    ELSE
      RETURN NULL;
  END CASE;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.credit_lot_member_total(uuid, text) IS
  '回傳 members 上 VIP／G23／G21 對應總額；非追蹤類別回傳 NULL。';

-- ---------------------------------------------------------------------------
-- Helper: 是否應套用 lot 變更（有列且加總與 members 一致）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_lots_are_consistent(
  p_member_id uuid,
  p_category text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_lot_count integer;
  v_lots_total numeric;
  v_members_total numeric;
BEGIN
  IF p_category NOT IN (
    'vip_voucher',
    'boat_voucher_g23',
    'boat_voucher_g21_panther'
  ) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(remaining), 0)
  INTO v_lot_count, v_lots_total
  FROM credit_lots
  WHERE member_id = p_member_id
    AND category = p_category;

  IF v_lot_count = 0 THEN
    RETURN false;
  END IF;

  v_members_total := public.credit_lot_member_total(p_member_id, p_category);
  IF v_members_total IS NULL THEN
    RETURN false;
  END IF;

  -- 允許極小浮點差（VIP 金額）
  RETURN abs(v_lots_total - v_members_total) < 0.005;
END;
$$;

COMMENT ON FUNCTION public.credit_lots_are_consistent(uuid, text) IS
  '有 lot 且 Σ remaining ≈ members 時才允許 FIFO／加 lot。';

-- ---------------------------------------------------------------------------
-- FIFO 扣減：p_qty > 0 表示要扣掉的數量
-- 呼叫時機：members 該欄已扣完之後（用扣後總額做一致性檢查）
-- 若呼叫前尚未更新 members，請改傳 p_expected_total_after
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_credit_lots_fifo(
  p_member_id uuid,
  p_category text,
  p_qty numeric,
  p_expected_total_after numeric DEFAULT NULL
)
RETURNS boolean
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
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN false;
  END IF;

  IF p_category NOT IN (
    'vip_voucher',
    'boat_voucher_g23',
    'boat_voucher_g21_panther'
  ) THEN
    RETURN false;
  END IF;

  -- 先鎖列再加總，避免並行扣款踩到同一年帳本
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
    RETURN false;
  END IF;

  -- 扣款前 lots 應對齊「扣前」members；若呼叫端已先改 members，
  -- 傳入 p_expected_total_after = 扣後總額，則 lots 應 ≈ after + qty
  IF p_expected_total_after IS NOT NULL THEN
    v_check_total := p_expected_total_after + p_qty;
  ELSE
    v_check_total := public.credit_lot_member_total(p_member_id, p_category);
  END IF;

  IF abs(v_lots_total - v_check_total) >= 0.005 THEN
    RAISE NOTICE
      'consume_credit_lots_fifo skipped: member=% category=% lots=% expected=%',
      p_member_id, p_category, v_lots_total, v_check_total;
    RETURN false;
  END IF;

  v_remaining_to_take := p_qty;

  -- 先從有正剩餘的舊年扣
  FOR v_lot IN
    SELECT id, remaining
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
    v_remaining_to_take := v_remaining_to_take - v_take;
  END LOOP;

  -- 仍不夠：從最舊年繼續扣（允許變負）
  IF v_remaining_to_take > 0 THEN
    SELECT id
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
      v_remaining_to_take := 0;
    END IF;
  END IF;

  RETURN v_remaining_to_take <= 0;
END;
$$;

COMMENT ON FUNCTION public.consume_credit_lots_fifo(uuid, text, numeric, numeric) IS
  '有一致 lot 時 FIFO 扣減；否則 no-op。回傳是否有套用。';

-- ---------------------------------------------------------------------------
-- 入帳加 lot：僅當該會員該類已有 lot（不全量開新帳本）
-- ---------------------------------------------------------------------------
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

  -- 尚未建立年帳本：只標交易年、不加 lot（避免 Σ 只等於本次入帳）
  IF v_lot_count = 0 THEN
    RETURN false;
  END IF;

  -- 呼叫端應已先更新 members；lots 應對齊「加之前」= members - qty
  v_members_total := public.credit_lot_member_total(p_member_id, p_category);
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
  '已有 lot 的會員，將入帳數量加到指定年；無 lot 則 no-op。';

-- ---------------------------------------------------------------------------
-- 手動調整某年 remaining（編輯／刪除／改標年用）
-- 僅在該會員該類已有任一 lot 時生效；不做 members 一致性檢查（呼叫端負責成對 +/-／-）
-- ---------------------------------------------------------------------------
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
  '已有 lot 時對指定年 remaining 做加減；用於改標年／編修入帳。';

GRANT EXECUTE ON FUNCTION public.credit_lot_member_total(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_lots_are_consistent(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credit_lots_fifo(uuid, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credit_lots(uuid, text, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_credit_lot_remaining(uuid, text, integer, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- 更新扣款 RPC：VIP／G23／G21 寫入交易後 FIFO
-- （完整 REPLACE，以 151 為底＋ FIFO）
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
BEGIN
  IF p_deductions IS NULL OR jsonb_typeof(p_deductions) <> 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '扣款項目格式無效'
    );
  END IF;
  IF jsonb_array_length(p_deductions) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '未指定扣款項目'
    );
  END IF;

  SELECT *
  INTO v_participant
  FROM booking_participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '找不到回報資料'
    );
  END IF;

  IF v_participant.status IS DISTINCT FROM 'pending'
     OR COALESCE(v_participant.is_deleted, false)
     OR v_participant.replaced_by_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '此回報已處理、已被取代或不需扣款'
    );
  END IF;

  SELECT *
  INTO v_member
  FROM members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '找不到會員資料'
    );
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
      WHEN v_category = 'plan' THEN
        NULL;
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
        'boat_voucher_g23',
        'boat_voucher_g21_panther',
        'designated_lesson',
        'gift_boat_hours'
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
    v_transaction_date := COALESCE(
      (v_deduction->>'transactionDate')::DATE,
      CURRENT_DATE
    );

    CASE v_category
      WHEN 'plan' THEN
        INSERT INTO transactions (
          member_id,
          booking_participant_id,
          transaction_type,
          category,
          adjust_type,
          amount,
          minutes,
          description,
          notes,
          transaction_date,
          operator_id
        ) VALUES (
          p_member_id,
          p_participant_id,
          'consume',
          v_category,
          'decrease',
          0,
          0,
          v_description,
          COALESCE(v_plan_name || COALESCE(' - ' || v_notes, ''), v_notes),
          v_transaction_date,
          p_operator_id
        );

      WHEN 'balance' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{balance}',
          to_jsonb((v_cumulative_balances->>'balance')::NUMERIC - v_amount)
        );

        INSERT INTO transactions (
          member_id,
          booking_participant_id,
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
          p_member_id,
          p_participant_id,
          'consume',
          v_category,
          'decrease',
          v_amount,
          v_description,
          v_notes,
          v_transaction_date,
          p_operator_id,
          (v_cumulative_balances->>'balance')::NUMERIC
        );

      WHEN 'vip_voucher' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{vip_voucher_amount}',
          to_jsonb((v_cumulative_balances->>'vip_voucher_amount')::NUMERIC - v_amount)
        );
        v_balance_after := (v_cumulative_balances->>'vip_voucher_amount')::NUMERIC;

        INSERT INTO transactions (
          member_id,
          booking_participant_id,
          transaction_type,
          category,
          adjust_type,
          amount,
          description,
          notes,
          transaction_date,
          operator_id,
          vip_voucher_amount_after
        ) VALUES (
          p_member_id,
          p_participant_id,
          'consume',
          v_category,
          'decrease',
          v_amount,
          v_description,
          v_notes,
          v_transaction_date,
          p_operator_id,
          v_balance_after
        );

        PERFORM public.consume_credit_lots_fifo(
          p_member_id,
          'vip_voucher',
          v_amount,
          v_balance_after
        );

      WHEN 'boat_voucher_g23' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{boat_voucher_g23_minutes}',
          to_jsonb((v_cumulative_balances->>'boat_voucher_g23_minutes')::INTEGER - v_minutes)
        );
        v_balance_after := (v_cumulative_balances->>'boat_voucher_g23_minutes')::NUMERIC;

        INSERT INTO transactions (
          member_id,
          booking_participant_id,
          transaction_type,
          category,
          adjust_type,
          minutes,
          description,
          notes,
          transaction_date,
          operator_id,
          boat_voucher_g23_minutes_after
        ) VALUES (
          p_member_id,
          p_participant_id,
          'consume',
          v_category,
          'decrease',
          v_minutes,
          v_description,
          v_notes,
          v_transaction_date,
          p_operator_id,
          v_balance_after::INTEGER
        );

        PERFORM public.consume_credit_lots_fifo(
          p_member_id,
          'boat_voucher_g23',
          v_minutes::numeric,
          v_balance_after
        );

      WHEN 'boat_voucher_g21_panther' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{boat_voucher_g21_panther_minutes}',
          to_jsonb(
            (v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::INTEGER
            - v_minutes
          )
        );
        v_balance_after :=
          (v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::NUMERIC;

        INSERT INTO transactions (
          member_id,
          booking_participant_id,
          transaction_type,
          category,
          adjust_type,
          minutes,
          description,
          notes,
          transaction_date,
          operator_id,
          boat_voucher_g21_panther_minutes_after
        ) VALUES (
          p_member_id,
          p_participant_id,
          'consume',
          v_category,
          'decrease',
          v_minutes,
          v_description,
          v_notes,
          v_transaction_date,
          p_operator_id,
          v_balance_after::INTEGER
        );

        PERFORM public.consume_credit_lots_fifo(
          p_member_id,
          'boat_voucher_g21_panther',
          v_minutes::numeric,
          v_balance_after
        );

      WHEN 'designated_lesson' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{designated_lesson_minutes}',
          to_jsonb(
            (v_cumulative_balances->>'designated_lesson_minutes')::INTEGER
            - v_minutes
          )
        );

        INSERT INTO transactions (
          member_id,
          booking_participant_id,
          transaction_type,
          category,
          adjust_type,
          minutes,
          description,
          notes,
          transaction_date,
          operator_id,
          designated_lesson_minutes_after
        ) VALUES (
          p_member_id,
          p_participant_id,
          'consume',
          v_category,
          'decrease',
          v_minutes,
          v_description,
          v_notes,
          v_transaction_date,
          p_operator_id,
          (v_cumulative_balances->>'designated_lesson_minutes')::INTEGER
        );

      WHEN 'gift_boat_hours' THEN
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{gift_boat_hours}',
          to_jsonb((v_cumulative_balances->>'gift_boat_hours')::INTEGER - v_minutes)
        );

        INSERT INTO transactions (
          member_id,
          booking_participant_id,
          transaction_type,
          category,
          adjust_type,
          minutes,
          description,
          notes,
          transaction_date,
          operator_id,
          gift_boat_hours_after
        ) VALUES (
          p_member_id,
          p_participant_id,
          'consume',
          v_category,
          'decrease',
          v_minutes,
          v_description,
          v_notes,
          v_transaction_date,
          p_operator_id,
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

  v_result := jsonb_build_object(
    'success', true,
    'balances', v_cumulative_balances
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.process_deduction_transaction(UUID, INTEGER, UUID, JSONB)
  IS '原子處理 pending 回報扣款；VIP／G23／G21 有一致 lot 時 FIFO 扣年餘。';

COMMIT;
