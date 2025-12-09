# 🔄 ESWake 自動備份到 WD MY BOOK

這個腳本可以自動將完整資料庫備份保存到 WD MY BOOK 硬碟。

## 📋 前置要求

1. **Node.js**：需要安裝 Node.js（建議 v14 或更高版本）
   - 下載：https://nodejs.org/
   - 驗證：在命令列執行 `node --version`

2. **WD MY BOOK 硬碟**：確保硬碟已連接並可以存取

## 🚀 快速開始

### 步驟 1：配置參數

編輯 `scripts/auto-backup-to-wd.cjs`，修改以下配置：

```javascript
// 1. API 端點（你的 Vercel 部署地址）
const API_URL = 'https://your-app.vercel.app/api/backup-full-database';

// 2. WD MY BOOK 硬碟路徑
const WD_MY_BOOK_PATH = 'E:\\ESWake-Backups';  // 修改為你的硬碟路徑

// 3. 備份保留天數
const KEEP_DAYS = 90;  // 保留 90 天的備份
```

### 步驟 2：測試執行

在命令列中執行：

```bash
node scripts/auto-backup-to-wd.cjs
```

如果成功，你應該看到：
- ✅ 備份檔案下載到 WD MY BOOK
- ✅ 備份檔案保存在 `E:\ESWake-Backups\Full-Database-Backups\` 目錄

### 步驟 3：設定自動備份（Windows 工作排程器）

#### 方法 A：使用批次處理檔案（推薦）

1. **建立工作排程器工作**
   - 開啟「工作排程器」（Task Scheduler）
   - 點擊「建立基本工作」

2. **配置工作**
   - 名稱：`ESWake 自動備份`
   - 觸發程序：選擇「每天」或「每週」
   - 時間：建議設定為凌晨 2:00（系統空閒時）

3. **動作設定**
   - 動作：啟動程式
   - 程式或腳本：`C:\path\to\your\project\scripts\auto-backup-to-wd.bat`
   - 起始於：`C:\path\to\your\project`

4. **條件設定**
   - ✅ 只有在電腦使用交流電源時才啟動（如果是筆記型電腦）
   - ✅ 喚醒電腦執行此工作

5. **設定**
   - ✅ 允許按需執行工作
   - ✅ 如果工作失敗，重新啟動工作（最多 3 次）

#### 方法 B：使用 PowerShell 腳本

建立一個 PowerShell 腳本 `auto-backup-scheduled.ps1`：

```powershell
# 切換到專案目錄
Set-Location "C:\path\to\your\project"

# 執行備份腳本
node scripts/auto-backup-to-wd.cjs
```

然後在工作排程器中執行這個 PowerShell 腳本。

---

## 📁 備份檔案結構

備份檔案會保存在以下目錄結構：

```
E:\ESWake-Backups\
├── Full-Database-Backups\
│   ├── eswake_backup_2025-01-15_02-00-00.sql
│   ├── eswake_backup_2025-01-16_02-00-00.sql
│   └── ...
└── backup-log.txt  (備份日誌)
```

---

## ⚙️ 環境變數配置（可選）

你可以透過環境變數覆蓋腳本中的配置：

```bash
# Windows (CMD)
set ESWAKE_API_URL=https://your-app.vercel.app/api/backup-full-database
set WD_MY_BOOK_PATH=E:\ESWake-Backups
set BACKUP_KEEP_DAYS=90
set VERBOSE=true

# Windows (PowerShell)
$env:ESWAKE_API_URL="https://your-app.vercel.app/api/backup-full-database"
$env:WD_MY_BOOK_PATH="E:\ESWake-Backups"
$env:BACKUP_KEEP_DAYS="90"
$env:VERBOSE="true"
```

---

## 🔍 故障排除

### 問題 1：找不到 Node.js

**錯誤**：`'node' 不是內部或外部命令`

**解決**：
1. 確認 Node.js 已安裝
2. 將 Node.js 新增到系統 PATH
3. 或在批次處理檔案中指定完整路徑：`set NODE_PATH=C:\Program Files\nodejs\node.exe`

### 問題 2：WD MY BOOK 路徑不存在

**錯誤**：`WD MY BOOK 路徑不存在`

**解決**：
1. 確認硬碟已連接
2. 檢查硬碟磁碟機代號（可能是 E:、F:、G: 等）
3. 修改腳本中的 `WD_MY_BOOK_PATH` 配置

### 問題 3：API 請求失敗

**錯誤**：`下載失敗: HTTP 404` 或 `下載失敗: HTTP 500`

**解決**：
1. 檢查 API_URL 是否正確
2. 確認 Vercel 部署正常
3. 檢查網路連接
4. 查看 Vercel 函數日誌

### 問題 4：備份檔案為空

**錯誤**：`下載的檔案為空`

**解決**：
1. 檢查 API 端點是否正常工作
2. 手動存取 API URL 測試
3. 查看 Vercel 函數日誌

---

## 📊 監控和日誌

### 備份日誌

每次備份都會在 `WD_MY_BOOK_PATH/backup-log.txt` 中記錄日誌：

```
[2025-01-15 02:00:00] ℹ️ ESWake 自動備份開始
[2025-01-15 02:00:01] ℹ️ 開始下載備份檔案
[2025-01-15 02:00:05] ✅ 下載完成: 15.23 MB
[2025-01-15 02:00:05] ✅ 備份成功保存
[2025-01-15 02:00:05] ✅ 備份完成！目前共有 5 個備份檔案
```

### 查看備份統計

執行腳本時會顯示：
- 目前備份檔案數量
- 總備份大小
- 清理的舊備份數量

---

## 🔐 安全建議

1. **保護 API 端點**：
   - 考慮新增身份驗證
   - 使用環境變數儲存敏感資訊

2. **備份檔案加密**（可選）：
   - 可以使用加密工具加密備份檔案
   - 例如：使用 7-Zip 加密壓縮

3. **多地點備份**：
   - 本地（WD MY BOOK）
   - 雲端（Google Drive、OneDrive）
   - 異地（另一個硬碟）

---

## 📅 備份頻率建議

| 頻率 | 適用場景 | 保留時間 |
|------|---------|---------|
| 每天 | 生產環境 | 30-90 天 |
| 每週 | 小型業務 | 90-180 天 |
| 每月 | 歸檔備份 | 永久 |

---

## 🆘 需要幫助？

如果遇到問題：
1. 查看 `backup-log.txt` 日誌檔案
2. 檢查 Windows 工作排程器的工作歷史
3. 手動執行腳本測試：`node scripts/auto-backup-to-wd.cjs`

