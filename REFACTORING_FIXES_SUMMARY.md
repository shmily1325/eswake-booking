# 重構問題修復總結

**日期**: 2024-11-24  
**問題**: 重構後系統一直卡在奇怪的 bug

---

## 🔥 核心問題：useEffect 無限循環

### 根本原因
將代碼重構成 custom hooks 後，在 useEffect 的依賴陣列中放入了函數（如 `fetchAllData`, `performConflictCheck`），導致：
1. 函數每次渲染時重新創建
2. useEffect 檢測到依賴變化
3. 再次執行 → 觸發狀態更新
4. 組件重新渲染 → 回到步驟 1
5. **無限循環** 💥

---

## ✅ 已修復的文件

### 1. **src/components/NewBookingDialog.tsx** (2 處)
```typescript
// ❌ 前
useEffect(() => {
  if (isOpen) fetchAllData()
}, [isOpen, fetchAllData])

// ✅ 後
useEffect(() => {
  if (isOpen) fetchAllData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen])
```

**影響**: 新增預約對話框不再無限重新載入

---

### 2. **src/hooks/useGlobalCache.ts** (2 處)
```typescript
// ❌ 前
useEffect(() => {
  fetchCoaches()
}, [fetchCoaches])

// ✅ 後  
useEffect(() => {
  fetchCoaches()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

**影響**: 教練和船隻資料緩存正常工作

---

### 3. **src/hooks/useBookingForm.ts**
添加 timer cleanup：
```typescript
// Cleanup timer on unmount
useEffect(() => {
    return () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }
    }
}, [])
```

**影響**: 防止記憶體洩漏

---

### 4. **src/pages/admin/BoatManagement.tsx**
```typescript
useEffect(() => {
  if (user) loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user])
```

---

### 5. **src/pages/coach/CoachDailyView.tsx**
```typescript
useEffect(() => {
  Promise.all([loadBoats(), loadCoaches(), loadBookings()])
  // ... realtime subscription setup
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [dateParam])
```

---

### 6. **src/pages/coach/CoachAssignment.tsx**
```typescript
useEffect(() => {
  loadCoaches()
  loadBookings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedDate])
```

---

### 7. **src/pages/member/MemberManagement.tsx**
- 移除重複的 `getLocalDateString` 實現
- 改用 `import { getLocalDateString } from '../../utils/date'`
- 修復 useEffect 依賴

```typescript
useEffect(() => {
  loadMembers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [showInactive])
```

---

### 8. **src/pages/DayView.tsx**
```typescript
useEffect(() => {
  fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [dateParam])
```

---

## 🐛 第二個問題：Object.values 錯誤

### 問題
```
TypeError: Cannot convert undefined or null to object
  at Object.values (<anonymous>)
```

### 根本原因
`VirtualizedBookingList` 組件使用 react-window 庫，該庫內部會對 `itemData` 調用 `Object.values`。

在以下情況可能出錯：
- React 18 並發渲染
- 組件快速掛載/卸載
- Supabase 請求失敗
- 熱重載（HMR）

### 修復：src/components/VirtualizedBookingList.tsx

添加防禦性檢查：

```typescript
// ❌ 前
const boatBookingsMap = React.useMemo(() => {
  const map = new Map<number, Booking[]>()
  boats.forEach(boat => {
    // ...
  })
  return map
}, [boats, bookings])

// ✅ 後
const boatBookingsMap = React.useMemo(() => {
  const map = new Map<number, Booking[]>()
  const safeBoats = boats || []
  const safeBookings = bookings || []
  
  safeBoats.forEach(boat => {
    // ...
  })
  return map
}, [boats, bookings])
```

**影響**: 預約表（DayView）可以正常進入

---

## 🛡️ 第三個問題：CoachAdmin 的防禦性檢查

### 修復：src/pages/coach/CoachAdmin.tsx

```typescript
// ❌ 前
const groupedPendingReports = pendingReports.reduce((acc, report) => {
  const key = `${report.bookings.id}`
  // ...
}, {})

// ✅ 後
const groupedPendingReports = (pendingReports || []).reduce((acc, report) => {
  const key = `${report.bookings?.id || 'unknown'}`
  if (!acc[key]) {
    acc[key] = {
      booking: report.bookings || {},
      reports: []
    }
  }
  // ...
}, {})
```

---

## 📊 修復統計

| 類別 | 數量 | 狀態 |
|------|------|------|
| useEffect 無限循環 | 8 處 | ✅ 已修復 |
| 記憶體洩漏 | 1 處 | ✅ 已修復 |
| Object.values 錯誤 | 1 處 | ✅ 已修復 |
| 防禦性檢查 | 2 處 | ✅ 已修復 |

---

## 🎯 核心學習

### 1. useEffect 依賴原則
```typescript
// ❌ 錯誤：放入會變化的函數
useEffect(() => {
  someFunction()
}, [someFunction])

// ✅ 正確：只放狀態變數
useEffect(() => {
  someFunction()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [stateVariable])
```

### 2. useCallback 的陷阱
```typescript
// ❌ useCallback 的依賴陣列本身也要正確
const fetchData = useCallback(async () => {
  // ...
}, [deps1, deps2, deps3]) // 如果這些 deps 一直變，還是會無限循環

// ✅ 最好不要在 useEffect 依賴中放函數
```

### 3. 防禦性編程
```typescript
// ✅ 處理第三方庫時永遠假設 props 可能是 null/undefined
const safeData = data || []
const safeValue = value ?? defaultValue
```

---

## 🚀 修復效果

### Before（重構前）
- ❌ 應用卡頓、無限重新渲染
- ❌ 無法進入預約表頁面
- ❌ 新增預約對話框一直載入
- ❌ 潛在記憶體洩漏

### After（修復後）
- ✅ 應用流暢運行
- ✅ 所有頁面正常訪問
- ✅ 對話框正常打開
- ✅ 無記憶體洩漏
- ✅ 防禦性保護到位

---

## 📝 建議

### 未來重構時的 Checklist

1. ✅ useCallback 的函數不要放在 useEffect 依賴中
2. ✅ 只把會變化的**狀態變數**放在依賴陣列
3. ✅ setTimeout/setInterval 一定要清理
4. ✅ 第三方庫的 props 要做防禦性檢查
5. ✅ 重構後立即測試，不要累積多個改動

### Code Review 重點

- 檢查所有 useEffect 的依賴陣列
- 檢查所有 useCallback 的使用
- 確認 timer/subscription 有清理
- 驗證第三方組件的 props 驗證

---

## 結論

這次重構遇到的問題都是 **React Hooks 的經典陷阱**，特別是：
1. **useEffect 依賴陣列處理不當**
2. **缺少清理邏輯**
3. **缺少防禦性檢查**

經過系統性的修復，應用現在運行穩定！🎉

主要是因為重構時將邏輯抽取到 custom hooks，但沒有正確處理函數依賴關係，導致一系列連鎖反應。

**教訓**：重構時要特別小心 useEffect 和 useCallback 的依賴陣列！

