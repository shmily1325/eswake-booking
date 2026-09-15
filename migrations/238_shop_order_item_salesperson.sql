BEGIN;

ALTER TABLE public.shop_order_items
  ADD COLUMN IF NOT EXISTS salesperson_coach_id UUID
    REFERENCES public.coaches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS salesperson_name_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_shop_order_items_salesperson
  ON public.shop_order_items(salesperson_coach_id)
  WHERE salesperson_coach_id IS NOT NULL;

COMMENT ON COLUMN public.shop_order_items.salesperson_coach_id IS
  '內部商品銷售歸屬教練；不提供 LIFF 客戶訂單快照';
COMMENT ON COLUMN public.shop_order_items.salesperson_name_snapshot IS
  '銷售歸屬姓名快照，避免教練改名影響既有統計';

NOTIFY pgrst, 'reload schema';

COMMIT;
