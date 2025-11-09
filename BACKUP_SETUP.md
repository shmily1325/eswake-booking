# Google Sheets 備份設定指南

以下步驟會把系統定期備份資料寫入 Google Sheets。

## 1. 建立 Google Cloud 專案與服務帳號
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選取專案
3. 啟用 **Google Sheets API**
4. 建立服務帳號 (Service Account)
5. 建立 JSON 金鑰並下載保存

## 2. 建立 Google Sheets 試算表
1. 在 Google Drive 建立一份新的 Google Sheet（建議使用共享雲端硬碟 Shared Drive，給予服務帳號權限）
2. 取得試算表 ID：網址 `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
3. 若使用 Shared Drive，確保服務帳號在該共享雲端硬碟擁有至少「內容管理員」權限

## 3. 設定 Vercel 環境變數
在 Vercel 專案的 `Settings -> Environment Variables` 中新增：

| 變數名稱 | 說明 | 範例 |
|----------|------|------|
| `SUPABASE_URL` | Supabase 專案 URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` API key | `eyJhbGciOiJI...` |
| `GOOGLE_CLIENT_EMAIL` | 服務帳號 email | `backup-service@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | 服務帳號私鑰（保留 `-----BEGIN ... END PRIVATE KEY-----`） | `-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | 試算表 ID | `1abc123...XYZ` |

> 若私鑰是單行字串，程式會自動把 `\n` 還原成換行。

## 4. 重新部署
更新環境變數後重新部署或觸發 redeploy。

## 5. 驗證
1. 在前端手動按「備份到 Google Sheets」，確認成功訊息
2. 到試算表檢查是否新增了新的工作表（Sheet tab）
3. Vercel Dashboard → Functions → `api/backup-to-drive` 可查看詳細日誌

## 6. Cron 排程（可選）
`vercel.json` 已設定每日排程：
```json
{
  "crons": [
    {
      "path": "/api/backup-to-drive",
      "schedule": "20 17 * * *"
    }
  ]
}
```
若需調整時間，更新 `schedule` 即可（UTC 時區）。

---

如需進階功能（篩選日期範圍、匯出多種報表）可以在前端頁面直接操作。
