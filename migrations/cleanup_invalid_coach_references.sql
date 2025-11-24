-- 清理無效的教練引用
-- 找出並刪除指向不存在教練的記錄

-- 1. 檢查有多少無效的 booking_coaches 記錄
SELECT COUNT(*) as invalid_booking_coaches
FROM booking_coaches bc
LEFT JOIN coaches c ON bc.coach_id = c.id
WHERE c.id IS NULL;

-- 2. 檢查有多少無效的 booking_drivers 記錄
SELECT COUNT(*) as invalid_booking_drivers
FROM booking_drivers bd
LEFT JOIN coaches c ON bd.driver_id = c.id
WHERE c.id IS NULL;

-- 3. 顯示無效的 booking_coaches 記錄（先看看再決定是否刪除）
SELECT bc.*, b.contact_name, b.start_at
FROM booking_coaches bc
LEFT JOIN coaches c ON bc.coach_id = c.id
LEFT JOIN bookings b ON bc.booking_id = b.id
WHERE c.id IS NULL
ORDER BY b.start_at DESC
LIMIT 10;

-- 4. 顯示無效的 booking_drivers 記錄
SELECT bd.*, b.contact_name, b.start_at
FROM booking_drivers bd
LEFT JOIN coaches c ON bd.driver_id = c.id
LEFT JOIN bookings b ON bd.booking_id = b.id
WHERE c.id IS NULL
ORDER BY b.start_at DESC
LIMIT 10;

-- 5. 刪除無效的 booking_coaches 記錄（執行前請先確認）
-- DELETE FROM booking_coaches
-- WHERE coach_id IN (
--   SELECT bc.coach_id
--   FROM booking_coaches bc
--   LEFT JOIN coaches c ON bc.coach_id = c.id
--   WHERE c.id IS NULL
-- );

-- 6. 刪除無效的 booking_drivers 記錄（執行前請先確認）
-- DELETE FROM booking_drivers
-- WHERE driver_id IN (
--   SELECT bd.driver_id
--   FROM booking_drivers bd
--   LEFT JOIN coaches c ON bd.driver_id = c.id
--   WHERE c.id IS NULL
-- );

