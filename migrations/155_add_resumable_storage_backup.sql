-- Resumable product-images inventory and Google Drive synchronization.
-- Apply after migration 154.

BEGIN;

CREATE TABLE IF NOT EXISTS public.storage_backup_inventory_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL DEFAULT 'product-images'
    CHECK (bucket_id = 'product-images'),
  phase varchar(20) NOT NULL DEFAULT 'inventory'
    CHECK (phase IN ('inventory', 'sync', 'reconcile', 'manifest', 'cleanup', 'complete', 'failed')),
  inventory_upper_path text,
  inventory_cursor text,
  sync_cursor text,
  object_count bigint NOT NULL DEFAULT 0 CHECK (object_count >= 0),
  total_bytes bigint NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  synced_count bigint NOT NULL DEFAULT 0 CHECK (synced_count >= 0),
  manifest_checksum varchar(64),
  manifest_payload jsonb,
  drive_folder_id text,
  manifest_file_id text,
  previous_manifest_file_ids text[] NOT NULL DEFAULT '{}',
  lease_token uuid,
  lease_expires_at timestamptz,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storage_backup_inventory_runs_checksum_format
    CHECK (manifest_checksum IS NULL OR manifest_checksum ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_storage_backup_inventory_runs_active
  ON public.storage_backup_inventory_runs(bucket_id)
  WHERE phase IN ('inventory', 'sync', 'reconcile', 'manifest', 'cleanup');

CREATE INDEX IF NOT EXISTS idx_storage_backup_inventory_runs_completed
  ON public.storage_backup_inventory_runs(bucket_id, completed_at DESC)
  WHERE phase = 'complete';

CREATE TABLE IF NOT EXISTS public.storage_backup_inventory_entries (
  run_id uuid NOT NULL
    REFERENCES public.storage_backup_inventory_runs(run_id) ON DELETE CASCADE,
  object_path text NOT NULL,
  source_updated_at text,
  source_size bigint NOT NULL DEFAULT 0 CHECK (source_size >= 0),
  content_type text,
  checksum varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, object_path),
  CONSTRAINT storage_backup_inventory_entries_checksum_format
    CHECK (checksum IS NULL OR checksum ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_storage_backup_inventory_entries_page
  ON public.storage_backup_inventory_entries(run_id, object_path);

ALTER TABLE public.storage_backup_objects
  ADD COLUMN IF NOT EXISTS last_seen_run_id uuid;

CREATE INDEX IF NOT EXISTS idx_storage_backup_objects_last_seen
  ON public.storage_backup_objects(bucket_id, last_seen_run_id);

ALTER TABLE public.storage_backup_inventory_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_backup_inventory_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.storage_backup_inventory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_backup_inventory_entries FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.storage_backup_inventory_runs
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.storage_backup_inventory_entries
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.storage_backup_inventory_runs
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.storage_backup_inventory_entries
  TO service_role;

DROP POLICY IF EXISTS "Service role manages storage backup runs"
  ON public.storage_backup_inventory_runs;
CREATE POLICY "Service role manages storage backup runs"
  ON public.storage_backup_inventory_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages storage backup entries"
  ON public.storage_backup_inventory_entries;
CREATE POLICY "Service role manages storage backup entries"
  ON public.storage_backup_inventory_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.acquire_storage_backup_inventory_run(
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_run public.storage_backup_inventory_runs%ROWTYPE;
  v_lease_seconds integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 120), 15), 120);
BEGIN
  IF p_lease_token IS NULL THEN
    RAISE EXCEPTION 'lease token is required';
  END IF;
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('storage_backup_inventory:product-images'));

  DELETE FROM public.storage_backup_inventory_runs
  WHERE (
      phase = 'complete'
      AND completed_at < now() - interval '7 days'
      AND run_id <> (
        SELECT latest.run_id
        FROM public.storage_backup_inventory_runs latest
        WHERE latest.bucket_id = 'product-images'
          AND latest.phase = 'complete'
        ORDER BY latest.completed_at DESC
        LIMIT 1
      )
    )
    OR (
      phase = 'failed'
      AND updated_at < now() - interval '7 days'
    );

  SELECT *
  INTO v_run
  FROM public.storage_backup_inventory_runs
  WHERE bucket_id = 'product-images'
    AND phase IN ('inventory', 'sync', 'reconcile', 'manifest', 'cleanup')
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.storage_backup_inventory_runs(bucket_id, inventory_upper_path)
    SELECT 'product-images', MAX(o.name)
    FROM storage.objects o
    WHERE o.bucket_id = 'product-images'
    RETURNING * INTO v_run;
  END IF;

  IF v_run.lease_token IS NOT NULL
     AND v_run.lease_token IS DISTINCT FROM p_lease_token
     AND v_run.lease_expires_at > now() THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'run', to_jsonb(v_run)
    );
  END IF;

  UPDATE public.storage_backup_inventory_runs
  SET lease_token = p_lease_token,
      lease_expires_at = now() + make_interval(secs => v_lease_seconds),
      error_message = NULL,
      updated_at = now()
  WHERE run_id = v_run.run_id
  RETURNING * INTO v_run;

  RETURN jsonb_build_object(
    'acquired', true,
    'run', to_jsonb(v_run)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.scan_storage_backup_inventory_page(
  p_run_id uuid,
  p_lease_token uuid,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_run public.storage_backup_inventory_runs%ROWTYPE;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000);
  v_count integer := 0;
  v_bytes bigint := 0;
  v_last_path text;
  v_has_more boolean := false;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  SELECT *
  INTO v_run
  FROM public.storage_backup_inventory_runs
  WHERE run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.phase <> 'inventory' THEN
    RAISE EXCEPTION 'inventory run is not active';
  END IF;
  IF v_run.lease_token IS DISTINCT FROM p_lease_token
     OR v_run.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'inventory lease is not valid';
  END IF;

  INSERT INTO public.storage_backup_inventory_entries(
    run_id,
    object_path,
    source_updated_at,
    source_size,
    content_type
  )
  SELECT
    p_run_id,
    o.name,
    o.updated_at::text,
    CASE
      WHEN COALESCE(o.metadata->>'size', '') ~ '^[0-9]+$'
        THEN (o.metadata->>'size')::bigint
      ELSE 0
    END,
    NULLIF(o.metadata->>'mimetype', '')
  FROM storage.objects o
  WHERE o.bucket_id = 'product-images'
    AND v_run.inventory_upper_path IS NOT NULL
    AND o.name <= v_run.inventory_upper_path
    AND o.created_at <= v_run.started_at
    AND (v_run.inventory_cursor IS NULL OR o.name > v_run.inventory_cursor)
  ORDER BY o.name
  LIMIT v_limit
  ON CONFLICT (run_id, object_path) DO UPDATE
  SET source_updated_at = EXCLUDED.source_updated_at,
      source_size = EXCLUDED.source_size,
      content_type = EXCLUDED.content_type,
      updated_at = now();

  SELECT
    COUNT(*)::integer,
    COALESCE(SUM(e.source_size), 0),
    MAX(e.object_path)
  INTO v_count, v_bytes, v_last_path
  FROM (
    SELECT object_path, source_size
    FROM public.storage_backup_inventory_entries
    WHERE run_id = p_run_id
      AND (v_run.inventory_cursor IS NULL OR object_path > v_run.inventory_cursor)
    ORDER BY object_path
    LIMIT v_limit
  ) e;

  IF v_last_path IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM storage.objects o
      WHERE o.bucket_id = 'product-images'
        AND o.name <= v_run.inventory_upper_path
        AND o.created_at <= v_run.started_at
        AND o.name > v_last_path
    )
    INTO v_has_more;
  END IF;

  UPDATE public.storage_backup_inventory_runs
  SET inventory_cursor = COALESCE(v_last_path, inventory_cursor),
      object_count = object_count + v_count,
      total_bytes = total_bytes + v_bytes,
      phase = CASE
        WHEN (v_count = 0 OR NOT v_has_more)
          AND object_count + v_count = 0 THEN 'reconcile'
        WHEN v_count = 0 OR NOT v_has_more THEN 'sync'
        ELSE phase
      END,
      updated_at = now(),
      lease_expires_at = now() + interval '120 seconds'
  WHERE run_id = p_run_id
  RETURNING * INTO v_run;

  RETURN jsonb_build_object(
    'run', to_jsonb(v_run),
    'page_count', v_count,
    'page_bytes', v_bytes,
    'has_more', v_has_more
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_storage_backup_inventory_entry(
  p_run_id uuid,
  p_lease_token uuid,
  p_object_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_run public.storage_backup_inventory_runs%ROWTYPE;
  v_entry public.storage_backup_inventory_entries%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
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

  SELECT *
  INTO v_entry
  FROM public.storage_backup_inventory_entries
  WHERE run_id = p_run_id
    AND (v_run.sync_cursor IS NULL OR object_path > v_run.sync_cursor)
  ORDER BY object_path
  LIMIT 1;

  IF v_entry.object_path IS DISTINCT FROM p_object_path THEN
    RAISE EXCEPTION 'storage backup cursor mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'product-images'
      AND o.name = v_entry.object_path
      AND o.updated_at::text IS NOT DISTINCT FROM v_entry.source_updated_at
      AND CASE
        WHEN COALESCE(o.metadata->>'size', '') ~ '^[0-9]+$'
          THEN (o.metadata->>'size')::bigint
        ELSE 0
      END = v_entry.source_size
  ) THEN
    RAISE EXCEPTION 'source object changed during backup';
  END IF;

  UPDATE public.storage_backup_objects
  SET last_seen_run_id = p_run_id,
      source_deleted_at = NULL,
      updated_at = now()
  WHERE bucket_id = 'product-images'
    AND object_path = p_object_path;

  UPDATE public.storage_backup_inventory_runs
  SET sync_cursor = p_object_path,
      synced_count = synced_count + 1,
      phase = CASE
        WHEN NOT EXISTS (
          SELECT 1
          FROM public.storage_backup_inventory_entries e
          WHERE e.run_id = p_run_id
            AND e.object_path > p_object_path
        ) THEN 'reconcile'
        ELSE phase
      END,
      updated_at = now(),
      lease_expires_at = now() + interval '120 seconds'
  WHERE run_id = p_run_id
  RETURNING * INTO v_run;

  RETURN to_jsonb(v_run);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_storage_backup_inventory_run(
  p_run_id uuid,
  p_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_run public.storage_backup_inventory_runs%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  SELECT *
  INTO v_run
  FROM public.storage_backup_inventory_runs
  WHERE run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.phase <> 'reconcile' THEN
    RAISE EXCEPTION 'storage backup run is not ready to reconcile';
  END IF;
  IF v_run.lease_token IS DISTINCT FROM p_lease_token
     OR v_run.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'storage backup lease is not valid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.storage_backup_inventory_entries e
    LEFT JOIN storage.objects o
      ON o.bucket_id = 'product-images'
     AND o.name = e.object_path
    WHERE e.run_id = p_run_id
      AND (
        o.id IS NULL
        OR o.updated_at::text IS DISTINCT FROM e.source_updated_at
        OR CASE
          WHEN COALESCE(o.metadata->>'size', '') ~ '^[0-9]+$'
            THEN (o.metadata->>'size')::bigint
          ELSE 0
        END IS DISTINCT FROM e.source_size
      )
  ) OR EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'product-images'
      AND v_run.inventory_upper_path IS NOT NULL
      AND o.name <= v_run.inventory_upper_path
      AND o.created_at <= v_run.started_at
      AND NOT EXISTS (
        SELECT 1
        FROM public.storage_backup_inventory_entries e
        WHERE e.run_id = p_run_id
          AND e.object_path = o.name
      )
  ) THEN
    RAISE EXCEPTION 'source inventory changed during reconciliation';
  END IF;

  UPDATE public.storage_backup_objects s
  SET source_deleted_at = NULL,
      updated_at = now()
  WHERE s.bucket_id = 'product-images'
    AND s.last_seen_run_id = p_run_id;

  UPDATE public.storage_backup_objects s
  SET source_deleted_at = COALESCE(s.source_deleted_at, now()),
      updated_at = now()
  WHERE s.bucket_id = 'product-images'
    AND s.last_seen_run_id IS DISTINCT FROM p_run_id
    AND NOT EXISTS (
      SELECT 1
      FROM storage.objects o
      WHERE o.bucket_id = s.bucket_id
        AND o.name = s.object_path
    );

  UPDATE public.storage_backup_inventory_runs
  SET phase = 'manifest',
      updated_at = now(),
      lease_expires_at = now() + interval '120 seconds'
  WHERE run_id = p_run_id
  RETURNING * INTO v_run;

  RETURN to_jsonb(v_run);
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_storage_backup_manifest(
  p_run_id uuid,
  p_lease_token uuid,
  p_manifest_checksum text,
  p_manifest_file_id text,
  p_previous_manifest_file_ids text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_run public.storage_backup_inventory_runs%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  IF p_manifest_checksum !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'manifest checksum is invalid';
  END IF;
  IF COALESCE(p_manifest_file_id, '') = '' THEN
    RAISE EXCEPTION 'manifest file id is required';
  END IF;

  SELECT *
  INTO v_run
  FROM public.storage_backup_inventory_runs
  WHERE run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.phase <> 'manifest' THEN
    RAISE EXCEPTION 'storage backup run is not ready to complete';
  END IF;
  IF v_run.lease_token IS DISTINCT FROM p_lease_token
     OR v_run.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'storage backup lease is not valid';
  END IF;

  LOCK TABLE storage.objects IN SHARE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.storage_backup_inventory_entries e
    LEFT JOIN storage.objects o
      ON o.bucket_id = 'product-images'
     AND o.name = e.object_path
    WHERE e.run_id = p_run_id
      AND (
        o.id IS NULL
        OR o.updated_at::text IS DISTINCT FROM e.source_updated_at
        OR CASE
          WHEN COALESCE(o.metadata->>'size', '') ~ '^[0-9]+$'
            THEN (o.metadata->>'size')::bigint
          ELSE 0
        END IS DISTINCT FROM e.source_size
      )
  ) OR EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'product-images'
      AND v_run.inventory_upper_path IS NOT NULL
      AND o.name <= v_run.inventory_upper_path
      AND o.created_at <= v_run.started_at
      AND NOT EXISTS (
        SELECT 1
        FROM public.storage_backup_inventory_entries e
        WHERE e.run_id = p_run_id
          AND e.object_path = o.name
      )
  ) THEN
    RAISE EXCEPTION 'source inventory changed before completion';
  END IF;

  UPDATE public.storage_backup_inventory_runs
  SET phase = 'cleanup',
      manifest_checksum = p_manifest_checksum,
      manifest_file_id = p_manifest_file_id,
      previous_manifest_file_ids = COALESCE(p_previous_manifest_file_ids, '{}'),
      error_message = NULL,
      updated_at = now(),
      lease_expires_at = now() + interval '120 seconds'
  WHERE run_id = p_run_id
  RETURNING * INTO v_run;

  RETURN to_jsonb(v_run);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_storage_backup_inventory_run(
  p_run_id uuid,
  p_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_run public.storage_backup_inventory_runs%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  SELECT *
  INTO v_run
  FROM public.storage_backup_inventory_runs
  WHERE run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.phase <> 'cleanup' THEN
    RAISE EXCEPTION 'storage backup run is not ready to complete';
  END IF;
  IF v_run.lease_token IS DISTINCT FROM p_lease_token
     OR v_run.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'storage backup lease is not valid';
  END IF;

  UPDATE public.storage_backup_inventory_runs
  SET phase = 'complete',
      completed_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL,
      error_message = NULL,
      updated_at = now()
  WHERE run_id = p_run_id
  RETURNING * INTO v_run;

  RETURN to_jsonb(v_run);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_storage_backup_inventory_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  UPDATE public.storage_backup_inventory_runs
  SET lease_token = NULL,
      lease_expires_at = NULL,
      error_message = LEFT(p_error_message, 1000),
      updated_at = now()
  WHERE run_id = p_run_id
    AND lease_token = p_lease_token
    AND phase IN ('inventory', 'sync', 'reconcile', 'manifest', 'cleanup');
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_storage_backup_inventory_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  UPDATE public.storage_backup_inventory_runs
  SET phase = 'failed',
      lease_token = NULL,
      lease_expires_at = NULL,
      error_message = LEFT(p_error_message, 1000),
      completed_at = now(),
      updated_at = now()
  WHERE run_id = p_run_id
    AND lease_token = p_lease_token
    AND phase IN ('inventory', 'sync', 'reconcile', 'manifest', 'cleanup');
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_storage_backup_inventory_run(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scan_storage_backup_inventory_page(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ack_storage_backup_inventory_entry(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_storage_backup_inventory_run(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_storage_backup_manifest(uuid, uuid, text, text, text[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_storage_backup_inventory_run(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_storage_backup_inventory_run(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_storage_backup_inventory_run(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.acquire_storage_backup_inventory_run(uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.scan_storage_backup_inventory_page(uuid, uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_storage_backup_inventory_entry(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_storage_backup_inventory_run(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_storage_backup_manifest(uuid, uuid, text, text, text[])
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_storage_backup_inventory_run(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_storage_backup_inventory_run(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_storage_backup_inventory_run(uuid, uuid, text)
  TO service_role;

COMMENT ON TABLE public.storage_backup_inventory_runs IS
  'Persistent phase and cursors for resumable product-images backups';
COMMENT ON TABLE public.storage_backup_inventory_entries IS
  'Immutable object inventory for one resumable Storage backup run';

COMMIT;

NOTIFY pgrst, 'reload schema';
