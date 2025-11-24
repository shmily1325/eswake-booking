# 安全性輔助工具使用指南

## 問題背景

在處理從 API 獲取的資料時，經常遇到 `Cannot read properties of null` 錯誤。這些錯誤通常發生在：

1. 資料庫 LEFT JOIN 返回 null（例如：會員被刪除）
2. API 返回不完整的資料
3. 非會員預約（某些關聯欄位為 null）

## 解決方案

使用 `src/utils/safetyHelpers.ts` 中的工具函數來**統一驗證和過濾資料**。

## 核心函數

### 1. 資料驗證函數

```typescript
import { validateBoats, validateBookings, validateCoaches } from '@/utils/safetyHelpers'

// 在組件中使用
const validBoats = useMemo(() => validateBoats(boats), [boats])
const validBookings = useMemo(() => validateBookings(bookings), [bookings])
```

**優點：**
- 自動過濾掉 null/undefined
- 驗證必要欄位存在
- TypeScript 類型保證

### 2. 安全存取函數

```typescript
import { safeBoatName, safeMemberName, safeFindById } from '@/utils/safetyHelpers'

// 安全取得船隻名稱（不會報錯）
const boatName = safeBoatName(booking.boats)  // 如果為 null 返回 "未知船隻"

// 安全查找
const boat = safeFindById(boats, boatId)  // 返回 Boat | null
```

### 3. 陣列處理函數

```typescript
import { filterNullish, safeMap } from '@/utils/safetyHelpers'

// 過濾掉 null/undefined
const validMembers = filterNullish(booking.booking_members)

// 安全映射（自動過濾）
const memberNames = safeMap(
  booking.booking_members,
  (bm) => bm.members?.name
)
```

## 實際案例

### Before（容易出錯）

```typescript
{boats.map(boat => {
  const bookings = allBookings.filter(b => b.boat_id === boat.id)
  // ❌ 如果 boat 或 boat.id 是 null 會報錯
})}
```

### After（安全）

```typescript
const validBoats = useMemo(() => validateBoats(boats), [boats])
const validBookings = useMemo(() => validateBookings(allBookings), [allBookings])

{validBoats.map(boat => {
  const bookings = validBookings.filter(b => b.boat_id === boat.id)
  // ✅ 保證 boat 和 boat.id 存在
})}
```

## 最佳實踐

### 1. 在組件入口處驗證資料

```typescript
function MyComponent({ boats, bookings }: Props) {
  // 立即驗證，確保後續使用安全
  const validBoats = useMemo(() => validateBoats(boats), [boats])
  const validBookings = useMemo(() => validateBookings(bookings), [bookings])
  
  // 後續直接使用 validBoats 和 validBookings
}
```

### 2. 使用開發環境代理偵測問題

```typescript
import { createSafeProxy } from '@/utils/safetyHelpers'

// 開發環境會在 console 警告 null 存取
const safeBooking = createSafeProxy(booking, 'booking')
console.log(safeBooking.boats?.name)  // 如果 boats 是 null 會有警告
```

### 3. 資料庫查詢時處理 JOIN

```typescript
// 查詢時
const { data } = await supabase
  .from('bookings')
  .select('*, booking_members(member_id, members(id, name, nickname))')

// 處理時：booking_members 中的 members 可能為 null
const memberNames = safeMap(
  data?.booking_members,
  (bm) => bm.members?.name || bm.members?.nickname
)
```

## 遷移指南

如果現有組件出現 null 錯誤：

1. **找到資料來源**：boats、bookings、coaches 等
2. **添加驗證**：使用 `validate*` 函數
3. **替換變量**：用 `validBoats` 替換 `boats`
4. **測試**：確保功能正常

## 範例：VirtualizedBookingList

```typescript
import { validateBoats, validateBookings } from '../utils/safetyHelpers'

export function VirtualizedBookingList({ boats, bookings, isMobile, onBookingClick }) {
  // ✅ 統一驗證，不需要到處寫 null 檢查
  const validBoats = useMemo(() => validateBoats(boats), [boats])
  const validBookings = useMemo(() => validateBookings(bookings), [bookings])

  // ✅ 安全使用
  const boatBookingsMap = useMemo(() => {
    const map = new Map()
    validBoats.forEach(boat => {
      const boatBookings = validBookings
        .filter(b => b.boat_id === boat.id)  // 不會報錯
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
      map.set(boat.id, boatBookings)
    })
    return map
  }, [validBoats, validBookings])

  return (
    <div>
      {validBoats.map(boat => (
        <div key={boat.id}>{boat.name}</div>  // 保證不是 null
      ))}
    </div>
  )
}
```

## 未來改進

- [ ] 添加更多資料類型的驗證器
- [ ] 整合 Zod 進行 schema 驗證
- [ ] 建立 API response 攔截器統一驗證
- [ ] 啟用 TypeScript strict mode

## 總結

**核心思想：在資料進入組件的邊界處統一驗證，而不是在使用時到處做 null 檢查。**

這樣可以：
- ✅ 減少重複代碼
- ✅ 提高代碼可讀性
- ✅ 更容易維護
- ✅ 避免運行時錯誤

