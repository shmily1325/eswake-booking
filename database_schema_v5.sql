-- =============================================
-- ESWake 預約系統 V5 資料庫架構
-- 更新：
-- 1. 簡化駕駛邏輯（駕駛 = 教練）
-- 2. 支援預約多個會員（LINE 通知）
-- 3. 新增教練回報表（駕駛回報 + 參與者回報）
-- 4. 簡化收費方式
-- =============================================

-- =============================================
-- 1. 會員表 (Members) - 統一管理所有人
-- =============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本資料
  name TEXT NOT NULL,
  nickname TEXT,
  phone TEXT,
  birthday TEXT,                                 -- 格式：'2025-11-10'
  notes TEXT,
  
  -- 會員類型
  member_type TEXT NOT NULL DEFAULT 'guest',    -- guest(客人), member(會員)
  
  -- 會員財務資訊（只有 member 類型才會有值）
  balance DECIMAL(10, 2) DEFAULT 0,
  designated_lesson_minutes INTEGER DEFAULT 0,
  boat_voucher_minutes INTEGER DEFAULT 0,
  membership_expires_at TEXT,                    -- 格式：'2025-11-10'
  
  -- 狀態
  status TEXT DEFAULT 'active',                  -- active, inactive
  
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE members IS '會員表：統一管理客人和會員';
COMMENT ON COLUMN members.member_type IS 'guest=客人（含新手和常客）, member=會員';

CREATE INDEX idx_members_type ON members(member_type);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_status ON members(status);

-- =============================================
-- 2. 置板服務表 (Board Storage) - 獨立管理，一對多
-- =============================================
CREATE TABLE board_storage (
  id SERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  
  -- 置板資訊
  slot_number INTEGER NOT NULL UNIQUE,           -- 格位編號：1-145（唯一，不可重複）
  expires_at TEXT,                               -- 格式：'2025-11-10'
  notes TEXT,
  
  -- 狀態
  status TEXT DEFAULT 'active',                  -- active, expired, cancelled
  
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE board_storage IS '置板服務表：一個會員可以有多個置板格位';
COMMENT ON COLUMN board_storage.slot_number IS '格位編號：1-145';

CREATE INDEX idx_board_storage_member ON board_storage(member_id);
CREATE INDEX idx_board_storage_status ON board_storage(status);
CREATE INDEX idx_board_storage_slot ON board_storage(slot_number);

-- =============================================
-- 3. 船隻表 (Boats)
-- =============================================
CREATE TABLE boats (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#1976d2',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE boats IS '船隻表';
COMMENT ON COLUMN boats.is_active IS '是否啟用：true=啟用, false=停用（永久開關）';

CREATE INDEX idx_boats_is_active ON boats(is_active);

-- =============================================
-- 4. 船隻停用記錄 (Boat Unavailable Dates)
-- =============================================
CREATE TABLE boat_unavailable_dates (
  id SERIAL PRIMARY KEY,
  boat_id INTEGER NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  
  -- 日期範圍（TEXT 格式）
  start_date TEXT NOT NULL,                      -- 格式：'2025-11-10'
  end_date TEXT NOT NULL,                        -- 格式：'2025-11-10'
  
  reason TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE boat_unavailable_dates IS '船隻停用記錄：特定日期範圍的船隻維修或停用';

CREATE INDEX idx_boat_unavail_boat ON boat_unavailable_dates(boat_id);
CREATE INDEX idx_boat_unavail_dates ON boat_unavailable_dates(start_date, end_date);

-- =============================================
-- 5. 教練表 (Coaches)
-- =============================================
CREATE TABLE coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  status TEXT DEFAULT 'active',                     -- active, inactive, archived
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE coaches IS '教練表（教練同時也是駕駛）';
COMMENT ON COLUMN coaches.status IS 'active=啟用中（預約/排班/回報/統計都顯示）, inactive=已停用（回報/統計顯示但預約/排班不顯示）, archived=已歸檔（完全隱藏，但資料保留）';

CREATE INDEX idx_coaches_status ON coaches(status);

-- =============================================
-- 6. 教練休假表 (Coach Time Off)
-- =============================================
CREATE TABLE coach_time_off (
  id SERIAL PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  
  -- 休假日期範圍（TEXT 格式）
  start_date TEXT NOT NULL,                      -- 格式：'2025-11-10'
  end_date TEXT NOT NULL,                        -- 格式：'2025-11-10'
  
  reason TEXT,
  notes TEXT,
  
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE coach_time_off IS '教練休假表：特定日期範圍的教練休假或請假';

CREATE INDEX idx_coach_timeoff_coach ON coach_time_off(coach_id);
CREATE INDEX idx_coach_timeoff_dates ON coach_time_off(start_date, end_date);

-- =============================================
-- 7. 預約表 (Bookings)
-- =============================================
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  
  -- 預約資訊
  boat_id INTEGER NOT NULL REFERENCES boats(id),
  member_id UUID REFERENCES members(id),         -- 可選：主要會員（向下相容）
  contact_name TEXT NOT NULL,                    -- 聯絡人姓名
  contact_phone TEXT,                            -- 聯絡電話
  
  -- 時間
  start_at TEXT NOT NULL,                        -- 格式：'2025-11-10T14:30:00'
  duration_min INTEGER NOT NULL,
  
  -- 其他資訊
  notes TEXT,
  status TEXT DEFAULT 'confirmed',               -- confirmed, cancelled, completed
  activity_types TEXT[],                         -- 活動類型（衝浪、SUP等）
  
  created_by UUID REFERENCES auth.users(id),
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE bookings IS '預約表';
COMMENT ON COLUMN bookings.member_id IS '主要會員（向下相容），多個會員請查看 booking_members 表';

CREATE INDEX idx_bookings_boat ON bookings(boat_id);
CREATE INDEX idx_bookings_member ON bookings(member_id);
CREATE INDEX idx_bookings_start_at ON bookings(start_at);
CREATE INDEX idx_bookings_status ON bookings(status);

-- =============================================
-- 8. 預約會員關聯表 (Booking Members) ⭐ 新增
-- =============================================
CREATE TABLE booking_members (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  created_at TEXT,
  
  UNIQUE(booking_id, member_id)
);

COMMENT ON TABLE booking_members IS '預約會員關聯表：一個預約可以有多個會員（用於 LINE 通知）';

CREATE INDEX idx_booking_members_booking ON booking_members(booking_id);
CREATE INDEX idx_booking_members_member ON booking_members(member_id);

-- =============================================
-- 9. 預約教練關聯表 (Booking Coaches)
-- =============================================
CREATE TABLE booking_coaches (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id),
  is_designated BOOLEAN DEFAULT FALSE,           -- 是否為指定教練
  created_at TEXT,
  
  UNIQUE(booking_id, coach_id)
);

COMMENT ON TABLE booking_coaches IS '預約教練關聯表：一個預約可以有多個教練（教練同時也是駕駛）';

CREATE INDEX idx_booking_coaches_booking ON booking_coaches(booking_id);
CREATE INDEX idx_booking_coaches_coach ON booking_coaches(coach_id);

-- =============================================
-- 10. 教練回報表 (Coach Reports) ⭐ 新增
-- =============================================
CREATE TABLE coach_reports (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id),
  
  -- 駕駛回報
  fuel_amount DECIMAL(10, 2),                    -- 油量（公升）
  driver_duration_min INTEGER,                   -- 駕駛時數（分鐘）
  
  -- 回報時間
  reported_at TEXT,
  
  UNIQUE(booking_id, coach_id)
);

COMMENT ON TABLE coach_reports IS '教練回報表（駕駛部分）：每個教練都要回報油量和駕駛時數';

CREATE INDEX idx_coach_reports_booking ON coach_reports(booking_id);
CREATE INDEX idx_coach_reports_coach ON coach_reports(coach_id);

-- =============================================
-- 11. 預約參與者表 (Booking Participants) ✨ 簡化
-- =============================================
CREATE TABLE booking_participants (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES coaches(id),          -- 哪個教練回報的
  member_id UUID REFERENCES members(id),         -- 可選：連結到會員
  participant_name TEXT NOT NULL,                -- 參與者姓名
  
  -- 時數和收費
  duration_min INTEGER NOT NULL,                 -- 參與者時數（分鐘）
  payment_method TEXT NOT NULL,                  -- 收費方式
  
  notes TEXT,
  created_at TEXT
);

COMMENT ON TABLE booking_participants IS '預約參與者表：教練回報時記錄實際參與者';
COMMENT ON COLUMN booking_participants.payment_method IS 'cash=現金, transfer=匯款, balance=扣儲值, voucher=票券, designated_paid=指定(收費), designated_free=指定(免費)';

CREATE INDEX idx_booking_participants_booking ON booking_participants(booking_id);
CREATE INDEX idx_booking_participants_coach ON booking_participants(coach_id);
CREATE INDEX idx_booking_participants_member ON booking_participants(member_id);

-- =============================================
-- 12. 財務交易記錄表 (Transactions)
-- =============================================
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  booking_participant_id INTEGER REFERENCES booking_participants(id),
  
  -- 交易類型和類別
  transaction_type TEXT NOT NULL,                -- charge, purchase, consume, refund, expire, adjust
  category TEXT NOT NULL,                        -- balance, designated_lesson, boat_voucher, membership
  
  -- 變動
  amount DECIMAL(10, 2),                         -- 金額變動
  minutes INTEGER,                               -- 分鐘數變動
  
  -- 餘額快照
  balance_after DECIMAL(10, 2),
  designated_lesson_minutes_after INTEGER,
  boat_voucher_minutes_after INTEGER,
  
  -- 說明
  description TEXT NOT NULL,
  notes TEXT,
  
  -- 關聯
  related_booking_id INTEGER REFERENCES bookings(id),
  
  -- 操作人
  operator_id UUID REFERENCES auth.users(id),
  created_at TEXT
);

COMMENT ON TABLE transactions IS '財務交易記錄表';

CREATE INDEX idx_transactions_member ON transactions(member_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- =============================================
-- 13. 每日任務表 (Daily Tasks)
-- =============================================
CREATE TABLE daily_tasks (
  id SERIAL PRIMARY KEY,
  task_date TEXT NOT NULL,                       -- 格式：'2025-11-10'
  task_content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE daily_tasks IS '每日任務表';

CREATE INDEX idx_daily_tasks_date ON daily_tasks(task_date);

-- =============================================
-- 14. 每日公告表 (Daily Announcements)
-- =============================================
CREATE TABLE daily_announcements (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  display_date TEXT NOT NULL,                    -- 格式：'2025-11-10'
  created_by UUID REFERENCES auth.users(id),
  created_at TEXT,
  updated_at TEXT
);

COMMENT ON TABLE daily_announcements IS '每日公告表';

CREATE INDEX idx_daily_announcements_date ON daily_announcements(display_date);

-- =============================================
-- 15. 操作日誌表 (Audit Log)
-- =============================================
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  start_time TEXT,                               -- 格式：'2025-11-10T14:30:00'
  details TEXT,
  changes JSONB,
  created_at TEXT
);

COMMENT ON TABLE audit_log IS '操作日誌表';

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- =============================================
-- 16. LINE 系統設定表 (System Settings)
-- =============================================
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  updated_at TEXT,
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE system_settings IS '系統設定表';

-- =============================================
-- 17. LINE 綁定表 (Line Bindings)
-- =============================================
CREATE TABLE line_bindings (
  id SERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  member_id UUID REFERENCES members(id),
  phone TEXT,
  status TEXT DEFAULT 'pending',                 -- pending, active, inactive
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

-- 啟用 RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE boat_unavailable_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_bindings ENABLE ROW LEVEL SECURITY;

-- 允許認證用戶完全訪問
CREATE POLICY "Allow authenticated users full access to members" ON members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to board_storage" ON board_storage FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to boats" ON boats FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to boat_unavailable_dates" ON boat_unavailable_dates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to coaches" ON coaches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to coach_time_off" ON coach_time_off FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to bookings" ON bookings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to booking_members" ON booking_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to booking_coaches" ON booking_coaches FOR ALL USING (auth.role() = 'authenticated');
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

-- 檢查教練是否可用
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

-- 檢查船隻是否可用
CREATE OR REPLACE FUNCTION is_boat_available(p_boat_id INTEGER, p_check_date TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- 檢查船隻是否啟用
  IF NOT EXISTS (SELECT 1 FROM boats WHERE id = p_boat_id AND is_active = TRUE) THEN
    RETURN FALSE;
  END IF;
  
  -- 檢查是否在停用日期範圍內
  RETURN NOT EXISTS (
    SELECT 1 FROM boat_unavailable_dates
    WHERE boat_id = p_boat_id
      AND is_active = TRUE
      AND p_check_date >= start_date
      AND p_check_date <= end_date
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Audit Log Triggers（自動記錄重要變更）
-- =============================================

-- 通用 Trigger 函數
CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- 嘗試獲取當前用戶 email
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

-- 為重要表建立 Trigger
CREATE TRIGGER bookings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

CREATE TRIGGER booking_coaches_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON booking_coaches
  FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

CREATE TRIGGER coach_reports_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON coach_reports
  FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

COMMENT ON FUNCTION log_booking_changes() IS 'Trigger 函數：自動記錄預約相關表的變更到 audit_log';

-- =============================================
-- V4 → V5 更新摘要
-- =============================================
-- 
-- ✅ 新增：
--   1. booking_members 表（預約可以有多個會員，用於 LINE 通知）
--   2. coach_reports 表（教練回報駕駛部分：油量、時數）
--   3. Audit log triggers（自動記錄變更）
--
-- ✨ 簡化：
--   1. booking_participants 表（簡化收費方式為單一欄位）
--   2. 刪除 drivers 表（駕駛 = 教練）
--   3. 保留 boat_unavailable_dates 和 coach_time_off（日期範圍管理）
--
-- ❌ 刪除：
--   1. bookings.driver_coach_id 欄位
--   2. booking_participants 的複雜收費欄位
--
-- 📋 遷移指南：
--   請使用 migrate_v4_to_v5.sql 進行遷移
-- =============================================

