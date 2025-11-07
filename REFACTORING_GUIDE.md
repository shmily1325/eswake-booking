# 重構指南 - ES Wake Booking System V2

## 已完成的重構工具

為了簡化大型組件（如 `NewBookingDialog` 1454行），我們創建了以下可重用工具：

### 1. **useMemberSearch Hook** (`src/hooks/useMemberSearch.ts`)

處理會員搜索邏輯，包括：
- 會員列表載入
- 搜索過濾（支持姓名、暱稱、電話）
- 會員選擇
- 手動輸入處理

**使用範例**：
```typescript
import { useMemberSearch } from '../hooks/useMemberSearch'

function MyComponent() {
  const {
    searchTerm,
    selectedMemberId,
    filteredMembers,
    showDropdown,
    handleSearchChange,
    selectMember,
    getContactName,
    reset
  } = useMemberSearch()
  
  // 使用這些狀態和方法來簡化你的組件
  const contactName = getContactName() // 獲取最終的聯絡人名稱
}
```

### 2. **Booking Conflict Checker** (`src/utils/bookingConflict.ts`)

處理複雜的衝突檢查邏輯，包括：
- 時間計算工具函數
- 船隻衝突檢查
- 教練衝突檢查
- 駕駛衝突檢查

**使用範例**：
```typescript
import {
  checkBoatConflict,
  checkCoachConflict,
  checkDriverConflict,
  timeToMinutes,
  minutesToTime
} from '../utils/bookingConflict'

// 檢查船隻衝突
const boatResult = await checkBoatConflict(
  boatId,
  '2025-11-08',
  '14:00',
  60
)

if (boatResult.hasConflict) {
  alert(boatResult.reason)
  return
}

// 檢查教練衝突
for (const coachId of selectedCoaches) {
  const coachResult = await checkCoachConflict(
    coachId,
    '2025-11-08',
    '14:00',
    60
  )
  
  if (coachResult.hasConflict) {
    alert(coachResult.reason)
    return
  }
}
```

## 效能優化建議

### 已實施：
✅ **並行查詢** - 使用 `Promise.all` 同時執行多個資料庫查詢
✅ **批量查詢** - 避免 N+1 查詢問題
✅ **前端快取** - 使用 `useMemo` 快取計算結果
✅ **早期返回** - 資料為空時立即返回

### 下一步建議（當資料量增長時）：
- **分頁載入** (Pagination) - 當會員超過 500 人
- **虛擬滾動** (Virtual Scrolling) - 長列表渲染
- **資料快取** (React Query / SWR) - 全域狀態管理

## 代碼組織原則

### 組件拆分原則：
1. **單一職責** - 每個組件只做一件事
2. **可重用** - 創建通用組件而非特定組件
3. **可測試** - 邏輯與 UI 分離
4. **效能** - 使用 React 效能優化技巧

### 檔案組織：
```
src/
├── components/       # UI 組件
├── hooks/           # 自定義 Hooks
├── utils/           # 工具函數
├── pages/           # 頁面組件
├── styles/          # 樣式系統
└── lib/             # 第三方套件配置
```

## 未來重構計劃

### 高優先級：
- [ ] 使用新工具簡化 `NewBookingDialog`（1454行 → ~800行）
- [ ] 使用新工具簡化 `EditBookingDialog`（類似邏輯）
- [ ] 統一所有 Dialog 的樣式和結構

### 中優先級：
- [ ] 創建 `useBookingForm` hook 統一表單邏輯
- [ ] 創建 `CoachSelector` 組件（可重用的教練選擇器）
- [ ] 創建 `TimeSelector` 組件（可重用的時間選擇器）

### 低優先級：
- [ ] 引入狀態管理庫 (Zustand/Jotai) 替代 prop drilling
- [ ] 引入 React Query 管理伺服器狀態
- [ ] 添加單元測試

## 注意事項

⚠️ **重構時的注意事項**：
1. **一次改一個組件** - 避免同時改動過多
2. **保留舊版本** - 重構時保留舊組件作為備份
3. **測試每個改動** - 確保功能正常後再繼續
4. **漸進式重構** - 不要試圖一次性重寫所有代碼

✅ **重構的好處**：
- 更容易維護和擴展
- 更好的代碼可讀性
- 更少的 bug
- 更快的開發速度

