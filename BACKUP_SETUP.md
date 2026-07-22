# ESWake 備份設定入口

舊版 Google Sheets 備份已停用。現行系統使用：

- Google Drive SQL：每天台灣時間 02:00
- Google Drive 商品圖片：每天 02:30 增量同步
- Windows 桌機 SQL＋商品圖片：每天 10:00，未登入則略過

設定與還原請以 [`docs/BACKUP_RUNBOOK.md`](docs/BACKUP_RUNBOOK.md) 為準。

Windows 桌機只需解壓 `ESWake-Backup-Installer.zip`，插入備份硬碟，
再執行 `install-portable-backup.cmd`。安裝程式會要求貼上與 Vercel
`CRON_SECRET` 相同的密鑰，完成後立即測試資料庫和商品圖片備份。
