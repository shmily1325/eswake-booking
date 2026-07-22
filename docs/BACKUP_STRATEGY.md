# ESWake backup strategy

## Recovery objectives

- Operational data and product images have two application-managed copies:
  Google Drive and a Windows external drive.
- A healthy destination has a verified success less than 26 hours old.
- SQL and image copies are retained for 90 days; health logs for 180 days.
- Supabase Pro physical backups are a third layer, not a dependency.

## Scheduled copies

| Taiwan time | Destination | Content |
| --- | --- | --- |
| 02:00 | Google Drive | Data-only SQL, manifest, SHA-256 |
| 02:30 | Google Drive | Incremental `product-images` objects and manifest |
| 10:00 | Windows external drive | SQL plus incremental product-image mirror |

The Windows task runs only while its Windows user is logged in. The Backup admin
page reports database and product-image health independently for each
destination.

## What each layer restores

- Data-only SQL restores the operational public tables after the same migrations
  have been applied.
- `product-images` manifests restore Supabase Storage bytes and repair public
  URLs when the target project URL changes.
- The quarterly DR export contains roles, schema, data including Auth records,
  migration history, Storage bytes, and checksums.
- Source-controlled static assets and migrations are restored from Git.

`user_click_events` is intentionally excluded because it is disposable
analytics data. `coach_report_logs` was removed by migration 084.

## Full disaster recovery

Run `scripts/export-supabase-disaster-recovery.ps1` quarterly and before
cancelling Supabase Pro. Follow [`BACKUP_RUNBOOK.md`](BACKUP_RUNBOOK.md) for
guarded SQL and Storage restore commands.
