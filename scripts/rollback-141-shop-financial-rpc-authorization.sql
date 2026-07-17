-- Emergency compatibility rollback for migration 141.
-- This temporarily allows authenticated sessions if the staff helper causes
-- an unexpected lockout. It intentionally does not restore anon/PUBLIC access.
-- Investigate the helper and re-apply migration 141 as soon as possible.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_execute_shop_financial_rpc()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'authenticated'
$$;

REVOKE ALL ON FUNCTION public.can_execute_shop_financial_rpc() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_shop_order_billing(UUID, JSONB, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_shop_order_billing(UUID, JSONB, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_shop_order(UUID, JSONB, UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_shop_order_settlement(UUID, NUMERIC, JSONB, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_shop_order(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_execute_shop_financial_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_shop_order_billing(UUID, JSONB, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_shop_order_billing(UUID, JSONB, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_shop_order(UUID, JSONB, UUID, TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_shop_order_settlement(UUID, NUMERIC, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_shop_order(UUID, TEXT) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
