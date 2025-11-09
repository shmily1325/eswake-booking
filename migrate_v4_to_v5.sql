-- =============================================
-- ESWake 預約系統 V4 → V5 遷移腳本
-- =============================================
-- 
-- ⚠️ 警告：此腳本會修改資料庫結構並刪除部分欄位
-- 請在執行前備份資料庫！
-- 
-- 執行順序：
-- 1. 備份資料庫
-- 2. 執行此腳本
-- 3. 測試功能
-- 4. 更新前端程式碼
-- =============================================

-- =============================================
-- 步驟 1：新增 booking_members 表（預約會員關聯）
-- =============================================
CREATE TABLE IF NOT EXISTS booking_members (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(booking_id, member_id)
);

COMMENT ON TABLE booking_members IS '預約會員關聯表：一個預約可以有多個會員（用於 LINE 通知）';

CREATE INDEX IF NOT EXISTS idx_booking_members_booking ON booking_members(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_members_member ON booking_members(member_id);

-- RLS
ALTER TABLE booking_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to booking_members" 
ON booking_members FOR ALL USING (auth.role() = 'authenticated');

-- 遷移現有資料：將 bookings.member_id 遷移到 booking_members
INSERT INTO booking_members (booking_id, member_id)
SELECT id, member_id 
FROM bookings 
WHERE member_id IS NOT NULL
ON CONFLICT (booking_id, member_id) DO NOTHING;

-- =============================================
-- 步驟 2：新增 coach_reports 表（教練回報 - 駕駛部分）
-- =============================================
CREATE TABLE IF NOT EXISTS coach_reports (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id),
  
  -- 駕駛回報
  fuel_amount DECIMAL(10, 2),                    -- 油量（公升）
  driver_duration_min INTEGER,                   -- 駕駛時數（分鐘）
  
  -- 回報時間
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(booking_id, coach_id)
);

COMMENT ON TABLE coach_reports IS '教練回報表（駕駛部分）：每個教練都要回報油量和駕駛時數';

CREATE INDEX IF NOT EXISTS idx_coach_reports_booking ON coach_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_coach_reports_coach ON coach_reports(coach_id);

-- RLS
ALTER TABLE coach_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to coach_reports" 
ON coach_reports FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- 步驟 3：修改 booking_participants 表（簡化）
-- =============================================

-- 3.1 新增欄位
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES coaches(id),
ADD COLUMN IF NOT EXISTS duration_min INTEGER,
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 3.2 遷移現有資料
-- 將 is_designated 轉換為 payment_method
UPDATE booking_participants
SET payment_method = CASE 
  WHEN is_designated = TRUE THEN 'designated_paid'
  ELSE 'cash'
END
WHERE payment_method IS NULL;

-- 3.3 刪除舊欄位（謹慎！會丟失資料）
-- 如果需要保留舊資料，請先備份或手動遷移

-- 注意：以下語句會刪除欄位並丟失資料
-- 請確認已備份或不需要這些資料後再執行

ALTER TABLE booking_participants
DROP COLUMN IF EXISTS boat_fee_type,
DROP COLUMN IF EXISTS boat_fee_duration_min,
DROP COLUMN IF EXISTS boat_fee_amount,
DROP COLUMN IF EXISTS boat_fee_rate,
DROP COLUMN IF EXISTS designated_coach_id,
DROP COLUMN IF EXISTS designated_fee_type,
DROP COLUMN IF EXISTS designated_fee_duration_min,
DROP COLUMN IF EXISTS designated_fee_amount,
DROP COLUMN IF EXISTS designated_fee_rate,
DROP COLUMN IF EXISTS is_designated;

-- 3.4 更新註釋
COMMENT ON COLUMN booking_participants.payment_method IS 
'cash=現金, transfer=匯款, balance=扣儲值, voucher=票券, designated_paid=指定(收費), designated_free=指定(免費)';

-- =============================================
-- 步驟 4：修改 bookings 表
-- =============================================

-- 4.1 新增 activity_types 欄位（如果沒有）
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS activity_types TEXT[];

-- 4.2 刪除 driver_coach_id（不再需要，駕駛 = 教練）
ALTER TABLE bookings
DROP COLUMN IF EXISTS driver_coach_id;

-- 4.3 更新註釋
COMMENT ON COLUMN bookings.member_id IS '主要會員（向下相容），多個會員請查看 booking_members 表';

-- =============================================
-- 步驟 5：刪除 drivers 表（不再需要）
-- =============================================

-- 注意：如果有外鍵引用，需要先刪除或修改
-- 檢查是否有引用：
-- SELECT * FROM information_schema.table_constraints 
-- WHERE constraint_type = 'FOREIGN KEY' 
-- AND table_name = 'drivers';

DROP TABLE IF EXISTS drivers CASCADE;

-- =============================================
-- 步驟 6：更新 coaches 表
-- =============================================

-- 6.1 確保 status 欄位存在
ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 6.2 更新註釋
COMMENT ON TABLE coaches IS '教練表（教練同時也是駕駛）';
COMMENT ON COLUMN coaches.status IS 'active=上架（可預約，在預約表顯示）, inactive=下架（不可預約，不在預約表顯示）';

-- 6.3 新增索引（如果沒有）
CREATE INDEX IF NOT EXISTS idx_coaches_status ON coaches(status);

-- =============================================
-- 步驟 7：新增 audit_log 欄位（如果缺少）
-- =============================================

ALTER TABLE audit_log
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS details TEXT;

-- =============================================
-- 完成！
-- =============================================

-- 驗證遷移結果
SELECT 
  'booking_members' as table_name, 
  COUNT(*) as row_count 
FROM booking_members
UNION ALL
SELECT 
  'coach_reports' as table_name, 
  COUNT(*) as row_count 
FROM coach_reports
UNION ALL
SELECT 
  'bookings' as table_name, 
  COUNT(*) as row_count 
FROM bookings
UNION ALL
SELECT 
  'booking_participants' as table_name, 
  COUNT(*) as row_count 
FROM booking_participants;

-- 列出所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

