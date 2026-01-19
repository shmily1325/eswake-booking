# 🔐 OAuth 2.0 雲端備份設定指南

## 📋 功能說明

使用 OAuth 2.0 讓應用程式代表用戶存取 Google Drive，可以上傳檔案到用戶的個人 Google Drive 資料夾，**無需 Google Workspace**。

> ⚠️ **注意**：此方案需要用戶授權，適用於需要存取用戶個人 Drive 的場景。

## 🚀 設定步驟

### 步驟 1：建立 OAuth 2.0 憑證

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選取專案
3. 啟用 **Google Drive API**
4. 前往「憑證」頁面
5. 點擊「建立憑證」→「OAuth 用戶端 ID」
6. 如果尚未設定 OAuth 同意畫面，需要先設定：
   - 選擇「外部」使用者類型（除非您有 Google Workspace）
   - 填寫應用程式資訊：
     - 應用程式名稱：`ESWake 備份系統`
     - 使用者支援電子郵件：您的 email（例如：`pjpan0511@gmail.com`）
     - 開發人員連絡資訊：您的 email
   - 新增範圍：`https://www.googleapis.com/auth/drive.file`
   - **新增測試使用者**（**非常重要**，如果應用程式尚未發布）：
     - 在「測試使用者」區塊中，點擊「+ 新增使用者」
     - 輸入您的 Google 帳號 email（例如：`pjpan0511@gmail.com`）
     - 點擊「新增」
     - ⚠️ **重要**：只有列在測試使用者清單中的帳號才能授權應用程式
7. 建立 OAuth 用戶端 ID：
   - 應用程式類型：選擇「網頁應用程式」
   - 名稱：`ESWake Backup`
   - **已授權的重新導向 URI**（**非常重要**，必須完全匹配）：
     - **生產環境**：`https://eswake-booking.vercel.app/api/oauth2-callback`
     - 開發環境（可選）：`http://localhost:3000/api/oauth2-callback`
     - ⚠️ **注意**：
       - URI 必須**完全匹配**，包括 `https://` 和結尾的 `/api/oauth2-callback`
       - 不要有多餘的斜線或空格
       - 如果使用自訂網域，請使用自訂網域的完整 URL
8. 點擊「建立」
9. 複製「用戶端 ID」和「用戶端密鑰」

> 💡 **提示**：如果之後遇到 `redirect_uri_mismatch` 錯誤，請檢查：
> - Google Cloud Console 中的重定向 URI 是否與實際使用的完全一致
> - 可以在 Vercel 環境變數中設定 `GOOGLE_OAUTH_REDIRECT_URI` 來明確指定

### 步驟 2：設定初始環境變數

在 Vercel 專案的 `Settings -> Environment Variables` 中先設定：

| 變數名稱 | 說明 | 範例 | 必填 |
|----------|------|------|------|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth 2.0 用戶端 ID | `123456789-abc.apps.googleusercontent.com` | ✅ |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth 2.0 用戶端密鑰 | `GOCSPX-xxxxx` | ✅ |
| `GOOGLE_OAUTH_REDIRECT_URI` | 重新導向 URI（**強烈建議設定**，避免 redirect_uri_mismatch 錯誤） | `https://eswake-booking.vercel.app/api/oauth2-callback` | ⚠️ 建議 |

> 💡 **建議**：設定 `GOOGLE_OAUTH_REDIRECT_URI` 可以確保重定向 URI 固定，避免因為請求頭變化而導致的 `redirect_uri_mismatch` 錯誤。此 URI 必須與 Google Cloud Console 中配置的「已授權的重新導向 URI」**完全一致**。

### 步驟 2.5：重新部署應用程式

> ⚠️ **重要**：新增 API 端點後，**必須重新部署**才能使用新的端點。

1. 確認 `api/oauth2-auth-url.ts` 和 `api/oauth2-callback.ts` 檔案已提交到 Git
2. 在 Vercel Dashboard 中：
   - 前往專案頁面
   - 點擊「Deployments」標籤
   - 點擊最新的部署旁邊的「⋯」選單
   - 選擇「Redeploy」
   - 或推送新的 commit 到 Git 觸發自動部署
3. 等待部署完成（通常需要 1-2 分鐘）

### 步驟 3：取得授權 URL

1. **確認部署完成後**，訪問以下 URL 取得授權連結：

```
https://eswake-booking.vercel.app/api/oauth2-auth-url
```

> 💡 **提示**：如果看到 404 錯誤，請確認：
> - 已重新部署應用程式（步驟 2.5）
> - 檔案 `api/oauth2-auth-url.ts` 存在於專案中
> - 等待幾分鐘讓 Vercel 完成部署

2. 回應會包含 `authUrl`，複製此 URL

3. 在瀏覽器中開啟此 URL

4. 登入您的 Google 帳號

5. 授權應用程式存取 Google Drive

6. 授權後，瀏覽器會重新導向到回調端點，並顯示刷新令牌

### 步驟 4：取得刷新令牌

授權完成後，您會看到一個 JSON 回應，包含：

```json
{
  "success": true,
  "message": "✅ 成功取得刷新令牌！",
  "tokens": {
    "refresh_token": "1//0xxxxx...",
    "access_token": "ya29.xxxxx...",
    "expiry_date": 1234567890
  },
  "instructions": {
    "step1": "請將以下刷新令牌複製到 Vercel 環境變數：",
    "step2": "變數名稱：GOOGLE_OAUTH_REFRESH_TOKEN",
    "step3": "變數值：1//0xxxxx...",
    "step4": "更新環境變數後重新部署",
    "note": "⚠️ 刷新令牌只會顯示一次，請妥善保存！"
  }
}
```

> ⚠️ **重要**：請立即複製 `refresh_token` 的值，它只會顯示一次！

### 步驟 5：設定完整的 Vercel 環境變數

在 Vercel 專案的 `Settings -> Environment Variables` 中新增或確認以下變數：

| 變數名稱 | 說明 | 範例 |
|----------|------|------|
| `SUPABASE_URL` | Supabase 專案 URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` API key | `eyJhbGciOiJI...` |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth 2.0 用戶端 ID | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth 2.0 用戶端密鑰 | `GOCSPX-xxxxx` |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | 刷新令牌（從步驟 4 取得） | `1//0xxxxx` |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive 資料夾 ID | `1abc123...XYZ` |

> ⚠️ **重要**：`GOOGLE_OAUTH_REFRESH_TOKEN` 是長期有效的令牌，請妥善保管。

> 💡 **提示**：`api/backup-to-cloud-drive.ts` 已支援 OAuth 2.0，會自動偵測並使用 OAuth 2.0 憑證（如果已設定）。

### 步驟 6：建立 Google Drive 資料夾

1. 在您的 Google Drive 建立一個資料夾（例如：`ESWake 資料庫備份`）
2. 取得資料夾 ID：
   - 開啟資料夾
   - 網址格式：`https://drive.google.com/drive/folders/<FOLDER_ID>`
   - 複製 `<FOLDER_ID>` 部分
3. 將 `GOOGLE_DRIVE_FOLDER_ID` 設定為此資料夾 ID

### 步驟 7：重新部署

更新環境變數後重新部署或觸發 redeploy。

### 步驟 8：驗證

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

## 🔐 安全建議

1. **保護 OAuth 憑證**：
   - 不要將 `GOOGLE_OAUTH_CLIENT_SECRET` 和 `GOOGLE_OAUTH_REFRESH_TOKEN` 公開
   - 只在 Vercel 環境變數中儲存

2. **刷新令牌安全**：
   - 刷新令牌是長期有效的，可以存取用戶的 Google Drive
   - 如果洩露，請立即撤銷：
     - 前往 [Google 帳號設定](https://myaccount.google.com/permissions)
     - 找到「第三方應用程式和服務」
     - 撤銷應用程式存取權限

3. **定期檢查備份**：
   - 確認備份檔案正常上傳
   - 檢查 Vercel 函數日誌

## 🆘 故障排除

### 問題 0：404 錯誤（端點找不到）

**錯誤**：`404: NOT_FOUND` 當訪問 `/api/oauth2-auth-url` 或 `/api/oauth2-callback`

**解決**：
1. **確認檔案存在**：檢查 `api/oauth2-auth-url.ts` 和 `api/oauth2-callback.ts` 是否在專案中
2. **重新部署**：
   - 在 Vercel Dashboard 中觸發重新部署
   - 或推送新的 commit 到 Git
3. **等待部署完成**：通常需要 1-2 分鐘
4. **檢查部署日誌**：確認沒有編譯錯誤
5. **確認檔案路徑**：Vercel 的 API 路由應該在 `api/` 目錄下，檔名應該與路由一致

### 問題 0.5：redirect_uri_mismatch 錯誤

**錯誤**：`Error 400: redirect_uri_mismatch` 當嘗試授權時

**原因**：Google Cloud Console 中配置的重定向 URI 與實際使用的不一致。

**解決步驟**：

1. **確認實際使用的重定向 URI**：
   - 訪問 `https://eswake-booking.vercel.app/api/oauth2-auth-url`
   - 複製返回的 `authUrl`
   - 在瀏覽器中開啟 `authUrl`，查看錯誤訊息中顯示的實際 URI
   - 或檢查瀏覽器網址列中的 `redirect_uri` 參數

2. **在 Google Cloud Console 中添加正確的 URI**：
   - 前往 [Google Cloud Console](https://console.cloud.google.com/)
   - 選擇您的專案
   - 前往「API 和服務」→「憑證」
   - 找到您的 OAuth 2.0 用戶端 ID，點擊編輯（鉛筆圖示）
   - 在「已授權的重新導向 URI」中，**確保包含以下 URI**：
     ```
     https://eswake-booking.vercel.app/api/oauth2-callback
     ```
   - ⚠️ **重要**：
     - URI 必須**完全匹配**，包括協議（`https://`）、網域、路徑
     - 不要有多餘的斜線、空格或參數
     - 如果使用自訂網域，請使用自訂網域的完整 URL
   - 點擊「儲存」

3. **（可選）設定環境變數明確指定**：
   - 在 Vercel 環境變數中新增：
     - 變數名稱：`GOOGLE_OAUTH_REDIRECT_URI`
     - 變數值：`https://eswake-booking.vercel.app/api/oauth2-callback`
   - 這樣可以確保使用固定的 URI，不會因為請求頭而變化

4. **等待幾分鐘**：
   - Google Cloud Console 的變更可能需要幾分鐘才會生效

5. **重新嘗試**：
   - 清除瀏覽器快取（可選）
   - 重新訪問 `https://eswake-booking.vercel.app/api/oauth2-auth-url`
   - 複製新的 `authUrl` 並在瀏覽器中開啟

### 問題 1：access_denied 錯誤（應用程式未驗證）

**錯誤**：`Error 403: access_denied` 或 `eswake-booking.vercel.app has not completed the Google verification process`

**原因**：應用程式處於測試階段，只有列在測試使用者清單中的帳號才能授權。

**解決步驟**：

1. **前往 OAuth 同意畫面設定**：
   - 前往 [Google Cloud Console](https://console.cloud.google.com/)
   - 選擇您的專案
   - 前往「API 和服務」→「OAuth 同意畫面」

2. **添加測試使用者**：
   - 在「測試使用者」區塊中，點擊「+ 新增使用者」
   - 輸入您的 Google 帳號 email（例如：`pjpan0511@gmail.com`）
   - 點擊「新增」
   - ⚠️ **重要**：只有列在測試使用者清單中的帳號才能授權應用程式
   - 最多可以添加 100 個測試使用者

3. **等待幾分鐘**：
   - 變更可能需要幾分鐘才會生效

4. **重新嘗試授權**：
   - 清除瀏覽器快取（可選）
   - 重新訪問 `https://eswake-booking.vercel.app/api/oauth2-auth-url`
   - 複製新的 `authUrl` 並在瀏覽器中開啟
   - 現在應該可以正常授權了

**替代方案：發布應用程式**（進階）：
- 如果應用程式已經準備好，可以申請發布
- 發布後，任何用戶都可以授權，不需要測試使用者清單
- 但需要通過 Google 的驗證流程（可能需要幾天時間）

### 問題 1.5：其他授權失敗錯誤

**錯誤**：`invalid_grant` 或其他授權錯誤

**解決**：
1. 確認 OAuth 用戶端 ID 和密鑰正確
2. 確認重新導向 URI 與設定一致
3. 確認授權碼未過期（授權碼只能使用一次）
4. 確認您已在測試使用者清單中（如果應用程式處於測試階段）

### 問題 2：刷新令牌過期（每 7 天或兩周失效）

**錯誤**：`invalid_grant: Token has been expired or revoked`

**原因**：
如果您的 OAuth 同意畫面還在「Testing / 測試」狀態，而且使用的是 External user type，Google 發的 refresh token **每 7 天**就會過期。這是 Google 的安全政策，用於限制未發布應用程式的令牌有效期。

**臨時解決方案**（每 7 天需要重新授權）：
1. 重新執行步驟 2-3 取得新的刷新令牌
2. 更新 Vercel 環境變數 `GOOGLE_OAUTH_REFRESH_TOKEN`
3. 重新部署

**永久解決方案**（推薦）：
將應用程式從「測試」狀態改為「發布」狀態，這樣刷新令牌就不會每 7 天過期了。詳見下方「問題 2.5：如何發布應用程式」。

### 問題 3：無法上傳檔案

**錯誤**：`Permission denied`

**解決**：
1. 確認 `GOOGLE_DRIVE_FOLDER_ID` 正確
2. 確認資料夾存在且可存取
3. 確認 OAuth 範圍包含 `https://www.googleapis.com/auth/drive.file`

### 問題 2.5：如何發布應用程式（解決刷新令牌每 7 天過期問題）

**為什麼要發布**：
- 測試狀態下的刷新令牌每 7 天就會過期
- 發布後，刷新令牌可以長期有效（除非被撤銷）
- 發布後，任何用戶都可以授權，不需要測試使用者清單

**發布步驟**：

1. **前往 OAuth 同意畫面設定**：
   - 前往 [Google Cloud Console](https://console.cloud.google.com/)
   - 選擇您的專案
   - 前往「API 和服務」→「OAuth 同意畫面」

2. **檢查發布狀態**：
   - 如果看到「應用程式未發布」或「Testing」狀態，需要發布
   - 如果已經發布，刷新令牌應該不會每 7 天過期

3. **準備發布**：
   - 確保應用程式資訊完整：
     - 應用程式名稱
     - 使用者支援電子郵件
     - 開發人員連絡資訊
     - 應用程式首頁連結（可選）
     - 應用程式隱私權政策連結（**建議提供**）
     - 應用程式服務條款連結（可選）
   - 確保所有必要的範圍都已添加
   - 確保測試使用者清單已設定（發布前仍需要）

4. **提交驗證**（如果需要）：
   - 如果您的應用程式請求敏感或高風險的 scope（如 `https://www.googleapis.com/auth/drive.file`），Google 可能會要求驗證
   - 點擊「發布應用程式」或「提交驗證」
   - 填寫驗證表單：
     - 應用程式類型：選擇「內部」或「外部」
     - 使用案例說明
     - 資料使用說明
   - 提交後，Google 會審核（可能需要幾天到幾週）

5. **發布應用程式**：
   - 如果不需要驗證，或驗證通過後，可以將應用程式設為「發布」狀態
   - 在 OAuth 同意畫面中，將「發布狀態」從「測試」改為「發布」
   - 確認發布

6. **重新取得刷新令牌**：
   - 發布後，需要重新授權以取得新的刷新令牌
   - 重新執行步驟 2-3 取得新的刷新令牌
   - 更新 Vercel 環境變數 `GOOGLE_OAUTH_REFRESH_TOKEN`
   - 重新部署

7. **驗證**：
   - 等待一段時間（例如 8-10 天）確認刷新令牌沒有過期
   - 如果備份仍然正常，表示問題已解決

> ⚠️ **注意**：
> - 發布應用程式後，任何用戶都可以授權，請確保應用程式安全
> - 如果 Google 要求驗證，可能需要提供隱私權政策和使用說明
> - 驗證過程可能需要幾天到幾週，請耐心等待

### 問題 4：授權碼只能使用一次

**錯誤**：`invalid_grant: Code was already redeemed`

**解決**：
- 授權碼只能使用一次，如果已經使用過，需要重新取得授權碼
- 重新執行步驟 2-3

## 📝 注意事項

1. **首次授權**：
   - 首次授權時，需要用戶手動授權
   - 取得刷新令牌後，可以自動使用，無需再次授權

2. **令牌有效期**：
   - 訪問令牌（access token）有效期約 1 小時
   - 刷新令牌（refresh token）有效期：
     - **測試狀態**：每 7 天過期（需要重新授權）
     - **發布狀態**：長期有效，除非被撤銷或超過 6 個月未使用
   - 應用程式會自動使用刷新令牌取得新的訪問令牌

3. **OAuth 同意畫面**：
   - 如果應用程式尚未發布（測試狀態）：
     - 只能新增最多 100 個測試使用者
     - **刷新令牌每 7 天過期**（這是 Google 的安全政策）
   - 發布應用程式後：
     - 任何用戶都可以授權
     - 刷新令牌可以長期有效
     - 建議發布應用程式以避免頻繁重新授權

4. **與服務帳號的差異**：
   - OAuth 2.0 代表用戶存取，使用用戶的儲存配額
   - 服務帳號有自己的配額限制（無法在共享資料夾中建立檔案）

## 📚 相關文檔

- [完整備份策略](./BACKUP_STRATEGY.md)
- [自動備份到 WD MY BOOK](./AUTO_BACKUP_SETUP.md)
- [雲端備份設定（服務帳號）](./CLOUD_BACKUP_SETUP.md)

## 🎯 快速開始

1. **建立 OAuth 2.0 憑證**（步驟 1）
2. **設定初始環境變數**（步驟 2）
3. **取得授權 URL 並授權**（步驟 3）
4. **取得刷新令牌**（步驟 4）
5. **設定完整環境變數**（步驟 5）
6. **建立 Google Drive 資料夾**（步驟 6）
7. **重新部署並驗證**（步驟 7-8）

完成以上步驟後，系統會自動使用 OAuth 2.0 認證上傳備份檔案到您的 Google Drive！

