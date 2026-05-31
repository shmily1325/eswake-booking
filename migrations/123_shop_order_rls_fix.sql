-- =============================================
-- 123_shop_order_rls_fix.sql
-- Fix: generate_shop_order_no fails with RLS on shop_order_no_seq
-- (Supabase may enable RLS on new tables even if 121 intended DISABLE)
-- =============================================

-- Drop accidental policies (safe if none exist)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'shop_order_no_seq',
        'shop_orders',
        'shop_order_items',
        'shop_order_settlements'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.shop_order_no_seq DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_settlements DISABLE ROW LEVEL SECURITY;

-- Run as owner so seq insert works even if RLS is re-enabled later
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
  INSERT INTO shop_order_no_seq (seq_date, last_seq)
  VALUES (v_date, 1)
  ON CONFLICT (seq_date) DO UPDATE
    SET last_seq = shop_order_no_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'SO-' || to_char(v_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_shop_order_no() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_shop_order_no() TO anon;

SELECT '123_shop_order_rls_fix: RLS disabled + generate_shop_order_no SECURITY DEFINER' AS status;
