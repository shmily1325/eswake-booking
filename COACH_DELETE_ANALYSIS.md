# 刪除教練功能 - 難度分析報告

## 📋 執行摘要

**難度等級：⭐⭐⭐⭐ (困難)**

刪除教練確實有一定難度，主要是因為教練資料與多個關鍵表有複雜的關聯關係。不過系統已有部分外鍵約束保護，可以避免資料完全損壞。

---

## 🗄️ 資料庫依賴關係分析

### 1. 教練表被以下表引用：

| 表名 | 關係類型 | 外鍵約束 | 刪除影響 |
|------|---------|---------|---------|
| `coach_time_off` | 教練休假記錄 | `ON DELETE CASCADE` ✅ | 自動刪除 |
| `booking_coaches` | 預約教練關聯 | **無約束** ⚠️ | 可能產生髒資料 |
| `booking_drivers` | 預約駕駛關聯 | **無約束** ⚠️ | 可能產生髒資料 |
| `coach_reports` | 教練回報記錄 | **無約束** ⚠️ | 可能產生髒資料 |
| `booking_participants` | 參與者記錄 (coach_id) | **無約束** ⚠️ | 可能產生髒資料 |

### 2. 間接影響

```
coaches (教練)
  ├─ coach_time_off (休假) ✅ 自動刪除
  ├─ booking_coaches (排班) ⚠️ 會變成無效引用
  ├─ booking_drivers (駕駛) ⚠️ 會變成無效引用
  ├─ coach_reports (回報) ⚠️ 會變成無效引用
  └─ booking_participants (參與者) ⚠️ 會變成無效引用
       └─ transactions (交易記錄) 🔒 ON DELETE SET NULL - 保留但斷開連結
```

---

## ⚠️ 主要困難點

### 困難點 1: 缺少外鍵約束保護

**問題：** 
大部分與教練相關的表 **沒有設置外鍵約束**，直接刪除教練會產生「孤兒資料」（orphaned records）。

**影響：**
- `booking_coaches` 表會有指向不存在教練的記錄
- `coach_reports` 表的回報記錄會失去教練資訊
- `booking_participants` 表會有無效的 coach_id
- 系統查詢時可能出錯或顯示空白

**證據：** 
從 `migrations/cleanup_invalid_coach_references.sql` 可以看到系統已經發現過這類問題：

```sql
-- 找出並刪除指向不存在教練的記錄
SELECT COUNT(*) as invalid_booking_coaches
FROM booking_coaches bc
LEFT JOIN coaches c ON bc.coach_id = c.id
WHERE c.id IS NULL;
```

### 困難點 2: 歷史資料完整性

**問題：**
教練可能關聯大量歷史預約和回報記錄。刪除後會導致：

1. **歷史回報記錄丟失教練資訊**
   - `coach_reports` 表存有該教練過去的駕駛時數、油量記錄
   - 這些數據對統計和歷史追溯很重要

2. **參與者記錄失去來源**
   - `booking_participants` 記錄了是哪個教練回報的
   - 刪除教練後無法追溯誰回報的

3. **排班歷史丟失**
   - `booking_coaches` 和 `booking_drivers` 記錄了教練的排班歷史
   - 刪除後無法查詢該教練過去的工作記錄

### 困難點 3: 財務記錄間接影響

**問題：**
雖然 `transactions` 表不直接引用 coaches，但透過 `booking_participants` 間接關聯：

```
coaches → booking_participants → transactions
```

**影響：**
- 如果刪除教練導致 `booking_participants` 被刪除
- 會觸發 `transactions.booking_participant_id` 被設為 NULL
- 財務記錄保留但失去與教練的追溯連結

**保護機制：**
系統已設置 `ON DELETE SET NULL`，所以交易記錄不會被刪除，只是斷開連結。

### 困難點 4: 前端顯示問題

**問題：**
多個前端頁面會查詢教練資料：

- `CoachAssignment.tsx` - 教練排班頁面
- `CoachReport.tsx` - 教練回報頁面
- `StaffManagement.tsx` - 教練管理頁面
- 各種統計報表

刪除教練後，這些頁面可能會：
- 顯示空白或 "undefined"
- 查詢失敗
- JOIN 查詢返回不完整資料

---

## 🔧 解決方案

### 方案 A：完全硬刪除（困難 ⭐⭐⭐⭐）

**步驟：**

1. **添加外鍵約束**（可選，防止未來問題）
   ```sql
   -- 參考 migrations/add_foreign_key_constraints.sql
   ALTER TABLE booking_coaches
   ADD CONSTRAINT fk_booking_coaches_coach
   FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE;
   
   -- 其他表類似...
   ```

2. **建立刪除 SQL 腳本**
   ```sql
   -- 分步驟刪除，避免外鍵錯誤
   BEGIN;
   
   -- 1. 刪除教練休假記錄
   DELETE FROM coach_time_off WHERE coach_id = '<教練ID>';
   
   -- 2. 刪除排班記錄
   DELETE FROM booking_coaches WHERE coach_id = '<教練ID>';
   DELETE FROM booking_drivers WHERE driver_id = '<教練ID>';
   
   -- 3. 刪除回報記錄
   DELETE FROM coach_reports WHERE coach_id = '<教練ID>';
   
   -- 4. 處理參與者記錄（謹慎！）
   -- 選項 A: 刪除（會影響財務記錄的連結）
   DELETE FROM booking_participants WHERE coach_id = '<教練ID>';
   
   -- 選項 B: 保留但清空 coach_id
   UPDATE booking_participants SET coach_id = NULL WHERE coach_id = '<教練ID>';
   
   -- 5. 最後刪除教練
   DELETE FROM coaches WHERE id = '<教練ID>';
   
   COMMIT;
   ```

3. **前端實作刪除功能**
   在 `StaffManagement.tsx` 加入刪除按鈕和確認對話框

**優點：**
- 徹底清除資料
- 不會佔用空間

**缺點：**
- 可能影響歷史記錄追溯
- 需要額外的資料清理工作
- 風險較高

---

### 方案 B：使用現有的 status 系統（推薦 ⭐⭐）

**現況：**
系統已經有 `status` 欄位設計：
- `active` - 啟用中（所有功能都顯示）
- `inactive` - 已停用（回報/統計顯示，但預約/排班不顯示）
- `archived` - 已歸檔（完全隱藏，但資料保留）

**實作方式：**
```typescript
// 在 StaffManagement.tsx 中
const handleArchiveCoach = async (coach: Coach) => {
  // 檢查是否有未來的預約
  const { data: futureBookings } = await supabase
    .from('booking_coaches')
    .select(`
      booking_id,
      bookings!inner(id, start_at, contact_name, status)
    `)
    .eq('coach_id', coach.id)
    .gte('bookings.start_at', getLocalDateString())
    .eq('bookings.status', 'confirmed')
  
  if (futureBookings && futureBookings.length > 0) {
    alert(`⚠️ 此教練還有 ${futureBookings.length} 筆未來的預約，請先處理！`)
    return
  }
  
  // 更新為 archived
  const { error } = await supabase
    .from('coaches')
    .update({ status: 'archived' })
    .eq('id', coach.id)
  
  if (error) {
    toast.error('歸檔失敗：' + error.message)
  } else {
    toast.success('教練已歸檔')
    loadData()
  }
}
```

**優點：**
- ✅ 保留所有歷史記錄
- ✅ 可以隨時還原（改回 active）
- ✅ 風險低，不會破壞資料
- ✅ 前端只需要過濾查詢
- ✅ 符合資料庫設計原意

**缺點：**
- 資料仍佔用空間（但微乎其微）
- 需要修改所有查詢加上 status 過濾

---

## 📊 影響範圍評估

### 需要檢查的預約數量

```sql
-- 查詢某教練關聯的預約數量
SELECT 
  c.name as coach_name,
  COUNT(DISTINCT bc.booking_id) as total_bookings,
  COUNT(DISTINCT CASE WHEN b.start_at >= NOW() THEN bc.booking_id END) as future_bookings,
  COUNT(DISTINCT cr.id) as total_reports,
  COUNT(DISTINCT bp.id) as total_participants
FROM coaches c
LEFT JOIN booking_coaches bc ON c.id = bc.coach_id
LEFT JOIN bookings b ON bc.booking_id = b.id
LEFT JOIN coach_reports cr ON c.id = cr.coach_id
LEFT JOIN booking_participants bp ON c.id = bp.coach_id
WHERE c.id = '<教練ID>'
GROUP BY c.id, c.name;
```

### 查詢範例輸出

```
coach_name    | total_bookings | future_bookings | total_reports | total_participants
------------- | -------------- | --------------- | ------------- | ------------------
張教練         | 150            | 5               | 120           | 450
```

**解讀：**
- 如果 `future_bookings > 0`：不建議刪除，會影響未來排班
- 如果 `total_participants > 0`：刪除會影響財務追溯
- 如果 `total_reports > 0`：刪除會丟失歷史回報記錄

---

## ✅ 建議做法

### 🥇 推薦：使用 archived 狀態（方案 B）

理由：
1. **安全**：不破壞現有資料
2. **可逆**：需要時可以還原
3. **簡單**：前端改動少
4. **符合設計**：系統本來就有 status 欄位

### 實作步驟

1. **在 `StaffManagement.tsx` 加入歸檔功能**
   - 加入「歸檔」按鈕
   - 檢查未來預約
   - 更新 status 為 'archived'

2. **修改查詢過濾**
   - 所有查詢教練的地方加上 `.neq('status', 'archived')`
   - 或者 `.in('status', ['active', 'inactive'])`

3. **加入「顯示已歸檔」開關**
   - 管理員需要時可以查看已歸檔的教練
   - 可以還原或查看歷史

### 🥈 次選：完全硬刪除（方案 A）

**只在以下情況考慮：**
- 教練完全沒有任何歷史記錄
- 是測試資料需要清理
- 確定不需要追溯任何歷史

**實作前必須：**
1. 完整備份資料庫
2. 確認沒有未來預約
3. 通知相關人員
4. 準備好回滾方案

---

## 🛠️ 如果你想實作刪除功能

我可以幫你：

1. **建立 SQL 刪除腳本**（含安全檢查）
2. **在前端加入歸檔/刪除按鈕**（StaffManagement.tsx）
3. **加入外鍵約束**（防止未來出現髒資料）
4. **建立檢查工具**（檢查教練是否可以安全刪除）

請告訴我你想要哪種方案，我會立即開始實作！

---

## 📝 總結

**為什麼「聽說很硬」？**

1. ⚠️ 缺少外鍵約束保護
2. ⚠️ 會影響多個關聯表（5+ 個表）
3. ⚠️ 可能產生髒資料
4. ⚠️ 影響歷史記錄追溯
5. ⚠️ 需要處理財務記錄連結

**但其實不必刪除！**

系統已經設計了 `archived` 狀態來處理這個問題。建議使用歸檔而不是刪除，這樣：
- ✅ 安全
- ✅ 可逆
- ✅ 保留歷史
- ✅ 實作簡單

---

**需要我協助實作嗎？請告訴我你想要哪種方案！** 🚀

