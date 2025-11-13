-- =============================================
-- 權限管理表格
-- =============================================

-- 1. 白名單表（控制誰可以登入）
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  notes TEXT
);

-- 2. 管理員表（可以看到 BAO 和排班）
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  notes TEXT
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_allowed_users_email ON allowed_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- 插入超級管理員（三個固定的）
INSERT INTO admin_users (email, created_by, notes) VALUES
  ('callumbao1122@gmail.com', 'SYSTEM', '超級管理員'),
  ('pjpan0511@gmail.com', 'SYSTEM', '超級管理員'),
  ('minlin1325@gmail.com', 'SYSTEM', '超級管理員')
ON CONFLICT (email) DO NOTHING;

-- 插入到白名單
INSERT INTO allowed_users (email, created_by, notes) VALUES
  ('callumbao1122@gmail.com', 'SYSTEM', '超級管理員'),
  ('pjpan0511@gmail.com', 'SYSTEM', '超級管理員'),
  ('minlin1325@gmail.com', 'SYSTEM', '超級管理員')
ON CONFLICT (email) DO NOTHING;

-- 啟用 RLS
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 允許所有已認證用戶讀取（因為需要檢查權限）
CREATE POLICY "Allow authenticated users to read allowed_users"
  ON allowed_users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read admin_users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

-- 只允許管理員修改
CREATE POLICY "Allow admins to insert allowed_users"
  ON allowed_users FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.email() IN (
      SELECT email FROM admin_users
    )
  );

CREATE POLICY "Allow admins to delete allowed_users"
  ON allowed_users FOR DELETE
  TO authenticated
  USING (
    auth.email() IN (
      SELECT email FROM admin_users
    )
  );

CREATE POLICY "Allow admins to insert admin_users"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.email() IN (
      SELECT email FROM admin_users
    )
  );

CREATE POLICY "Allow admins to delete admin_users"
  ON admin_users FOR DELETE
  TO authenticated
  USING (
    auth.email() IN (
      SELECT email FROM admin_users
    )
    AND email NOT IN ('callumbao1122@gmail.com', 'pjpan0511@gmail.com', 'minlin1325@gmail.com')
  );

-- 完成
SELECT 'Permission tables created successfully!' AS status;

