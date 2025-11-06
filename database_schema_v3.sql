-- =============================================
-- ESWake Booking System - V2 完整資料庫架構
-- =============================================

-- 清理舊資料
DROP TABLE IF EXISTS daily_tasks CASCADE;
DROP TABLE IF EXISTS member_transactions CASCADE;
DROP TABLE IF EXISTS booking_participants CASCADE;
DROP TABLE IF EXISTS booking_coaches CASCADE;
DROP TABLE IF EXISTS coach_time_off CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS coaches CASCADE;
DROP TABLE IF EXISTS boats CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

-- =============================================
-- 1. 船隻表 (Boats)
-- =============================================
CREATE TABLE boats (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boats_active ON boats(is_active);

COMMENT ON TABLE boats IS '船隻表';

-- =============================================
-- 2. 教練表 (Coaches)
-- =============================================
CREATE TABLE coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE coaches IS '教練表：只記錄名字和備註，休假用 coach_time_off 表管理';

-- =============================================
-- 3. 教練休假表 (Coach Time Off)
-- =============================================
CREATE TABLE coach_time_off (
  id SERIAL PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  
  -- 日期範圍（TEXT 格式，避免時差問題）
  start_date TEXT NOT NULL,                      -- 格式：'2025-11-10'
  end_date TEXT NOT NULL,                        -- 格式：'2025-11-10'，單日時相同
  
  -- 說明
  reason TEXT,
  notes TEXT,
  
  -- 狀態
  is_active BOOLEAN DEFAULT TRUE,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coach_time_off_coach ON coach_time_off(coach_id);
CREATE INDEX idx_coach_time_off_dates ON coach_time_off(start_date, end_date);
CREATE INDEX idx_coach_time_off_active ON coach_time_off(is_active);

COMMENT ON TABLE coach_time_off IS '教練休假表：記錄教練休假的日期範圍';

-- =============================================
-- 4. 船隻停用記錄 (Boat Unavailable Dates)
-- =============================================
CREATE TABLE boat_unavailable_dates (
  id SERIAL PRIMARY KEY,
  boat_id INTEGER NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  
  -- 日期範圍（TEXT 格式，避免時差問題）
  start_date TEXT NOT NULL,                      -- 格式：'2025-11-10'
  end_date TEXT NOT NULL,                        -- 格式：'2025-11-10'，單日時相同
  
  -- 原因
  reason TEXT NOT NULL,                          -- '引擎維修', '年度保養', '臨時故障'
  notes TEXT,
  
  -- 狀態
  is_active BOOLEAN DEFAULT TRUE,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boat_unavailable_boat ON boat_unavailable_dates(boat_id);
CREATE INDEX idx_boat_unavailable_dates ON boat_unavailable_dates(start_date, end_date);
CREATE INDEX idx_boat_unavailable_active ON boat_unavailable_dates(is_active);

COMMENT ON TABLE boat_unavailable_dates IS '船隻停用記錄：維修、保養或臨時故障';

-- =============================================
-- 5. 會員表 (Members)
-- =============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本資料
  name TEXT NOT NULL,
  nickname TEXT,
  birthday TEXT,                                 -- 格式：'1990-01-15'
  phone TEXT,
  email TEXT,
  line_id TEXT,                                  -- LINE ID
  
  -- 會員權益（按分鐘數計算）
  balance DECIMAL(10, 2) DEFAULT 0,              -- 儲值餘額（金額）
  designated_lesson_minutes INTEGER DEFAULT 0,   -- 指定課剩餘分鐘數
  boat_voucher_minutes INTEGER DEFAULT 0,        -- 船券剩餘分鐘數
  membership_expires_at TEXT,                    -- 會員到期日，格式：'2026-12-31'
  
  -- 置板服務
  has_board_storage BOOLEAN DEFAULT FALSE,
  board_storage_expires_at TEXT,                 -- 格式：'2025-12-31'
  board_storage_location TEXT,
  
  -- 其他
  notes TEXT,
  member_type TEXT DEFAULT 'regular',            -- regular, vip, board_only
  tags TEXT[],
  
  -- 系統欄位
  status TEXT DEFAULT 'active',                  -- active, inactive, suspended
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_members_name ON members(name);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_status ON members(status);

COMMENT ON TABLE members IS '會員表';
COMMENT ON COLUMN members.balance IS '儲值餘額（金額）';
COMMENT ON COLUMN members.designated_lesson_minutes IS '指定課剩餘分鐘數';
COMMENT ON COLUMN members.boat_voucher_minutes IS '船券剩餘分鐘數';

-- =============================================
-- 5. 預約表 (Bookings)
-- =============================================
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  
  -- 預約基本資訊
  boat_id INTEGER NOT NULL REFERENCES boats(id),
  contact_name TEXT NOT NULL,                    -- 聯絡人
  contact_phone TEXT,
  booking_member_id UUID REFERENCES members(id), -- 預約的會員（可選）
  
  -- 駕駛（從教練列表選擇）
  driver_coach_id UUID REFERENCES coaches(id),   -- 駕駛教練（可選）
  
  -- 時間和活動（TEXT 格式，避免時差問題）
  start_at TEXT NOT NULL,                        -- 格式：'2025-11-10T08:00:00'
  duration_min INTEGER NOT NULL,
  activity_types TEXT[],                         -- ['WB', 'WS', 'Foil']
  
  -- 狀態
  status TEXT DEFAULT 'confirmed',               -- confirmed, completed, cancelled
  notes TEXT,
  
  -- 系統欄位
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_boat_start ON bookings(boat_id, start_at);
CREATE INDEX idx_bookings_date ON bookings(start_at);
CREATE INDEX idx_bookings_status ON bookings(status);

COMMENT ON TABLE bookings IS '預約表：預約時只記錄基本資訊';

-- =============================================
-- 6. 預約-教練關聯表 (Booking Coaches)
-- =============================================
CREATE TABLE booking_coaches (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id),
  
  -- 是否為指定課
  is_designated BOOLEAN DEFAULT FALSE,           -- TRUE=指定課（需額外付費）
  
  -- 教練回報
  actual_duration_min INTEGER,
  coach_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  coach_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, coach_id)
);

CREATE INDEX idx_booking_coaches_booking ON booking_coaches(booking_id);
CREATE INDEX idx_booking_coaches_coach ON booking_coaches(coach_id);

COMMENT ON TABLE booking_coaches IS '預約-教練關聯表';

-- =============================================
-- 7. 預約參與者表 (Booking Participants) - 教練回報時才創建
-- =============================================
CREATE TABLE booking_participants (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- 參與者身份（二選一）
  member_id UUID REFERENCES members(id),
  guest_name TEXT,
  guest_phone TEXT,
  is_first_timer BOOLEAN DEFAULT FALSE,          -- 是否初學者
  
  -- 船費支付（必須）
  boat_fee_type TEXT NOT NULL,                   -- 'balance', 'voucher', 'cash', 'free'
  boat_fee_duration_min INTEGER NOT NULL,        -- 船費計費時長（分鐘）
  boat_fee_amount DECIMAL(10, 2),                -- 金額（儲值/現金）
  boat_fee_rate DECIMAL(10, 2),                  -- 費率（記錄用）
  
  -- 指定課費用（可選）
  designated_coach_id UUID REFERENCES coaches(id),
  designated_fee_type TEXT,                      -- 'lesson_minutes', 'cash', NULL
  designated_fee_duration_min INTEGER,           -- 指定課計費時長（分鐘）
  designated_fee_amount DECIMAL(10, 2),          -- 金額（現金支付）
  
  -- 教練評價
  skill_level TEXT,                              -- beginner, intermediate, advanced
  performance_notes TEXT,
  
  -- 狀態
  attendance_status TEXT DEFAULT 'attended',     -- attended, no_show
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_participants_booking ON booking_participants(booking_id);
CREATE INDEX idx_booking_participants_member ON booking_participants(member_id);
CREATE INDEX idx_booking_participants_coach ON booking_participants(designated_coach_id);

-- 約束：member_id 和 guest_name 至少要有一個
ALTER TABLE booking_participants 
ADD CONSTRAINT check_participant_identity 
CHECK (
  (member_id IS NOT NULL AND guest_name IS NULL) OR 
  (member_id IS NULL AND guest_name IS NOT NULL)
);

-- 約束：如果用儲值/船券，必須有 member_id
ALTER TABLE booking_participants
ADD CONSTRAINT check_member_payment
CHECK (
  boat_fee_type IN ('cash', 'free') OR 
  member_id IS NOT NULL
);

COMMENT ON TABLE booking_participants IS '預約參與者表：教練回報時才創建記錄';

-- =============================================
-- 8. 會員交易記錄 (Member Transactions)
-- =============================================
CREATE TABLE member_transactions (
  id SERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  booking_participant_id INTEGER REFERENCES booking_participants(id),
  
  -- 交易類型和類別
  transaction_type TEXT NOT NULL,                -- charge(儲值), purchase(購買), consume(消耗), refund(退款), expire(過期), adjust(調整)
  category TEXT NOT NULL,                        -- balance(儲值), designated_lesson(指定課), boat_voucher(船券), membership(會籍), board_storage(置板)
  
  -- 變動（金額或分鐘數）
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

CREATE INDEX idx_member_transactions_member ON member_transactions(member_id);
CREATE INDEX idx_member_transactions_type ON member_transactions(transaction_type, category);
CREATE INDEX idx_member_transactions_date ON member_transactions(created_at DESC);

COMMENT ON TABLE member_transactions IS '會員交易記錄';

-- 購買指定課/船券的交易記錄範例：
-- 
-- 1. 儲值入金
-- INSERT INTO member_transactions (member_id, transaction_type, category, amount, balance_after, description)
-- VALUES (會員ID, 'charge', 'balance', 20000, 20000, '儲值 $20,000');
--
-- 2. 購買指定課（從儲值扣款 → 轉成分鐘數）- 需要兩筆記錄：
-- 
-- 2a. 扣除儲值
-- INSERT INTO member_transactions (member_id, transaction_type, category, amount, balance_after, description)
-- VALUES (會員ID, 'purchase', 'balance', -12000, 8000, '購買指定課 600 分鐘');
-- 
-- 2b. 增加指定課分鐘數
-- INSERT INTO member_transactions (member_id, transaction_type, category, minutes, designated_lesson_minutes_after, description)
-- VALUES (會員ID, 'purchase', 'designated_lesson', 600, 600, '購買指定課 600 分鐘');
--
-- 3. 使用指定課
-- INSERT INTO member_transactions (member_id, transaction_type, category, minutes, designated_lesson_minutes_after, description)
-- VALUES (會員ID, 'consume', 'designated_lesson', -60, 540, '消耗指定課 60 分鐘 - 阿寶教練');

-- =============================================
-- 9. 交辦事項表 (Daily Tasks)
-- =============================================
CREATE TABLE daily_tasks (
  id SERIAL PRIMARY KEY,
  
  -- 日期（可以是特定日期或一般事項）
  task_date TEXT,                                -- 格式：'2025-11-10'，NULL = 一般事項，隨時顯示
  
  -- 內容
  title TEXT NOT NULL,
  content TEXT,
  priority TEXT DEFAULT 'normal',                -- urgent, high, normal, low
  
  -- 狀態
  status TEXT DEFAULT 'pending',                 -- pending, completed, cancelled
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  
  -- 分類
  category TEXT,                                 -- 設備維護, 客戶跟進 等
  
  -- 指派
  assigned_to UUID REFERENCES auth.users(id),
  
  -- 提醒
  is_reminder BOOLEAN DEFAULT FALSE,
  remind_before_days INTEGER DEFAULT 0,
  
  -- 系統欄位
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_tasks_date ON daily_tasks(task_date);
CREATE INDEX idx_daily_tasks_status ON daily_tasks(status);
CREATE INDEX idx_daily_tasks_priority ON daily_tasks(priority);
CREATE INDEX idx_daily_tasks_assigned ON daily_tasks(assigned_to);

COMMENT ON TABLE daily_tasks IS '交辦事項：每日任務和提醒';

-- =============================================
-- 10. 審計日誌表 (Audit Log) - 保持簡單版本
-- =============================================
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  operation TEXT NOT NULL,                       -- 新增預約, 修改預約, 刪除預約
  user_email TEXT NOT NULL,
  
  -- 預約詳細資訊
  student_name TEXT NOT NULL,
  boat_name TEXT NOT NULL,
  coach_names TEXT,
  start_time TEXT NOT NULL,                      -- 格式：'2025-11-10T08:00:00'
  duration_min INTEGER NOT NULL,
  activity_types TEXT[],
  notes TEXT,
  
  -- 修改內容
  changes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_student ON audit_log(student_name);
CREATE INDEX idx_audit_log_user ON audit_log(user_email);

COMMENT ON TABLE audit_log IS '審計日誌表';

-- =============================================
-- 11. RLS (Row Level Security) 策略
-- =============================================
ALTER TABLE boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE boat_unavailable_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 所有已認證用戶都可以讀取
CREATE POLICY "Allow authenticated users to read boats"
ON boats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read boat_unavailable_dates"
ON boat_unavailable_dates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read coaches"
ON coaches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read coach_time_off"
ON coach_time_off FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read members"
ON members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read bookings"
ON bookings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read booking_coaches"
ON booking_coaches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read booking_participants"
ON booking_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read member_transactions"
ON member_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read daily_tasks"
ON daily_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read audit_log"
ON audit_log FOR SELECT TO authenticated USING (true);

-- 所有已認證用戶都可以寫入
CREATE POLICY "Allow authenticated users to insert bookings"
ON bookings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update bookings"
ON bookings FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete bookings"
ON bookings FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage booking_coaches"
ON booking_coaches FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage booking_participants"
ON booking_participants FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage members"
ON members FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage member_transactions"
ON member_transactions FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage boats"
ON boats FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage boat_unavailable_dates"
ON boat_unavailable_dates FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage coaches"
ON coaches FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage coach_time_off"
ON coach_time_off FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage daily_tasks"
ON daily_tasks FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert audit_log"
ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- 12. 函數：檢查船隻是否可用
-- =============================================
CREATE OR REPLACE FUNCTION is_boat_available(
  p_boat_id INTEGER,
  p_check_date TEXT  -- 格式：'2025-11-10'
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_available BOOLEAN;
BEGIN
  -- 檢查船隻本身是否啟用
  IF NOT EXISTS (
    SELECT 1 FROM boats 
    WHERE id = p_boat_id AND is_active = TRUE
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- 檢查是否有停用記錄
  SELECT NOT EXISTS (
    SELECT 1
    FROM boat_unavailable_dates bud
    WHERE bud.boat_id = p_boat_id
      AND bud.is_active = TRUE
      AND p_check_date >= bud.start_date
      AND p_check_date <= bud.end_date
  ) INTO v_is_available;
  
  RETURN v_is_available;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 13. 函數：檢查教練是否可用
-- =============================================
CREATE OR REPLACE FUNCTION is_coach_available(
  p_coach_id UUID,
  p_check_date TEXT  -- 格式：'2025-11-10'
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_available BOOLEAN;
BEGIN
  -- 檢查是否有休假記錄
  SELECT NOT EXISTS (
    SELECT 1
    FROM coach_time_off cto
    WHERE cto.coach_id = p_coach_id
      AND cto.is_active = TRUE
      AND p_check_date >= cto.start_date
      AND p_check_date <= cto.end_date
  ) INTO v_is_available;
  
  RETURN v_is_available;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 14. 插入初始數據
-- =============================================

-- 船隻
INSERT INTO boats (name, color, display_order) VALUES
  ('G23', '#5a5a5a', 1),
  ('G21', '#5a5a5a', 2),
  ('黑豹', '#5a5a5a', 3),
  ('粉紅', '#5a5a5a', 4),
  ('彈簧床', '#5a5a5a', 5);

-- 教練（只插入名字，費率和專長之後在前台設定）
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

