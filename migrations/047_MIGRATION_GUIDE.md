# 教練練習標記欄位 - 遷移指南

## 📋 遷移內容

在 `bookings` 表添加 `is_coach_practice` 欄位，用於標記預約是否為教練練習。

**影響範圍：**
- ✅ 只添加新欄位，不修改現有資料
- ✅ 所有現有預約自動設為 `false`（非教練練習）
- ✅ 不影響任何現有功能
- ✅ 可安全回滾

---

## ⚠️ 執行前必讀

### 1. 備份資料庫（重要！）

在 Supabase Dashboard 執行備份：
1. 進入你的 Supabase 專案
2. Settings → Database → Backup
3. 或使用 SQL 備份：

```sql
-- 備份 bookings 表
CREATE TABLE bookings_backup_20251126 AS 
SELECT * FROM bookings;

-- 驗證備份
SELECT COUNT(*) FROM bookings_backup_20251126;
```

### 2. 確認測試環境

**強烈建議先在測試環境執行！**

如果沒有測試環境，至少確保：
- ✅ 已完成資料庫備份
- ✅ 在非高峰時段執行
- ✅ 已通知團隊成員

---

## 🚀 執行步驟

### Step 1: 驗證當前狀態

執行 `047_verify_migration.sql` 的前兩個查詢：

```sql
-- 檢查欄位是否已存在
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name = 'is_coach_practice';
```

**預期結果：**
- 如果返回空（沒有資料），表示欄位不存在 ✓ 可以繼續
- 如果返回有資料，表示欄位已存在 ✗ 請勿重複執行

### Step 2: 執行遷移

在 Supabase SQL Editor 中執行：

```bash
migrations/047_add_is_coach_practice_field.sql
```

**預期輸出：**
```
✓ 欄位 is_coach_practice 已成功添加
✓ 驗證成功：所有現有預約都已設為非教練練習
```

**執行時間：** 應該在 1-2 秒內完成

### Step 3: 驗證遷移結果

執行完整的驗證腳本：

```bash
migrations/047_verify_migration.sql
```

**預期看到：**
```
✓ PASS - 欄位已存在
✓ PASS - 索引已建立
✓ PASS - 新預約的預設值正確 (false)
✓✓✓ 遷移完全成功！可以繼續前端開發 ✓✓✓
```

### Step 4: 測試基本功能

```sql
-- 1. 測試插入普通預約（預設應該是 false）
INSERT INTO bookings (boat_id, contact_name, start_at, duration_min)
VALUES (1, '測試客人', '2025-12-01T10:00:00', 60)
RETURNING id, is_coach_practice;
-- 預期：is_coach_practice = false

-- 2. 測試插入教練練習預約
INSERT INTO bookings (boat_id, contact_name, start_at, duration_min, is_coach_practice)
VALUES (1, '教練練習', '2025-12-01T14:00:00', 60, true)
RETURNING id, is_coach_practice;
-- 預期：is_coach_practice = true

-- 3. 測試查詢
SELECT id, contact_name, is_coach_practice 
FROM bookings 
ORDER BY id DESC 
LIMIT 5;

-- 4. 清理測試資料
DELETE FROM bookings WHERE contact_name IN ('測試客人', '教練練習');
```

---

## 🔙 回滾步驟（如果需要）

**只有在遇到問題時才執行！**

### 1. 確認需要回滾

先檢查問題：
- 遷移執行失敗？
- 發現資料異常？
- 影響現有功能？

### 2. 執行回滾

```bash
migrations/047_rollback_is_coach_practice.sql
```

### 3. 驗證回滾

```sql
-- 確認欄位已移除
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name = 'is_coach_practice';
-- 應該返回空
```

### 4. 恢復備份（如果需要）

```sql
-- 從備份恢復（謹慎使用！）
BEGIN;

-- 先刪除當前資料（會丟失新增的預約！）
TRUNCATE bookings CASCADE;

-- 從備份恢復
INSERT INTO bookings 
SELECT * FROM bookings_backup_20251126;

-- 檢查資料是否正確
SELECT COUNT(*) FROM bookings;

-- 如果確認無誤，提交
COMMIT;
-- 如果有問題，回滾
-- ROLLBACK;
```

---

## 📊 遷移詳細資訊

### 新增的欄位

| 欄位名稱 | 類型 | 預設值 | 可空 | 說明 |
|---------|------|--------|------|------|
| `is_coach_practice` | BOOLEAN | `false` | NOT NULL | 是否為教練練習 |

### 新增的索引

| 索引名稱 | 類型 | 條件 | 說明 |
|---------|------|------|------|
| `idx_bookings_is_coach_practice` | B-tree | WHERE is_coach_practice = false | 部分索引，優化查詢效能 |

### 對現有資料的影響

- ✅ 所有現有預約的 `is_coach_practice` 自動設為 `false`
- ✅ 不影響任何現有查詢
- ✅ 不影響任何現有功能
- ✅ 表大小增加：每筆資料約 1 byte（幾乎可忽略）

---

## ✅ 檢查清單

執行遷移前：
- [ ] 已備份資料庫
- [ ] 已在測試環境測試（或確認風險）
- [ ] 已檢查欄位不存在
- [ ] 已通知相關人員

執行遷移後：
- [ ] 遷移執行成功（看到成功訊息）
- [ ] 驗證腳本全部通過
- [ ] 測試插入/查詢功能正常
- [ ] 前端功能正常運作

---

## 🆘 遇到問題？

### 常見問題

**Q1: 執行時出現「欄位已存在」錯誤**
- A: 表示之前已經執行過遷移，不需要重複執行

**Q2: 執行後發現部分預約的 `is_coach_practice` 是 NULL**
- A: 這不應該發生！請立即執行回滾腳本並檢查

**Q3: 執行很慢（超過 10 秒）**
- A: 可能是資料量大或資料庫負載高，等待完成即可

**Q4: 如何確認遷移完全成功？**
- A: 執行驗證腳本，看到「✓✓✓ 遷移完全成功」即可

### 緊急聯絡

如果遇到嚴重問題：
1. 立即停止操作
2. 執行回滾腳本
3. 從備份恢復（如果需要）
4. 記錄錯誤訊息以便排查

---

## 📝 執行記錄

請記錄執行結果：

```
執行日期：__________
執行人員：__________
執行環境：□ 測試環境  □ 正式環境
執行結果：□ 成功  □ 失敗  □ 已回滾
備註：

```

---

## 下一步

遷移成功後，可以繼續：
1. ✅ 前端表單添加「教練練習」勾選框
2. ✅ CoachReport 過濾教練練習預約
3. ✅ DayView 顯示教練練習標識

