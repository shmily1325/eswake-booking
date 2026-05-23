-- =============================================
-- 修復：把 inventory 兩張表的 GRANT 給 anon / authenticated
-- 前端 (anon key) 讀取 products / product_variants 時拿到空集合 []
-- 雖然 RLS 已 DISABLE，但 supabase 新建 table 預設只 GRANT 給 service_role
-- 結果就是 anon 撈到「沒權限」=> 空陣列（PostgREST 不會報錯）
--
-- 這份 migration 把讀寫權限補齊：
--   anon          → 只能 SELECT（公開讀，給未登入也能看商品）
--   authenticated → 完整 CRUD（已登入員工，前端再用 can_products 旗標控制）
-- =============================================

-- products
GRANT SELECT ON products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;

-- product_variants
GRANT SELECT ON product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO authenticated;

-- 通知 PostgREST 重新載入 schema cache（這樣 GRANT 立刻生效）
NOTIFY pgrst, 'reload schema';

SELECT 'inventory grants applied' AS status;
