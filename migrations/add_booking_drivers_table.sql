-- =============================================
-- 新增 booking_drivers 表
-- 用途：儲存「另外排定」的駕駛
-- 邏輯：
--   - 只有 booking_coaches（無 booking_drivers）→ 教練默認是駕駛
--   - 有 booking_drivers → 教練只是教練，drivers 裡的人是駕駛
-- =============================================

CREATE TABLE IF NOT EXISTS booking_drivers (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES coaches(id),
  created_at TEXT,
  
  UNIQUE(booking_id, driver_id)
);

COMMENT ON TABLE booking_drivers IS '預約駕駛關聯表：儲存另外排定的駕駛（非默認教練）';
COMMENT ON COLUMN booking_drivers.driver_id IS '駕駛 ID（必須是 coaches 表中的人）';

CREATE INDEX idx_booking_drivers_booking ON booking_drivers(booking_id);
CREATE INDEX idx_booking_drivers_driver ON booking_drivers(driver_id);

-- 啟用 RLS
ALTER TABLE booking_drivers ENABLE ROW LEVEL SECURITY;

-- 允許已登入用戶查看所有駕駛資料
CREATE POLICY "Allow authenticated users to view booking drivers"
ON booking_drivers FOR SELECT
TO authenticated
USING (true);

-- 允許已登入用戶新增駕駛
CREATE POLICY "Allow authenticated users to insert booking drivers"
ON booking_drivers FOR INSERT
TO authenticated
WITH CHECK (true);

-- 允許已登入用戶刪除駕駛
CREATE POLICY "Allow authenticated users to delete booking drivers"
ON booking_drivers FOR DELETE
TO authenticated
USING (true);

-- 驗證表已創建
SELECT 'booking_drivers 表已成功創建' AS status;
