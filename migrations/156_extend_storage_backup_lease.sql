-- Keep one resumable Storage worker fenced for the full five-minute Vercel
-- invocation. Migration 155 remains immutable.

BEGIN;

CREATE OR REPLACE FUNCTION public.renew_storage_backup_inventory_lease(
  p_run_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 330
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_run public.storage_backup_inventory_runs%ROWTYPE;
  v_lease_seconds integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 330), 120), 330);
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  UPDATE public.storage_backup_inventory_runs
  SET lease_expires_at = now() + make_interval(secs => v_lease_seconds),
      updated_at = now()
  WHERE run_id = p_run_id
    AND lease_token = p_lease_token
    AND lease_expires_at > now()
    AND phase IN ('inventory', 'sync', 'reconcile', 'manifest', 'cleanup')
  RETURNING * INTO v_run;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'storage backup lease can no longer be renewed';
  END IF;

  RETURN to_jsonb(v_run);
END;
$$;

ALTER FUNCTION public.commit_storage_backup_manifest(uuid, uuid, text, text, text[])
  SET lock_timeout TO '10s';
ALTER FUNCTION public.commit_storage_backup_manifest(uuid, uuid, text, text, text[])
  SET statement_timeout TO '30s';
ALTER FUNCTION public.reconcile_storage_backup_inventory_run(uuid, uuid)
  SET statement_timeout TO '30s';

REVOKE ALL ON FUNCTION public.renew_storage_backup_inventory_lease(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_storage_backup_inventory_lease(uuid, uuid, integer)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
