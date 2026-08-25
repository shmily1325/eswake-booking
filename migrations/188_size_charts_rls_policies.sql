-- =============================================================
-- 188: 修 size_charts 權限（後台「＋ 新增」失敗：42501 RLS）
--
-- 186 的 DISABLE ROW LEVEL SECURITY 在 supabase 會被自動 re-enable，
-- 沒有 policy 就只剩 service_role 能寫。做法比照 110／111 的 products：
--   anon          → SELECT（商城前台未登入也要看得到尺寸表）
--   authenticated → CRUD（後台員工，業務權限再由前端 can_products 控管）
-- 可重跑。
-- =============================================================

GRANT SELECT ON public.size_charts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.size_charts TO authenticated;

ALTER TABLE public.size_charts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "size_charts_select" ON public.size_charts;
DROP POLICY IF EXISTS "size_charts_insert" ON public.size_charts;
DROP POLICY IF EXISTS "size_charts_update" ON public.size_charts;
DROP POLICY IF EXISTS "size_charts_delete" ON public.size_charts;
CREATE POLICY "size_charts_select" ON public.size_charts
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "size_charts_insert" ON public.size_charts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "size_charts_update" ON public.size_charts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "size_charts_delete" ON public.size_charts
  FOR DELETE TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';

SELECT 'size_charts grants and RLS policies applied' AS status;
