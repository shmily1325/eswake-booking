-- =============================================
-- Migration: 更新 booking_participants 表結構
-- 用途：支援教練回報修改追蹤和待處理扣款功能
-- 日期：2024-11-16
-- =============================================

-- 1. 加入新欄位
ALTER TABLE booking_participants 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TEXT,
ADD COLUMN IF NOT EXISTS replaced_by_id INTEGER REFERENCES booking_participants(id),
ADD COLUMN IF NOT EXISTS replaces_id INTEGER REFERENCES booking_participants(id),
ADD COLUMN IF NOT EXISTS transaction_id INTEGER REFERENCES transactions(id),
ADD COLUMN IF NOT EXISTS updated_at TEXT;

-- 2. 更新註解
COMMENT ON COLUMN booking_participants.status IS 'pending=待處理, processed=已處理, not_applicable=非會員不需處理';
COMMENT ON COLUMN booking_participants.is_deleted IS '是否已刪除（軟刪除）';
COMMENT ON COLUMN booking_participants.deleted_at IS '刪除時間';
COMMENT ON COLUMN booking_participants.replaced_by_id IS '被哪一筆記錄取代';
COMMENT ON COLUMN booking_participants.replaces_id IS '取代了哪一筆記錄';
COMMENT ON COLUMN booking_participants.transaction_id IS '產生的交易ID';

-- 3. 建立索引
CREATE INDEX IF NOT EXISTS idx_booking_participants_status ON booking_participants(status);
CREATE INDEX IF NOT EXISTS idx_booking_participants_is_deleted ON booking_participants(is_deleted);
CREATE INDEX IF NOT EXISTS idx_booking_participants_transaction ON booking_participants(transaction_id);

-- 4. 更新現有資料的預設值
UPDATE booking_participants 
SET status = 'not_applicable', 
    is_deleted = FALSE 
WHERE status IS NULL;

-- 5. 更新已有 transaction 關聯的記錄為 processed
-- 注意：這個需要根據實際的 transactions 表結構調整
UPDATE booking_participants bp
SET status = 'processed'
FROM transactions t
WHERE t.booking_participant_id = bp.id
  AND bp.status = 'not_applicable';

