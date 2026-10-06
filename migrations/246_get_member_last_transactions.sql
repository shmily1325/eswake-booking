-- Return one latest transaction row per active member without depending on
-- PostgREST's per-request row limit.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.can_execute_shop_financial_rpc()') IS NULL THEN
    RAISE EXCEPTION 'Missing staff authorization helper; apply migration 141 first';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_transactions_member_created_desc
  ON public.transactions (member_id, created_at DESC NULLS LAST, id DESC);

CREATE OR REPLACE FUNCTION public.get_member_last_transactions()
RETURNS TABLE (
  member_id UUID,
  transaction_date DATE,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may read member transaction summaries'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    latest.transaction_date,
    latest.created_at
  FROM public.members AS m
  JOIN LATERAL (
    SELECT
      t.transaction_date,
      t.created_at
    FROM public.transactions AS t
    WHERE t.member_id = m.id
    ORDER BY t.created_at DESC NULLS LAST, t.id DESC
    LIMIT 1
  ) AS latest ON TRUE
  WHERE m.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_last_transactions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_last_transactions() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT
  p.oid::regprocedure::text AS function_signature,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc AS p
WHERE p.oid = 'public.get_member_last_transactions()'::regprocedure;
