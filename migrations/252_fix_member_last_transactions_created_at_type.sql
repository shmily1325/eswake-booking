-- =============================================================================
-- 252_fix_member_last_transactions_created_at_type.sql
--
-- Both transactions.transaction_date and transactions.created_at are TEXT.
-- Recreate the read-only helper with an output signature matching the table.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_member_last_transactions();

CREATE FUNCTION public.get_member_last_transactions()
RETURNS TABLE (
  member_id UUID,
  transaction_date TEXT,
  created_at TEXT
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

-- Execute the query before commit so a future output-type mismatch aborts the
-- migration instead of first appearing in production.
DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"authenticated","email":"minlin1325@gmail.com"}',
    true
  );
  PERFORM 1
  FROM public.get_member_last_transactions()
  LIMIT 1;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT 'member last-transactions output types aligned with text columns' AS status;
