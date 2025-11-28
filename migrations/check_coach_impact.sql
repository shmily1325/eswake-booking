-- =============================================
-- 檢查教練影響範圍
-- =============================================
-- 
-- 用途：在刪除教練前，檢查會影響多少資料
-- 
-- 使用方法：
-- 1. 先執行下面的查詢找出教練 ID：
--    SELECT id, name, status FROM coaches ORDER BY name;
-- 
-- 2. 將下方所有 '<教練ID>' 替換為實際的教練 UUID
--    (使用編輯器的「尋找取代」功能一次替換所有)
-- 
-- =============================================

-- 先查詢所有教練，找出要檢查的教練 ID
SELECT id, name, status, created_at 
FROM coaches 
ORDER BY created_at DESC;

-- ⬇️⬇️⬇️ 請將下面所有 '<教練ID>' 替換為實際的 UUID ⬇️⬇️⬇️

DO $$
DECLARE
  v_coach_id UUID := '<教練ID>'; -- ⚠️ 請替換這裡的 <教練ID>
  v_coach_name TEXT;
  v_time_offs INTEGER;
  v_booking_coaches INTEGER;
  v_booking_drivers INTEGER;
  v_coach_reports INTEGER;
  v_participants INTEGER;
  v_future_bookings INTEGER;
  v_total_bookings INTEGER;
  v_has_transactions INTEGER;
  v_can_delete BOOLEAN := TRUE;
BEGIN
  -- 取得教練名稱
  SELECT name INTO v_coach_name FROM coaches WHERE id = v_coach_id;
  
  IF v_coach_name IS NULL THEN
    RAISE NOTICE '❌ 找不到此教練 ID: %', v_coach_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '檢查教練影響範圍';
  RAISE NOTICE '============================================';
  RAISE NOTICE '教練名稱: %', v_coach_name;
  RAISE NOTICE '教練 ID: %', v_coach_id;
  RAISE NOTICE '';
  
  -- 1. 檢查休假記錄
  SELECT COUNT(*) INTO v_time_offs
  FROM coach_time_off
  WHERE coach_id = v_coach_id;
  
  RAISE NOTICE '1. 休假記錄: % 筆', v_time_offs;
  
  -- 2. 檢查排班記錄（教練）
  SELECT COUNT(*) INTO v_booking_coaches
  FROM booking_coaches
  WHERE coach_id = v_coach_id;
  
  RAISE NOTICE '2. 排班記錄（教練）: % 筆', v_booking_coaches;
  
  -- 3. 檢查排班記錄（駕駛）
  SELECT COUNT(*) INTO v_booking_drivers
  FROM booking_drivers
  WHERE driver_id = v_coach_id;
  
  RAISE NOTICE '3. 排班記錄（駕駛）: % 筆', v_booking_drivers;
  
  -- 4. 檢查教練回報
  SELECT COUNT(*) INTO v_coach_reports
  FROM coach_reports
  WHERE coach_id = v_coach_id;
  
  RAISE NOTICE '4. 教練回報記錄: % 筆', v_coach_reports;
  
  -- 5. 檢查參與者記錄
  SELECT COUNT(*) INTO v_participants
  FROM booking_participants
  WHERE coach_id = v_coach_id;
  
  RAISE NOTICE '5. 參與者記錄: % 筆', v_participants;
  
  -- 6. 檢查未來的預約
  SELECT COUNT(DISTINCT bc.booking_id) INTO v_future_bookings
  FROM booking_coaches bc
  JOIN bookings b ON bc.booking_id = b.id
  WHERE bc.coach_id = v_coach_id
    AND b.start_at >= NOW()::TEXT
    AND b.status != 'cancelled';
  
  RAISE NOTICE '6. 未來預約: % 筆', v_future_bookings;
  
  -- 7. 檢查總預約數
  SELECT COUNT(DISTINCT bc.booking_id) INTO v_total_bookings
  FROM booking_coaches bc
  WHERE bc.coach_id = v_coach_id;
  
  RAISE NOTICE '7. 總預約數: % 筆', v_total_bookings;
  
  -- 8. 檢查是否有關聯的交易記錄
  SELECT COUNT(*) INTO v_has_transactions
  FROM transactions t
  WHERE t.booking_participant_id IN (
    SELECT id FROM booking_participants WHERE coach_id = v_coach_id
  );
  
  RAISE NOTICE '8. 關聯的交易記錄: % 筆', v_has_transactions;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '刪除影響評估';
  RAISE NOTICE '============================================';
  
  -- 評估是否可以安全刪除
  IF v_future_bookings > 0 THEN
    RAISE NOTICE '⚠️  警告：此教練有 % 筆未來預約，刪除後這些預約會失去教練！', v_future_bookings;
    v_can_delete := FALSE;
  END IF;
  
  IF v_has_transactions > 0 THEN
    RAISE NOTICE '⚠️  警告：有 % 筆交易記錄關聯到此教練的回報', v_has_transactions;
    RAISE NOTICE '    （交易記錄會保留，但會失去與教練的連結）';
  END IF;
  
  IF v_participants > 0 THEN
    RAISE NOTICE '⚠️  注意：將刪除 % 筆參與者記錄', v_participants;
  END IF;
  
  IF v_coach_reports > 0 THEN
    RAISE NOTICE '⚠️  注意：將刪除 % 筆教練回報記錄', v_coach_reports;
  END IF;
  
  RAISE NOTICE '';
  
  IF v_can_delete THEN
    RAISE NOTICE '✅ 此教練可以安全刪除';
    RAISE NOTICE '';
    RAISE NOTICE '建議執行：';
    RAISE NOTICE '1. 使用 delete_coach_safe.sql 腳本刪除';
    RAISE NOTICE '2. 或在前端點擊「刪除教練」按鈕';
  ELSE
    RAISE NOTICE '❌ 不建議刪除此教練';
    RAISE NOTICE '';
    RAISE NOTICE '建議：';
    RAISE NOTICE '1. 先處理未來的預約';
    RAISE NOTICE '2. 或使用「歸檔」功能（status = archived）';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

-- 詳細列出關聯的預約（前 10 筆）
SELECT 
  '關聯預約詳情（前10筆）' as info;
  
SELECT 
  b.id,
  b.contact_name,
  b.start_at,
  b.duration_min,
  b.status,
  CASE 
    WHEN b.start_at >= NOW()::TEXT THEN '未來'
    ELSE '過去'
  END as time_status
FROM booking_coaches bc
JOIN bookings b ON bc.booking_id = b.id
WHERE bc.coach_id = '<教練ID>'
ORDER BY b.start_at DESC
LIMIT 10;

-- 列出關聯的回報記錄（前 10 筆）
SELECT 
  '回報記錄詳情（前10筆）' as info;
  
SELECT 
  cr.id,
  b.contact_name,
  b.start_at,
  cr.fuel_amount,
  cr.driver_duration_min,
  cr.reported_at
FROM coach_reports cr
JOIN bookings b ON cr.booking_id = b.id
WHERE cr.coach_id = '<教練ID>'
ORDER BY b.start_at DESC
LIMIT 10;

-- 使用說明
SELECT 
  '===== 使用說明 =====' as help;
  
SELECT 
  '1. 請將所有 <教練ID> 替換為實際的教練 UUID' as step_1,
  '2. 在 Supabase SQL Editor 執行此腳本' as step_2,
  '3. 查看輸出的影響評估' as step_3,
  '4. 如果顯示「可以安全刪除」，則可執行 delete_coach_safe.sql' as step_4;

