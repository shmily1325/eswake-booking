-- 修復權限表的 RLS 政策

-- 1. 先刪除可能有問題的舊政策
DROP POLICY IF EXISTS "Allow authenticated users to read allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Allow authenticated users to read admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow admins to insert allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Allow admins to delete allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Allow admins to insert admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow admins to delete admin_users" ON admin_users;

-- 2. 創建新的、更寬鬆的讀取政策
CREATE POLICY "Public read allowed_users"
  ON allowed_users FOR SELECT
  USING (true);  -- 所有人都可以讀取（包括未認證用戶）

CREATE POLICY "Public read admin_users"
  ON admin_users FOR SELECT
  USING (true);  -- 所有人都可以讀取（包括未認證用戶）

-- 3. 只有已認證用戶可以修改
CREATE POLICY "Authenticated insert allowed_users"
  ON allowed_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated delete allowed_users"
  ON allowed_users FOR DELETE
  TO authenticated
  USING (
    email NOT IN ('callumbao1122@gmail.com', 'pjpan0511@gmail.com', 'minlin1325@gmail.com')
  );

CREATE POLICY "Authenticated insert admin_users"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated delete admin_users"
  ON admin_users FOR DELETE
  TO authenticated
  USING (
    email NOT IN ('callumbao1122@gmail.com', 'pjpan0511@gmail.com', 'minlin1325@gmail.com')
  );

-- 確認結果
SELECT 'RLS 政策已更新' AS status;

