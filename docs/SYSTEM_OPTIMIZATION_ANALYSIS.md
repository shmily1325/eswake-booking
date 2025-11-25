# ES Wake 系統全流程優化分析

> 分析日期：2025-11-25  
> 分析範圍：預約 → 排班 → 回報 → 結帳 → 統計

---

## 📊 系統流程概覽

```
1️⃣ 預約 (Booking)
   ├─ 建立預約 (NewBookingDialog)
   ├─ 編輯預約 (EditBookingDialog)
   ├─ 重複預約 (RepeatBookingDialog)
   └─ 查看預約 (DayView, SearchBookings)
   
2️⃣ 排班 (Scheduling)
   ├─ 教練排班 (CoachAssignment)
   ├─ 每日課表 (CoachDailyView)
   └─ 衝突檢查 (bookingConflict.ts)

3️⃣ 回報 (Reporting)
   ├─ 教練回報 (CoachReport)
   └─ 我的回報 (MyReport)
   
4️⃣ 結帳 (Settlement)
   ├─ 待處理扣款 (PendingDeductionItem)
   ├─ 非會員記錄 (CoachAdmin)
   └─ 會員交易 (TransactionDialog)
   
5️⃣ 統計 (Statistics)
   ├─ 教練總覽 (CoachOverview)
   ├─ 統計報表 (StatisticsTab)
   └─ 審計日誌 (AuditLog)
```

---

## 🎯 優化建議分類

### 🔴 高優先級（影響核心業務流程）
### 🟡 中優先級（提升使用體驗）
### 🟢 低優先級（錦上添花）

---

## 1️⃣ 預約流程優化

### 🔴 高優先級

#### 1.1 簡化預約建立流程
**現況問題：**
- 建立預約時需要填寫很多欄位（船隻、時間、會員、教練、活動類型等）
- 移動端輸入體驗有待改善
- 重複預約功能較少被使用

**優化建議：**
```typescript
// 建議：快速預約模式（只填必填項）
interface QuickBookingMode {
  船隻: required
  日期時間: required
  時長: required (預設60分)
  會員: optional (稍後可補)
  教練: optional (稍後排班補)
  備註: optional
}

// 進階模式：完整功能（現有模式）
```

**實施方案：**
- 新增「快速預約」按鈕，預設60分鐘，只填最必要資訊
- 提供「常用預約」模板功能（例如：Ming + G23 + 60分）
- 優化移動端表單佈局，使用更大的觸控區域

**預期效果：**
- 預約建立時間從 60 秒降到 20 秒
- 減少 50% 的點擊次數

---

#### 1.2 優化衝突檢查邏輯
**現況分析：**
✅ 已實現批次衝突檢查（`checkCoachesConflictBatch`）
✅ 即時衝突檢查（在 EditBookingDialog 中）
⚠️ 但仍有改進空間

**優化建議：**

**1.2.1 快取教練可用時段**
```typescript
// 建議：在排班頁面建立當日教練可用時段快取
interface CoachAvailability {
  coachId: string
  availableSlots: TimeSlot[]  // 可用時段
  busySlots: TimeSlot[]       // 忙碌時段
  lastUpdated: string
}

// 減少重複查詢，提升排班頁面性能
```

**1.2.2 前端智能提示**
```typescript
// 當前：只顯示衝突錯誤
// 建議：顯示建議的可用時段

interface ConflictSuggestion {
  hasConflict: boolean
  conflictReason: string
  suggestedTimes: string[]  // "14:00 可用", "15:30 可用"
  suggestedCoaches: Coach[] // 該時段可用的其他教練
}
```

**預期效果：**
- 減少 30% 的預約編輯錯誤
- 提升排班效率

---

#### 1.3 增強會員搜尋功能
**現況問題：**
- 只能搜尋名字、暱稱、電話
- 沒有最近使用會員的快速選擇
- 沒有會員分組（VIP、一般、新手等）

**優化建議：**
```typescript
// 1. 新增最近使用會員（基於登入用戶）
interface RecentMembers {
  members: Member[]  // 最近30天預約的前10位
  lastBookingDate: string
}

// 2. 新增會員標籤系統
interface MemberTags {
  tags: ['VIP', '新手', '常客', '高級會員'] // 可自訂
  autoTag: {
    bookingCount: number  // 自動標記「常客」
    totalSpending: number // 自動標記「VIP」
  }
}

// 3. 智能排序
searchMembers() {
  return members.sort((a, b) => {
    // 優先顯示：最近預約 > 預約次數 > 字母順序
  })
}
```

**預期效果：**
- 會員選擇時間從 10 秒降到 3 秒
- 減少輸入錯誤

---

### 🟡 中優先級

#### 1.4 批次操作功能
**建議功能：**
- 批次取消預約（例如：因天氣取消當天所有預約）
- 批次調整時間（例如：整體延後30分鐘）
- 批次更換船隻（例如：G23維修，轉移到G21）

**實施方案：**
```typescript
interface BatchOperation {
  action: 'cancel' | 'reschedule' | 'changeBoat'
  bookingIds: number[]
  reason: string
  newTime?: string
  newBoatId?: number
}
```

---

#### 1.5 預約模板功能
**建議：** 儲存常用的預約配置
```typescript
interface BookingTemplate {
  name: string  // "Ming 常規課程"
  boatId: number
  durationMin: 60
  coaches: string[]
  activityTypes: string[]
  notes: string
}
```

---

## 2️⃣ 排班流程優化

### 🔴 高優先級

#### 2.1 視覺化排班界面
**現況問題：**
- CoachAssignment 頁面是列表式，不夠直觀
- 無法一眼看出教練的忙碌程度
- 時間軸不夠清晰

**優化建議：**

**2.1.1 時間軸視圖（Gantt Chart）**
```
         09:00  10:00  11:00  12:00  13:00  14:00
阿寶    [====預約1====]      [==預約2==]
Jerry            [====預約3=========]
小王    [休假==================]
```

**2.1.2 顏色編碼**
```typescript
interface CoachStatus {
  available: '#22c55e'    // 綠色 - 可用
  busy: '#ef4444'         // 紅色 - 忙碌
  partial: '#f59e0b'      // 橙色 - 部分可用（駕駛中但可教課）
  off: '#94a3b8'          // 灰色 - 休假
}
```

**2.1.3 拖拽排班**
```typescript
// 建議：支援拖拽分配教練
<DraggableCoach coachId="阿寶" />
<DroppableBooking bookingId={123} />
```

**預期效果：**
- 排班效率提升 50%
- 減少排班衝突

---

#### 2.2 智能排班建議
**建議功能：**
```typescript
interface SmartAssignment {
  // 1. 自動建議最佳教練
  suggestCoach(booking: Booking): {
    coachId: string
    reason: '該時段唯一可用' | '該會員常用教練' | '工作量最平衡'
    confidence: number  // 0-1
  }

  // 2. 工作量平衡提示
  checkWorkloadBalance(): {
    overloaded: Coach[]  // 工作量過高的教練
    underused: Coach[]   // 工作量過低的教練
    suggestion: string   // "建議將預約123分配給Jerry"
  }

  // 3. 休息時間檢查
  checkBreakTime(): {
    warning: "阿寶連續工作4小時，建議安排休息"
  }
}
```

**預期效果：**
- 教練工作量更平衡
- 減少排班錯誤

---

### 🟡 中優先級

#### 2.3 批次排班功能
**建議：** 一鍵自動排班（基於規則）
```typescript
interface AutoAssignmentRules {
  preferredCoachForMember: Map<memberId, coachId>  // 會員偏好
  balanceWorkload: boolean                         // 平衡工作量
  respectTimeOff: boolean                          // 尊重休假
  minBreakMinutes: number                          // 最少休息時間
}
```

---

#### 2.4 教練請假管理優化
**現況：** 已有 `coach_time_off` 表
**建議增強：**
- 請假申請流程（教練端）
- 審核功能（管理員端）
- 請假提醒（影響的預約自動通知）

---

## 3️⃣ 回報流程優化

### 🔴 高優先級

#### 3.1 簡化回報界面
**現況問題：**
- CoachReport 頁面功能很完整，但對教練來說可能過於複雜
- 移動端輸入體驗需要優化

**優化建議：**

**3.1.1 一鍵快速回報**
```typescript
// 對於常規課程（1位會員，60分鐘，扣儲值，不指定）
interface QuickReport {
  確認: 點一下 → 自動填入預約資訊
  回報完成: 只需要確認即可
}

// 只有特殊情況才需要手動調整
```

**3.1.2 語音輸入備註**
```typescript
// 建議：支援語音輸入 notes
<VoiceInput 
  onTranscript={(text) => setNotes(text)} 
  placeholder="點擊說話..."
/>
```

**預期效果：**
- 回報時間從 2 分鐘降到 30 秒
- 提升教練使用意願

---

#### 3.2 批次回報功能
**建議：** 一次回報多個預約
```typescript
interface BatchReport {
  bookingIds: number[]
  commonData: {
    paymentMethod: 'balance'
    lessonType: 'undesignated'
  }
  // 只需要填入不同的部分（會員、時長）
}
```

---

#### 3.3 離線回報支援
**現況問題：**
- 如果在水上網路不好，無法回報
- 需要等到回岸上才能填寫

**優化建議：**
```typescript
// 使用 Service Worker + IndexedDB
interface OfflineReport {
  saveLocal: () => void      // 儲存到本地
  syncWhenOnline: () => void // 上線後自動同步
  showSyncStatus: () => void // 顯示同步狀態
}
```

**預期效果：**
- 任何時候都能回報
- 減少遺漏回報

---

### 🟡 中優先級

#### 3.4 回報提醒系統
**建議功能：**
```typescript
interface ReportReminder {
  // 1. 預約結束後30分鐘，推送提醒
  pushNotification: {
    title: "請回報預約"
    body: "Ming 的 G23 課程已結束，請完成回報"
  }

  // 2. 每日未回報清單（LINE 通知）
  dailySummary: {
    time: "20:00"
    message: "今天還有 3 筆預約未回報"
  }

  // 3. 逾期提醒（超過24小時未回報）
  overdueAlert: {
    target: "管理員"
    message: "阿寶有 2 筆預約超過24小時未回報"
  }
}
```

---

#### 3.5 回報品質檢查
**建議：** 自動檢查回報的合理性
```typescript
interface ReportValidation {
  // 1. 時長檢查
  checkDuration: (reported: number, booked: number) => {
    if (Math.abs(reported - booked) > 15) {
      return "時長差異超過15分鐘，請確認"
    }
  }

  // 2. 會員檢查
  checkMember: (participant: string, booking: Booking) => {
    if (booking.member && participant !== booking.member.name) {
      return "回報的會員與預約不符，請確認"
    }
  }

  // 3. 付款方式檢查
  checkPaymentMethod: (method: string, member: Member) => {
    if (method === 'balance' && member.balance < requiredAmount) {
      return "警告：會員餘額不足"
    }
  }
}
```

---

## 4️⃣ 結帳流程優化

### 🔴 高優先級

#### 4.1 扣款流程自動化
**現況分析：**
✅ 扣款邏輯已經很完善（DEDUCTION_FLOW.md）
✅ 支援動態價格計算
✅ 完全彈性（可調整任意欄位）
⚠️ 但仍需要人工處理

**優化建議：**

**4.1.1 智能預設值**
```typescript
// 當前：生成預設扣款，需要人工確認
// 建議：信任度評分系統

interface DeductionConfidence {
  score: number  // 0-100
  factors: {
    會員是常客: +30
    付款方式明確: +20
    金額正常範圍: +20
    教練回報完整: +20
    無衝突歷史: +10
  }
}

// 如果 score >= 90，可以自動處理
// 如果 score < 90，需要人工確認
```

**4.1.2 批次處理功能**
```typescript
interface BatchDeduction {
  // 選擇多筆待處理記錄
  selectedIds: number[]
  
  // 一鍵處理（適用於標準扣款）
  processAll: () => {
    // 只處理高信任度的記錄
    // 低信任度的保留人工處理
  }
}
```

**預期效果：**
- 80% 的扣款可以自動處理
- 報帳時間減少 60%

---

#### 4.2 扣款異常處理
**建議功能：**
```typescript
interface DeductionException {
  // 1. 餘額不足處理
  insufficientBalance: {
    action: 'notify' | 'partial' | 'pending'
    notifyMember: boolean
    notifyAdmin: boolean
  }

  // 2. 扣款失敗重試
  retryPolicy: {
    maxRetries: 3
    retryInterval: '5 minutes'
    fallbackAction: 'manual' | 'cancel'
  }

  // 3. 扣款回滾
  rollback: {
    reason: string
    refundAmount: number
    notifyMember: boolean
  }
}
```

---

#### 4.3 財務報表優化
**現況：** 已有交易記錄（transactions 表）
**建議增強：**
```typescript
interface FinancialReport {
  // 1. 日報表
  dailyReport: {
    date: string
    totalIncome: number       // 總收入
    byCategory: {             // 分類收入
      balance: number
      voucher: number
      vip: number
    }
    topMembers: Member[]      // 消費最多的會員
  }

  // 2. 月報表
  monthlyReport: {
    totalIncome: number
    averagePerBooking: number
    memberRetention: number   // 會員留存率
    newMembers: number
  }

  // 3. 匯出功能
  export: {
    format: 'CSV' | 'Excel' | 'PDF'
    includeDetails: boolean
  }
}
```

---

### 🟡 中優先級

#### 4.4 會員餘額預警
**建議功能：**
```typescript
interface BalanceAlert {
  // 1. 低餘額提醒
  lowBalanceWarning: {
    threshold: 5000  // 低於5000元提醒
    notifyMember: true
    notifyAdmin: true
  }

  // 2. 自動儲值建議
  autoRechargeReco: {
    basedOn: '過去3個月平均消費'
    suggestedAmount: 10000
  }

  // 3. 優惠推薦
  promotionReco: {
    condition: '儲值滿10000送1000'
    eligibleMembers: Member[]
  }
}
```

---

#### 4.5 非會員轉會員流程
**現況：** 可以關聯會員，但流程較手動
**建議：** 簡化流程
```typescript
interface ConvertToMember {
  // 1. 一鍵建立會員檔案
  quickCreate: {
    name: string  // 從非會員記錄自動填入
    phone: string
    initialBalance: number
  }

  // 2. 自動關聯歷史記錄
  linkHistory: {
    searchByName: boolean
    searchByPhone: boolean
    autoLink: boolean
  }
}
```

---

## 5️⃣ 統計流程優化

### 🔴 高優先級

#### 5.1 即時儀表板
**現況：** 需要切換不同頁面查看統計
**建議：** 統一儀表板
```typescript
interface Dashboard {
  // 1. 今日總覽
  today: {
    totalBookings: number
    completedBookings: number
    pendingReports: number
    revenue: number
  }

  // 2. 本週趨勢
  weekTrend: {
    bookingsChart: LineChart
    revenueChart: LineChart
    popularBoats: BarChart
  }

  // 3. 即時狀態
  liveStatus: {
    currentlyUsedBoats: Boat[]
    onDutyCoaches: Coach[]
    upcomingBookings: Booking[]
  }

  // 4. 異常提醒
  alerts: {
    unreportedBookings: number
    lowBalanceMembers: number
    conflictBookings: number
  }
}
```

**預期效果：**
- 一眼掌握營運狀況
- 快速發現問題

---

#### 5.2 教練績效分析
**現況：** CoachOverview 已有基本統計
**建議增強：**
```typescript
interface CoachPerformance {
  // 1. 多維度分析
  metrics: {
    teachingHours: number       // 教學時數
    drivingHours: number        // 駕駛時數
    totalStudents: number       // 總學員數
    repeatStudents: number      // 回頭學員數
    averageRating: number       // 平均評價（如果有評價系統）
  }

  // 2. 趨勢分析
  trend: {
    lastMonth: Metrics
    thisMonth: Metrics
    growth: number  // 成長率
  }

  // 3. 排名
  ranking: {
    byTeachingHours: number
    byStudentCount: number
    overall: number
  }

  // 4. 目標設定
  goals: {
    monthlyTarget: number
    progress: number  // 完成百分比
  }
}
```

---

#### 5.3 會員行為分析
**建議功能：**
```typescript
interface MemberAnalytics {
  // 1. 會員分群
  segmentation: {
    新手: { bookingCount: '< 5' }
    常客: { bookingCount: '5-20' }
    VIP: { bookingCount: '> 20' }
    流失: { lastBooking: '> 90天' }
  }

  // 2. 消費分析
  spending: {
    averagePerBooking: number
    totalSpending: number
    preferredPayment: 'balance' | 'voucher' | 'cash'
  }

  // 3. 偏好分析
  preferences: {
    preferredBoat: string
    preferredCoach: string
    preferredTime: string  // "週末下午"
    preferredDuration: number
  }

  // 4. 流失預警
  churnRisk: {
    score: number  // 0-100
    factors: [
      '最近30天未預約',
      '取消率增加',
      '消費金額下降'
    ]
    recommendation: '發送優惠券'
  }
}
```

---

### 🟡 中優先級

#### 5.4 船隻使用率分析
**建議功能：**
```typescript
interface BoatUtilization {
  // 1. 使用率計算
  utilizationRate: {
    boatId: number
    totalAvailableHours: number  // 營業時間
    bookedHours: number          // 已預約時間
    rate: number                 // 使用率 %
  }

  // 2. 閒置時段分析
  idleSlots: {
    boat: Boat
    idleSlots: TimeSlot[]
    suggestion: '可推出優惠吸引預約'
  }

  // 3. 維修計劃建議
  maintenancePlan: {
    boat: Boat
    totalUsageHours: number
    lastMaintenance: string
    nextRecommended: string
  }
}
```

---

#### 5.5 收入預測
**建議功能：**
```typescript
interface RevenueForecasting {
  // 1. 基於歷史數據預測
  forecast: {
    nextWeek: number
    nextMonth: number
    confidence: number  // 預測信心度
  }

  // 2. 季節性分析
  seasonality: {
    peakMonths: string[]
    lowMonths: string[]
    averageGrowth: number
  }

  // 3. 優化建議
  recommendations: [
    '週末課程已滿，建議增加船隻或時段',
    '週二下午使用率低，建議推出優惠',
    '12月為淡季，建議提前規劃行銷活動'
  ]
}
```

---

## 🔧 技術層面優化

### 🔴 高優先級

#### T1. 資料庫查詢優化
**現況分析：**
✅ 已使用批次查詢（`checkCoachesConflictBatch`）
⚠️ 仍有 N+1 查詢問題

**優化建議：**
```sql
-- 1. 增加複合索引
CREATE INDEX idx_bookings_date_boat 
ON bookings(boat_id, start_at);

CREATE INDEX idx_booking_participants_status_member 
ON booking_participants(status, member_id, is_deleted);

-- 2. 使用物化視圖（Materialized View）
CREATE MATERIALIZED VIEW mv_coach_daily_stats AS
SELECT 
  coach_id,
  DATE(bookings.start_at) as date,
  SUM(duration_min) as total_minutes,
  COUNT(*) as booking_count
FROM booking_participants
JOIN bookings ON ...
GROUP BY coach_id, DATE(bookings.start_at);

-- 定期刷新（每小時）
REFRESH MATERIALIZED VIEW mv_coach_daily_stats;
```

---

#### T2. 前端性能優化
**建議：**
```typescript
// 1. 虛擬滾動（大列表）
import { VirtualList } from 'react-virtual'

<VirtualList
  height={600}
  itemCount={bookings.length}
  itemSize={80}
  renderItem={BookingItem}
/>

// 2. 分頁載入
interface Pagination {
  pageSize: 50  // 每次載入50筆
  loadMore: () => void
  hasMore: boolean
}

// 3. 快取策略
import { useSWR } from 'swr'

const { data } = useSWR(
  `/api/bookings/${date}`,
  fetcher,
  { revalidateOnFocus: false, dedupingInterval: 60000 }
)
```

---

#### T3. 錯誤處理增強
**建議：** 統一錯誤處理機制
```typescript
// 1. 錯誤邊界（Error Boundary）
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // 記錄到 Sentry 或其他服務
    logError(error, errorInfo)
    // 顯示友善錯誤訊息
    this.setState({ hasError: true })
  }
}

// 2. 樂觀更新 + 回滾
async function optimisticUpdate() {
  // 立即更新 UI
  updateUI(newData)
  
  try {
    // 背景更新資料庫
    await api.update(newData)
  } catch (error) {
    // 失敗則回滾
    rollbackUI(oldData)
    showError('更新失敗，請重試')
  }
}

// 3. 重試機制
async function retryableRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(1000 * Math.pow(2, i))  // 指數退避
    }
  }
}
```

---

### 🟡 中優先級

#### T4. 實時通訊
**建議：** 使用 Supabase Realtime
```typescript
// 1. 即時預約更新
const channel = supabase
  .channel('bookings')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'bookings'
  }, (payload) => {
    updateBookings(payload.new)
  })
  .subscribe()

// 2. 協同編輯（多人同時排班）
interface CollaborativeEditing {
  showUserCursors: boolean
  lockEditingBooking: boolean  // 防止衝突
  showRealtimeUpdates: boolean
}
```

---

#### T5. PWA 支援
**建議：** 離線可用
```typescript
// 1. Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}

// 2. 快取策略
workbox.routing.registerRoute(
  /\/api\/bookings\//,
  new workbox.strategies.NetworkFirst({
    cacheName: 'bookings-cache',
    networkTimeoutSeconds: 3
  })
)

// 3. 安裝到主畫面
let deferredPrompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  showInstallButton()
})
```

---

## 📱 用戶體驗優化

### 🟡 中優先級

#### UX1. 移動端優化
**建議：**
- 增大觸控區域（最小 44x44 px）
- 減少輸入欄位（使用選擇器代替輸入框）
- 優化滾動性能
- 支援手勢操作（滑動刪除、拉動刷新）

#### UX2. 快捷鍵支援
**建議：**
```typescript
// 桌面端快捷鍵
interface Shortcuts {
  'Ctrl+N': '新增預約'
  'Ctrl+F': '搜尋'
  'Ctrl+S': '儲存'
  'Esc': '關閉對話框'
  'Alt+1/2/3': '切換 Tab'
}
```

#### UX3. 黑暗模式
**建議：** 支援深色主題（護眼、省電）

#### UX4. 多語言支援
**建議：** 英文、簡體中文（如有外籍會員）

---

## 🎯 優先級排序

### 第一階段（立即實施）
1. 扣款流程自動化（T1）
2. 簡化預約建立流程（1.1）
3. 簡化回報界面（3.1）
4. 即時儀表板（5.1）
5. 資料庫查詢優化（T1）

### 第二階段（1-2個月）
1. 視覺化排班界面（2.1）
2. 智能排班建議（2.2）
3. 批次操作功能（1.4, 3.2, 4.1.2）
4. 會員行為分析（5.3）
5. 錯誤處理增強（T3）

### 第三階段（3-6個月）
1. 離線回報支援（3.3）
2. 實時通訊（T4）
3. PWA 支援（T5）
4. 移動端優化（UX1）
5. 收入預測（5.5）

---

## 📊 預期成效

### 效率提升
- **預約建立時間**：60秒 → 20秒 (-67%)
- **排班時間**：30分鐘 → 15分鐘 (-50%)
- **回報時間**：2分鐘 → 30秒 (-75%)
- **報帳時間**：10分鐘 → 4分鐘 (-60%)

### 錯誤減少
- **預約衝突**：減少 30%
- **回報遺漏**：減少 80%
- **扣款錯誤**：減少 50%

### 用戶滿意度
- **教練滿意度**：簡化回報流程
- **管理員效率**：自動化報帳
- **會員體驗**：更快的預約回應

---

## 🚀 實施建議

### 技術準備
1. 設置測試環境
2. 準備資料遷移腳本
3. 建立回滾計劃

### 團隊協作
1. 與教練溝通新功能
2. 培訓管理員使用新系統
3. 收集用戶反饋

### 漸進式上線
1. 先上線核心功能（第一階段）
2. 小範圍測試（1週）
3. 收集反饋並調整
4. 全面上線

---

**最後更新**：2025-11-25  
**版本**：v1.0  
**作者**：系統分析

