-- =============================================================================
-- 144_revoke_anon_member_update.sql
--
-- Phase 2 of the LIFF birthday hardening. The deployed LIFF client now uses
-- update_liff_member_birthday(), so anonymous callers no longer need direct
-- UPDATE access to members.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.update_liff_member_birthday(text,date)') IS NULL THEN
    RAISE EXCEPTION 'Missing update_liff_member_birthday(); apply migration 143 first';
  END IF;
END
$$;

DROP POLICY IF EXISTS "allow_anon_update_birthday" ON public.members;
REVOKE UPDATE ON TABLE public.members FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT
  has_table_privilege('anon', 'public.members', 'UPDATE') AS anon_can_update_members,
  EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'members'
      AND p.cmd = 'UPDATE'
      AND 'anon' = ANY (p.roles)
  ) AS anon_update_policy_exists,
  has_function_privilege(
    'anon',
    'public.update_liff_member_birthday(text,date)',
    'EXECUTE'
  ) AS anon_can_execute_birthday_rpc;
