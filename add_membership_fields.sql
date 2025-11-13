-- =============================================
-- 新增會員資料欄位
-- 用途：支援會員類型、雙人會籍、置板、贈送時數等功能
-- =============================================

-- 1. 新增會員類型（會員、雙人會員、置板）
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'general';
COMMENT ON COLUMN members.membership_type IS '會員類型：general=一般會員, dual=雙人會員, board=置板';

-- 2. 新增會員開始日期
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_start_date TEXT;
COMMENT ON COLUMN members.membership_start_date IS '會員開始日期 (YYYY-MM-DD)';

-- 3. 重命名 membership_expires_at 為 membership_end_date（統一命名）
-- 先檢查舊欄位是否存在，如果存在則重命名，否則新增
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'membership_expires_at'
  ) THEN
    ALTER TABLE members RENAME COLUMN membership_expires_at TO membership_end_date;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'membership_end_date'
  ) THEN
    ALTER TABLE members ADD COLUMN membership_end_date TEXT;
  END IF;
END $$;
COMMENT ON COLUMN members.membership_end_date IS '會員截止日期 (YYYY-MM-DD)';

-- 4. 新增置板位號碼
ALTER TABLE members ADD COLUMN IF NOT EXISTS board_slot_number TEXT;
COMMENT ON COLUMN members.board_slot_number IS '置板位號碼（僅限置板會員）';

-- 5. 新增置板到期日
ALTER TABLE members ADD COLUMN IF NOT EXISTS board_expiry_date TEXT;
COMMENT ON COLUMN members.board_expiry_date IS '置板到期日 (YYYY-MM-DD)';

-- 6. 新增贈送時數
ALTER TABLE members ADD COLUMN IF NOT EXISTS free_hours DECIMAL(10, 2) DEFAULT 0;
COMMENT ON COLUMN members.free_hours IS '贈送時數（分鐘）';

-- 7. 新增已使用時數
ALTER TABLE members ADD COLUMN IF NOT EXISTS free_hours_used DECIMAL(10, 2) DEFAULT 0;
COMMENT ON COLUMN members.free_hours_used IS '已使用贈送時數（分鐘）';

-- 8. 新增贈送時數使用註記
ALTER TABLE members ADD COLUMN IF NOT EXISTS free_hours_notes TEXT;
COMMENT ON COLUMN members.free_hours_notes IS '贈送時數使用註記';

-- 9. 新增雙人會員配對
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_partner_id UUID REFERENCES members(id);
COMMENT ON COLUMN members.membership_partner_id IS '雙人會員配對的另一位會員 ID';

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_members_membership_type ON members(membership_type);
CREATE INDEX IF NOT EXISTS idx_members_membership_end_date ON members(membership_end_date);
CREATE INDEX IF NOT EXISTS idx_members_partner ON members(membership_partner_id);

-- 驗證
SELECT 'members 表欄位已成功新增/更新' AS status;

