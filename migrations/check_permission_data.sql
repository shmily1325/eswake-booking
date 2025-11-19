-- 檢查權限表格數據

-- 檢查 admin_users
SELECT 'admin_users 表格' AS table_name, COUNT(*) AS count FROM admin_users;
SELECT * FROM admin_users ORDER BY email;

-- 檢查 allowed_users
SELECT 'allowed_users 表格' AS table_name, COUNT(*) AS count FROM allowed_users;
SELECT * FROM allowed_users ORDER BY email;

