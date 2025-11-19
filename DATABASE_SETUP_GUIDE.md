# 📚 ESWake 預約系統 - 資料庫設置指南

## 🎯 從零開始建立完整資料庫

### 方案一：使用現有架構 + 遷移腳本（推薦）

適用於：建立新的生產環境資料庫

**步驟：**

1. **建立基礎架構**
   ```sql
   -- 在 Supabase SQL Editor 執行
   執行：database_schema_v5.sql
   ```

2. **⚠️ 重要：修復 reported_at 欄位類型**
   ```sql
   -- 如果你的數據庫已經運行，必須執行此修復
   執行：current_state_migration.sql
   ```
   
   **說明**：此腳本將 `booking_participants.reported_at` 從 TIMESTAMPTZ 轉換為 TEXT，以匹配代碼中使用的格式。

3. **初始化系統設置**（可選）
   ```sql
   執行：init_line_settings.sql  -- LINE 提醒設置
   ```

**優點：**
- ✅ 清楚的步驟
- ✅ 可追蹤的變更歷史
- ✅ 包含所有最新功能
- ✅ 避免類型不匹配錯誤

---

### 方案二：完整重建（開發環境）

適用於：開發測試，需要清空重來

**⚠️ 警告：會刪除所有現有資料！**

```sql
-- 在 Supabase SQL Editor 執行
執行：reset_and_setup_v5.sql

-- 然後執行最新遷移
執行：complete_migration.sql
```

---

## 📋 資料庫架構總覽

### 核心表

1. **members** - 會員管理
   - 會員基本資料
   - 財務資訊（餘額、時數、船券）
   - 會籍狀態

2. **coaches** - 教練管理
   - 教練基本資料
   - 狀態（active/inactive/archived）

3. **boats** - 船隻管理
   - 船隻資料
   - 可用狀態

4. **bookings** - 預約管理
   - 預約基本資訊
   - 時間、時長
   - 關聯船隻和會員

5. **booking_participants** - 參與者記錄
   - 教練回報的參與者
   - 時數和收費方式
   - **最新欄位**：
     - `is_teaching` (BOOLEAN) - 是否計入教學時數
     - `reported_at` (TEXT) - 回報時間
     - `updated_at` (TEXT) - 更新時間
     - `deleted_at` (TEXT) - 刪除時間
     - `is_deleted` (BOOLEAN) - 軟刪除標記
     - `lesson_type` (VARCHAR) - 教學方式（undesignated/designated_paid/designated_free）
     - `status` (TEXT) - 記錄狀態

6. **coach_reports** - 教練回報
   - 駕駛時數回報
   - 關聯預約和教練

7. **transactions** - 財務交易
   - 儲值、扣款、退款記錄
   - 關聯會員和參與者

### 輔助表

8. **booking_members** - 預約會員關聯（多對多）
9. **booking_coaches** - 預約教練關聯（多對多）
10. **coach_time_off** - 教練休假
11. **boat_unavailable_dates** - 船隻不可用日期
12. **board_storage** - 置板管理
13. **daily_tasks** - 每日任務
14. **daily_announcements** - 每日公告
15. **audit_log** - 審計日誌
16. **system_settings** - 系統設置
17. **line_bindings** - LINE 綁定

---

## 🔧 最新功能（2025-11-19）

### booking_participants 表增強

執行 `complete_migration.sql` 會添加以下欄位：

```sql
-- 教學時數判定
is_teaching BOOLEAN DEFAULT true

-- 時間戳記（TEXT 格式，避免時區問題）
reported_at TEXT          -- 回報時間
updated_at TEXT           -- 更新時間
deleted_at TEXT           -- 刪除時間
is_deleted BOOLEAN        -- 軟刪除標記

-- 教學方式（與收費方式分離）
lesson_type VARCHAR(20)   -- undesignated/designated_paid/designated_free

-- 記錄狀態
status TEXT              -- pending/processed/not_applicable
```

### 時區處理統一

所有時間戳欄位統一使用：
- **類型**：TEXT
- **格式**：`YYYY-MM-DDTHH:mm:ss`
- **時區**：本地時間（台灣 UTC+8）
- **工具函數**：`getLocalTimestamp()`

---

## 📁 重要 SQL 檔案說明

### 必備檔案

| 檔案 | 用途 | 執行時機 |
|------|------|----------|
| `database_schema_v5.sql` | 基礎架構定義 | 建立新資料庫 |
| `complete_migration.sql` | 最新功能遷移 | 架構建立後 |
| `reset_and_setup_v5.sql` | 完整重建（開發用）| 需要清空重來時 |

### 初始化檔案（可選）

| 檔案 | 用途 |
|------|------|
| `init_line_settings.sql` | LINE 提醒設置初始化 |
| `insert_super_admins.sql` | 插入超級管理員 |
| `create_permission_tables.sql` | 權限系統初始化 |

### 維護檔案（按需使用）

| 檔案 | 用途 |
|------|------|
| `add_membership_fields.sql` | 添加會員欄位 |
| `add_transaction_date.sql` | 添加交易日期 |
| `database_indexes_recommendation.sql` | 索引優化建議 |

---

## ✅ 驗證資料庫設置

執行以下查詢確認設置正確：

```sql
-- 1. 檢查所有表是否存在
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. 檢查 booking_participants 的欄位
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'booking_participants'
ORDER BY ordinal_position;

-- 3. 檢查索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'booking_participants';

-- 4. 驗證時間戳格式（應該都是 text 類型）
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name IN ('created_at', 'updated_at', 'reported_at', 'deleted_at')
  AND table_schema = 'public'
ORDER BY table_name, column_name;
```

---

## 🚀 快速開始（新專案）

```bash
# 1. 在 Supabase 建立新專案

# 2. 進入 SQL Editor

# 3. 依序執行以下 SQL 檔案：

# Step 1: 建立基礎架構
→ 執行 database_schema_v5.sql

# Step 2: 應用最新遷移
→ 執行 complete_migration.sql

# Step 3: （可選）初始化系統設置
→ 執行 init_line_settings.sql

# 完成！✅
```

---

## 📝 更新記錄

### 2025-11-19
- ✅ 新增 `booking_participants` 完整欄位支援
- ✅ 統一時區處理（TEXT 格式）
- ✅ 分離教學方式和收費方式
- ✅ 新增軟刪除功能
- ✅ 新增記錄狀態管理

### 2025-11-18
- ✅ V5 架構重構
- ✅ 簡化駕駛邏輯
- ✅ 支援多會員預約

---

## ⚠️ 注意事項

1. **生產環境**：
   - 在執行任何 SQL 前先備份
   - 使用 `database_schema_v5.sql` + `complete_migration.sql`
   - 不要使用 `reset_and_setup_v5.sql`（會刪除資料）

2. **開發環境**：
   - 可以使用 `reset_and_setup_v5.sql` 快速重建
   - 記得在重建後執行 `complete_migration.sql`

3. **時區處理**：
   - 所有新時間戳欄位使用 TEXT 格式
   - 使用 `getLocalTimestamp()` 函數插入資料
   - 不要使用 `new Date().toISOString()`（會轉換為 UTC）

---

## 🔗 相關文檔

- [教練回報系統架構](./docs/CoachReport-Architecture.md)
- [教練回報邏輯說明](./docs/CoachReport-Logic.md)
- [時區修復檢查報告](./TIMEZONE_FIX_REVIEW.md)
- [資料庫遷移指南](./MIGRATION_GUIDE.md)

