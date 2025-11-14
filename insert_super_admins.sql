-- 補充插入超級管理員（如果不存在）

-- 插入到管理員表
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

-- 確認結果
SELECT '管理員數量' AS info, COUNT(*) AS count FROM admin_users;
SELECT '白名單數量' AS info, COUNT(*) AS count FROM allowed_users;

SELECT 'admin_users 列表' AS table_name;
SELECT email, created_by, notes FROM admin_users ORDER BY email;

SELECT 'allowed_users 列表' AS table_name;
SELECT email, created_by, notes FROM allowed_users ORDER BY email;

