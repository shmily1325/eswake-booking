# 後台刪除教練指南

## 📝 使用方法

### 步驟 1：檢查影響範圍

1. 打開 `migrations/check_coach_impact.sql`
2. 執行第一段查詢找出教練 ID：
   ```sql
   SELECT id, name, status, created_at 
   FROM coaches 
   ORDER BY created_at DESC;
   ```
3. 複製要刪除的教練 UUID
4. 使用「尋找取代」功能，將所有 `<教練ID>` 替換為實際的 UUID
5. 在 Supabase SQL Editor 執行整個腳本
6. 查看輸出，確認影響範圍

### 步驟 2：執行刪除

**⚠️ 確認是測試資料後再繼續**

1. 打開 `migrations/delete_coach_safe.sql`
2. 執行第一段查詢確認教練
3. 使用「尋找取代」功能，將所有 `<教練ID>` 替換為實際的 UUID
4. 在 Supabase SQL Editor 執行整個腳本
5. 查看執行結果
6. 輸入 `COMMIT;` 確認刪除（或 `ROLLBACK;` 取消）

## 📊 快速範例

假設要刪除 ID 為 `1782719f-bded-40ee-a249-b7f57cbd2661` 的教練：

```sql
-- 1. 檢查影響
-- 將 <教練ID> 全部替換為 1782719f-bded-40ee-a249-b7f57cbd2661
-- 執行 check_coach_impact.sql

-- 2. 執行刪除
-- 將 <教練ID> 全部替換為 1782719f-bded-40ee-a249-b7f57cbd2661
-- 執行 delete_coach_safe.sql

-- 3. 確認
COMMIT;  -- 完成刪除
-- 或
ROLLBACK;  -- 取消刪除
```

## ✅ 安全機制

腳本內建了以下保護：
- ✅ 自動檢查未來預約（有的話會中止）
- ✅ 顯示詳細影響範圍
- ✅ 使用交易（有錯誤會自動回滾）
- ✅ 需要手動 COMMIT 才會真正刪除

## 🗂️ 相關檔案

- `migrations/check_coach_impact.sql` - 檢查影響範圍
- `migrations/delete_coach_safe.sql` - 安全刪除教練
- `COACH_DELETE_ANALYSIS.md` - 詳細技術分析

