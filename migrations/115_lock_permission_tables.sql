-- =============================================================================
-- 115_lock_permission_tables.sql
--
-- 目的：鎖住權限相關表 + reservation_restrictions
--
-- 處理表（5 張）：
--   1. allowed_users               （目前 RLS=off，anon 可寫入自己 → 高危）
--   2. admin_users                 （目前 RLS=off，雖然空表但結構暴露）
--   3. editor_users                （目前 RLS=off，舊 policy 引用空的 admin_users）
--   4. view_users                  （目前 RLS=off）
--   5. reservation_restrictions    （目前 RLS=off，影響預約限制）
--
-- 預期影響：
--   ✅ 員工後台（StaffManagement.tsx）讀寫照常運作（用 super admin 或 allowed_user 身份）
--   ✅ 前端 isAllowedUser() / loadAllowedEmails() 照常運作（authenticated 可讀）
--   ✅ LIFF 完全不受影響（這些表 anon 本來就不該碰）
--   ❌ 攻擊者用任意 Google 帳號登入後，無法插入自己進 allowed_users 變員工
--   ❌ anon 無法直接 INSERT/UPDATE/DELETE 這些表
--
-- Rollback 方法（如果出問題）：
--   ALTER TABLE allowed_users DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE editor_users DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE view_users DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE reservation_restrictions DISABLE ROW LEVEL SECURITY;
--
-- 前置條件：必須先跑 114_security_helper_functions.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0) 前置檢查：確保 helper functions 存在（沒有就 abort）
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'is_allowed_staff'
  ) THEN
    RAISE EXCEPTION '請先執行 114_security_helper_functions.sql';
  END IF;
END $$;

-- =============================================================================
-- 1) allowed_users  ← 員工白名單（高危）
-- =============================================================================
-- 清舊 policy（先全清，避免和新規則衝突；用 IF EXISTS 安全）
DROP POLICY IF EXISTS "Allow authenticated users to read allowed_users" ON public.allowed_users;
DROP POLICY IF EXISTS "Allow admins to insert allowed_users"           ON public.allowed_users;
DROP POLICY IF EXISTS "Allow admins to delete allowed_users"           ON public.allowed_users;
DROP POLICY IF EXISTS "Public read allowed_users"                       ON public.allowed_users;
DROP POLICY IF EXISTS "Authenticated insert allowed_users"              ON public.allowed_users;
DROP POLICY IF EXISTS "Authenticated delete allowed_users"              ON public.allowed_users;

-- 啟用 RLS
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_users FORCE ROW LEVEL SECURITY;  -- 連 owner 都要遵守

-- 員工可讀（前端 loadAllowedEmails 需要）
CREATE POLICY "allowed_users_select_staff"
  ON public.allowed_users
  FOR SELECT
  TO authenticated
  USING (public.is_allowed_staff());

-- 只有超級管理員可寫
CREATE POLICY "allowed_users_write_superadmin"
  ON public.allowed_users
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- =============================================================================
-- 2) admin_users  ← 雖然空表，但結構不該被亂改
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to read admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow admins to insert admin_users"            ON public.admin_users;
DROP POLICY IF EXISTS "Allow admins to delete admin_users"            ON public.admin_users;
DROP POLICY IF EXISTS "Public read admin_users"                        ON public.admin_users;
DROP POLICY IF EXISTS "Authenticated insert admin_users"               ON public.admin_users;
DROP POLICY IF EXISTS "Authenticated delete admin_users"               ON public.admin_users;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;

CREATE POLICY "admin_users_select_staff"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_allowed_staff());

CREATE POLICY "admin_users_write_superadmin"
  ON public.admin_users
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- =============================================================================
-- 3) editor_users  ← 功能權限旗標（小編）
-- =============================================================================
-- 注意：原本有 3 條引用 admin_users 的 policy，但 admin_users 是空表，
-- 所以 RLS 一啟用，INSERT/DELETE 會 deny 所有人。改成用 is_super_admin()。
DROP POLICY IF EXISTS "Allow admins to delete editor_users"            ON public.editor_users;
DROP POLICY IF EXISTS "Allow admins to insert editor_users"            ON public.editor_users;
DROP POLICY IF EXISTS "Allow authenticated users to read editor_users" ON public.editor_users;

ALTER TABLE public.editor_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editor_users FORCE ROW LEVEL SECURITY;

-- 員工可讀（前端 loadEditorRows 需要）
CREATE POLICY "editor_users_select_staff"
  ON public.editor_users
  FOR SELECT
  TO authenticated
  USING (public.is_allowed_staff());

-- 只有超級管理員可寫
CREATE POLICY "editor_users_write_superadmin"
  ON public.editor_users
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- =============================================================================
-- 4) view_users  ← 一般權限名單
-- =============================================================================
ALTER TABLE public.view_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_users FORCE ROW LEVEL SECURITY;

CREATE POLICY "view_users_select_staff"
  ON public.view_users
  FOR SELECT
  TO authenticated
  USING (public.is_allowed_staff());

CREATE POLICY "view_users_write_superadmin"
  ON public.view_users
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- =============================================================================
-- 5) reservation_restrictions  ← 預約限制設定
-- =============================================================================
-- 此表會被 LIFF 透過 view 讀到（reservation_restrictions_with_announcement_view），
-- 但 view 走 view 的權限，本表本身不需要對 anon 開放。
ALTER TABLE public.reservation_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_restrictions FORCE ROW LEVEL SECURITY;

-- 員工可讀寫（後台會用）
CREATE POLICY "reservation_restrictions_all_staff"
  ON public.reservation_restrictions
  FOR ALL
  TO authenticated
  USING (public.is_allowed_staff())
  WITH CHECK (public.is_allowed_staff());

COMMIT;

-- =============================================================================
-- 驗證查詢（跑完後在 SQL editor 跑這幾條確認）
-- =============================================================================
-- (a) 確認 RLS 都啟用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('allowed_users','admin_users','editor_users','view_users','reservation_restrictions');
-- 預期：rowsecurity = true（5 張全 true）

-- (b) 列出新 policies
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('allowed_users','admin_users','editor_users','view_users','reservation_restrictions')
ORDER BY tablename, policyname;

SELECT 'permission tables locked successfully' AS status;
