-- =============================================
-- 庫存表 RLS policies
-- 說明：
--   原本 106 的 ALTER TABLE ... DISABLE ROW LEVEL SECURITY
--   在 supabase 平台會被自動 re-enable（public schema 安全策略）。
--   結果：anon / authenticated 雖然有 GRANT，但沒 policy 就讀不到資料（fetch → []）。
--
-- 解法：保留 RLS enabled，加上寬鬆 policy
--   anon          → SELECT（公開讀，未登入也能看商品）
--   authenticated → CRUD（已登入員工，前端再用 can_products 旗標控制業務權限）
-- =============================================

-- 確保 RLS enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- products
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "products_insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_update" ON public.products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_delete" ON public.products
  FOR DELETE TO authenticated USING (true);

-- product_variants
DROP POLICY IF EXISTS "variants_select" ON public.product_variants;
DROP POLICY IF EXISTS "variants_insert" ON public.product_variants;
DROP POLICY IF EXISTS "variants_update" ON public.product_variants;
DROP POLICY IF EXISTS "variants_delete" ON public.product_variants;
CREATE POLICY "variants_select" ON public.product_variants
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "variants_insert" ON public.product_variants
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "variants_update" ON public.product_variants
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "variants_delete" ON public.product_variants
  FOR DELETE TO authenticated USING (true);

-- 通知 PostgREST 重新載入 schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'inventory RLS policies applied' AS status;
