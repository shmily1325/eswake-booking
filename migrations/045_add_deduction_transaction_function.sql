-- 建立扣款交易處理函數
-- 目的：確保扣款操作的原子性（要麼全部成功，要麼全部回滾）

CREATE OR REPLACE FUNCTION process_deduction_transaction(
  p_member_id UUID,
  p_participant_id INTEGER,
  p_operator_id UUID,
  p_deductions JSONB  -- 扣款項目陣列
) RETURNS JSONB AS $$
DECLARE
  v_member RECORD;
  v_deduction JSONB;
  v_updates JSONB := '{}'::JSONB;
  v_transaction_id INTEGER;
  v_cumulative_balances JSONB;
  v_category TEXT;
  v_amount NUMERIC;
  v_minutes INTEGER;
  v_description TEXT;
  v_notes TEXT;
  v_plan_name TEXT;
  v_result JSONB;
BEGIN
  -- 1. 鎖定會員記錄（防止併發問題）
  SELECT * INTO v_member
  FROM members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '找不到會員資料'
    );
  END IF;

  -- 2. 初始化累積餘額
  v_cumulative_balances := jsonb_build_object(
    'balance', COALESCE(v_member.balance, 0),
    'vip_voucher_amount', COALESCE(v_member.vip_voucher_amount, 0),
    'boat_voucher_g23_minutes', COALESCE(v_member.boat_voucher_g23_minutes, 0),
    'boat_voucher_g21_panther_minutes', COALESCE(v_member.boat_voucher_g21_panther_minutes, 0),
    'designated_lesson_minutes', COALESCE(v_member.designated_lesson_minutes, 0),
    'gift_boat_hours', COALESCE(v_member.gift_boat_hours, 0)
  );

  -- 3. 逐筆處理扣款
  FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_deductions)
  LOOP
    v_category := v_deduction->>'category';
    v_amount := (v_deduction->>'amount')::NUMERIC;
    v_minutes := (v_deduction->>'minutes')::INTEGER;
    v_description := v_deduction->>'description';
    v_notes := v_deduction->>'notes';
    v_plan_name := v_deduction->>'planName';

    -- 根據類別處理
    CASE v_category
      WHEN 'plan' THEN
        -- 方案：不扣款，只記錄
        INSERT INTO transactions (
          member_id,
          booking_participant_id,
          transaction_type,
          category,
          amount,
          minutes,
          description,
          notes,
          transaction_date,
          operator_id,
          balance_after,
          vip_voucher_amount_after,
          boat_voucher_g23_minutes_after,
          boat_voucher_g21_panther_minutes_after,
          designated_lesson_minutes_after,
          gift_boat_hours_after
        ) VALUES (
          p_member_id,
          p_participant_id,
          'consume',
          v_category,
          0,
          0,
          v_description,
          COALESCE(v_plan_name || COALESCE(' - ' || v_notes, ''), v_notes),
          CURRENT_DATE,
          p_operator_id,
          (v_cumulative_balances->>'balance')::NUMERIC,
          (v_cumulative_balances->>'vip_voucher_amount')::NUMERIC,
          (v_cumulative_balances->>'boat_voucher_g23_minutes')::INTEGER,
          (v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::INTEGER,
          (v_cumulative_balances->>'designated_lesson_minutes')::INTEGER,
          (v_cumulative_balances->>'gift_boat_hours')::INTEGER
        );

      WHEN 'balance' THEN
        -- 扣儲值
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{balance}',
          to_jsonb((v_cumulative_balances->>'balance')::NUMERIC - v_amount)
        );
        
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          amount, description, notes, transaction_date, operator_id,
          balance_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category,
          -v_amount, v_description, v_notes, CURRENT_DATE, p_operator_id,
          (v_cumulative_balances->>'balance')::NUMERIC
        );

      WHEN 'vip_voucher' THEN
        -- 扣VIP票券
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{vip_voucher_amount}',
          to_jsonb((v_cumulative_balances->>'vip_voucher_amount')::NUMERIC - v_amount)
        );
        
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          amount, description, notes, transaction_date, operator_id,
          vip_voucher_amount_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category,
          -v_amount, v_description, v_notes, CURRENT_DATE, p_operator_id,
          (v_cumulative_balances->>'vip_voucher_amount')::NUMERIC
        );

      WHEN 'boat_voucher_g23' THEN
        -- 扣G23船券
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{boat_voucher_g23_minutes}',
          to_jsonb((v_cumulative_balances->>'boat_voucher_g23_minutes')::INTEGER - v_minutes)
        );
        
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          minutes, description, notes, transaction_date, operator_id,
          boat_voucher_g23_minutes_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category,
          -v_minutes, v_description, v_notes, CURRENT_DATE, p_operator_id,
          (v_cumulative_balances->>'boat_voucher_g23_minutes')::INTEGER
        );

      WHEN 'boat_voucher_g21_panther' THEN
        -- 扣G21/黑豹船券
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{boat_voucher_g21_panther_minutes}',
          to_jsonb((v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::INTEGER - v_minutes)
        );
        
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          minutes, description, notes, transaction_date, operator_id,
          boat_voucher_g21_panther_minutes_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category,
          -v_minutes, v_description, v_notes, CURRENT_DATE, p_operator_id,
          (v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::INTEGER
        );

      WHEN 'designated_lesson' THEN
        -- 扣指定課時數
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{designated_lesson_minutes}',
          to_jsonb((v_cumulative_balances->>'designated_lesson_minutes')::INTEGER - v_minutes)
        );
        
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          minutes, description, notes, transaction_date, operator_id,
          designated_lesson_minutes_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category,
          -v_minutes, v_description, v_notes, CURRENT_DATE, p_operator_id,
          (v_cumulative_balances->>'designated_lesson_minutes')::INTEGER
        );

      WHEN 'gift_boat_hours' THEN
        -- 扣贈送時數
        v_cumulative_balances := jsonb_set(
          v_cumulative_balances,
          '{gift_boat_hours}',
          to_jsonb((v_cumulative_balances->>'gift_boat_hours')::INTEGER - v_minutes)
        );
        
        INSERT INTO transactions (
          member_id, booking_participant_id, transaction_type, category,
          minutes, description, notes, transaction_date, operator_id,
          gift_boat_hours_after
        ) VALUES (
          p_member_id, p_participant_id, 'consume', v_category,
          -v_minutes, v_description, v_notes, CURRENT_DATE, p_operator_id,
          (v_cumulative_balances->>'gift_boat_hours')::INTEGER
        );

      ELSE
        RAISE EXCEPTION '未知的扣款類別: %', v_category;
    END CASE;
  END LOOP;

  -- 4. 更新會員餘額（一次性更新）
  UPDATE members SET
    balance = (v_cumulative_balances->>'balance')::NUMERIC,
    vip_voucher_amount = (v_cumulative_balances->>'vip_voucher_amount')::NUMERIC,
    boat_voucher_g23_minutes = (v_cumulative_balances->>'boat_voucher_g23_minutes')::INTEGER,
    boat_voucher_g21_panther_minutes = (v_cumulative_balances->>'boat_voucher_g21_panther_minutes')::INTEGER,
    designated_lesson_minutes = (v_cumulative_balances->>'designated_lesson_minutes')::INTEGER,
    gift_boat_hours = (v_cumulative_balances->>'gift_boat_hours')::INTEGER
  WHERE id = p_member_id;

  -- 5. 標記為已處理
  UPDATE booking_participants
  SET status = 'processed'
  WHERE id = p_participant_id;

  -- 6. 返回成功結果
  v_result := jsonb_build_object(
    'success', true,
    'balances', v_cumulative_balances
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- 任何錯誤都會自動回滾
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- 新增註解
COMMENT ON FUNCTION process_deduction_transaction IS '處理扣款交易（支援多筆扣款，確保原子性）';

-- 測試資訊
DO $$
BEGIN
  RAISE NOTICE '✅ 扣款交易函數建立完成';
  RAISE NOTICE '📝 使用方式：';
  RAISE NOTICE '  SELECT process_deduction_transaction(';
  RAISE NOTICE '    ''會員UUID''::UUID,';
  RAISE NOTICE '    參與記錄ID,';
  RAISE NOTICE '    操作者UUID,';
  RAISE NOTICE '    ''[扣款項目陣列]''::JSONB';
  RAISE NOTICE '  )';
END $$;

