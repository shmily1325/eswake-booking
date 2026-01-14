# 離線編輯器使用說明

## 📋 概述

`off-line-editor.html` 是一個完全離線運行的 HTML 檔案，提供與線上版本相同的 UI 和架構，但使用 SQL.js 作為資料庫後端，可以載入 SQL 備份檔案進行編輯。

## ✨ 功能特點

- ✅ **完全離線運行** - 不需要網路連線
- ✅ **與線上版本相同的 UI** - 首頁、組件、樣式完全一致
- ✅ **支援 SQL 備份載入** - 可以載入 PostgreSQL 備份檔案
- ✅ **自動資料儲存** - 每 30 秒自動儲存到 localStorage
- ✅ **所有路由已配置** - 包含所有頁面路由（部分頁面為基礎版本，可後續擴展）

## 🚀 使用步驟

### 1. 開啟檔案

直接在瀏覽器中開啟 `off-line-editor.html` 檔案。

### 2. 載入資料庫

首次開啟會顯示資料庫載入界面：

**選項 A：載入 SQL 備份**
- 點擊「📁 載入 SQL 備份檔案」
- 選擇你的 PostgreSQL 備份 SQL 檔案
- 系統會自動轉換並載入資料

**選項 B：建立空白資料庫**
- 點擊「🆕 建立空白資料庫」
- 系統會建立空的資料庫結構

### 3. 登入

載入資料庫後，點擊「開始使用（離線模式）」按鈕登入。

### 4. 使用應用

登入後會看到與線上版本完全相同的首頁，包含：
- 📅 今日預約
- 📝 預約表
- ✅ 教練回報
- 🔍 預約查詢
- ⏰ 明日提醒
- 📋 編輯記錄
- 🚤 船隻管理
- 🔧 BAO

## 📝 已實現的功能

### ✅ 完整實現

1. **資料庫系統**
   - SQL.js 資料庫引擎
   - PostgreSQL 到 SQLite 轉換
   - 自動儲存到 localStorage
   - 支援載入 SQL 備份

2. **認證系統**
   - 離線模式模擬認證
   - 用戶資訊管理

3. **首頁**
   - 與線上版本完全一致的 UI
   - Logo 顯示
   - 用戶選單
   - 今日公告
   - 功能選單網格

4. **組件**
   - UserMenu（用戶選單）
   - DailyAnnouncement（今日公告）

5. **工具函數**
   - 日期工具（getLocalDateString, getWeekdayText 等）
   - 響應式 Hook（useResponsive）

### 🚧 基礎版本（可擴展）

以下頁面已配置路由，但為基礎版本，可後續擴展：

- 預約表（DayView）
- 預約查詢（SearchPage）
- 會員管理（MemberManagement）
- 教練管理（CoachManagement）
- 船隻管理（BoatManagement）
- 其他管理頁面

## 🔧 技術架構

### 資料庫適配器

使用 SQL.js 模擬 Supabase API：

```javascript
// 這些查詢在離線模式下也能正常工作
const { data, error } = await supabase
  .from('bookings')
  .select('*')
  .eq('status', 'confirmed')
  .order('start_at')
```

### 支援的查詢操作

- ✅ `.select()` - 選擇欄位
- ✅ `.eq()`, `.neq()` - 等於/不等於
- ✅ `.gt()`, `.gte()`, `.lt()`, `.lte()` - 比較操作
- ✅ `.like()`, `.ilike()` - 模糊查詢
- ✅ `.in()` - 包含查詢
- ✅ `.order()` - 排序
- ✅ `.limit()` - 限制數量

### 資料表結構

已建立的資料表：
- `members` - 會員表
- `boats` - 船隻表
- `coaches` - 教練表
- `bookings` - 預約表
- `booking_members` - 預約會員關聯表
- `booking_coaches` - 預約教練關聯表
- `coach_reports` - 教練回報表
- `booking_participants` - 預約參與者表
- `transactions` - 交易記錄表
- `daily_announcements` - 每日公告表
- `audit_log` - 審計日誌表

## 📦 擴展指南

### 添加新頁面

1. 在「頁面組件」區段添加新組件：

```javascript
function NewPage() {
    const { user } = useAuth();
    // 你的頁面邏輯
    return <div>...</div>;
}
```

2. 在路由中添加：

```javascript
<Route path="/new-page" element={<NewPage />} />
```

### 添加新組件

在「組件」區段添加新組件，例如：

```javascript
function NewComponent({ prop1, prop2 }) {
    // 組件邏輯
    return <div>...</div>;
}
```

### 完善 Supabase 適配器

如果需要支援更複雜的查詢（如關聯查詢），可以在 `QueryBuilder` 類的 `execute()` 方法中添加處理邏輯。

## ⚠️ 注意事項

### 1. 資料大小限制

- localStorage 通常有 5-10MB 限制
- 如果資料太大，可能需要定期匯出清理

### 2. 性能考慮

- SQL.js 在瀏覽器中運行，性能有限
- 大量資料查詢可能較慢
- 建議資料量控制在合理範圍

### 3. 瀏覽器相容性

- 需要支援 WebAssembly（SQL.js 依賴）
- 建議使用 Chrome、Firefox、Edge 等現代瀏覽器

### 4. 資料安全

- 資料儲存在瀏覽器本地
- 清除瀏覽器資料會遺失所有資料
- **請定期匯出備份！**

### 5. 關聯查詢

目前關聯查詢（如 `boats:boat_id(name, color)`）為簡化實現，如需完整支援，需要擴展 `QueryBuilder` 類。

## 🔄 資料匯出

資料會自動儲存到 localStorage，也可以手動匯出：

```javascript
// 在瀏覽器控制台執行
const savedDb = localStorage.getItem('eswake-offline-db');
console.log('資料庫已儲存，大小:', savedDb.length, '字元');
```

## 🐛 故障排除

### 🔍 如何查看控制台日誌（調試資訊）

載入 SQL 檔案時，系統會在瀏覽器控制台輸出詳細的調試資訊，包括：
- ✅ 成功載入的記錄數
- ⏭️ 跳過的記錄數和原因
- 📊 統計資訊（成功率、總數等）
- 🔍 每個跳過語句的詳細內容

**查看步驟：**

1. **開啟開發者工具**
   - **Chrome/Edge**: 按 `F12` 或 `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox**: 按 `F12` 或 `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Safari**: 按 `Cmd+Option+I` (需先在偏好設定中啟用開發者選單)

2. **切換到 Console（控制台）標籤**
   - 在開發者工具中點擊「Console」或「控制台」標籤

3. **載入 SQL 檔案**
   - 選擇 SQL 檔案後，控制台會自動顯示詳細的載入資訊

4. **查看跳過資訊**
   - 成功載入的記錄會顯示 `✅ 已處理 X 條記錄...`
   - 跳過的記錄會顯示 `⏭️ [序號/總數] 跳過原因: 語句預覽`
   - 載入完成後會顯示完整的統計摘要

**日誌標記說明：**
- `📊` - 統計資訊
- `✅` - 成功處理
- `⏭️` - 跳過的語句
- `❌` - 執行錯誤
- `🔍` - 詳細資訊（可展開查看）

**範例輸出：**
```
📊 開始處理 SQL 語句，總數: 1500
⏭️  [1/1500] 跳過 CREATE TABLE: CREATE TABLE members ...
✅ 已處理 100 條記錄...
✅ 已處理 200 條記錄...
...
📊 ========== 載入完成統計 ==========
✅ 成功: 1200 條
⏭️  跳過: 300 條
📈 總計: 1500 條 SQL 語句
📉 成功率: 80.00%

📋 跳過原因統計:
   CREATE TABLE: 50 條
   ALTER TABLE: 30 條
   CREATE INDEX: 20 條
   INSERT 格式不符: 150 條
   其他: 50 條

🔍 詳細跳過資訊（展開查看）:
   ⏭️  INSERT 格式不符 (150 條)
      [101] INSERT INTO bookings (id, start_at) VALUES ...
      [102] INSERT INTO bookings (id, start_at) VALUES ...
      ...
```

### 問題：無法載入 SQL 檔案

**解決方案：**
- 檢查 SQL 檔案格式是否正確
- 確保是 UTF-8 編碼
- **查看瀏覽器控制台錯誤資訊**（參考上方「如何查看控制台日誌」）
- 檢查跳過的語句是否包含重要資料

### 問題：資料遺失

**解決方案：**
- 檢查 localStorage 是否被清除
- 嘗試從備份恢復
- 定期匯出資料作為備份

### 問題：頁面顯示「開發中」

**解決方案：**
- 這是正常的，這些頁面為基礎版本
- 可以參考線上版本的實現代碼進行擴展
- 所有路由已配置，只需添加頁面內容

## 📝 後續擴展建議

1. **完善頁面組件**
   - 將線上版本的頁面組件整合進來
   - 確保所有功能都能正常工作

2. **完善 Supabase 適配器**
   - 支援完整的關聯查詢
   - 支援 INSERT、UPDATE、DELETE 操作
   - 支援事務處理

3. **添加資料匯出功能**
   - 匯出為 SQL 格式
   - 匯出為 JSON 格式
   - 匯出為 CSV 格式

4. **優化性能**
   - 實現資料快取
   - 優化查詢性能
   - 實現虛擬滾動（如需要）

## 🎉 總結

`off-line-editor.html` 提供了一個完整的離線編輯環境，與線上版本具有相同的 UI 和架構。目前首頁和核心組件已完整實現，其他頁面可以根據需要逐步擴展。

**記住：定期匯出備份！**

---

**版本：** 1.0.0  
**最後更新：** 2025-01-XX  
**所有註解使用繁體中文**

