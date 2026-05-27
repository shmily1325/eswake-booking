-- =============================================================================
-- 114_security_helper_functions.sql
--
-- 目的：建立 RLS policy 用的 helper functions，集中管理「誰算合法員工」邏輯
--
-- 背景：
--   1. anon / authenticated 兩個 role 對所有 public schema 的表都有 FULL CRUD GRANT
--      （Supabase 預設行為），所以 RLS 是阻擋未授權存取的唯一防線。
--   2. 員工權限的「真實來源」是 allowed_users 表 + 程式內硬編碼的 SUPER_ADMINS / HIDDEN。
--   3. 為了未來修改方便（只改 function，policy 不用全部改），把判斷邏輯封裝成 function。
--
-- 安全考量：
--   - SECURITY DEFINER：function 以 owner 身份執行，可以略過 caller 的 RLS。
--     這是必要的，因為 function 自己要讀 allowed_users 表，如果用 INVOKER
--     模式 + allowed_users 開了 RLS，會變雞生蛋蛋生雞。
--   - STABLE：標記為穩定函式，讓 query planner 在單一查詢內 memoize 結果，
--     避免 RLS 對每一列都重算一次（效能考量）。
--   - search_path 鎖死為 public，避免被惡意 schema shadowing 攻擊。
--
-- 此 migration 不啟用任何 RLS、不刪任何 policy，跑完 100% 零影響。
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1) is_super_admin()  →  目前 JWT 是否為硬編碼超級管理員
-- ----------------------------------------------------------------------------
-- 與前端 src/utils/auth.ts 的 SUPER_ADMINS 陣列保持一致
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN (
    'callumbao1122@gmail.com',
    'pjpan0511@gmail.com',
    'minlin1325@gmail.com'
  )
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  '判斷當前 JWT 是否為硬編碼超級管理員（與前端 SUPER_ADMINS 一致）';

-- ----------------------------------------------------------------------------
-- 2) is_allowed_staff()  →  目前 JWT 是否為合法員工
-- ----------------------------------------------------------------------------
-- 條件（與前端 isAllowedUser 一致）：
--   - 超級管理員（硬編碼）
--   - HIDDEN_CODE_ALLOWED_USER_EMAILS（硬編碼）
--   - allowed_users 表內
CREATE OR REPLACE FUNCTION public.is_allowed_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (auth.jwt() ->> 'email') IS NOT NULL
    AND (
      -- 超級管理員
      lower(auth.jwt() ->> 'email') IN (
        'callumbao1122@gmail.com',
        'pjpan0511@gmail.com',
        'minlin1325@gmail.com'
      )
      OR
      -- 程式硬編碼白名單（HIDDEN_CODE_ALLOWED_USER_EMAILS）
      lower(auth.jwt() ->> 'email') IN (
        'yylai0@gmail.com'
      )
      OR
      -- DB 白名單
      EXISTS (
        SELECT 1
        FROM public.allowed_users a
        WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
      )
    )
$$;

COMMENT ON FUNCTION public.is_allowed_staff() IS
  '判斷當前 JWT 是否為合法員工（super admin + 硬編碼 hidden + allowed_users 表）';

-- ----------------------------------------------------------------------------
-- 3) GRANT EXECUTE  →  讓 anon / authenticated 都能呼叫
-- ----------------------------------------------------------------------------
-- 因為 RLS policy 內會呼叫這些函式，PostgREST 用 anon / authenticated 身份
-- 跑 query 時必須能執行才不會被擋。
GRANT EXECUTE ON FUNCTION public.is_super_admin()   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_allowed_staff() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) 驗證
-- ----------------------------------------------------------------------------
-- 跑完後可以在 SQL editor 用以下查詢驗證 function 已建立：
--   SELECT proname, prosecdef, provolatile
--   FROM pg_proc
--   WHERE pronamespace = 'public'::regnamespace
--     AND proname IN ('is_super_admin', 'is_allowed_staff');

SELECT 'helper functions created successfully' AS status;
