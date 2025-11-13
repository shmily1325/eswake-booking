-- =============================================
-- ESWake 預約系統 - 清空並重建 V5
-- =============================================
-- 
-- ⚠️ 警告：此腳本會刪除所有資料！
-- 僅在開發階段使用！
-- 
-- 執行步驟：
-- 1. 在 Supabase SQL Editor 執行此腳本
-- 2. 等待完成
-- 3. 重新初始化船隻和教練資料
-- =============================================

-- =============================================
-- 步驟 1：刪除所有現有表（CASCADE 會自動刪除相關聯的資料）
-- =============================================
DROP TABLE IF EXISTS line_bindings CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS daily_announcements CASCADE;
DROP TABLE IF EXISTS daily_tasks CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS booking_participants CASCADE;
DROP TABLE IF EXISTS coach_reports CASCADE;
DROP TABLE IF EXISTS booking_drivers CASCADE;
DROP TABLE IF EXISTS booking_coaches CASCADE;
DROP TABLE IF EXISTS booking_members CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS coach_time_off CASCADE;
DROP TABLE IF EXISTS coaches CASCADE;
DROP TABLE IF EXISTS boat_unavailable_dates CASCADE;
DROP TABLE IF EXISTS boats CASCADE;
DROP TABLE IF EXISTS board_storage CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;

-- =============================================
-- 步驟 2：刪除所有函數
-- =============================================
DROP FUNCTION IF EXISTS is_coach_available(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS is_boat_available(INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS log_booking_changes() CASCADE;

-- =============================================
-- 步驟 3：創建 V5 結構
-- =============================================

-- 1. 會員表 (Members)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本資料
  name TEXT NOT NULL,
  nickname TEXT,
  phone TEXT,
  birthday TEXT,
  notes TEXT,
  
  -- 會員類型與配對
  member_type TEXT NOT NULL DEFAULT 'guest',
  membership_type TEXT DEFAULT 'general',
  membership_partner_id UUID REFERENCES members(id),
  
  -- 會員期限
  membership_start_date TEXT,
  membership_end_date TEXT,
  
  -- 置板相關
  board_slot_number TEXT,
  board_expiry_date TEXT,
  
  -- 贈送時數
  free_hours DECIMAL(10, 2) DEFAULT 0,
  free_hours_used DECIMAL(10, 2) DEFAULT 0,
  free_hours_notes TEXT,
  
  -- 會員財務資訊
  balance DECIMAL(10, 2) DEFAULT 0,
  designated_lesson_minutes INTEGER DEFAULT 0,
  boat_voucher_g23_minutes INTEGER DEFAULT 0,
  boat_voucher_g21_minutes INTEGER DEFAULT 0,
  
  -- 狀態
  status TEXT DEFAULT 'active',
  
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE members IS '會員表：統一管理客人和會員';
COMMENT ON COLUMN members.membership_type IS '會員類型：general=一般會員, dual=雙人會員, board=置板';
COMMENT ON COLUMN members.membership_partner_id IS '雙人會員配對的另一位會員 ID';
COMMENT ON COLUMN members.free_hours IS '贈送時數（分鐘）';
COMMENT ON COLUMN members.free_hours_used IS '已使用贈送時數（分鐘）';
COMMENT ON COLUMN members.board_slot_number IS '置板位號碼（僅限置板會員）';

CREATE INDEX idx_members_type ON members(member_type);
CREATE INDEX idx_members_membership_type ON members(membership_type);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_membership_end_date ON members(membership_end_date);
CREATE INDEX idx_members_partner ON members(membership_partner_id);

-- 2. 置板服務表 (Board Storage)
CREATE TABLE board_storage (
  id SERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  
  slot_number INTEGER NOT NULL UNIQUE,
  expires_at TEXT,
  notes TEXT,
  
  status TEXT DEFAULT 'active',
  
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE board_storage IS '置板服務表';
CREATE INDEX idx_board_storage_member ON board_storage(member_id);
CREATE INDEX idx_board_storage_status ON board_storage(status);

-- 3. 船隻表 (Boats)
CREATE TABLE boats (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#1976d2',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE boats IS '船隻表';
CREATE INDEX idx_boats_is_active ON boats(is_active);

-- 初始船隻資料
INSERT INTO boats (name, color) VALUES
  ('G23', '#FF6B6B'),
  ('G21', '#4ECDC4'),
  ('黑豹', '#2C3E50'),
  ('粉紅', '#FF69B4'),
  ('彈簧床', '#95E1D3');

-- 4. 船隻停用記錄 (Boat Unavailable Dates)
CREATE TABLE boat_unavailable_dates (
  id SERIAL PRIMARY KEY,
  boat_id INTEGER NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  
  reason TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE boat_unavailable_dates IS '船隻停用記錄';
CREATE INDEX idx_boat_unavail_boat ON boat_unavailable_dates(boat_id);
CREATE INDEX idx_boat_unavail_dates ON boat_unavailable_dates(start_date, end_date);

-- 5. 教練表 (Coaches)
CREATE TABLE coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE coaches IS '教練表（教練同時也是駕駛）';
CREATE INDEX idx_coaches_status ON coaches(status);

-- 初始教練資料
INSERT INTO coaches (name) VALUES
  ('Casper'),
  ('ED'),
  ('Jerry'),
  ('Kevin'),
  ('小胖'),
  ('許書源'),
  ('木鳥'),
  ('義揚'),
  ('阿寶');

-- 6. 教練休假表 (Coach Time Off)
CREATE TABLE coach_time_off (
  id SERIAL PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  
  reason TEXT,
  notes TEXT,
  
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE coach_time_off IS '教練休假表';
CREATE INDEX idx_coach_timeoff_coach ON coach_time_off(coach_id);
CREATE INDEX idx_coach_timeoff_dates ON coach_time_off(start_date, end_date);

-- 7. 預約表 (Bookings)
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  
  boat_id INTEGER NOT NULL REFERENCES boats(id),
  member_id UUID REFERENCES members(id),
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  
  start_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  
  notes TEXT,
  status TEXT DEFAULT 'confirmed',
  activity_types TEXT[],
  
  created_by UUID REFERENCES auth.users(id),
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE bookings IS '預約表';
CREATE INDEX idx_bookings_boat ON bookings(boat_id);
CREATE INDEX idx_bookings_member ON bookings(member_id);
CREATE INDEX idx_bookings_start_at ON bookings(start_at);
CREATE INDEX idx_bookings_status ON bookings(status);
-- 複合索引優化常用查詢
CREATE INDEX idx_bookings_boat_date ON bookings(boat_id, start_at);
CREATE INDEX idx_bookings_status_date ON bookings(status, start_at);

-- 8. 預約會員關聯表 (Booking Members) ⭐ V5 新增
CREATE TABLE booking_members (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  created_at TEXT,
  
  UNIQUE(booking_id, member_id)
);

COMMENT ON TABLE booking_members IS '預約會員關聯表：一個預約可以有多個會員';
CREATE INDEX idx_booking_members_booking ON booking_members(booking_id);
CREATE INDEX idx_booking_members_member ON booking_members(member_id);

-- 9. 預約教練關聯表 (Booking Coaches)
CREATE TABLE booking_coaches (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id),
  is_designated BOOLEAN DEFAULT FALSE,
  created_at TEXT,
  
  UNIQUE(booking_id, coach_id)
);

COMMENT ON TABLE booking_coaches IS '預約教練關聯表';
CREATE INDEX idx_booking_coaches_booking ON booking_coaches(booking_id);
CREATE INDEX idx_booking_coaches_coach ON booking_coaches(coach_id);

-- 9.5. 預約駕駛關聯表 (Booking Drivers) ⭐ 新增
CREATE TABLE booking_drivers (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES coaches(id),
  created_at TEXT,
  
  UNIQUE(booking_id, driver_id)
);

COMMENT ON TABLE booking_drivers IS '預約駕駛關聯表：儲存另外排定的駕駛（駕駛=教練表中的人）';
COMMENT ON COLUMN booking_drivers.driver_id IS '駕駛 ID（必須是 coaches 表中的人）';
CREATE INDEX idx_booking_drivers_booking ON booking_drivers(booking_id);
CREATE INDEX idx_booking_drivers_driver ON booking_drivers(driver_id);

-- 10. 教練回報表 (Coach Reports) ⭐ V5 新增
CREATE TABLE coach_reports (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id),
  
  fuel_amount DECIMAL(10, 2),
  driver_duration_min INTEGER,
  
  reported_at TEXT,
  
  UNIQUE(booking_id, coach_id)
);

COMMENT ON TABLE coach_reports IS '教練回報表（駕駛部分）';
CREATE INDEX idx_coach_reports_booking ON coach_reports(booking_id);
CREATE INDEX idx_coach_reports_coach ON coach_reports(coach_id);

-- 11. 預約參與者表 (Booking Participants) ✨ V5 簡化
CREATE TABLE booking_participants (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES coaches(id),
  member_id UUID REFERENCES members(id),
  participant_name TEXT NOT NULL,
  
  duration_min INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  
  notes TEXT,
  created_at TEXT
);

COMMENT ON TABLE booking_participants IS '預約參與者表';
COMMENT ON COLUMN booking_participants.payment_method IS 'cash, transfer, balance, voucher, designated_paid, designated_free';
CREATE INDEX idx_booking_participants_booking ON booking_participants(booking_id);
CREATE INDEX idx_booking_participants_coach ON booking_participants(coach_id);
CREATE INDEX idx_booking_participants_member ON booking_participants(member_id);

-- 12. 財務交易記錄表 (Transactions)
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  booking_participant_id INTEGER REFERENCES booking_participants(id),
  
  transaction_type TEXT NOT NULL,
  category TEXT NOT NULL,
  
  amount DECIMAL(10, 2),
  minutes INTEGER,
  
  balance_after DECIMAL(10, 2),
  designated_lesson_minutes_after INTEGER,
  boat_voucher_g23_minutes_after INTEGER,
  boat_voucher_g21_minutes_after INTEGER,
  
  description TEXT NOT NULL,
  notes TEXT,
  
  payment_method TEXT,
  adjust_type TEXT,
  
  related_booking_id INTEGER REFERENCES bookings(id),
  
  operator_id UUID REFERENCES auth.users(id),
  created_at TEXT
);

COMMENT ON TABLE transactions IS '財務交易記錄表';
COMMENT ON COLUMN transactions.payment_method IS '付款方式：cash=現金, transfer=匯款, deduct_balance=扣儲值, g23_voucher=G23船券, g21_voucher=G21船券, designated_paid=指定課程（收費）, designated_free=指定課程（免費）, free_hours=贈送時數';
COMMENT ON COLUMN transactions.adjust_type IS '調整類型：increase=增加餘額, decrease=減少餘額';
CREATE INDEX idx_transactions_member ON transactions(member_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- 13. 每日任務表 (Daily Tasks)
CREATE TABLE daily_tasks (
  id SERIAL PRIMARY KEY,
  task_date TEXT NOT NULL,
  task_content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE daily_tasks IS '每日任務表';
CREATE INDEX idx_daily_tasks_date ON daily_tasks(task_date);

-- 14. 每日公告表 (Daily Announcements)
CREATE TABLE daily_announcements (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  display_date TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE daily_announcements IS '每日公告表';
CREATE INDEX idx_daily_announcements_date ON daily_announcements(display_date);

-- 15. 操作日誌表 (Audit Log)
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  start_time TEXT,
  details TEXT,
  changes JSONB,
  created_at TEXT
);

COMMENT ON TABLE audit_log IS '操作日誌表';
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- 16. 系統設定表 (System Settings)
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  updated_at TEXT,
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE system_settings IS '系統設定表';

-- 初始系統設定
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('line_reminder_enabled', 'false', 'LINE 每日提醒開關'),
  ('line_webhook_enabled', 'false', 'LINE Webhook 回覆開關（false=靜默模式，只記錄 user ID）');

-- 17. LINE 綁定表 (Line Bindings)
CREATE TABLE line_bindings (
  id SERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  member_id UUID REFERENCES members(id),
  phone TEXT,
  status TEXT DEFAULT 'pending',
  verification_code TEXT,
  created_at TEXT,
  expires_at TEXT,
  completed_at TEXT
);

COMMENT ON TABLE line_bindings IS 'LINE 綁定表';
CREATE INDEX idx_line_bindings_member ON line_bindings(member_id);
CREATE INDEX idx_line_bindings_phone ON line_bindings(phone);

-- =============================================
-- RLS (Row Level Security) 政策
-- =============================================

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE boat_unavailable_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to members" ON members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to board_storage" ON board_storage FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to boats" ON boats FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to boat_unavailable_dates" ON boat_unavailable_dates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to coaches" ON coaches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to coach_time_off" ON coach_time_off FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to bookings" ON bookings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to booking_members" ON booking_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to booking_coaches" ON booking_coaches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to booking_drivers" ON booking_drivers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to coach_reports" ON coach_reports FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to booking_participants" ON booking_participants FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to transactions" ON transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to daily_tasks" ON daily_tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to daily_announcements" ON daily_announcements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to audit_log" ON audit_log FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to system_settings" ON system_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to line_bindings" ON line_bindings FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- 輔助函數
-- =============================================

CREATE OR REPLACE FUNCTION is_coach_available(p_coach_id UUID, p_check_date TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM coach_time_off
    WHERE coach_id = p_coach_id
      AND p_check_date >= start_date
      AND p_check_date <= end_date
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_boat_available(p_boat_id INTEGER, p_check_date TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM boats WHERE id = p_boat_id AND is_active = TRUE) THEN
    RETURN FALSE;
  END IF;
  
  RETURN NOT EXISTS (
    SELECT 1 FROM boat_unavailable_dates
    WHERE boat_id = p_boat_id
      AND is_active = TRUE
      AND p_check_date >= start_date
      AND p_check_date <= end_date
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_email, action, table_name, record_id, details)
    VALUES (
      COALESCE(user_email, 'system'),
      'create',
      TG_TABLE_NAME,
      NEW.id::TEXT,
      '自動記錄：新增記錄'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (user_email, action, table_name, record_id, details, changes)
    VALUES (
      COALESCE(user_email, 'system'),
      'update',
      TG_TABLE_NAME,
      NEW.id::TEXT,
      '自動記錄：更新記錄',
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_email, action, table_name, record_id, details)
    VALUES (
      COALESCE(user_email, 'system'),
      'delete',
      TG_TABLE_NAME,
      OLD.id::TEXT,
      '自動記錄：刪除記錄'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER bookings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

CREATE TRIGGER booking_coaches_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON booking_coaches
  FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

CREATE TRIGGER booking_drivers_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON booking_drivers
  FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

CREATE TRIGGER coach_reports_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON coach_reports
  FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

-- =============================================
-- 完成！V5 資料庫創建成功！
-- =============================================

SELECT 
  '✅ V5 資料庫創建成功！' as status,
  COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

