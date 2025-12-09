# ☁️ 雲端完整資料庫備份設定指南

## 📋 功能說明

這個功能會將完整資料庫備份（SQL 檔案）自動上傳到 Google Drive，**無需電腦開機**。

## 🚀 設定步驟

### 步驟 1：建立 Google Cloud 專案與服務帳號

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選取專案
3. 啟用 **Google Drive API**（不是 Google Sheets API）
4. 建立服務帳號 (Service Account)
5. 建立 JSON 金鑰並下載保存

### 步驟 2：建立 Google Drive 資料夾

1. 在 Google Drive 建立一個新的資料夾（例如：`ESWake 資料庫備份`）
2. 取得資料夾 ID：
   - 開啟資料夾
   - 網址格式：`https://drive.google.com/drive/folders/<FOLDER_ID>`
   - 複製 `<FOLDER_ID>` 部分
3. 將服務帳號的 email 加入資料夾的「共用」設定，給予「編輯者」權限

### 步驟 3：設定 Vercel 環境變數

在 Vercel 專案的 `Settings -> Environment Variables` 中新增：

| 變數名稱 | 說明 | 範例 |
|----------|------|------|
| `SUPABASE_URL` | Supabase 專案 URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` API key | `eyJhbGciOiJI...` |
| `GOOGLE_CLIENT_EMAIL` | 服務帳號 email | `backup-service@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | 服務帳號私鑰（保留 `-----BEGIN ... END PRIVATE KEY-----`） | `-----BEGIN PRIVATE KEY-----<br>...<br>-----END PRIVATE KEY-----` |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive 資料夾 ID（可選，不設定會上傳到服務帳號的根目錄） | `1abc123...XYZ` |

> 若私鑰是單行字串，程式會自動把 `\n` 還原成換行。

### 步驟 4：重新部署

更新環境變數後重新部署或觸發 redeploy。

### 步驟 5：驗證

1. 在前端手動按「☁️ 備份到 Google Drive (SQL)」，確認成功訊息
2. 到 Google Drive 資料夾檢查是否新增了 SQL 檔案
3. Vercel Dashboard → Functions → `api/backup-to-cloud-drive` 可查看詳細日誌

## 🔄 自動備份排程

`vercel.json` 已設定每日自動備份：

```json
{
  "crons": [
    {
      "path": "/api/backup-to-cloud-drive",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- **執行時間**：每天 UTC 02:00（台灣時間 10:00）
- **備份內容**：完整資料庫（所有表）
- **檔案格式**：SQL 檔案
- **自動清理**：自動刪除超過 90 天的舊備份

## 📁 備份檔案命名

備份檔案會以以下格式命名：
```
eswake_backup_2025-12-09T10-00-00.sql
```

## 🗑️ 自動清理

系統會自動：
- 保留最近 90 天的備份
- 自動刪除超過 90 天的舊備份
- 在 Google Drive 中管理備份檔案

## 💡 優點

1. **無需電腦開機**：雲端自動備份
2. **完整資料庫**：包含所有表和數據
3. **自動清理**：自動刪除舊備份，節省空間
4. **易於恢復**：SQL 檔案可直接導入恢復

## 🔐 安全建議

1. **保護服務帳號金鑰**：不要將 JSON 金鑰公開
2. **限制資料夾權限**：只給服務帳號必要的權限
3. **定期檢查備份**：確認備份檔案正常上傳

## 🆘 故障排除

### 問題 1：上傳失敗

**錯誤**：`Missing Google Drive credentials`

**解決**：
1. 檢查所有環境變數是否正確設定
2. 確認 Google Drive API 已啟用
3. 檢查服務帳號權限

### 問題 2：無法上傳到資料夾

**錯誤**：`Permission denied`

**解決**：
1. 確認服務帳號 email 已加入資料夾的「共用」設定
2. 確認服務帳號有「編輯者」權限
3. 檢查 `GOOGLE_DRIVE_FOLDER_ID` 是否正確

### 問題 3：備份檔案為空

**解決**：
1. 檢查 Supabase 連接是否正常
2. 查看 Vercel 函數日誌
3. 確認資料庫中有資料

---

## 📚 相關文檔

- [完整備份策略](./BACKUP_STRATEGY.md)
- [自動備份到 WD MY BOOK](./AUTO_BACKUP_SETUP.md)

