# 🔍 程式碼品質分析報告

生成時間: 2025-11-09

---

## 📊 整體評估

| 項目 | 評分 | 說明 |
|------|------|------|
| **程式碼結構** | ⭐⭐⭐⭐ | 模組化良好，但部分組件過大 |
| **時間處理** | ⭐⭐⭐⭐⭐ | 使用純字串處理，避免時區問題 |
| **錯誤處理** | ⭐⭐⭐ | 有基本錯誤處理，可加強 |
| **性能** | ⭐⭐⭐⭐ | 使用了 useMemo，但有改善空間 |
| **可維護性** | ⭐⭐⭐ | 部分邏輯重複，需要重構 |

**總評**: 系統整體架構良好，但有一些可以改善的地方。

---

## ⚠️ 高優先級問題

### 1. 🔴 重複的衝突檢查邏輯

**位置**: 
- `src/components/NewBookingDialog.tsx` (line 288-343)
- `src/components/EditBookingDialog.tsx` (line 270-314)
- `src/utils/bookingConflict.ts` (已封裝但未被使用)

**問題**: 
衝突檢查邏輯在 NewBookingDialog 和 EditBookingDialog 中重複實現，而 `bookingConflict.ts` 中已經有封裝好的函數但沒有被使用。

**影響**: 
- 維護困難：修改邏輯需要改三個地方
- 容易出錯：邏輯不一致可能導致bug
- 程式碼冗餘：約200行重複程式碼

**建議修復**:
```typescript
// NewBookingDialog.tsx 中替換現有的衝突檢查
import { checkBoatConflict, checkCoachConflict } from '../utils/bookingConflict'

// 替換 line 294-343 的船隻衝突檢查
const conflictResult = await checkBoatConflict(
  selectedBoatId,
  dateStr,
  timeStr,
  durationMin
)

if (conflictResult.hasConflict) {
  hasConflict = true
  conflictReason = conflictResult.reason
}
```

---

### 2. 🔴 教練衝突檢查的複雜查詢

**位置**: `src/components/NewBookingDialog.tsx` (line 346-419)

**問題**: 
教練衝突檢查涉及多次資料庫查詢：
1. 查詢 booking_coaches（所有教練的預約關聯）
2. 查詢 bookings（預約詳情）
3. 過濾同一天的預約
4. 逐一檢查時間衝突

**性能影響**:
- 如果選擇3位教練，需要進行 3 × 2 = 6次資料庫查詢
- 重複預約4週 × 3位教練 = 24次額外查詢

**建議優化**:
```typescript
// 一次查詢所有教練在該日期的預約
const { data: coachBookingsData } = await supabase
  .from('booking_coaches')
  .select(`
    coach_id,
    bookings!inner(
      id,
      start_at,
      duration_min,
      contact_name
    )
  `)
  .in('coach_id', selectedCoaches)
  .gte('bookings.start_at', `${dateStr}T00:00:00`)
  .lte('bookings.start_at', `${dateStr}T23:59:59`)

// 一次性檢查所有教練
```

**預期改善**: 從 O(n×m) 降到 O(1) 查詢次數

---

### 3. 🟡 DayView.tsx 組件過大

**位置**: `src/pages/DayView.tsx` (1053 lines)

**問題**: 
單一組件包含太多職責：
- 預約顯示（列表 + 時間軸）
- 日期導航
- 船隻過濾
- 對話框管理
- 排班管理狀態（未使用）

**影響**:
- 難以理解和維護
- 測試困難
- 性能：每次狀態變更可能觸發大量重新渲染

**建議重構**:
```
DayView.tsx (主容器)
├── DateNavigation.tsx (日期選擇和導航)
├── ViewModeToggle.tsx (列表/時間軸切換)
├── BookingListView.tsx (列表視圖)
│   └── BookingListItem.tsx
└── BookingTimelineView.tsx (時間軸視圖)
    └── BookingCell.tsx
```

---

### 4. 🟡 未處理的錯誤情況

**位置**: 多處

**問題示例**:

```typescript
// NewBookingDialog.tsx line 467
if (selectedCoaches.length > 0 && insertedBooking) {
  const { error: coachInsertError } = await supabase
    .from('booking_coaches')
    .insert(bookingCoachesToInsert)

  if (coachInsertError) {
    // ❌ 只刪除預約並跳過，但沒有回滾會員關聯
    await supabase.from('bookings').delete().eq('id', insertedBooking.id)
    results.skipped.push({...})
    continue
  }
}
```

**風險**: 
資料不一致：預約被刪除但 booking_members 可能已插入

**建議**: 
使用 Supabase RPC 進行事務操作，或改善錯誤處理流程

---

### 5. 🟡 未使用的狀態變數

**位置**: `src/pages/DayView.tsx` (line 91-99)

```typescript
// 排班管理狀態
const [assignments, setAssignments] = useState<Record<number, {
  coachIds: string[]
  driverIds: string[]
  notes: string
}>>({})
const [saving, setSaving] = useState(false)
const [saveSuccess, setSaveSuccess] = useState('')
const [saveError, setSaveError] = useState('')
```

**問題**: 這些狀態在整個組件中完全沒有被使用

**影響**: 
- 增加記憶體佔用
- 造成困惑（看起來像未完成的功能）

**建議**: 移除或實作相關功能

---

## ✅ 做得好的地方

### 1. ⭐ 時間處理策略優秀

**位置**: `src/utils/date.ts` 和所有時間相關邏輯

**優點**:
```typescript
// ✅ 正確：使用純字串處理
const datetime = booking.start_at.substring(0, 16) // "2025-11-01T13:55"
const [dateStr, timeStr] = datetime.split('T')

// ❌ 錯誤：使用 new Date() 會有時區問題
const date = new Date(booking.start_at) // 可能會偏移8小時
```

**影響**: 完全避免了時區相關的bug

---

### 2. ⭐ 使用 useMemo 優化性能

**位置**: 多處

```typescript
const selectedCoachesSet = useMemo(() => new Set(selectedCoaches), [selectedCoaches])
const activityTypesSet = useMemo(() => new Set(activityTypes), [activityTypes])
const filteredTimeSlots = useMemo(() => {...}, [timeRange])
```

**效果**: 減少不必要的重新計算

---

### 3. ⭐ 詳細的衝突錯誤訊息

**位置**: NewBookingDialog.tsx (line 320-341)

```typescript
// ✅ 清楚告知用戶問題所在
conflictReason = `與 ${existing.contact_name} 的預約衝突：
  ${existing.contact_name} 在 ${existingEndTime} 結束，
  需要15分鐘接船時間。您的預約 ${timeStr} 太接近了。`
```

**優點**: 用戶能清楚知道為什麼衝突，不會一頭霧水

---

### 4. ⭐ 多會員支援設計良好

**位置**: NewBookingDialog.tsx, EditBookingDialog.tsx

**優點**:
- 支援會員多選
- 支援會員 + 非會員混合
- UI清楚區分會員（藍色）和非會員（橘色）
- booking_members 表正確維護多對多關係

---

## 🎯 改善建議優先級

### 立即修復（本週）
1. ✅ **使用 bookingConflict.ts 重構衝突檢查** - 減少重複程式碼
2. ✅ **移除未使用的狀態變數** - 清理程式碼
3. ✅ **加強錯誤處理** - 避免資料不一致

### 短期改善（本月）
4. **優化教練衝突查詢** - 提升性能
5. **拆分 DayView 組件** - 提高可維護性
6. **加入單元測試** - 確保重構不出錯

### 長期優化（下季）
7. **使用 React Query** - 更好的資料管理
8. **實作樂觀更新** - 提升用戶體驗
9. **加入 E2E 測試** - 自動化測試關鍵流程

---

## 🐛 潛在Bug清單

### Bug #1: 編輯預約時會員下拉選單位置錯誤

**位置**: EditBookingDialog.tsx (line 849)

```typescript
top: 'calc(100% + 50px)', // ❌ 硬編碼 50px
```

**問題**: 如果上方有標籤，下拉選單會顯示在錯誤位置

**修復**:
```typescript
top: '100%', // 相對於輸入框
```

---

### Bug #2: 重複預約時沒有檢查結束日期是否小於開始日期

**位置**: NewBookingDialog.tsx (line 1230-1247)

**風險**: 用戶可能誤設結束日期早於開始日期

**建議**:
```typescript
<input
  type="date"
  value={repeatEndDate}
  onChange={(e) => {
    if (e.target.value < startDate) {
      alert('結束日期不能早於開始日期')
      return
    }
    setRepeatEndDate(e.target.value)
  }}
  min={startDate} // ✅ 加入這行
  ...
/>
```

---

### Bug #3: 彈簧床的特殊規則未完全實作

**位置**: DayView.tsx (line 276-299)

```typescript
const isCleanupTime = (boatId: number, timeSlot: string): boolean => {
  const boat = boats.find(b => b.id === boatId)
  if (boat && boat.name === '彈簧床') return false // ✅ 正確

  // 但在衝突檢查時沒有考慮彈簧床
  // NewBookingDialog.tsx 和 EditBookingDialog.tsx 的衝突檢查
  // 都固定使用15分鐘清理時間
}
```

**建議**: 
在 bookingConflict.ts 中加入船隻類型參數：

```typescript
export async function checkBoatConflict(
  boatId: number,
  boatName: string, // ✅ 加入船名
  dateStr: string,
  startTime: string,
  durationMin: number
): Promise<ConflictResult> {
  const cleanupTime = boatName === '彈簧床' ? 0 : 15
  const newSlot = calculateTimeSlot(startTime, durationMin, cleanupTime)
  // ...
}
```

---

## 📈 性能分析

### 當前性能瓶頸

1. **fetchBookingsWithCoaches** (DayView.tsx line 186-221)
   - 問題：N+1 查詢（先查預約，再查教練）
   - 改善：使用 JOIN 一次查詢完成

2. **重複預約的循環查詢** (NewBookingDialog.tsx line 271-522)
   - 問題：每週都要查詢一次船隻和教練衝突
   - 改善：批次查詢所有週數的預約，一次性檢查

3. **教練列表載入** (多處)
   - 問題：每次打開對話框都重新查詢
   - 改善：全域快取 + 定時更新

---

## 🧪 測試覆蓋率建議

### 關鍵測試案例

```typescript
// 1. 時間計算測試
describe('timeToMinutes', () => {
  it('應該正確轉換時間', () => {
    expect(timeToMinutes('10:30')).toBe(630)
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

// 2. 衝突檢查測試
describe('checkTimeSlotConflict', () => {
  it('時間重疊應該衝突', () => {
    const slot1 = { startMinutes: 600, endMinutes: 660, cleanupEndMinutes: 675 }
    const slot2 = { startMinutes: 630, endMinutes: 690, cleanupEndMinutes: 705 }
    expect(checkTimeSlotConflict(slot1, slot2)).toBe(true)
  })
  
  it('接船時間衝突應該檢測', () => {
    const slot1 = { startMinutes: 600, endMinutes: 660, cleanupEndMinutes: 675 }
    const slot2 = { startMinutes: 670, endMinutes: 730, cleanupEndMinutes: 745 }
    expect(checkTimeSlotConflict(slot1, slot2)).toBe(true) // 670 < 675
  })
  
  it('15分鐘後應該不衝突', () => {
    const slot1 = { startMinutes: 600, endMinutes: 660, cleanupEndMinutes: 675 }
    const slot2 = { startMinutes: 675, endMinutes: 735, cleanupEndMinutes: 750 }
    expect(checkTimeSlotConflict(slot1, slot2)).toBe(false)
  })
})

// 3. 多會員名稱組合測試
describe('多會員預約', () => {
  it('應該正確組合會員和非會員名稱', () => {
    const memberNames = ['陳大明', '李小華']
    const manualName = '訪客A'
    const result = [...memberNames, manualName].join(', ')
    expect(result).toBe('陳大明, 李小華, 訪客A')
  })
})
```

---

## 📝 程式碼風格建議

### 1. 統一命名規範

**不一致的地方**:
```typescript
// ❌ 混用
const coachBookingIds // camelCase
const booking_coaches // snake_case
```

**建議**:
- 前端變數：camelCase (`coachBookingIds`)
- 資料庫欄位：snake_case (`booking_coaches`)
- 介面名稱：PascalCase (`BookingCoach`)

### 2. 提取魔術數字

```typescript
// ❌ 魔術數字
const cleanupEndMinutes = endMinutes + 15
const slots = Math.ceil(booking.duration_min / 15)
if (hour < 8 && selectedCoaches.length === 0)

// ✅ 使用常數
const CLEANUP_TIME_MINUTES = 15
const TIME_SLOT_MINUTES = 15
const EARLY_BOOKING_HOUR_LIMIT = 8

const cleanupEndMinutes = endMinutes + CLEANUP_TIME_MINUTES
const slots = Math.ceil(booking.duration_min / TIME_SLOT_MINUTES)
if (hour < EARLY_BOOKING_HOUR_LIMIT && selectedCoaches.length === 0)
```

### 3. 加入 TypeScript 嚴格模式

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

---

## 🎓 最佳實踐檢查

| 實踐 | 狀態 | 說明 |
|------|------|------|
| DRY (Don't Repeat Yourself) | ⚠️ | 衝突檢查邏輯重複 |
| SOLID 原則 | ⚠️ | DayView 違反單一職責 |
| 錯誤處理 | ⚠️ | 部分錯誤未妥善處理 |
| 程式碼註解 | ⚠️ | 關鍵邏輯缺少註解 |
| 型別安全 | ✅ | 良好使用 TypeScript |
| 性能優化 | ✅ | 適當使用 useMemo |
| 可測試性 | ⚠️ | 缺少單元測試 |
| 無障礙設計 | ❌ | 未考慮 ARIA 標籤 |

---

## 🚀 下一步行動計畫

### Week 1: 清理與重構
- [ ] 使用 bookingConflict.ts 重構衝突檢查
- [ ] 移除未使用的狀態變數
- [ ] 修復 Bug #1, #2, #3
- [ ] 提取魔術數字為常數

### Week 2: 測試與驗證
- [ ] 使用 TEST_HELPER.html 完成所有測試場景
- [ ] 記錄並修復發現的問題
- [ ] 加入關鍵功能的單元測試

### Week 3: 優化與改善
- [ ] 優化教練衝突查詢性能
- [ ] 重構 DayView 組件（拆分）
- [ ] 加入錯誤邊界和重試機制

### Week 4: 部署與監控
- [ ] 部署到測試環境
- [ ] 進行壓力測試
- [ ] 建立監控和日誌系統

---

## 💡 總結

### 優點
✅ 時間處理策略優秀，完全避免時區問題  
✅ 多會員功能設計良好  
✅ 錯誤訊息清晰易懂  
✅ 適當使用性能優化技巧

### 需要改善
⚠️ 重複程式碼過多，需重構  
⚠️ 部分組件過大，違反單一職責  
⚠️ 錯誤處理可以更完善  
⚠️ 缺少自動化測試

### 整體評價
**B+ (85分)** - 這是一個功能完整、架構合理的系統，但仍有改善空間。建議按照上述行動計畫逐步優化。

---

*報告結束 - 繼續努力！💪*

