# ESWake backup strategy

## Recovery objectives

- Operational data and product images have two application-managed copies:
  Google Drive and a Windows external drive.
- Google Drive database health is green through 26 hours, yellow through 50
  hours, and red after 50 hours without a verified success.
- Product-image health is normal through seven days, yellow after seven days,
  and red after 30 days without a complete verified success.
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
destination. Unconfigured Windows copies show `未設定` and remain secondary.

The BAO hub uses only the Google Drive database as its primary backup badge.
Google Drive image health is displayed separately and does not turn the primary
badge yellow or red. Likewise, desktop health never changes the BAO badge.
Resumable image `running` rows are informational; one image failure remains
informational while a recent complete image backup is recoverable. Sustained
image failures are yellow. For database backups, one failed attempt is yellow
and two consecutive failed daily cycles are red; retries on the same date count
as one cycle, and intervening `running` rows neither count as failures nor reset
that streak.

## What each layer restores

- Data-only SQL format v4 restores the operational public tables, including the
  `credit_lots` yearly voucher ledger, after the same migrations have been applied.
- Earlier v3 files predate the `credit_lots` contract and must not be treated as
  complete current recovery points.
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
