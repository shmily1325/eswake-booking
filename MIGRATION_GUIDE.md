# 資料庫遷移指南

## 📋 概述

本指南說明如何執行資料庫遷移，以支援新的教學管理功能。

## 🎯 遷移目的

### 新增欄位
1. **`is_teaching`** - 是否計入教學時數
2. **`reported_at`** - 回報時間
3. **`lesson_type`** - 教學方式（與收費方式分離）

### 功能改進
- ✅ 分離教學方式和收費方式
- ✅ 簡化教學時數計算邏輯
- ✅ 支援同一預約中每個參與者獨立選擇教學方式

## 🚀 執行步驟

### 1. 前往 Supabase

登入你的 Supabase 專案：
- 點擊左側選單的 **SQL Editor**
- 點擊 **New query** 建立新查詢

### 2. 執行遷移腳本

複製 `complete_migration.sql` 的完整內容，貼到 SQL Editor 中，然後點擊 **Run**。

### 3. 驗證結果

執行成功後，你應該會看到：

```
✅ 遷移完成！所有欄位已成功新增並初始化。
```

以及幾個驗證查詢的結果，確認資料正確性。

### 4. 重新整理應用

在瀏覽器中：
- 按 `Ctrl+Shift+R` (Windows) 或 `Cmd+Shift+R` (Mac)
- 硬刷新清除快取
- 重新測試所有功能

## 📊 遷移內容詳解

### 步驟 1-3：新增欄位

```sql
-- is_teaching: 是否計入教學時數
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS is_teaching BOOLEAN DEFAULT true;

-- reported_at: 回報時間
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- lesson_type: 教學方式
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS lesson_type VARCHAR(20) DEFAULT 'undesignated';
```

### 步驟 4：遷移現有資料

從舊的 `payment_method` 中提取 `lesson_type`：
- `designated_paid` → `lesson_type = 'designated_paid'`
- `designated_free` → `lesson_type = 'designated_free'`
- 其他 → `lesson_type = 'undesignated'`

### 步驟 5：清理舊資料

將 `payment_method` 中的 `designated_*` 轉換為 `cash`：
- 這些記錄的教學方式已經儲存在 `lesson_type` 中
- `payment_method` 改為純收費方式

### 步驟 6：更新 is_teaching

根據新的簡化邏輯更新所有記錄：
```sql
is_teaching = (lesson_type IN ('designated_paid', 'designated_free'))
```

### 步驟 7：建立索引

為新欄位建立索引，提升查詢效能。

## ✅ 驗證檢查清單

執行遷移後，請確認：

- [ ] `lesson_type` 分布正確（有 undesignated、designated_paid、designated_free）
- [ ] `payment_method` 不再有 `designated_*` 值
- [ ] `is_teaching` 的值符合預期（指定課為 true，不指定為 false）
- [ ] 所有舊資料都已正確遷移
- [ ] 應用程式正常運作，沒有錯誤訊息

## 🔄 回滾方案

如果遷移出現問題，可以：

1. **刪除新欄位**（不建議，會丟失資料）：
```sql
ALTER TABLE booking_participants DROP COLUMN IF EXISTS lesson_type;
ALTER TABLE booking_participants DROP COLUMN IF EXISTS is_teaching;
ALTER TABLE booking_participants DROP COLUMN IF EXISTS reported_at;
```

2. **還原 payment_method**（如果需要）：
```sql
-- 根據 lesson_type 還原回舊的 payment_method
UPDATE booking_participants
SET payment_method = lesson_type
WHERE lesson_type IN ('designated_paid', 'designated_free');
```

## 📞 常見問題

### Q: 遷移會影響現有資料嗎？
A: 不會。遷移腳本使用 `IF NOT EXISTS` 和 `UPDATE` 語句，安全地添加新欄位並保留所有現有資料。

### Q: 遷移需要多久時間？
A: 通常在幾秒內完成，取決於資料量。

### Q: 如果遇到錯誤怎麼辦？
A: 
1. 檢查控制台的錯誤訊息
2. 確認你有資料庫的寫入權限
3. 查看是否有其他會話正在修改相同的表

### Q: 已經執行過舊的遷移腳本怎麼辦？
A: 沒關係！`complete_migration.sql` 使用 `IF NOT EXISTS`，不會重複添加欄位。直接執行即可補充缺失的欄位。

## 📝 相關文件

- `complete_migration.sql` - 完整遷移腳本
- `docs/CoachReport-Architecture.md` - 系統架構文檔
- `docs/CoachReport-Logic.md` - 詳細邏輯說明

---

**最後更新**：2025-11-19

