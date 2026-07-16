# Backup and offline recovery runbook

## Required secrets

- Vercel: set a high-entropy `CRON_SECRET`. Vercel Cron sends it as
  `Authorization: Bearer ...`.
- Windows Task Scheduler: set `ESWAKE_BACKUP_SECRET` to the same value.
- Keep `ESWAKE_API_URL` and `WD_MY_BOOK_PATH` in the scheduled task environment.
- Never put any of these values in source control or command files.

After changing `CRON_SECRET`, update Vercel and the WD scheduled task together,
then run both jobs manually once.

## Daily health criteria

A healthy system has successful `google_drive` and `wd_local` records less than
26 hours old. Each successful record must have:

- backup format version;
- exact byte count;
- SHA-256 checksum;
- per-table row counts in the embedded manifest.

The WD directory contains both `.sql` and matching `.sql.sha256` files. A `.tmp`
file is never considered a backup.

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
