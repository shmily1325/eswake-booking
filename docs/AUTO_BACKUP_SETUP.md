# 🤖 自動備份到 WD MY BOOK 設定指南

## 🚀 快速開始（3 步完成）

### 步驟 1：執行設定腳本

在 PowerShell 中（以系統管理員身分執行）：

```powershell
cd C:\path\to\your\project
.\scripts\setup-auto-backup.ps1
```

### 步驟 2：按照精靈配置

腳本會引導你完成：
1. ✅ 輸入 Vercel 部署地址
2. ✅ 選擇 WD MY BOOK 硬碟磁碟機代號
3. ✅ 設定備份保留天數（預設 90 天）
4. ✅ 測試備份
5. ✅ 建立 Windows 工作排程器工作

### 步驟 3：完成！

系統將自動：
- ✅ 每天凌晨 2:00 自動備份
- ✅ 保存到 WD MY BOOK 硬碟
- ✅ 自動清理超過保留期的舊備份
- ✅ 記錄備份日誌

---

## 📋 詳細設定步驟

### 方法一：使用設定腳本（推薦）

1. **開啟 PowerShell（系統管理員權限）**
   ```powershell
   # 右鍵點擊 PowerShell，選擇"以系統管理員身分執行"
   ```

2. **執行設定腳本**
   ```powershell
   cd "C:\Users\PEI JU PAN\Documents\8_Projects\eswake-booking"
   .\scripts\setup-auto-backup.ps1
   ```

3. **按照提示完成配置**

### 方法二：手動配置

#### 1. 編輯腳本配置

開啟 `scripts/auto-backup-to-wd.cjs`，修改以下配置：

```javascript
// 1. API 端點（你的 Vercel 部署地址）
const API_URL = 'https://your-app.vercel.app/api/backup-full-database';

// 2. WD MY BOOK 硬碟路徑
const WD_MY_BOOK_PATH = 'E:\\ESWake-Backups';  // 修改為你的硬碟路徑

// 3. 備份保留天數
const KEEP_DAYS = 90;  // 保留 90 天的備份
```

#### 2. 測試執行

```bash
node scripts/auto-backup-to-wd.cjs
```

#### 3. 建立 Windows 工作排程器工作

1. 開啟「工作排程器」（Task Scheduler）
2. 點擊「建立基本工作」
3. 配置：
   - **名稱**：`ESWake 自動備份`
   - **觸發程序**：每天
   - **時間**：02:00
   - **動作**：啟動程式
   - **程式**：`C:\path\to\your\project\scripts\auto-backup-to-wd.bat`
   - **起始於**：`C:\path\to\your\project`

---

## 📁 備份檔案位置

備份檔案會保存在：

```
E:\ESWake-Backups\
├── Full-Database-Backups\
│   ├── eswake_backup_2025-01-15_02-00-00.sql
│   ├── eswake_backup_2025-01-16_02-00-00.sql
│   └── ...
└── backup-log.txt  (備份日誌)
```

---

## ⚙️ 配置選項

### 環境變數（可選）

你可以透過環境變數覆蓋腳本配置：

**Windows (CMD)**
```cmd
set ESWAKE_API_URL=https://your-app.vercel.app/api/backup-full-database
set WD_MY_BOOK_PATH=E:\ESWake-Backups
set BACKUP_KEEP_DAYS=90
set VERBOSE=true
```

**Windows (PowerShell)**
```powershell
$env:ESWAKE_API_URL="https://your-app.vercel.app/api/backup-full-database"
$env:WD_MY_BOOK_PATH="E:\ESWake-Backups"
$env:BACKUP_KEEP_DAYS="90"
$env:VERBOSE="true"
```

---

## 🔍 監控和日誌

### 查看備份日誌

備份日誌保存在：`E:\ESWake-Backups\backup-log.txt`

```log
[2025-01-15 02:00:00] ℹ️ ESWake 自動備份開始
[2025-01-15 02:00:01] ℹ️ 開始下載備份檔案
[2025-01-15 02:00:05] ✅ 下載完成: 15.23 MB
[2025-01-15 02:00:05] ✅ 備份成功保存
[2025-01-15 02:00:05] ✅ 備份完成！目前共有 5 個備份檔案
```

### 查看工作排程器歷史

1. 開啟「工作排程器」
2. 找到「ESWake 自動備份」工作
3. 點擊「歷史記錄」查看執行記錄

---

## 🔧 故障排除

### 問題 1：找不到 Node.js

**錯誤**：`'node' 不是內部或外部命令`

**解決**：
1. 確認 Node.js 已安裝：`node --version`
2. 將 Node.js 新增到系統 PATH
3. 或在批次處理檔案中指定完整路徑

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

### 問題 4：工作排程器工作不執行

**解決**：
1. 檢查工作是否已啟用
2. 檢查工作執行條件（電源、網路等）
3. 手動執行工作測試
4. 查看工作歷史記錄中的錯誤資訊

---

## 📊 備份統計

執行腳本時會顯示：
- ✅ 目前備份檔案數量
- ✅ 總備份大小
- ✅ 清理的舊備份數量

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
4. 查看詳細文件：`scripts/README_AUTO_BACKUP.md`

