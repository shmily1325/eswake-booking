-- =============================================
-- 新增小編角色 (Editor Users)
-- 小編可以看到更多功能，例如船隻管理
-- 權限控制靠應用層面（只有 SUPER_ADMINS 能進人員管理頁面）
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

-- 關閉 RLS（權限靠應用層面控制）
ALTER TABLE editor_users DISABLE ROW LEVEL SECURITY;

-- 完成
SELECT 'Editor users table created successfully!' AS status;

