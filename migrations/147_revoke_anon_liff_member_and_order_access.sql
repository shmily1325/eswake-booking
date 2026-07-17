-- =============================================================================
-- 147_revoke_anon_liff_member_and_order_access.sql
--
-- Final cutover after migration 146 and the token-verifying LIFF client/API
-- have been deployed. Remove all direct anonymous access replaced by the API.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.get_liff_member_profile(text,boolean)') IS NULL
    OR to_regprocedure('public.bind_liff_member(text,text,date)') IS NULL
    OR to_regprocedure('public.get_liff_shop_orders(text)') IS NULL
    OR to_regprocedure('public.update_liff_member_birthday(text,date)') IS NULL
    OR to_regprocedure('public.get_liff_member_transactions(text,text,date)') IS NULL
  THEN
    RAISE EXCEPTION 'Missing LIFF RPC prerequisites; apply migrations 143, 145, and 146 first';
  END IF;
END
$$;

-- All sensitive LIFF RPCs are now reachable only through the server-side
-- access-token gateway, which invokes them with the service role.
REVOKE ALL ON FUNCTION public.get_liff_member_profile(TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_liff_member(TEXT, TEXT, DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_liff_shop_orders(TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_liff_member_birthday(TEXT, DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_liff_member_transactions(TEXT, TEXT, DATE)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_liff_member_profile(TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_liff_member(TEXT, TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_liff_shop_orders(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_liff_member_birthday(TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_liff_member_transactions(TEXT, TEXT, DATE) TO service_role;

DROP POLICY IF EXISTS "Allow anon users to read board_storage" ON public.board_storage;
DROP POLICY IF EXISTS "shop_orders_select" ON public.shop_orders;
DROP POLICY IF EXISTS "shop_order_items_select" ON public.shop_order_items;

CREATE POLICY "shop_orders_select" ON public.shop_orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "shop_order_items_select" ON public.shop_order_items
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.members FROM PUBLIC, anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_bindings FROM PUBLIC, anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.board_storage FROM PUBLIC, anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_orders FROM PUBLIC, anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_order_items FROM PUBLIC, anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.shop_order_settlements FROM PUBLIC, anon;

COMMIT;

NOTIFY pgrst, 'reload schema';

WITH targets(table_name) AS (
  VALUES
    ('members'),
    ('line_bindings'),
    ('board_storage'),
    ('shop_orders'),
    ('shop_order_items'),
    ('shop_order_settlements')
)
SELECT
  table_name,
  has_table_privilege('anon', format('public.%I', table_name), 'SELECT') AS anon_can_select,
  has_table_privilege('anon', format('public.%I', table_name), 'INSERT') AS anon_can_insert,
  has_table_privilege('anon', format('public.%I', table_name), 'UPDATE') AS anon_can_update,
  has_table_privilege('anon', format('public.%I', table_name), 'DELETE') AS anon_can_delete
FROM targets
ORDER BY table_name;

SELECT
  p.oid::regprocedure::text AS function_signature,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc p
WHERE p.oid IN (
  'public.get_liff_member_profile(text,boolean)'::regprocedure,
  'public.bind_liff_member(text,text,date)'::regprocedure,
  'public.get_liff_shop_orders(text)'::regprocedure,
  'public.update_liff_member_birthday(text,date)'::regprocedure,
  'public.get_liff_member_transactions(text,text,date)'::regprocedure
)
ORDER BY function_signature;
