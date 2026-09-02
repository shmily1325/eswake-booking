# Backup and disaster-recovery runbook

## Backup layers

1. Google Drive database SQL at 02:00 Taiwan time.
2. Google Drive `product-images` incremental sync at 02:30.
3. Windows database SQL plus `product-images` mirror at 10:00 when the user is logged in.
4. Supabase Pro daily physical backups (seven days) are an extra safety layer only.

The application-managed Google Drive and Windows backups continue to work after
the Supabase project is downgraded from Pro.

Database backups use format v4 and include the `credit_lots` yearly voucher
ledger. Format v3 predates that recovery contract and must not be accepted as a
complete current backup. Immediately after deploying the v4 code, run the
Google Drive database backup and Windows task once so the first v4 recovery
points replace the old health status.

The product-image cloud job is resumable. A `202 running` result is expected
while it advances through inventory, sync, deletion reconciliation, and
manifest phases. Repeating the manual action or the next Cron invocation resumes
the same run from its saved cursor. Migration 155 must be applied before this
endpoint is deployed.

Migration 156 extends the fenced worker lease for five-minute Vercel
invocations. Apply it before deploying the 300-second Storage backup settings.
The worker stops starting new transfers early enough to preserve time for lease
release and health logging.

## Required secrets

- Vercel: set a high-entropy `CRON_SECRET`. Vercel Cron sends it as
  `Authorization: Bearer ...`.
- Windows installer: paste the same value once. It is stored with Windows DPAPI
  for the current user and is never written into the portable installer.
- Never put `CRON_SECRET`, database passwords, or service-role keys in source
  control or command files.

After changing `CRON_SECRET`, update Vercel and the WD scheduled task together,
then run both jobs manually once.

## Daily health criteria

The BAO hub's primary status is the Google Drive database (`google_drive`) only.
It is green when the latest verified success is at most 26 hours old with no
new failed attempt, yellow from over 26 through 50 hours or after one failed
daily attempt while the previous success remains recoverable, and red after 50
hours, when no successful backup exists, when integrity metadata is invalid, or
after two consecutive failed daily cycles. Multiple retries on the same venue
date count as one failed cycle. `running` rows are informational: they do not
count as failures and do not break a failure streak.

Google Drive product images (`google_drive_storage`) appear separately in muted
text on the BAO hub. A complete verified success at most seven days old is
normal. One failed or running resumable step is informational. More than seven
days without a complete success or sustained failures is yellow; more than 30
days, no complete success, or invalid integrity metadata is red. Image status
never changes the primary database badge and never triggers the database
manual-backup prompt.

Windows database and image statuses are secondary. They use the corresponding
database and image age/integrity rules on the Backup admin page, but never
change the BAO primary status. Before the Windows installer is used, both
Windows statuses correctly show `未設定`.

Each successful record must have:

- backup format version;
- exact byte count;
- SHA-256 checksum;
- per-table row counts in the embedded manifest.

The Windows directory contains matching `.sql` / `.sql.sha256` files and
`Storage-Backups/product-images/manifest.json`. A `.tmp` file is never a backup.

Database SQL and product-image copies are retained for 90 days. `backup_logs`
health history is retained for 180 days.

Automatic Drive purge only deletes files carrying the ESWake ownership marker.
Legacy SQL files created before this hardening remain untouched and can be
reviewed and removed manually after a newer verified backup exists.

## Staging restore verification

The target database must already have the same migrations as production. Never
run this command against production.

```powershell
$env:BACKUP_RESTORE_DATABASE_URL = "postgresql://...staging..."
$env:ESWAKE_RESTORE_CONFIRM = "STAGING_ONLY"
$env:ESWAKE_ALLOW_REMOTE_STAGING_RESTORE = "YES" # only for a remote staging DB
$env:PRODUCTION_DATABASE_URL = "postgresql://...production..."
npm run verify:backup-restore -- "D:\backups\eswake_backup_....sql"
```

The command restores with `ON_ERROR_STOP` and compares every table count with
the backup manifest. Any SQL error or count mismatch fails the drill.

Run this drill at least quarterly and after schema/backup-format changes.

## Product-image restore verification

Verify local files without writing to Supabase:

```powershell
npm run restore:product-images -- "D:\ESWake-Backups\Storage-Backups\product-images" --verify-only
```

Restore to an explicitly selected recovery project:

```powershell
$env:SUPABASE_URL = "https://recovery-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "..."
$env:ESWAKE_STORAGE_RESTORE_CONFIRM = "RESTORE_PRODUCT_IMAGES"
npm run restore:product-images -- "D:\ESWake-Backups\Storage-Backups\product-images"
```

The script checks each local SHA-256 when present, uploads with `upsert`, then
downloads each object and verifies its SHA-256 again.
Add `--include-deleted` only when intentionally recovering product images that
were deleted from the source within the 90-day retention window.

## Full DR export and cancelling Pro

Supabase database backups include database schemas and Auth data, but do not
include Storage object bytes. Pro physical backups are therefore useful but not
a replacement for this export.

Run quarterly and immediately before cancelling Pro:

```powershell
supabase link --project-ref "<project-ref>"
.\scripts\export-supabase-disaster-recovery.ps1 -OutputRoot "D:\ESWake-DR"
```

Prerequisites: the official Supabase CLI, its Docker requirement, and a linked
project. The script securely prompts for the database password, passes it to
the CLI through `SUPABASE_DB_PASSWORD` rather than a command-line URL, and uses
official `supabase db dump --linked` flows for roles, schema, data, and
migration history. It then downloads all `product-images`, hashes every
artifact, and writes `checksums.sha256`.

Keep the completed DR directory in two locations. A Pro downgrade must not be
treated as complete until this export succeeds.

Full recovery order:

1. Create the replacement Supabase project and restore roles/schema/data using
   the official Supabase restore procedure.
2. Restore migration history.
3. Reapply project-level Auth/provider, API key, SMTP, Realtime, and domain
   settings; those settings are not database dump content.
4. Run `restore:product-images`.
5. Deploy the application with replacement project environment variables.
6. Run SQL and Storage health checks before reopening writes.

## Fully offline recovery

1. From the Backup page, download both the latest SQL backup and
   `eswake-offline.html`.
2. Disconnect networking.
3. Open `eswake-offline.html` directly in a current browser.
4. Import the SQL file.
5. Confirm the displayed backup time, row total, and checksum.
6. Check member lookup, booking search, today's bookings, and tomorrow reminder.

The offline tool stores data only in that browser/device. It never writes back
to production. Import occurs in a staged IndexedDB database and becomes active
only after all manifest row counts match.
