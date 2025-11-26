# 🐛 Bug 修復完成報告

**完成日期:** 2025-11-26

---

## ✅ 已完成的修復

### 1. ✅ Sentry 錯誤監控設置說明

**問題:** 用戶不知道如何啟動 Sentry 錯誤監控

**解決方案:**
- 建立了完整的 `SENTRY_SETUP.md` 文檔
- Sentry 已經在 `src/main.tsx` 中配置完成
- 只需要：
  1. 在 Sentry.io 取得 DSN
  2. 在 Vercel 設定環境變數 `VITE_SENTRY_DSN`
  3. 重新部署

**相關文件:**
- `SENTRY_SETUP.md` (新增)
- `src/main.tsx` (已配置)

---

### 2. ✅ 會員搜尋的 State 同步問題

**問題:** 
在 `useMemberSearch.ts` 中，`handleSearchChange` 函數使用 `filteredMembers.length` 判斷是否顯示下拉選單，但 `filteredMembers` 是透過 `useMemo` 計算的，依賴 `searchTerm` state。由於 `setSearchTerm` 是異步的，所以判斷時可能用到舊值，造成競態條件。

**修復前:**
```typescript
const handleSearchChange = (value: string) => {
  setSearchTerm(value)
  setSelectedMemberId(null)
  setManualName(value)
  setShowDropdown(filteredMembers.length > 0) // ⚠️ 用到舊的 filteredMembers
}
```

**修復後:**
```typescript
const handleSearchChange = (value: string) => {
  setSearchTerm(value)
  setSelectedMemberId(null)
  setManualName(value)
  // ✅ 直接用 value 判斷，不依賴 state
  const hasResults = value.trim().length > 0 && members.some(m =>
    m.name.toLowerCase().includes(value.toLowerCase()) ||
    m.nickname?.toLowerCase().includes(value.toLowerCase()) ||
    m.phone?.includes(value)
  )
  setShowDropdown(hasResults)
}
```

**相關文件:**
- `src/hooks/useMemberSearch.ts` (已修復)

---

### 3. ✅ 衝突檢查的清理時間假設問題

**問題:**
`bookingConflict.ts` 的 `checkBoatConflict` 函數假設同一艘船的所有預約清理時間相同。但如果船隻屬性從「船」改成「設施」（或反過來），歷史預約的清理時間可能不正確。

**修復方案:**
1. **資料庫層面:**
   - 新增 `bookings.cleanup_minutes` 欄位（預設 15）
   - 自動更新歷史資料（設施為 0，船隻為 15）
   - 新增索引提升查詢性能

2. **應用層面:**
   - 建立預約時自動設定 `cleanup_minutes`
   - 衝突檢查時使用資料庫儲存的值，不再假設

**修復前:**
```typescript
// ⚠️ 假設所有預約清理時間相同
const existingSlot = calculateTimeSlot(existingTime, existing.duration_min, cleanupMinutes)
```

**修復後:**
```typescript
// ✅ 使用資料庫儲存的清理時間
const existingCleanupMinutes = (existing as any).cleanup_minutes ?? 15
const existingSlot = calculateTimeSlot(existingTime, existing.duration_min, existingCleanupMinutes)
```

**相關文件:**
- `migrations/044_add_cleanup_minutes_to_bookings.sql` (新增)
- `src/utils/bookingConflict.ts` (已修復)
- `src/components/NewBookingDialog.tsx` (已修復)
- `src/components/RepeatBookingDialog.tsx` (已修復)
- `src/components/EditBookingDialog.tsx` (已修復)

**Migration 錯誤修復:**
- 移除索引中的 `DATE()` 函數（不是 IMMUTABLE）
- 改為直接在 `start_at` 上建立索引

---

### 4. ✅ 批次操作的交易保護

**問題:**
`PendingDeductionItem` 處理扣款時，分成多個步驟：
1. 更新會員餘額
2. 記錄交易
3. 標記已處理

如果中間任一步驟失敗，資料會不一致。

**修復方案:**
建立資料庫交易函數 `process_deduction_transaction`，確保原子性（要麼全部成功，要麼全部回滾）。

**功能特點:**
- ✅ 使用 `FOR UPDATE` 鎖定會員記錄（防止併發問題）
- ✅ 支援多筆扣款項目
- ✅ 累積計算餘額（避免重複查詢）
- ✅ 自動回滾錯誤
- ✅ 返回詳細的成功/失敗資訊

**修復前:**
```typescript
// ⚠️ 多個獨立的資料庫操作，沒有交易保護
for (const item of deductionItems) {
  await supabase.from('members').update(updates).eq('id', memberId)
  await supabase.from('transactions').insert(transactionData)
}
await supabase.from('booking_participants').update({ status: 'processed' })
```

**修復後:**
```typescript
// ✅ 使用資料庫交易函數
const { data: result } = await supabase.rpc('process_deduction_transaction', {
  p_member_id: report.member_id,
  p_participant_id: report.id,
  p_operator_id: operatorId,
  p_deductions: deductionsData
})

if (!result?.success) {
  throw new Error(result?.error)
}
```

**相關文件:**
- `migrations/045_add_deduction_transaction_function.sql` (新增)
- `src/components/PendingDeductionItem.tsx` (已修復)

---

### 5. ✅ 移除手勢操作功能

**原因:**
手勢操作在特定情況下容易誤觸：
- 用戶在滾動列表時可能觸發左右滑動
- 在輸入框中選取文字時可能觸發手勢
- 與原生滑動手勢可能衝突

**移除內容:**
- 刪除 `src/hooks/useSwipeGesture.ts`
- 刪除 `src/hooks/usePullToRefresh.ts`
- 移除 `DayView.tsx` 中的相關引用和 UI

**相關文件:**
- `src/hooks/useSwipeGesture.ts` (已刪除)
- `src/hooks/usePullToRefresh.ts` (已刪除)
- `src/pages/DayView.tsx` (已清理)

---

## 📝 需要執行的 Migrations

執行以下 SQL 文件來應用資料庫變更：

```sql
-- 1. 新增清理時間欄位
\i migrations/044_add_cleanup_minutes_to_bookings.sql

-- 2. 建立扣款交易函數
\i migrations/045_add_deduction_transaction_function.sql
```

或透過 Supabase Dashboard 執行：
1. 進入 Supabase Dashboard
2. 選擇 SQL Editor
3. 依序執行兩個 migration 文件的內容

---

## 🎯 改進摘要

### 資料一致性
- ✅ 扣款操作現在有完整的交易保護
- ✅ 清理時間不再依賴假設，直接儲存在資料庫

### 用戶體驗
- ✅ 移除容易誤觸的手勢操作
- ✅ 會員搜尋更穩定，沒有競態條件

### 可維護性
- ✅ Sentry 錯誤監控說明完整
- ✅ 代碼更簡潔，更容易理解

---

## ⚠️ 注意事項

### 1. 資料庫 Migration
需要手動執行兩個 migration 文件。執行順序很重要：
1. 先執行 044（新增欄位）
2. 再執行 045（新增函數）

### 2. 舊資料處理
Migration 044 會自動處理歷史資料：
- 彈簧床預約的 `cleanup_minutes` 設為 0
- 其他船隻預約的 `cleanup_minutes` 設為 15（預設值）

### 3. 測試建議
建議測試以下場景：
- ✅ 建立新預約（檢查 cleanup_minutes 是否正確）
- ✅ 編輯預約（檢查衝突檢查是否正確）
- ✅ 扣款處理（檢查交易是否正確回滾）
- ✅ 會員搜尋（快速輸入測試）

---

## 🚀 部署檢查清單

- [ ] 執行 Migration 044
- [ ] 執行 Migration 045
- [ ] 測試扣款功能（成功和失敗情況）
- [ ] 測試預約衝突檢查
- [ ] 測試會員搜尋
- [ ] 確認 DayView 載入正常（沒有手勢操作錯誤）
- [ ] （選用）設定 Sentry DSN 並測試錯誤追蹤

---

**完成時間:** 2025-11-26
**修復項目:** 5 項
**新增文件:** 3 個
**修改文件:** 7 個
**刪除文件:** 2 個

