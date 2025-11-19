-- 檢查和修復 bookings 表的 created_at 欄位

-- 1. 查看當前 created_at 的狀況
SELECT 
  id,
  contact_name,
  start_at,
  created_at,
  CASE 
    WHEN created_at IS NULL THEN '無值'
    WHEN created_at = '' THEN '空字串'
    ELSE '有值'
  END as status
FROM bookings
ORDER BY id DESC
LIMIT 10;

-- 2. 檢查有多少筆沒有 created_at
SELECT 
  COUNT(*) as total_bookings,
  COUNT(created_at) as has_created_at,
  COUNT(*) - COUNT(created_at) as missing_created_at
FROM bookings;

-- 3. 為沒有 created_at 的預約設置預設值（使用 start_at 作為參考）
-- 注意：這會將所有沒有 created_at 的預約設為它們的 start_at 時間
-- 如果你不想執行這個，可以註解掉
UPDATE bookings
SET created_at = start_at
WHERE created_at IS NULL OR created_at = '';

-- 4. 確保未來新增的預約都有 created_at
-- 方法 A: 修改表結構，添加預設值（推薦）
ALTER TABLE bookings 
ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'UTC')::TEXT;

-- 方法 B: 如果上面的不行，可以創建一個 trigger
-- CREATE OR REPLACE FUNCTION set_created_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.created_at IS NULL OR NEW.created_at = '' THEN
--     NEW.created_at := (NOW() AT TIME ZONE 'UTC')::TEXT;
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER bookings_created_at_trigger
-- BEFORE INSERT ON bookings
-- FOR EACH ROW
-- EXECUTE FUNCTION set_created_at();

-- 5. 驗證修復結果
SELECT 
  id,
  contact_name,
  start_at,
  created_at,
  CASE 
    WHEN created_at IS NULL THEN '無值'
    WHEN created_at = '' THEN '空字串'
    ELSE '有值'
  END as status
FROM bookings
ORDER BY id DESC
LIMIT 10;

