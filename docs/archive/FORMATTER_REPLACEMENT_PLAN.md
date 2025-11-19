# 格式化函數替換計劃

**目標：** 逐步將現有的格式化邏輯替換為 `src/utils/formatters.ts` 中的工具函數  
**原則：** 確保 100% 行為一致，不影響任何現有功能

---

## 🔍 已發現的可替換項目

### 1. 日期時間提取 (高優先級，低風險)

**當前寫法：**
```typescript
booking.start_at.substring(0, 10)  // 提取日期 YYYY-MM-DD
booking.start_at.substring(11, 16) // 提取時間 HH:mm
```

**替換為：**
```typescript
import { extractDate, extractTime } from '../utils/formatters'

extractDate(booking.start_at)  // 提取日期 YYYY-MM-DD
extractTime(booking.start_at)  // 提取時間 HH:mm
```

**影響的文件：**
- `src/components/CoachReportFormDialog.tsx` (1 處)
- `src/pages/CoachAdmin.tsx` (6 處)
- `src/pages/CoachReport.tsx` (1 處)
- `src/pages/CoachOverview.tsx` (4 處)
- `src/components/StatisticsTab.tsx` (多處)
- `src/pages/BackupPage.tsx` (5 處)
- `src/components/NewBookingDialog.tsx` (1 處)

**風險評估：** ⭐ 極低
- 函數行為完全相同
- 已有完整的錯誤處理
- 有 JSDoc 文檔

---

### 2. 付款方式標籤 (中優先級，低風險)

**當前寫法：**
```typescript
// 內聯判斷或硬編碼標籤
payment_method === 'cash' ? '現金' : ...
```

**替換為：**
```typescript
import { getPaymentMethodLabel } from '../utils/formatters'

getPaymentMethodLabel(payment_method)
```

**需要先檢查：** 是否有實際使用場景

**風險評估：** ⭐⭐ 低
- 需要確保標籤完全一致

---

### 3. 課程類型標籤 (中優先級，低風險)

**當前寫法：**
```typescript
// 可能在某些地方有轉換邏輯
lesson_type === 'designated_paid' ? '指定（需收費）' : ...
```

**替換為：**
```typescript
import { getLessonTypeLabel } from '../utils/formatters'

getLessonTypeLabel(lesson_type)
```

**風險評估：** ⭐⭐ 低

---

### 4. 會員顯示名稱 (中優先級，低風險)

**當前寫法：**
```typescript
member.nickname || member.name
```

**替換為：**
```typescript
import { getMemberDisplayName } from '../utils/formatters'

getMemberDisplayName(member)
```

**風險評估：** ⭐⭐ 低
- 需要確保 null 處理一致

---

## 📋 執行計劃

### Phase 1: 日期時間提取 (最安全)
1. ✅ 創建替換計劃文檔
2. ✅ 替換 `CoachReportFormDialog.tsx` (1 處)
3. ✅ 替換 `CoachReport.tsx` (1 處)  
4. ✅ 替換 `CoachAdmin.tsx` (6 處)
5. ⏳ 替換其他文件 (CoachOverview, StatisticsTab, BackupPage, NewBookingDialog)

### Phase 2: 標籤轉換
1. ⏳ 檢查實際使用場景
2. ⏳ 逐個替換

### Phase 3: 其他格式化
1. ⏳ 識別其他可優化的地方
2. ⏳ 評估風險後執行

---

## ✅ 驗證清單

每次替換後必須檢查：
- [ ] Linter 無錯誤
- [ ] TypeScript 編譯通過
- [ ] 輸出格式完全一致
- [ ] 無運行時錯誤
- [ ] UI 顯示正常

---

## 🎯 成功標準

- ✅ 所有替換不改變任何顯示內容
- ✅ 無新增 linter 錯誤
- ✅ 無新增 TypeScript 錯誤
- ✅ 代碼更簡潔易讀
- ✅ 提高可維護性

---

**更新時間：** 2025-11-19  
**狀態：** 進行中 - Phase 1

