# Windows backup scripts

Use the portable package at the repository root:

```text
ESWake-Backup-Installer.zip
```

After extraction, run `install-portable-backup.cmd`. The companion
`portable-backup-installer.ps1` installs a self-contained PowerShell worker
under `%LOCALAPPDATA%\ESWakeBackup`; the repository and Node.js are not needed
on the destination computer.

The older `auto-backup-to-wd.cjs`, `.bat`, and `setup-auto-backup.ps1` remain
for existing installations only. New installations must use the portable
installer because it includes DPAPI secret storage, SQL checksum validation,
product-image mirroring, and the 10:00 Task Scheduler configuration.

Operational and recovery instructions are in
[`../docs/BACKUP_RUNBOOK.md`](../docs/BACKUP_RUNBOOK.md).
