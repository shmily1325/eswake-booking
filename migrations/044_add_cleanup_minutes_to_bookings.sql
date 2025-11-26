-- 新增清理時間欄位到 bookings 表
-- 目的：避免每次衝突檢查時重新計算，並解決船隻屬性變更的問題

-- 1. 新增欄位
ALTER TABLE bookings 
ADD COLUMN cleanup_minutes INTEGER NOT NULL DEFAULT 15;

-- 2. 更新註解
COMMENT ON COLUMN bookings.cleanup_minutes IS '接船/清理時間（分鐘）。一般船隻為 15，設施（彈簧床）為 0';

-- 3. 根據現有船隻類型更新歷史資料
-- 設施（彈簧床）的清理時間設為 0
UPDATE bookings
SET cleanup_minutes = 0
WHERE boat_id IN (
  SELECT id FROM boats WHERE name LIKE '%彈簧床%'
);

-- 4. 其他船隻保持預設值 15（已由 DEFAULT 設定）

-- 5. 建立索引（提升衝突檢查性能）
-- 注意：不使用 DATE() 函數，因為它不是 IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_bookings_boat_date_cleanup 
ON bookings(boat_id, start_at, cleanup_minutes);

-- 6. 顯示更新結果
DO $$
DECLARE
  total_count INTEGER;
  facility_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM bookings;
  SELECT COUNT(*) INTO facility_count FROM bookings WHERE cleanup_minutes = 0;
  
  RAISE NOTICE '✅ 清理時間欄位新增完成';
  RAISE NOTICE '📊 總預約數：%', total_count;
  RAISE NOTICE '📊 設施預約（0分鐘）：%', facility_count;
  RAISE NOTICE '📊 船隻預約（15分鐘）：%', total_count - facility_count;
END $$;

