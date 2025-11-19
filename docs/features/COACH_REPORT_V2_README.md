# 預約回報系統 V2 - 初版說明

## 概述
這是預約回報系統的重構版本，實現了教練回報和待處理扣款的完整流程。

## 主要改動

### 1. 資料庫結構更新
**檔案：** `migration_booking_participants_v2.sql`

新增欄位到 `booking_participants` 表：
- `status` - 處理狀態（pending/processed/not_applicable）
- `is_deleted` - 軟刪除標記
- `deleted_at` - 刪除時間
- `replaced_by_id` - 被哪筆記錄取代
- `replaces_id` - 取代了哪筆記錄
- `transaction_id` - 關聯的交易ID
- `updated_at` - 更新時間

### 2. 頁面重構
**檔案：** `src/pages/CoachReport.tsx`

#### 新增功能：

##### A. Tab 切換
- **Tab 1: 教練回報** - 記錄教練和駕駛的回報
- **Tab 2: 待處理扣款** - 處理會員扣款

##### B. 教練回報邏輯優化
- ✅ 過濾掉設施（彈簧床等）
- ✅ 油量欄位已 comment out
- ✅ 支援多種回報情況：
  - 有教練 + 有駕駛
  - 有教練 + 無駕駛（教練兼駕駛）
  - 多個教練（彈性處理）
  - 只有駕駛（coach_id=NULL）

##### C. 軟刪除邏輯
當修改已回報的內容時：
1. 舊記錄標記為 `is_deleted=true`
2. 新增修改後的記錄，並記錄 `replaces_id`
3. 保留完整修改歷史

##### D. 待處理扣款頁面
- 按預約分組顯示
- 只顯示當天的 `status='pending'` 記錄
- 會員記錄顯示「處理扣款」按鈕
- 非會員記錄只顯示資訊（不需扣款）
- 修改的記錄會顯示 🔄 標記和原始資料

##### E. 整合 TransactionDialog
- 點擊「處理扣款」載入會員完整資料
- 開啟交易對話框供寶哥手動處理
- 處理完成後自動更新狀態為 `processed`

## 回報狀態流程

```
教練回報
  ↓
儲存到 booking_participants
  ├─ 會員 → status = 'pending'
  └─ 非會員 → status = 'not_applicable'
  ↓
Tab 2: 待處理扣款（顯示 pending）
  ↓
寶哥點擊「處理扣款」
  ↓
開啟 TransactionDialog
  ↓
寶哥手動選擇扣款方式
  ↓
建立 transaction
  ↓
status 更新為 'processed'
```

## 修改回報流程

```
教練修改已回報的內容
  ↓
系統載入舊記錄
  ↓
標記舊記錄 is_deleted = true
  ↓
新增修改後的記錄（replaces_id 指向舊記錄）
  ↓
會員記錄：status = 'pending'（重新待處理）
非會員記錄：status = 'not_applicable'
  ↓
在待處理扣款頁面會看到修改標記 🔄
並顯示原始資料供對比
```

## 資料追蹤

### 軟刪除設計優點
1. **完整歷史** - 所有記錄都保留，可追溯
2. **清楚關聯** - 透過 `replaces_id` 知道誰取代誰
3. **方便查詢** - 透過 `is_deleted=false` 查詢有效記錄
4. **支援修改** - 修改後自動產生新記錄，舊記錄保留

### 範例：修改回報
```sql
-- 原始回報
id=1, member_id='user1', duration_min=60, status='processed', is_deleted=false

-- 教練修改為 90 分鐘
id=1, is_deleted=true, replaced_by_id=2  -- 舊記錄
id=2, duration_min=90, status='pending', replaces_id=1  -- 新記錄

-- 寶哥重新處理
id=2, status='processed'
```

## 使用說明

### 1. 執行 Migration
```sql
-- 在 Supabase SQL Editor 執行
psql -f migration_booking_participants_v2.sql
```

### 2. 教練回報操作
1. 選擇日期
2. 選擇教練
3. 點擊預約進行回報
4. 填寫駕駛時數（如需要）
5. 填寫客人資訊（姓名、時數、收費方式）
6. 提交回報

### 3. 處理扣款操作
1. 切換到「待處理扣款」Tab
2. 選擇日期
3. 查看按預約分組的待處理列表
4. 點擊會員的「處理扣款」按鈕
5. 在交易對話框中確認並處理
6. 完成後自動更新狀態

## 注意事項

### 目前實作
- ✅ 管理員代填版本（寶哥使用）
- ✅ 選擇教練後進行回報
- ✅ 油量欄位已 comment out
- ✅ 設施（彈簧床）已過濾，不顯示在回報列表

### 未來擴展
- 🔜 教練自己登入填寫（權限控制）
- 🔜 油量記錄（待確認需求）
- 🔜 設施回報邏輯（待討論）

## 測試建議

### 1. 基本回報測試
- [ ] 教練回報（只有教練）
- [ ] 駕駛回報（只有駕駛）
- [ ] 教練兼駕駛回報
- [ ] 多個教練各自回報

### 2. 修改回報測試
- [ ] 修改未處理的回報
- [ ] 修改已處理的回報（檢查是否正確產生 pending）
- [ ] 刪除參與者
- [ ] 新增參與者

### 3. 扣款處理測試
- [ ] 處理會員扣款
- [ ] 檢查 status 是否正確更新
- [ ] 檢查交易是否正確建立
- [ ] 查看會員交易頁面是否顯示

### 4. 邊界情況測試
- [ ] 沒有預約的日期
- [ ] 非會員的回報
- [ ] 同一預約多個教練
- [ ] 修改多次的回報

## 技術細節

### Interface 定義
- `MemberSearchResult` - 會員搜尋結果（簡化版）
- `FullMember` - 完整會員資料（含財務欄位）
- `Participant` - 參與者記錄（含新狀態欄位）
- `PendingReport` - 待處理回報（含預約資訊）

### 狀態管理
- 使用 React hooks 管理所有狀態
- Tab 切換時重新載入對應資料
- 表單提交後自動重新載入

### 效能優化
- 並行載入相關資料（coaches, drivers, reports, participants）
- 只載入當天的待處理記錄
- 過濾設施後才載入詳細資料

## 問題排查

### 如果看不到預約
- 檢查是否選擇了正確的日期
- 檢查是否選擇了教練（不能是「全部教練」）
- 檢查預約是否是設施（會被過濾）

### 如果待處理扣款是空的
- 檢查是否有 `status='pending'` 的記錄
- 檢查日期是否正確
- 檢查是否有會員記錄（非會員不顯示處理按鈕）

### 如果無法處理扣款
- 檢查會員資料是否完整
- 檢查 TransactionDialog 是否正常開啟
- 查看 console 是否有錯誤訊息

## 聯絡資訊
如有問題或需要調整，請聯繫開發團隊。

