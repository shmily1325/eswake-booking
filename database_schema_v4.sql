-- =============================================
-- ESWake 預約系統 V4 資料庫架構
-- 重新設計：分離聯絡人、會員資格、置板服務
-- =============================================

-- 清空現有資料（謹慎使用！）
DROP TABLE IF EXISTS member_transactions CASCADE;
DROP TABLE IF EXISTS booking_participants CASCADE;
DROP TABLE IF EXISTS booking_coaches CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS board_storage CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS coach_time_off CASCADE;
DROP TABLE IF EXISTS boat_unavailable_dates CASCADE;
DROP TABLE IF EXISTS coaches CASCADE;
DROP TABLE IF EXISTS boats CASCADE;
DROP TABLE IF EXISTS daily_tasks CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

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
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE boats IS '船隻表';

-- 初始船隻資料
INSERT INTO boats (name, color) VALUES
  ('G23', '#FF6B6B'),
  ('G21', '#4ECDC4'),
  ('黑豹', '#2C3E50'),
  ('粉紅', '#FF69B4'),
  ('彈簧床', '#95E1D3');

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE boat_unavailable_dates IS '船隻停用記錄';

CREATE INDEX idx_boat_unavail_boat ON boat_unavailable_dates(boat_id);
CREATE INDEX idx_boat_unavail_dates ON boat_unavailable_dates(start_date, end_date);

-- =============================================
-- 5. 教練表 (Coaches)
-- =============================================
CREATE TABLE coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  status TEXT DEFAULT 'active',                     -- active, inactive
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE coaches IS '教練表';
COMMENT ON COLUMN coaches.status IS 'active=上架（可預約，在預約表顯示）, inactive=下架（不可預約，不在預約表顯示）';

-- 初始教練資料
INSERT INTO coaches (name) VALUES
  ('教練A'),
  ('教練B'),
  ('教練C');

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
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE coach_time_off IS '教練休假表';

CREATE INDEX idx_coach_timeoff_coach ON coach_time_off(coach_id);
CREATE INDEX idx_coach_timeoff_dates ON coach_time_off(start_date, end_date);

-- =============================================
-- 7. 駕駛表 (Drivers)
-- =============================================
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  status TEXT DEFAULT 'active',                     -- active, inactive
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE drivers IS '駕駛表（專門負責開船的人員）';
COMMENT ON COLUMN drivers.status IS 'active=上架（可排班），inactive=下架（不可排班）';

-- 初始駕駛資料
INSERT INTO drivers (name) VALUES
  ('駕駛A'),
  ('駕駛B');

-- =============================================
-- 8. 預約表 (Bookings)
-- =============================================
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  
  -- 預約資訊
  boat_id INTEGER NOT NULL REFERENCES boats(id),
  member_id UUID REFERENCES members(id),         -- 可選：連結到會員
  contact_name TEXT NOT NULL,                    -- 聯絡人姓名
  contact_phone TEXT,                            -- 聯絡電話
  
  -- 時間
  start_at TEXT NOT NULL,                        -- 格式：'2025-11-10T14:30:00'
  duration_min INTEGER NOT NULL,
  
  -- 駕駛和教練
  driver_coach_id UUID REFERENCES coaches(id),   -- 駕駛（可選）
  
  -- 其他資訊
  notes TEXT,
  status TEXT DEFAULT 'confirmed',               -- confirmed, cancelled, completed
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bookings IS '預約表';

CREATE INDEX idx_bookings_boat ON bookings(boat_id);
CREATE INDEX idx_bookings_member ON bookings(member_id);
CREATE INDEX idx_bookings_start_at ON bookings(start_at);
CREATE INDEX idx_bookings_status ON bookings(status);

-- =============================================
-- 8. 預約教練關聯表 (Booking Coaches)
-- =============================================
CREATE TABLE booking_coaches (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id),
  is_designated BOOLEAN DEFAULT FALSE,           -- 是否為指定教練
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(booking_id, coach_id)
);

COMMENT ON TABLE booking_coaches IS '預約教練關聯表：一個預約可以有多個教練';

CREATE INDEX idx_booking_coaches_booking ON booking_coaches(booking_id);
CREATE INDEX idx_booking_coaches_coach ON booking_coaches(coach_id);

-- =============================================
-- 9. 預約參與者表 (Booking Participants)
-- =============================================
CREATE TABLE booking_participants (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id),         -- 可選：連結到會員
  participant_name TEXT NOT NULL,                -- 參與者姓名
  
  -- 船費支付
  boat_fee_type TEXT,                            -- balance(扣儲值), voucher(扣船券), cash(現金)
  boat_fee_duration_min INTEGER,                 -- 使用分鐘數
  boat_fee_amount DECIMAL(10, 2),               -- 金額
  boat_fee_rate DECIMAL(10, 2),                 -- 費率（元/分鐘）
  
  -- 指定教練費用
  designated_coach_id UUID REFERENCES coaches(id),
  designated_fee_type TEXT,                      -- lesson(扣指定課), cash(現金)
  designated_fee_duration_min INTEGER,           -- 使用分鐘數
  designated_fee_amount DECIMAL(10, 2),         -- 金額
  designated_fee_rate DECIMAL(10, 2),           -- 費率（元/分鐘）
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE booking_participants IS '預約參與者表：教練回報時記錄';

CREATE INDEX idx_booking_participants_booking ON booking_participants(booking_id);
CREATE INDEX idx_booking_participants_member ON booking_participants(member_id);

-- =============================================
-- 10. 財務交易記錄表 (Transactions)
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE transactions IS '財務交易記錄表';

CREATE INDEX idx_transactions_member ON transactions(member_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- =============================================
-- 11. 每日任務表 (Daily Tasks)
-- =============================================
CREATE TABLE daily_tasks (
  id SERIAL PRIMARY KEY,
  task_date TEXT NOT NULL,                       -- 格式：'2025-11-10'
  task_content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE daily_tasks IS '每日任務表';

CREATE INDEX idx_daily_tasks_date ON daily_tasks(task_date);

-- =============================================
-- 12. 操作日誌表 (Audit Log)
-- =============================================
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  start_time TEXT,                               -- 格式：'2025-11-10T14:30:00'
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS '操作日誌表';

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

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
ALTER TABLE booking_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 允許認證用戶完全訪問
CREATE POLICY "Allow authenticated users full access to members" ON members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to board_storage" ON board_storage FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to boats" ON boats FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to boat_unavailable_dates" ON boat_unavailable_dates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to coaches" ON coaches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to coach_time_off" ON coach_time_off FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to bookings" ON bookings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to booking_coaches" ON booking_coaches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to booking_participants" ON booking_participants FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to transactions" ON transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to daily_tasks" ON daily_tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users full access to audit_log" ON audit_log FOR ALL USING (auth.role() = 'authenticated');

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
-- 完成！
-- =============================================

