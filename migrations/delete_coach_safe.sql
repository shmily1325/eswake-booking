-- =============================================
-- 安全刪除教練
-- =============================================
-- 
-- ⚠️ 警告：此腳本會永久刪除教練及其所有相關資料！
-- 
-- ⚠️ 執行前請：
--    1. 先執行 check_coach_impact.sql 檢查影響範圍
--    2. 確認這是測試資料或確實需要刪除
--    3. 備份資料庫
-- 
-- 使用方法：
-- 1. 先執行下面的查詢找出教練 ID：
--    SELECT id, name, status FROM coaches ORDER BY name;
-- 
-- 2. 將下方所有 '<教練ID>' 替換為實際的教練 UUID
--    (使用編輯器的「尋找取代」功能一次替換所有)
-- 
-- 3. 確認無誤後，執行整個腳本
-- 
-- =============================================

-- 先查詢所有教練，確認要刪除的教練
SELECT id, name, status, created_at 
FROM coaches 
ORDER BY created_at DESC;

-- ⬇️⬇️⬇️ 請將下面所有 '<教練ID>' 替換為實際的 UUID ⬇️⬇️⬇️

-- 開始交易（如果有錯誤會自動回滾）
BEGIN;

DO $$
DECLARE
  v_coach_id UUID := '<教練ID>'; -- ⚠️ 請替換這裡的 <教練ID>
  v_coach_name TEXT;
  v_deleted_time_offs INTEGER;
  v_deleted_booking_coaches INTEGER;
  v_deleted_booking_drivers INTEGER;
  v_deleted_coach_reports INTEGER;
  v_deleted_participants INTEGER;
  v_future_bookings INTEGER;
BEGIN
  -- 取得教練名稱
  SELECT name INTO v_coach_name FROM coaches WHERE id = v_coach_id;
  
  IF v_coach_name IS NULL THEN
    RAISE EXCEPTION '❌ 找不到此教練 ID: %', v_coach_id;
  END IF;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '開始刪除教練: %', v_coach_name;
  RAISE NOTICE 'ID: %', v_coach_id;
  RAISE NOTICE '============================================';
  
  -- 最後檢查：是否有未來的預約
  SELECT COUNT(DISTINCT bc.booking_id) INTO v_future_bookings
  FROM booking_coaches bc
  JOIN bookings b ON bc.booking_id = b.id
  WHERE bc.coach_id = v_coach_id
    AND b.start_at >= NOW()::TEXT
    AND b.status != 'cancelled';
  
  IF v_future_bookings > 0 THEN
    RAISE EXCEPTION '❌ 此教練有 % 筆未來預約，無法刪除！請先處理這些預約。', v_future_bookings;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '開始刪除關聯資料...';
  RAISE NOTICE '';
  
  -- 步驟 1: 刪除教練休假記錄
  DELETE FROM coach_time_off WHERE coach_id = v_coach_id;
  GET DIAGNOSTICS v_deleted_time_offs = ROW_COUNT;
  RAISE NOTICE '✓ 已刪除 % 筆休假記錄', v_deleted_time_offs;
  
  -- 步驟 2: 刪除參與者記錄
  -- 注意：這會導致 transactions.booking_participant_id 被設為 NULL（ON DELETE SET NULL）
  DELETE FROM booking_participants WHERE coach_id = v_coach_id;
  GET DIAGNOSTICS v_deleted_participants = ROW_COUNT;
  RAISE NOTICE '✓ 已刪除 % 筆參與者記錄', v_deleted_participants;
  
  -- 步驟 3: 刪除教練回報記錄
  DELETE FROM coach_reports WHERE coach_id = v_coach_id;
  GET DIAGNOSTICS v_deleted_coach_reports = ROW_COUNT;
  RAISE NOTICE '✓ 已刪除 % 筆教練回報記錄', v_deleted_coach_reports;
  
  -- 步驟 4: 刪除排班記錄（教練）
  DELETE FROM booking_coaches WHERE coach_id = v_coach_id;
  GET DIAGNOSTICS v_deleted_booking_coaches = ROW_COUNT;
  RAISE NOTICE '✓ 已刪除 % 筆排班記錄（教練）', v_deleted_booking_coaches;
  
  -- 步驟 5: 刪除排班記錄（駕駛）
  DELETE FROM booking_drivers WHERE driver_id = v_coach_id;
  GET DIAGNOSTICS v_deleted_booking_drivers = ROW_COUNT;
  RAISE NOTICE '✓ 已刪除 % 筆排班記錄（駕駛）', v_deleted_booking_drivers;
  
  -- 步驟 6: 最後刪除教練本身
  DELETE FROM coaches WHERE id = v_coach_id;
  RAISE NOTICE '✓ 已刪除教練: %', v_coach_name;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '刪除完成！';
  RAISE NOTICE '============================================';
  RAISE NOTICE '總共刪除：';
  RAISE NOTICE '  - 教練：1 位';
  RAISE NOTICE '  - 休假記錄：% 筆', v_deleted_time_offs;
  RAISE NOTICE '  - 排班記錄（教練）：% 筆', v_deleted_booking_coaches;
  RAISE NOTICE '  - 排班記錄（駕駛）：% 筆', v_deleted_booking_drivers;
  RAISE NOTICE '  - 回報記錄：% 筆', v_deleted_coach_reports;
  RAISE NOTICE '  - 參與者記錄：% 筆', v_deleted_participants;
  RAISE NOTICE '';
  
  IF v_deleted_participants > 0 THEN
    RAISE NOTICE '⚠️  注意：相關的交易記錄已自動斷開連結（booking_participant_id 設為 NULL）';
    RAISE NOTICE '    交易記錄仍保留在資料庫中，可在「會員交易」頁面查看';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '請輸入 COMMIT; 確認刪除';
  RAISE NOTICE '或輸入 ROLLBACK; 取消刪除';
END $$;

-- 驗證刪除結果
SELECT 
  '===== 驗證刪除結果 =====' as verification;

-- 確認教練已被刪除
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM coaches WHERE id = '<教練ID>')
    THEN '✓ 教練已成功刪除'
    ELSE '✗ 教練仍存在！'
  END as coach_deleted;

-- 確認所有關聯資料已被刪除
SELECT 
  (SELECT COUNT(*) FROM coach_time_off WHERE coach_id = '<教練ID>') as remaining_time_offs,
  (SELECT COUNT(*) FROM booking_coaches WHERE coach_id = '<教練ID>') as remaining_booking_coaches,
  (SELECT COUNT(*) FROM booking_drivers WHERE driver_id = '<教練ID>') as remaining_booking_drivers,
  (SELECT COUNT(*) FROM coach_reports WHERE coach_id = '<教練ID>') as remaining_coach_reports,
  (SELECT COUNT(*) FROM booking_participants WHERE coach_id = '<教練ID>') as remaining_participants;
-- 預期：所有數字都應該是 0

-- ⚠️ 重要：請手動輸入以下其中一個指令
-- COMMIT;    -- 確認刪除
-- ROLLBACK;  -- 取消刪除

-- 使用說明
SELECT 
  '===== 執行步驟 =====' as help;
  
SELECT 
  '1. 將所有 <教練ID> 替換為實際的教練 UUID' as step_1,
  '2. 檢查腳本輸出，確認要刪除的資料' as step_2,
  '3. 如果確認無誤，輸入 COMMIT; 完成刪除' as step_3,
  '4. 如果要取消，輸入 ROLLBACK; 回滾變更' as step_4;

