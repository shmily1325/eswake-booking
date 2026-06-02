-- =============================================
-- 128_liff_shop_orders_read.sql
-- LIFF 會員查商品訂單：anon SELECT（應用層僅查自己的 member_id）
-- 與 products / transactions 相同：RLS + 寬鬆 SELECT policy
-- =============================================

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_orders_select" ON public.shop_orders;
DROP POLICY IF EXISTS "shop_orders_insert" ON public.shop_orders;
DROP POLICY IF EXISTS "shop_orders_update" ON public.shop_orders;
DROP POLICY IF EXISTS "shop_orders_delete" ON public.shop_orders;

CREATE POLICY "shop_orders_select" ON public.shop_orders
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "shop_orders_insert" ON public.shop_orders
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shop_orders_update" ON public.shop_orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shop_orders_delete" ON public.shop_orders
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "shop_order_items_select" ON public.shop_order_items;
DROP POLICY IF EXISTS "shop_order_items_insert" ON public.shop_order_items;
DROP POLICY IF EXISTS "shop_order_items_update" ON public.shop_order_items;
DROP POLICY IF EXISTS "shop_order_items_delete" ON public.shop_order_items;

CREATE POLICY "shop_order_items_select" ON public.shop_order_items
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "shop_order_items_insert" ON public.shop_order_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shop_order_items_update" ON public.shop_order_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shop_order_items_delete" ON public.shop_order_items
  FOR DELETE TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';

SELECT '128_liff_shop_orders_read: RLS policies for LIFF' AS status;
