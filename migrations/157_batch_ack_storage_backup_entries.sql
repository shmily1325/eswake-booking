-- Batch unchanged Storage checkpoints to avoid per-object PostgREST round trips.
-- Apply after migration 156.

BEGIN;

CREATE OR REPLACE FUNCTION public.ack_storage_backup_inventory_entries(
  p_run_id uuid,
  p_lease_token uuid,
  p_entries jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_run public.storage_backup_inventory_runs%ROWTYPE;
  v_count integer;
  v_requested_paths text[];
  v_expected_paths text[];
  v_last_path text;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'storage backup batch must be an array';
  END IF;

  v_count := jsonb_array_length(p_entries);
  IF v_count < 1 OR v_count > 50 THEN
    RAISE EXCEPTION 'storage backup batch size must be between 1 and 50';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_entries) AS item(value)
    WHERE NULLIF(item.value->>'object_path', '') IS NULL
      OR COALESCE(item.value->>'checksum', '') !~ '^[a-f0-9]{64}$'
  ) THEN
    RAISE EXCEPTION 'storage backup batch entry is invalid';
  END IF;

  SELECT array_agg(item.value->>'object_path' ORDER BY item.ordinality)
  INTO v_requested_paths
  FROM jsonb_array_elements(p_entries) WITH ORDINALITY AS item(value, ordinality);

  IF (
    SELECT count(DISTINCT requested_path)
    FROM unnest(v_requested_paths) AS requested_path
  ) <> v_count OR EXISTS (
    SELECT 1
    FROM unnest(v_requested_paths) WITH ORDINALITY AS current_item(path, position)
    JOIN unnest(v_requested_paths) WITH ORDINALITY AS next_item(path, position)
      ON next_item.position = current_item.position + 1
    WHERE current_item.path >= next_item.path
  ) THEN
    RAISE EXCEPTION 'storage backup batch paths must be unique and ordered';
  END IF;

  SELECT *
  INTO v_run
  FROM public.storage_backup_inventory_runs
  WHERE run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.phase <> 'sync' THEN
    RAISE EXCEPTION 'storage backup run is not syncing';
  END IF;
  IF v_run.lease_token IS DISTINCT FROM p_lease_token
     OR v_run.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'storage backup lease is not valid';
  END IF;

  SELECT array_agg(expected.object_path ORDER BY expected.object_path)
  INTO v_expected_paths
  FROM (
    SELECT entry.object_path
    FROM public.storage_backup_inventory_entries entry
    WHERE entry.run_id = p_run_id
      AND (v_run.sync_cursor IS NULL OR entry.object_path > v_run.sync_cursor)
    ORDER BY entry.object_path
    LIMIT v_count
  ) AS expected;

  IF v_expected_paths IS DISTINCT FROM v_requested_paths THEN
    RAISE EXCEPTION 'storage backup cursor mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.storage_backup_inventory_entries entry
    LEFT JOIN storage.objects source
      ON source.bucket_id = 'product-images'
     AND source.name = entry.object_path
    WHERE entry.run_id = p_run_id
      AND entry.object_path = ANY(v_requested_paths)
      AND (
        source.name IS NULL
        OR source.updated_at::text IS DISTINCT FROM entry.source_updated_at
        OR CASE
          WHEN COALESCE(source.metadata->>'size', '') ~ '^[0-9]+$'
            THEN (source.metadata->>'size')::bigint
          ELSE 0
        END <> entry.source_size
      )
  ) THEN
    RAISE EXCEPTION 'source object changed during backup';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_entries) AS item(value)
    JOIN public.storage_backup_inventory_entries entry
      ON entry.run_id = p_run_id
     AND entry.object_path = item.value->>'object_path'
    LEFT JOIN public.storage_backup_objects checkpoint
      ON checkpoint.bucket_id = 'product-images'
     AND checkpoint.object_path = entry.object_path
    WHERE checkpoint.object_path IS NULL
      OR checkpoint.status <> 'success'
      OR checkpoint.source_deleted_at IS NOT NULL
      OR checkpoint.drive_file_id IS NULL
      OR checkpoint.last_backed_up_at IS NULL
      OR checkpoint.last_backed_up_at < now() - interval '30 days'
      OR checkpoint.checksum IS DISTINCT FROM item.value->>'checksum'
      OR checkpoint.source_updated_at IS DISTINCT FROM entry.source_updated_at
      OR checkpoint.source_size IS DISTINCT FROM entry.source_size
  ) THEN
    RAISE EXCEPTION 'storage backup entry is not unchanged';
  END IF;

  UPDATE public.storage_backup_inventory_entries entry
  SET checksum = item.checksum,
      updated_at = now()
  FROM (
    SELECT value->>'object_path' AS object_path, value->>'checksum' AS checksum
    FROM jsonb_array_elements(p_entries)
  ) AS item
  WHERE entry.run_id = p_run_id
    AND entry.object_path = item.object_path;

  UPDATE public.storage_backup_objects checkpoint
  SET last_seen_run_id = p_run_id,
      source_deleted_at = NULL,
      updated_at = now()
  WHERE checkpoint.bucket_id = 'product-images'
    AND checkpoint.object_path = ANY(v_requested_paths);

  v_last_path := v_requested_paths[v_count];
  UPDATE public.storage_backup_inventory_runs
  SET sync_cursor = v_last_path,
      synced_count = synced_count + v_count,
      phase = CASE
        WHEN NOT EXISTS (
          SELECT 1
          FROM public.storage_backup_inventory_entries entry
          WHERE entry.run_id = p_run_id
            AND entry.object_path > v_last_path
        ) THEN 'reconcile'
        ELSE phase
      END,
      updated_at = now(),
      lease_expires_at = now() + interval '330 seconds'
  WHERE run_id = p_run_id
  RETURNING * INTO v_run;

  RETURN jsonb_build_object(
    'run', to_jsonb(v_run),
    'acked_count', v_count
  );
END;
$$;

ALTER FUNCTION public.ack_storage_backup_inventory_entries(uuid, uuid, jsonb)
  SET lock_timeout TO '10s';
ALTER FUNCTION public.ack_storage_backup_inventory_entries(uuid, uuid, jsonb)
  SET statement_timeout TO '15s';

REVOKE ALL ON FUNCTION public.ack_storage_backup_inventory_entries(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_storage_backup_inventory_entries(uuid, uuid, jsonb)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
