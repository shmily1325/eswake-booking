-- =============================================================================
-- 251_fix_member_last_transactions_return_type.sql
--
-- transactions.transaction_date is intentionally stored as YYYY-MM-DD text.
-- Migration 246 declared the RPC output as DATE, so PostgreSQL rejected every
-- call before returning rows. Recreate only this read-only helper with TEXT.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_member_last_transactions();

CREATE FUNCTION public.get_member_last_transactions()
RETURNS TABLE (
  member_id UUID,
  transaction_date TEXT,
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

SELECT 'member last-transactions output type fixed' AS status;
