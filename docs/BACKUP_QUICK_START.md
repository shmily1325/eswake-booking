# Backup quick start

## Daily status

Open the admin Backup page. It shows four independent checks:

- Google Drive database
- Google Drive product images
- Windows database
- Windows product images

Green means a verified success within 26 hours. A Windows item shows `未設定`
until that computer completes its first backup.

## Windows installation

1. Copy and unzip `ESWake-Backup-Installer.zip`.
2. Connect the external backup drive.
3. Run `install-portable-backup.cmd`.
4. Select the drive and paste the Vercel `CRON_SECRET`.
5. Wait for the immediate SQL and product-image tests to pass.

The task then runs daily at 10:00 while that Windows user is logged in.

## Manual recovery checks

```powershell
npm run verify:backup-restore -- "D:\ESWake-Backups\Full-Database-Backups\eswake_backup_....sql"
npm run restore:product-images -- "D:\ESWake-Backups\Storage-Backups\product-images" --verify-only
```

See [`BACKUP_RUNBOOK.md`](BACKUP_RUNBOOK.md) before writing to any recovery
database or Storage bucket.
