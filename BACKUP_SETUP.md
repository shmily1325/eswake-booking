# Google Drive 備份設定指南

本指南將幫助您設定定期自動備份資料庫資料到 Google Drive 的功能。

## 📋 前置需求

1. Google Cloud Platform (GCP) 帳號
2. Vercel 部署環境（已設定）
3. Supabase 專案（已設定）

## 🔧 設定步驟

### 1. 建立 Google Cloud 專案並啟用 Google Drive API

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 **Google Drive API**：
   - 在左側選單選擇「API 和服務」→「程式庫」
   - 搜尋「Google Drive API」
   - 點擊「啟用」

### 2. 建立服務帳號 (Service Account)

1. 在 Google Cloud Console 中，前往「API 和服務」→「憑證」
2. 點擊「建立憑證」→「服務帳號」
3. 填寫服務帳號資訊：
   - **服務帳號名稱**：例如 `database-backup`
   - **服務帳號 ID**：會自動產生
   - **說明**：用於資料庫備份
4. 點擊「建立並繼續」
5. 在「授予此服務帳號存取專案的權限」步驟中，可以跳過（選擇「繼續」）
6. 點擊「完成」

### 3. 建立服務帳號金鑰

1. 在「憑證」頁面，找到剛建立的服務帳號
2. 點擊服務帳號名稱進入詳細頁面
3. 切換到「金鑰」標籤
4. 點擊「新增金鑰」→「建立新金鑰」
5. 選擇「JSON」格式
6. 下載 JSON 檔案（會自動下載到您的電腦）

### 4. 取得服務帳號資訊

開啟下載的 JSON 檔案，您會看到類似以下的內容：

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  ...
}
```

請記下：
- `client_email`：這是您的服務帳號電子郵件
- `private_key`：這是私鑰（包含換行符號 `\n`）

### 5. 建立 Google Drive 資料夾並分享給服務帳號

1. 在 Google Drive 中建立一個新資料夾（例如：`資料庫備份`）
2. 右鍵點擊資料夾 →「共用」
3. 在「新增使用者和群組」欄位中，貼上服務帳號的電子郵件（步驟 4 的 `client_email`）
4. 將權限設為「編輯者」
5. 點擊「傳送」（不需要通知）
6. 取得資料夾 ID：
   - 在 Google Drive 中開啟該資料夾
   - 查看網址列，網址格式為：`https://drive.google.com/drive/folders/FOLDER_ID`
   - 複製 `FOLDER_ID` 部分

### 6. 取得 Supabase Service Role Key

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 前往「Settings」→「API」
4. 在「Project API keys」區塊找到 **`service_role`** key（⚠️ 注意：這是機密金鑰，請勿在前端使用）
5. 複製 `service_role` key

### 7. 設定 Vercel 環境變數

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 前往「Settings」→「Environment Variables」
4. 新增以下環境變數：

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `VITE_SUPABASE_URL`` | `https://your-project.supabase.co` | Supabase 專案 URL（如果尚未設定） |
| `SUPABASE_URL` | `https://your-project.supabase.co` | Supabase 專案 URL（API 路由使用） |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` | Supabase Service Role Key（步驟 6） |
| `GOOGLE_CLIENT_EMAIL` | `your-service-account@project.iam.gserviceaccount.com` | Google 服務帳號電子郵件（步驟 4） |
| `GOOGLE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` | Google 服務帳號私鑰（步驟 4，完整包含換行符號） |
| `GOOGLE_DRIVE_FOLDER_ID` | `your-folder-id` | Google Drive 資料夾 ID（步驟 5） |

**重要提示：**
- `GOOGLE_PRIVATE_KEY` 必須包含完整的私鑰，包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`
- 如果私鑰中有 `\n`，請保留它們（Vercel 會自動處理）
- 或者，您可以將整個私鑰放在一行，API 會自動處理換行符號

### 8. 重新部署專案

在 Vercel 中：
1. 前往「Deployments」標籤
2. 點擊最新部署右側的「⋯」選單
3. 選擇「Redeploy」
4. 確認環境變數已正確設定

## ⏰ 自動備份排程

系統已設定為每天 **凌晨 2 點（UTC）** 自動執行備份。

如需修改排程，請編輯 `vercel.json` 中的 `crons` 設定：

```json
{
  "crons": [
    {
      "path": "/api/backup-to-drive",
      "schedule": "0 2 * * *"  // Cron 格式：分 時 日 月 星期
    }
  ]
}
```

### Cron 排程格式說明

格式：`分 時 日 月 星期`

範例：
- `0 2 * * *` - 每天凌晨 2 點
- `0 */6 * * *` - 每 6 小時
- `0 0 * * 0` - 每週日午夜
- `0 2 1 * *` - 每月 1 號凌晨 2 點

## 🧪 測試備份功能

1. 前往應用程式的「匯出」頁面
2. 點擊「☁️ 備份到 Google Drive」按鈕
3. 如果設定正確，您應該會看到成功訊息，並可以開啟 Google Drive 檔案連結

## 🔍 疑難排解

### 錯誤：Missing Google Drive credentials
- 檢查所有 Google Drive 相關環境變數是否已設定
- 確認環境變數名稱拼寫正確

### 錯誤：Missing Supabase credentials
- 檢查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 是否已設定
- 確認 Service Role Key 是正確的（不是 anon key）

### 錯誤：Permission denied
- 確認服務帳號已獲得 Google Drive 資料夾的「編輯者」權限
- 確認資料夾 ID 正確

### 備份檔案沒有出現在 Google Drive
- 檢查服務帳號是否有資料夾存取權限
- 確認資料夾 ID 正確
- 檢查 Vercel 函數日誌以查看詳細錯誤訊息

### Cron Job 沒有執行
- 確認 Vercel 專案已升級到 Pro 方案（Cron Jobs 需要 Pro 方案）
- 檢查 `vercel.json` 中的 cron 設定格式是否正確
- 查看 Vercel Dashboard 中的 Cron Jobs 執行記錄

## 📝 備註

- 備份檔案會以 `自動備份_預約備份_YYYY-MM-DD_HHMM.csv` 或 `手動備份_預約備份_YYYY-MM-DD_HHMM.csv` 格式命名
- 所有備份檔案都會上傳到您指定的 Google Drive 資料夾
- 建議定期檢查備份是否正常執行
- 可以透過 Vercel Dashboard 查看函數執行日誌

