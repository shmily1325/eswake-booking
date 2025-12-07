-- =============================================
-- 新增小編角色 (Editor Users)
-- 小編可以看到更多功能，例如船隻管理
-- =============================================

-- 1. 建立小編表
CREATE TABLE IF NOT EXISTS editor_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  notes TEXT
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_editor_users_email ON editor_users(email);

-- 啟用 RLS
ALTER TABLE editor_users ENABLE ROW LEVEL SECURITY;

-- 允許所有已認證用戶讀取（因為需要檢查權限）
CREATE POLICY "Allow authenticated users to read editor_users"
  ON editor_users FOR SELECT
  TO authenticated
  USING (true);

-- 只允許管理員修改
CREATE POLICY "Allow admins to insert editor_users"
  ON editor_users FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.email() IN (
      SELECT email FROM admin_users
    )
  );

CREATE POLICY "Allow admins to update editor_users"
  ON editor_users FOR UPDATE
  TO authenticated
  USING (
    auth.email() IN (
      SELECT email FROM admin_users
    )
  );

CREATE POLICY "Allow admins to delete editor_users"
  ON editor_users FOR DELETE
  TO authenticated
  USING (
    auth.email() IN (
      SELECT email FROM admin_users
    )
  );

-- 完成
SELECT 'Editor users table created successfully!' AS status;

