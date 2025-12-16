-- 在 booking_participants 表添加提交者 email 欄位
-- 用於追蹤是誰回報的（教練本人或 BAO 代報）

-- 原始回報者（創建時設定，之後不變）
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS created_by_email TEXT;

-- 最後修改者（每次更新時覆蓋）
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS updated_by_email TEXT;

-- 添加註解
COMMENT ON COLUMN booking_participants.created_by_email IS '原始回報者 email（創建時設定）';
COMMENT ON COLUMN booking_participants.updated_by_email IS '最後修改者 email（每次更新時覆蓋）';

-- 為查詢優化添加索引
CREATE INDEX IF NOT EXISTS idx_booking_participants_created_by 
ON booking_participants(created_by_email);
CREATE INDEX IF NOT EXISTS idx_booking_participants_updated_by 
ON booking_participants(updated_by_email);

