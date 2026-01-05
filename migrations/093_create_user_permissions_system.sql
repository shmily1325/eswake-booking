-- =============================================
-- 權限管理系統重構
-- 三層權限架構：
-- 1. 基礎權限（登入用戶）- 只能看今日預約
-- 2. 畫面權限（view_users）- 可以看到一般功能畫面
-- 3. 小編權限（editor_users）- 可以使用進階功能
-- =============================================

-- 1. 建立畫面權限用戶表（授權可看到一般功能畫面的用戶）
CREATE TABLE IF NOT EXISTS view_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,                -- 顯示名稱，如「林昱」
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- 2. 修改 editor_users 表，新增 display_name 欄位
ALTER TABLE editor_users 
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 3. 建立索引
CREATE INDEX IF NOT EXISTS idx_view_users_email ON view_users(email);

-- 4. 關閉 RLS（權限靠應用層面控制）
ALTER TABLE view_users DISABLE ROW LEVEL SECURITY;

-- 5. 遷移現有 editor_users 到 view_users（小編也有畫面權限）
INSERT INTO view_users (email, display_name, notes)
SELECT 
  email,
  display_name,
  '從小編權限遷移'
FROM editor_users
WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- 完成
SELECT 'User permissions system created successfully!' AS status;


