-- =============================================
-- 新增「需要駕駛」欄位到 bookings 表
-- =============================================

-- 1. 新增欄位
ALTER TABLE bookings 
ADD COLUMN requires_driver BOOLEAN DEFAULT false;

-- 2. 加上註解
COMMENT ON COLUMN bookings.requires_driver IS '是否需要駕駛（勾選後在排班時必須指定駕駛）';

-- 3. 建立索引（方便查詢需要駕駛的預約）
CREATE INDEX idx_bookings_requires_driver ON bookings(requires_driver) WHERE requires_driver = true;

-- 4. 驗證
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name = 'requires_driver';

