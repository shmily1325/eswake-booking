-- 068_allow_anon_update_member_birthday.sql
-- 允許 anon 用戶通過 LIFF 更新會員生日

-- 創建 RLS 政策允許 anon 用戶更新 members 表的 birthday 欄位
CREATE POLICY "allow_anon_update_birthday"
ON members
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- 驗證政策是否創建成功
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'members';

