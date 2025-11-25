-- =============================================
-- 為 coaches 表添加 user_email 欄位
-- 用於關聯教練與登入帳號
-- =============================================

-- 1. 添加 user_email 欄位
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2. 添加註解
COMMENT ON COLUMN coaches.user_email IS '關聯的登入帳號 email（用於教練專用回報頁面）';

-- 3. 添加索引以加快查詢
CREATE INDEX IF NOT EXISTS idx_coaches_user_email ON coaches(user_email);

-- 4. 添加唯一約束（一個帳號只能對應一個教練）
ALTER TABLE coaches 
ADD CONSTRAINT unique_coach_user_email UNIQUE (user_email);

-- 注意：執行此 migration 後，需要在人員管理頁面手動設定每個教練對應的帳號

