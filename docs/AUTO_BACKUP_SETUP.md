# Windows desktop backup setup

The portable installer requires no Node.js installation and does not copy a
secret into source files.

1. Copy and unzip `ESWake-Backup-Installer.zip`.
2. Connect the external drive.
3. Run `install-portable-backup.cmd`.
4. Select the drive, confirm the deployment URL, and paste the same value used
   for Vercel `CRON_SECRET`.
5. Wait for the immediate database and `product-images` backup tests.

The installer creates `ESWake 自動備份` in Windows Task Scheduler:

- Daily at 10:00 local time.
- Runs only while that Windows user is logged in.
- Saves the secret with Windows DPAPI for that user.
- Retains SQL and deleted product-image copies for 90 days.

Files are stored under:

```text
X:\ESWake-Backups\
├── Full-Database-Backups\
│   ├── eswake_backup_....sql
│   └── eswake_backup_....sql.sha256
├── Storage-Backups\
│   └── product-images\
│       ├── manifest.json
│       └── files\
└── backup-log.txt
```

If the drive is disconnected or the user is logged out, that day's task is
skipped or fails. The admin Backup page detects the missing verified success
after 26 hours.
