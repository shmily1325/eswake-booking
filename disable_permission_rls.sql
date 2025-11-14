-- 完全禁用權限表的 RLS
-- 因為這些表的數據不敏感，且需要在前端查詢

-- 禁用 RLS
ALTER TABLE allowed_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- 刪除所有政策（清理乾淨）
DROP POLICY IF EXISTS "Public read allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Public read admin_users" ON admin_users;
DROP POLICY IF EXISTS "Authenticated insert allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Authenticated delete allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Authenticated insert admin_users" ON admin_users;
DROP POLICY IF EXISTS "Authenticated delete admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow authenticated users to read allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Allow authenticated users to read admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow admins to insert allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Allow admins to delete allowed_users" ON allowed_users;
DROP POLICY IF EXISTS "Allow admins to insert admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow admins to delete admin_users" ON admin_users;

SELECT 'RLS 已完全禁用，權限表可以自由查詢' AS status;

