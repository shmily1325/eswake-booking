-- =============================================================================
-- 145_scope_liff_transaction_reads.sql
--
-- Replace unrestricted anon SELECT access to transactions with a narrow RPC
-- that resolves the member from an active LINE binding.
--
-- Apply only after the LIFF client using get_liff_member_transactions() has
-- been deployed.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_liff_member_transactions(
  p_line_user_id TEXT,
  p_category TEXT,
  p_since_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_result JSONB;
BEGIN
  IF NULLIF(trim(p_line_user_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE 使用者識別');
  END IF;

  IF NULLIF(trim(p_category), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少交易類別');
  END IF;

  SELECT member_id
  INTO v_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到有效的會員綁定');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'transaction_date', t.transaction_date,
        'category', t.category,
        'adjust_type', t.adjust_type,
        'transaction_type', t.transaction_type,
        'amount', t.amount,
        'minutes', t.minutes,
        'description', t.description,
        'notes', t.notes
      )
      ORDER BY t.transaction_date DESC, t.id DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.transactions t
  WHERE t.member_id = v_member_id
    AND t.category = p_category
    AND (p_since_date IS NULL OR t.transaction_date >= p_since_date::TEXT);

  RETURN jsonb_build_object('success', true, 'transactions', v_result);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.get_liff_member_transactions(TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_liff_member_transactions(TEXT, TEXT, DATE) TO anon, authenticated;

DROP POLICY IF EXISTS "Allow anon users to read transactions" ON public.transactions;
REVOKE SELECT ON TABLE public.transactions FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT
  has_table_privilege('anon', 'public.transactions', 'SELECT') AS anon_can_select_transactions,
  EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'transactions'
      AND p.cmd = 'SELECT'
      AND 'anon' = ANY (p.roles)
  ) AS anon_select_policy_exists,
  has_function_privilege(
    'anon',
    'public.get_liff_member_transactions(text,text,date)',
    'EXECUTE'
  ) AS anon_can_execute_transaction_rpc;
