-- Backup integrity metadata. All authenticated staff retain read access to health logs.

ALTER TABLE public.backup_logs
  ADD COLUMN IF NOT EXISTS destination varchar(50),
  ADD COLUMN IF NOT EXISTS checksum varchar(64),
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS format_version integer;

DROP POLICY IF EXISTS "Allow authenticated users to read backup_logs"
  ON public.backup_logs;
DROP POLICY IF EXISTS "Super admins can read backup logs"
  ON public.backup_logs;

CREATE POLICY "Allow authenticated users to read backup_logs"
  ON public.backup_logs
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON COLUMN public.backup_logs.destination IS
  'Validated destination such as google_drive, wd_local, or manual_download';
COMMENT ON COLUMN public.backup_logs.checksum IS
  'SHA-256 checksum of the exact backup payload';
COMMENT ON COLUMN public.backup_logs.file_size_bytes IS
  'Exact UTF-8 payload size in bytes';
COMMENT ON COLUMN public.backup_logs.format_version IS
  'ESWake backup manifest format version';
