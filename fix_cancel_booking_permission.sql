-- 修复 LIFF 取消预约权限
-- 允许匿名用户删除预约（透过 booking_members 关联验证）

-- 1. 允许删除 booking_members（关联表）
CREATE POLICY "bookings_members_delete_anon" 
ON booking_members FOR DELETE TO anon 
USING (true);

-- 2. 允许删除 booking_coaches（关联表）
CREATE POLICY "booking_coaches_delete_anon" 
ON booking_coaches FOR DELETE TO anon 
USING (true);

-- 3. 允许删除 booking_drivers（关联表）
CREATE POLICY "booking_drivers_delete_anon" 
ON booking_drivers FOR DELETE TO anon 
USING (true);

-- 4. 允许删除 bookings（主表）
CREATE POLICY "bookings_delete_anon" 
ON bookings FOR DELETE TO anon 
USING (true);

-- 验证：查看所有 bookings 相关的 RLS 策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('bookings', 'booking_members', 'booking_coaches', 'booking_drivers')
ORDER BY tablename, policyname;

