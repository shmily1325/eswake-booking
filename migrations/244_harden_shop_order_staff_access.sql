-- Restrict internal shop-order data and destructive RPCs to the shared
-- allowed-staff boundary. Fine-grained feature permissions remain a UI concern.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_allowed_staff()') IS NULL
    OR to_regprocedure('public.can_execute_shop_financial_rpc()') IS NULL
  THEN
    RAISE EXCEPTION 'Missing staff authorization helpers; apply migrations 114 and 141 first';
  END IF;
END
$$;

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_no_seq ENABLE ROW LEVEL SECURITY;

-- Replace every historical permissive policy on these internal tables. Using
-- SELECT around the stable helper lets PostgreSQL evaluate it once per query.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'shop_orders',
        'shop_order_items',
        'shop_order_settlements',
        'shop_order_no_seq'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END
$$;

CREATE POLICY shop_orders_allowed_staff
  ON public.shop_orders
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_allowed_staff()))
  WITH CHECK ((SELECT public.is_allowed_staff()));

CREATE POLICY shop_order_items_allowed_staff
  ON public.shop_order_items
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_allowed_staff()))
  WITH CHECK ((SELECT public.is_allowed_staff()));

CREATE POLICY shop_order_settlements_allowed_staff
  ON public.shop_order_settlements
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_allowed_staff()))
  WITH CHECK ((SELECT public.is_allowed_staff()));

REVOKE ALL ON TABLE public.shop_orders FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.shop_order_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.shop_order_settlements FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.shop_order_no_seq FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_order_settlements TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_shop_order_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_seq INTEGER;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may generate shop order numbers'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.shop_order_no_seq (seq_date, last_seq)
  VALUES (v_date, 1)
  ON CONFLICT (seq_date) DO UPDATE
    SET last_seq = public.shop_order_no_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'SO-' || to_char(v_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_shop_order(
  p_order_id UUID,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.shop_orders%ROWTYPE;
  v_item public.shop_order_items%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may delete shop orders'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.shop_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;

  FOR v_item IN
    SELECT *
    FROM public.shop_order_items
    WHERE order_id = p_order_id
    FOR UPDATE
  LOOP
    IF v_item.qty_pending_bill > 0 OR v_item.qty_paid > 0 THEN
      SELECT * INTO v_variant
      FROM public.product_variants
      WHERE id = v_item.variant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '找不到商品規格');
      END IF;

      IF v_item.qty_pending_bill > 0 THEN
        IF v_variant.reserved_qty < v_item.qty_pending_bill THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', format('保留庫存不足（規格 %s）', v_item.variant_id)
          );
        END IF;

        UPDATE public.product_variants
        SET reserved_qty = reserved_qty - v_item.qty_pending_bill
        WHERE id = v_item.variant_id;
      END IF;

      IF v_item.qty_paid > 0 THEN
        UPDATE public.product_variants
        SET stock = stock + v_item.qty_paid
        WHERE id = v_item.variant_id;
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.shop_orders WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_shop_order_no() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_shop_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_shop_order_no() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shop_order(UUID, TEXT) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Deployment verification: anon must have no table/RPC access, and each table
-- must have RLS enabled.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') AS anon_has_crud,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_can_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'shop_orders',
    'shop_order_items',
    'shop_order_settlements',
    'shop_order_no_seq'
  )
ORDER BY c.relname;

SELECT
  p.oid::regprocedure::text AS function_signature,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
WHERE p.oid IN (
  'public.generate_shop_order_no()'::regprocedure,
  'public.delete_shop_order(uuid,text)'::regprocedure
)
ORDER BY function_signature;
