-- =============================================================================
-- 143_add_liff_birthday_rpc.sql
--
-- Phase 1 of replacing broad anon UPDATE access on members.
-- This migration only adds the narrow RPC; it does not remove the legacy
-- policy yet, so it is safe to apply before deploying the LIFF client change.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_liff_member_birthday(
  p_line_user_id TEXT,
  p_birthday DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  IF NULLIF(trim(p_line_user_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE 使用者識別');
  END IF;

  IF p_birthday IS NULL OR p_birthday > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', '生日日期無效');
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

  UPDATE public.members
  SET birthday = p_birthday
  WHERE id = v_member_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  RETURN jsonb_build_object('success', true, 'member_id', v_member_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.update_liff_member_birthday(TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_liff_member_birthday(TEXT, DATE) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT
  p.oid::regprocedure::text AS function_signature,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_can_execute
FROM pg_proc p
WHERE p.oid = 'public.update_liff_member_birthday(text,date)'::regprocedure;
