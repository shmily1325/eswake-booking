-- =============================================
-- ESWake Booking System - 重构版数据库架构
-- =============================================

-- 1. 删除旧表和触发器
DROP TRIGGER IF EXISTS audit_bookings_changes ON bookings;
DROP TRIGGER IF EXISTS audit_boats_changes ON boats;
DROP TRIGGER IF EXISTS audit_coaches_changes ON coaches;
DROP FUNCTION IF EXISTS log_table_changes();

DROP TABLE IF EXISTS booking_coaches CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS boats CASCADE;
DROP TABLE IF EXISTS coaches CASCADE;

-- =============================================
-- 2. 船隻表 (Boats)
-- =============================================
CREATE TABLE boats (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. 教練表 (Coaches)
-- =============================================
CREATE TABLE coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. 預約表 (Bookings) - 主表，不包含 coach_id
-- =============================================
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  boat_id INTEGER NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  student TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL,
  activity_types TEXT[], -- ['WB', 'WS']
  notes TEXT,
  status TEXT DEFAULT 'Confirmed',
  created_by UUID NOT NULL, -- 創建者 (auth.users.id)
  updated_by UUID, -- 最後更新者
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. 預約-教練關聯表 (Booking Coaches) - 多對多
-- =============================================
CREATE TABLE booking_coaches (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  -- 教練確認相關欄位
  actual_duration_min INTEGER,
  coach_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, coach_id) -- 同一預約不能重複指定同一教練
);

-- =============================================
-- 6. 審計日誌表 (Audit Log) - 人類可讀版本
-- =============================================
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  operation TEXT NOT NULL, -- '新增預約', '修改預約', '刪除預約'
  user_email TEXT NOT NULL, -- 操作者的 Gmail
  
  -- 預約詳細資訊（完整的人類可讀描述）
  student_name TEXT NOT NULL,
  boat_name TEXT NOT NULL,
  coach_names TEXT, -- "Bao / Cas" 或 "未指定"
  start_time TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL,
  activity_types TEXT[], -- ['WB', 'WS']
  notes TEXT,
  
  -- 修改內容（僅「修改預約」時使用）
  changes TEXT, -- 例: "教練: Bao → Cas / ED; 時長: 60分 → 90分"
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 審計日誌顯示範例：
-- 2025-10-28 14:32 | user@gmail.com | 新增預約 | fdsaf / G23 / 2025-10-28 05:00 / Cas, ED / 60分鐘 / WB
-- 2025-10-28 15:10 | user@gmail.com | 修改預約 | fdsaf / G23 / 2025-10-28 05:00 → 修改: 教練: Cas, ED → Bao / 時長: 60分 → 90分
-- 2025-10-28 16:45 | user@gmail.com | 刪除預約 | asdf / G21 / 2025-10-28 08:30 / Bao / 60分鐘

-- =============================================
-- 7. 索引優化
-- =============================================
CREATE INDEX idx_bookings_boat_start ON bookings(boat_id, start_at);
CREATE INDEX idx_bookings_start_at ON bookings(start_at);
CREATE INDEX idx_bookings_student ON bookings(student);
CREATE INDEX idx_booking_coaches_booking ON booking_coaches(booking_id);
CREATE INDEX idx_booking_coaches_coach ON booking_coaches(coach_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_student ON audit_log(student_name);
CREATE INDEX idx_audit_log_user ON audit_log(user_email);

-- =============================================
-- 8. 船衝突檢查
-- =============================================
-- 衝突檢查由應用層處理，確保：
-- 1. 同一船的預約之間至少有 15 分鐘間隔
-- 2. 同一教練不能有重疊的預約
-- 不使用數據庫 EXCLUDE 約束，因為涉及複雜的時區和邏輯判斷

-- =============================================
-- 9. 審計日誌說明
-- =============================================
-- 審計日誌將由應用層手動記錄，確保記錄人類可讀的資訊
-- 不使用自動觸發器，因為需要組合多個表的資訊（bookings + booking_coaches + boats + coaches）

-- =============================================
-- 10. RLS (Row Level Security) 策略
-- =============================================
ALTER TABLE boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 所有已認證用戶都可以讀取
CREATE POLICY "Allow authenticated users to read boats"
ON boats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read coaches"
ON coaches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read bookings"
ON bookings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read booking_coaches"
ON booking_coaches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read audit_log"
ON audit_log FOR SELECT TO authenticated USING (true);

-- 所有已認證用戶都可以寫入
CREATE POLICY "Allow authenticated users to insert bookings"
ON bookings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update bookings"
ON bookings FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete bookings"
ON bookings FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert booking_coaches"
ON booking_coaches FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update booking_coaches"
ON booking_coaches FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete booking_coaches"
ON booking_coaches FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert audit_log"
ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- 12. 插入初始數據
-- =============================================

-- 船隻
INSERT INTO boats (name, color, display_order) VALUES
  ('G23', '#5a5a5a', 1),
  ('G21', '#5a5a5a', 2),
  ('黑豹', '#5a5a5a', 3),
  ('粉紅', '#5a5a5a', 4),
  ('彈簧床', '#5a5a5a', 5);

-- 教練
INSERT INTO coaches (name) VALUES
  ('阿寶'),
  ('Casper'),
  ('ED'),
  ('Jerry'),
  ('Kevin'),
  ('小胖'),
  ('木鳥'),
  ('義揚'),
  ('許書源');

-- =============================================
-- 完成！
-- =============================================

