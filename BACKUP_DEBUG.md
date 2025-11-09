# 備份功能調試指南

當備份功能執行時間過長或失敗時，請按照以下步驟進行調試：

## 🔍 快速診斷步驟

### 1. **檢查瀏覽器控制台 (Console)**

1. 打開瀏覽器開發者工具（按 `F12` 或右鍵 → 檢查）
2. 切換到 **Console** 標籤
3. 點擊「備份到 Google Drive」按鈕
4. 查看控制台輸出，會顯示：
   - `开始备份...` - 開始時間
   - `收到响应 (XXXms)` - 收到響應的時間
   - `响应结果:` - 完整的響應結果
   - 任何錯誤信息

**常見錯誤：**
- `Failed to fetch` - 網絡連接問題或 API 路由不存在
- `AbortError` - 請求超時（超過60秒）
- `500 Internal Server Error` - 服務器端錯誤

### 2. **檢查網絡請求 (Network Tab)**

1. 在開發者工具中切換到 **Network** 標籤
2. 點擊「備份到 Google Drive」按鈕
3. 找到 `/api/backup-to-drive` 請求
4. 檢查：
   - **Status**: 應該是 `200` 或 `500`
   - **Time**: 請求耗時
   - **Response**: 點擊查看響應內容
   - **Preview**: 查看格式化的響應

**如果請求一直處於 `pending` 狀態：**
- 可能是 Vercel 函數超時（默認10秒，Pro 計劃可達60秒）
- 可能是數據量太大，查詢時間過長

### 3. **檢查 Vercel 函數日誌**

這是**最重要的調試方法**，可以看到服務器端的詳細執行過程：

1. 登錄 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的項目
3. 前往 **Functions** 標籤
4. 找到 `api/backup-to-drive` 函數
5. 點擊查看最近的執行記錄
6. 查看 **Logs** 標籤

**日誌格式：**
```
[0ms] 1. 开始备份流程
[5ms] 2. 检查环境变量
[10ms] 2.1 环境变量检查完成
[15ms] 3. 请求参数 {"startDate":"...","endDate":"..."}
[20ms] 4. 创建 Supabase 客户端
[500ms] 5. 查询预约数据
[520ms] 5.1 预约数据查询完成 {"count":100}
[530ms] 6. 查询关联数据（教练、参与者、驾驶）
[800ms] 6.2 关联数据查询完成 {"coaches":50,"participants":80,"drivers":10}
[850ms] 7. 生成 CSV 数据
[900ms] 7.1 CSV 生成完成 {"csvLength":50000}
[950ms] 8. 初始化 Google Drive 客户端
[1000ms] 8.1 Google Drive 客户端创建完成
[1050ms] 9. 准备上传到 Google Drive
[1100ms] 9.1 文件名 {"fileName":"手動備份_預約備份_2025-01-15_1430.csv"}
[1200ms] 9.2 开始上传文件到 Google Drive
[5000ms] 9.3 文件上传完成 {"fileId":"..."}
[5010ms] 10. 备份完成 {"totalTime":"5010ms","bookingsCount":100}
```

**根據日誌判斷問題：**

- **卡在步驟 5（查詢預約數據）**：
  - 數據量太大
  - Supabase 查詢慢
  - 網絡連接問題

- **卡在步驟 6（查詢關聯數據）**：
  - 關聯表數據量大
  - 查詢語句效率低

- **卡在步驟 7（生成 CSV）**：
  - 數據量太大，CSV 生成耗時

- **卡在步驟 9（上傳到 Google Drive）**：
  - Google Drive API 響應慢
  - 文件太大
  - 網絡連接問題
  - **最常見的原因**

### 4. **檢查環境變數**

確認 Vercel 環境變數已正確設定：

1. 在 Vercel Dashboard → **Settings** → **Environment Variables**
2. 確認以下變數存在：
   - `VITE_SUPABASE_URL` 或 `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_DRIVE_FOLDER_ID`

**檢查方法：**
- 如果日誌顯示 `错误: Missing Supabase credentials` → 環境變數未設定
- 如果日誌顯示 `错误: Missing Google Drive credentials` → Google 相關環境變數未設定

### 5. **測試各個步驟**

#### 測試 Supabase 連接
在 Vercel 函數日誌中查看步驟 5 的執行時間：
- 正常：< 1秒
- 慢：1-5秒
- 超時：> 10秒

#### 測試 Google Drive 上傳
在 Vercel 函數日誌中查看步驟 9 的執行時間：
- 正常：1-3秒
- 慢：3-10秒
- 超時：> 30秒

## 🐛 常見問題與解決方案

### 問題 1: 備份超時（超過60秒）

**症狀：**
- 瀏覽器顯示「備份超時（超過60秒）」
- 控制台顯示 `AbortError`

**可能原因：**
1. 數據量太大（超過1000筆預約）
2. Google Drive API 響應慢
3. Vercel 函數執行時間限制

**解決方案：**
1. **限制日期範圍**：選擇較小的日期範圍進行備份
2. **升級 Vercel 計劃**：Pro 計劃有更長的執行時間限制
3. **分批備份**：將大範圍分成多個小範圍分別備份

### 問題 2: 請求一直 pending

**症狀：**
- 網絡請求一直處於 `pending` 狀態
- 沒有收到任何響應

**可能原因：**
1. Vercel 函數未部署或路由錯誤
2. 函數執行時間超過限制（默認10秒）
3. 函數崩潰但沒有返回錯誤

**解決方案：**
1. 檢查 Vercel 部署狀態
2. 查看 Vercel 函數日誌（即使請求 pending，日誌仍會記錄）
3. 檢查函數是否有語法錯誤

### 問題 3: Google Drive 上傳失敗

**症狀：**
- 日誌顯示步驟 9 失敗
- 錯誤信息包含 `Google Drive` 或 `permission denied`

**可能原因：**
1. 服務帳號沒有 Google Drive 資料夾權限
2. `GOOGLE_DRIVE_FOLDER_ID` 錯誤
3. Google 私鑰格式錯誤

**解決方案：**
1. 確認服務帳號已獲得資料夾的「編輯者」權限
2. 確認資料夾 ID 正確（從 Google Drive URL 中獲取）
3. 確認私鑰格式正確（包含 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`）

### 問題 4: Supabase 查詢失敗

**症狀：**
- 日誌顯示步驟 5 或 6 失敗
- 錯誤信息包含 `Supabase` 或 `database`

**可能原因：**
1. `SUPABASE_SERVICE_ROLE_KEY` 錯誤
2. 數據庫表結構不匹配
3. RLS 策略問題

**解決方案：**
1. 確認 Service Role Key 正確（不是 anon key）
2. 檢查數據庫表結構是否與代碼匹配
3. 確認 RLS 策略允許 Service Role 訪問

## 📊 性能優化建議

### 如果數據量很大：

1. **添加日期範圍限制**：
   - 不要一次備份所有數據
   - 建議每次備份不超過 3 個月的數據

2. **優化查詢**：
   - 使用索引字段進行查詢
   - 避免查詢不需要的字段

3. **分批處理**：
   - 將大範圍分成多個小範圍
   - 分別備份後合併

## 🔧 手動測試 API

您也可以直接測試 API 端點：

```bash
curl -X POST https://your-domain.vercel.app/api/backup-to-drive \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "manual": true
  }'
```

查看響應和執行時間。

## 📝 日誌級別說明

API 會記錄以下級別的日誌：

- **步驟日誌**：每個主要步驟的開始和結束
- **錯誤日誌**：任何錯誤的詳細信息
- **性能日誌**：每個步驟的執行時間

所有日誌都會包含時間戳（從開始執行的毫秒數），方便定位性能瓶頸。

## 💡 調試技巧

1. **先查看 Vercel 日誌**：這是最快找到問題的方法
2. **檢查最後一個成功的步驟**：如果日誌停在某個步驟，問題就在那個步驟
3. **對比執行時間**：如果某個步驟突然變慢，可能是數據量增加或網絡問題
4. **檢查環境變數**：很多問題都是環境變數配置錯誤導致的

---

如果以上方法都無法解決問題，請提供：
1. Vercel 函數的完整日誌
2. 瀏覽器控制台的錯誤信息
3. 網絡請求的詳細信息（Status, Response）

這樣可以更快地定位問題！

