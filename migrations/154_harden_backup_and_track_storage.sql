-- Preserve backup health visibility and track incremental Storage copies.

DROP POLICY IF EXISTS "Allow authenticated users to read backup_logs"
  ON public.backup_logs;
DROP POLICY IF EXISTS "Super admins can read backup logs"
  ON public.backup_logs;

CREATE POLICY "Allow authenticated users to read backup_logs"
  ON public.backup_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_backup_logs_destination_created_at
  ON public.backup_logs(destination, created_at DESC);

CREATE TABLE IF NOT EXISTS public.storage_backup_objects (
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  source_updated_at text,
  source_size bigint NOT NULL DEFAULT 0 CHECK (source_size >= 0),
  drive_file_id text,
  checksum varchar(64),
  status varchar(20) NOT NULL DEFAULT 'pending',
  last_backed_up_at timestamptz,
  source_deleted_at timestamptz,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id, object_path),
  CONSTRAINT storage_backup_objects_checksum_format
    CHECK (checksum IS NULL OR checksum ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_storage_backup_objects_status
  ON public.storage_backup_objects(bucket_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_storage_backup_objects_deleted
  ON public.storage_backup_objects(bucket_id, source_deleted_at)
  WHERE source_deleted_at IS NOT NULL;

ALTER TABLE public.storage_backup_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_backup_objects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages storage backup objects"
  ON public.storage_backup_objects;
CREATE POLICY "Service role manages storage backup objects"
  ON public.storage_backup_objects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.storage_backup_objects IS
  'Checkpoint state for incremental copies of Supabase Storage objects to Google Drive';
COMMENT ON COLUMN public.storage_backup_objects.source_deleted_at IS
  'Source disappearance time; the Drive copy remains recoverable until retention purge';

CREATE TABLE IF NOT EXISTS public.storage_backup_manifest_snapshots (
  token uuid PRIMARY KEY,
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_storage_backup_manifest_snapshots_expires_at
  ON public.storage_backup_manifest_snapshots(expires_at);

ALTER TABLE public.storage_backup_manifest_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_backup_manifest_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages storage manifest snapshots"
  ON public.storage_backup_manifest_snapshots;
CREATE POLICY "Service role manages storage manifest snapshots"
  ON public.storage_backup_manifest_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.storage_backup_manifest_snapshots IS
  'Short-lived immutable manifests for consistent paginated desktop and DR downloads';
