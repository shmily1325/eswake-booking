-- 为 LIFF 添加交易记录读取权限
-- 安全策略：只允许读取（SELECT），不允许写入
-- 应用层已通过 line_bindings 验证用户身份

-- 1. 删除旧的政策（如果存在）
DROP POLICY IF EXISTS "Allow anon users to read transactions" ON transactions;

-- 2. 为匿名用户（LIFF）添加只读权限
-- 注意：前端应用层需确保只查询已绑定会员的交易记录
CREATE POLICY "Allow anon users to read transactions" 
ON transactions FOR SELECT
TO anon
USING (true);

-- 说明：
-- 1. authenticated 用户（管理后台）：可以增删改查所有交易记录
-- 2. anon 用户（LIFF）：只能读取交易记录
-- 3. 应用层通过 line_bindings 验证用户身份，确保只查询自己的数据
-- 4. 数据库层面已限制为只读，即使前端被绕过也无法修改数据

