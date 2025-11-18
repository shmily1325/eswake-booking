# CoachReport 教練回報頁面 - 邏輯文檔

> **⚠️ 重要更新 (2025-11-18)**  
> 本文檔描述的是**原始版本**的 CoachReport，包含 4 個 Tab。  
> 系統已重構為兩個獨立頁面：
> - **CoachReport.tsx** - 教練專用回報頁面（簡化版）
> - **CoachAdmin.tsx** - 管理員後台（包含 Tab 2, 3, 4 功能）
> 
> 詳見：`CoachReport-Architecture.md`

## 概述

`CoachReport` 原本是教練回報系統的核心頁面，用於處理預約結束後的教練回報和會員扣款。

**原始版本包含四個功能**：
1. **教練回報**：教練回報實際參與者和時數
2. **待處理扣款**：處理需要扣款的會員記錄
3. **非會員記錄**：管理非會員記錄，可關聯會員或結案
4. **已結案記錄**：查看教練教學與駕駛細帳

**重構後**：
- `CoachReport.tsx` 只保留功能 1（教練回報）
- `CoachAdmin.tsx` 包含功能 2, 3, 4（管理員功能）

---

## 頁面結構

### 四個 Tab 頁籤
- **Tab 1: 教練回報** (`activeTab === 'report'`) - 教練進行回報
- **Tab 2: 待處理扣款** (`activeTab === 'pending'`) - 處理會員扣款
- **Tab 3: 非會員記錄** (`activeTab === 'non_member'`) - 管理非會員記錄，可關聯會員或結案
- **Tab 4: 已結案記錄** (`activeTab === 'completed'`) - 查看教練教學與駕駛細帳

---

## 查看模式

系統提供兩種查看模式，方便教練靈活查看回報狀態：

### 1. 按日期查看 (`viewMode === 'date'`)
- **預設模式**
- 查看特定日期的所有已結束預約
- 適合日常回報使用
- 可以看到當天所有需要回報的預約（已回報和未回報）

### 2. 查看所有未回報 (`viewMode === 'unreported'`)
- **防止遺漏模式**
- 查看過去 30 天內所有未完成回報的預約
- 自動過濾已完成回報的預約
- 幫助教練找出之前遺漏的回報
- 避免因為只看當天而漏掉其他日期的未回報

**切換方式：**
- 在篩選區有兩個按鈕可以切換
- 📅 按日期查看（藍色）
- ⚠️ 查看所有未回報（橙色）

---

## 核心概念

### 1. 回報類型 (Report Type)

系統會根據預約的教練和駕駛配置，自動判斷需要回報的類型：

#### `getReportType(booking, coachId)` 函數邏輯

```typescript
- 'coach': 只需要教練回報（回報參與者+時數）
- 'driver': 只需要駕駛回報（回報駕駛時數）
- 'both': 兩者都需要回報
- null: 不需要回報
```

**判斷規則：**
1. **沒有教練，只有駕駛（純駕駛預約）** → `both`
   - 駕駛需要回報駕駛時數（`driver_duration_min`）
   - 駕駛需要回報參與者（作為教練角色填寫參與者資訊）
   - 因為沒有教練，駕駛要承擔記錄參與者的責任
2. **是教練也是駕駛（教練兼駕駛）** → `both`
   - 需要回報駕駛時數
   - 需要回報參與者
3. **只是教練** → `coach`
   - 只需要回報參與者
4. **只是駕駛（有教練的預約）** → `driver`
   - 只需要回報駕駛時數
   - 參與者由教練回報

### 2. 角色判定

- **isCoach**: 該用戶在 `booking_coaches` 中
- **isExplicitDriver**: 該用戶在 `booking_drivers` 中（明確指定的駕駛）
- **isImplicitDriver**: 是教練、預約沒有指定駕駛、且**不是設施**（教練兼駕駛）
  - **判斷邏輯**：使用 `isFacility(boatName)` 判斷是否是彈簧床
  - **船只預約**：如果沒有指定駕駛，教練必須兼任駕駛（船不可能自己開）
  - **彈簧床**：不需要駕駛，教練不會被視為駕駛
  - **注意**：`requires_driver` 欄位的含義是"是否強制指定駕駛"，不是"是否需要有人開船"

---

## Tab 1: 教練回報

### 資料載入流程

#### `loadBookings()` 函數

1. **根據查看模式載入預約**
   
   **按日期模式** (`viewMode === 'date'`)：
   - 時間範圍：選定日期的 00:00-23:59
   - 狀態：`status = 'confirmed'`
   - **包含所有類型**：船隻預約和設施預約（彈簧床等）都需要回報
   - 只保留已結束的預約（`bookingEnd <= now`）
   
   **未回報模式** (`viewMode === 'unreported'`)：
   - 時間範圍：過去 30 天
   - 狀態：`status = 'confirmed'`
   - **包含所有類型**：船隻預約和設施預約（彈簧床等）都需要回報
   - 只保留已結束的預約（`bookingEnd <= now`）
   - **額外過濾**：只顯示未完成回報的預約

2. **並行載入相關資料**
   - `booking_coaches`: 教練列表
   - `booking_drivers`: 駕駛列表
   - `coach_reports`: 駕駛回報記錄
   - `booking_participants`: 參與者記錄

3. **組裝資料**
   - 將所有相關資料關聯到各個預約
   - 根據 `selectedCoachId` 篩選（可選）

4. **未回報模式的過濾邏輯**
   
   當 `viewMode === 'unreported'` 時，會進一步過濾預約：
   
   **針對特定教練** (`selectedCoachId !== 'all'`)：
   - 使用 `getReportType()` 判斷該教練需要回報的類型
   - 使用 `getReportStatus()` 檢查是否已完成回報
   - 根據回報類型判斷：
     - `type === 'coach'`：如果已有教練回報則排除
     - `type === 'driver'`：如果已有駕駛回報則排除
     - `type === 'both'`：如果兩者都完成才排除
   
   **顯示所有教練** (`selectedCoachId === 'all'`)：
   - 檢查所有教練是否都已回報
   - 檢查駕駛是否已回報（如有駕駛）
   - 任一教練未回報就顯示該預約
   - 特殊情況：只有駕駛沒有教練時，檢查是否有參與者回報

### 開始回報流程

#### `startReportWithCoach(booking, coachId)` 函數

1. **判斷回報類型**
   - 呼叫 `getReportType()` 判斷需要回報什麼

2. **初始化駕駛回報**
   - 如果已有記錄，載入現有的 `driver_duration_min`
   - 否則預設為預約的 `duration_min`

3. **初始化教練回報（參與者列表）**
   - **情況 A：修改現有回報**
     - 載入該教練已提交的 `booking_participants` 記錄
   - **情況 B：新回報**
     - 呼叫 `loadBookingMembers()` 載入預約會員

#### `loadBookingMembers(bookingId, defaultDuration)` 函數

**目的**：自動帶入預約的會員，並排除已被其他教練回報的會員

**步驟：**

1. **載入預約的所有會員**
   - 從 `booking_members` 表取得

2. **載入已被回報的參與者**
   - 從 `booking_participants` 表取得
   - `is_deleted = false`
   - `coach_id IS NOT NULL`

3. **找出已被其他教練回報的會員**
   - 建立 `reportedMemberIds` 和 `reportedNames` Set
   - 只記錄其他教練（不是當前教練）回報的

4. **過濾並建立參與者列表**
   - 排除已被其他教練回報的會員
   - 為每個可用會員建立預設參與者記錄：
     ```typescript
     {
       member_id: 會員ID,
       participant_name: 暱稱或姓名,
       duration_min: 預約時長,
       payment_method: 'cash',
       status: 'pending'
     }
     ```

5. **檢查預約人是否為非會員**
   - 解析 `contact_name`（可能包含多個姓名，用逗號分隔）
   - 如果預約人不在會員列表中且未被回報，添加為非會員參與者：
     ```typescript
     {
       member_id: null,
       participant_name: 預約人姓名,
       duration_min: 預約時長,
       payment_method: 'cash',
       status: 'not_applicable'  // 非會員
     }
     ```

6. **處理空列表情況**
   - 如果沒有任何參與者（所有會員都被其他教練回報了），建立一個空白參與者

### 提交回報流程

#### `submitReport()` 函數

根據 `reportType` 決定呼叫哪些提交函數：
- `'driver'` → `submitDriverReport()`
- `'coach'` → `submitCoachReport()`
- `'both'` → 兩者都呼叫

#### `submitDriverReport(bookingId)` 函數

**簡單的駕駛時數記錄**

```typescript
// 使用 upsert 插入或更新
supabase
  .from('coach_reports')
  .upsert({
    booking_id,
    coach_id: reportingCoachId,
    driver_duration_min: driverDuration,
    reported_at: now
  }, {
    onConflict: 'booking_id,coach_id'
  })
```

#### `submitCoachReport(bookingId)` 函數

**複雜的參與者記錄處理，支援軟刪除和修改追蹤**

**步驟：**

1. **驗證輸入**
   - 過濾掉空白姓名的參與者
   - 檢查時數 > 0

2. **載入現有記錄**
   ```typescript
   // 取得該教練之前回報的所有參與者
   const oldParticipants = await supabase
     .from('booking_participants')
     .select('*')
     .eq('booking_id', bookingId)
     .eq('coach_id', reportingCoachId)
     .eq('is_deleted', false)
   ```

3. **處理刪除的參與者（軟刪除）**
   - 找出舊記錄中存在但新列表中不存在的
   - 標記為軟刪除：
     ```typescript
     {
       is_deleted: true,
       deleted_at: now,
       updated_at: now
     }
     ```

4. **刪除未軟刪除的舊記錄**
   - 為了重新插入最新版本
   ```typescript
   await supabase
     .from('booking_participants')
     .delete()
     .eq('booking_id', bookingId)
     .eq('coach_id', reportingCoachId)
     .eq('is_deleted', false)
   ```

5. **插入新的參與者記錄**
   - 判斷 status：
     - `member_id` 為 null → `'not_applicable'` (非會員)
     - 有 `member_id` → `'pending'` (待處理扣款)
   - 記錄修改來源：
     - `replaces_id`: 如果是修改現有記錄，記錄原始 ID

### 會員搜尋功能

- 使用 `useMemberSearch` hook
- 輸入時自動過濾會員列表
- 點選會員後：
  - 設定 `member_id`
  - 設定 `participant_name`（優先使用暱稱）
  - 設定 `status = 'pending'`

### UI 狀態標籤

- **已選會員**：紫色漸層標籤 "👤 會員"
- **未選會員**：橙色提示 "🔍 可搜尋會員或輸入客人姓名"

---

## 功能 2: 待處理扣款

### 資料載入

#### `loadPendingReports()` 函數

```typescript
// 載入當天所有 status = 'pending' 的參與者
const { data } = await supabase
  .from('booking_participants')
  .select(`
    *,
    bookings!inner(...),
    coaches:coach_id(id, name),
    old_participant:replaces_id(*)
  `)
  .eq('status', 'pending')
  .eq('is_deleted', false)
  .gte('bookings.start_at', startOfDay)
  .lte('bookings.start_at', endOfDay)
```

**回傳資料包含：**
- 參與者基本資訊
- 所屬預約資訊
- 教練資訊
- 原始記錄（如果是修改）

### 處理扣款流程

#### `handleProcessTransaction(report)` 函數

1. **驗證會員**
   - 只有會員（`member_id` 不為 null）才能處理扣款

2. **載入完整會員資料**
   ```typescript
   const memberData = await supabase
     .from('members')
     .select('*')
     .eq('id', report.member_id)
     .single()
   ```

3. **開啟交易對話框**
   - 傳入會員資料
   - 傳入參與者資料（時數、付款方式等）

#### `handleTransactionComplete()` 函數

**扣款完成後的回調**

```typescript
// 更新狀態為 'processed'（已處理）
await supabase
  .from('booking_participants')
  .update({ 
    status: 'processed',
    updated_at: now
  })
  .eq('id', processingReport.id)
```

### 顯示邏輯

- **按預約分組顯示**
- **顯示修改標記**：如果 `replaces_id` 存在，顯示 "🔄 修改" 標籤
- **顯示原始資料**：如果是修改，顯示修改前的時數和付款方式
- **只有會員才顯示「處理扣款」按鈕**

---

## 資料表關聯

### 主要資料表

1. **bookings** - 預約主表
   - 關聯 `boats`、`booking_members`

2. **booking_coaches** - 預約教練關聯表
   - `booking_id` + `coach_id`

3. **booking_drivers** - 預約駕駛關聯表
   - `booking_id` + `driver_id`

4. **coach_reports** - 駕駛回報表
   - `booking_id` + `coach_id` (unique)
   - `driver_duration_min`: 實際駕駛時數
   - `reported_at`: 回報時間

5. **booking_participants** - 參與者記錄表（教練回報）
   - `booking_id`: 預約 ID
   - `coach_id`: 回報的教練 ID
   - `member_id`: 會員 ID（可為 null）
   - `participant_name`: 參與者姓名
   - `duration_min`: 實際時數
   - `payment_method`: 付款方式
   - `status`: 狀態
     - `'pending'`: 待處理扣款（會員）
     - `'not_applicable'`: 不適用（非會員）
     - `'processed'`: 已處理
   - `is_deleted`: 軟刪除標記
   - `deleted_at`: 刪除時間
   - `replaces_id`: 被修改的原始記錄 ID
   - `transaction_id`: 關聯的交易記錄 ID

---

## 狀態管理

### 全域狀態

```typescript
// Tab 切換
const [activeTab, setActiveTab] = useState<TabType>('report')

// 日期和教練篩選
const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())
const [selectedCoachId, setSelectedCoachId] = useState<string>('all')
const [coaches, setCoaches] = useState<Coach[]>([])
const [viewMode, setViewMode] = useState<'date' | 'unreported'>('date')

// 預約列表
const [bookings, setBookings] = useState<Booking[]>([])
const [loading, setLoading] = useState(false)
```

### 回報表單狀態

```typescript
// 正在回報的預約
const [reportingBookingId, setReportingBookingId] = useState<number | null>(null)
const [reportType, setReportType] = useState<'coach' | 'driver' | 'both'>('coach')
const [reportingCoachId, setReportingCoachId] = useState<string | null>(null)
const [reportingCoachName, setReportingCoachName] = useState<string>('')

// 駕駛回報
const [driverDuration, setDriverDuration] = useState<number>(0)

// 教練回報（參與者列表）
const [participants, setParticipants] = useState<Participant[]>([])
```

### 待處理扣款狀態

```typescript
const [pendingReports, setPendingReports] = useState<PendingReport[]>([])
const [processingReport, setProcessingReport] = useState<PendingReport | null>(null)
const [processingMember, setProcessingMember] = useState<FullMember | null>(null)
const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
```

### 會員搜尋狀態

```typescript
const [memberSearchTerm, setMemberSearchTerm] = useState('')
const { filteredMembers, handleSearchChange } = useMemberSearch()
```

---

## 付款方式

```typescript
const PAYMENT_METHODS = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '匯款' },
  { value: 'balance', label: '扣儲值' },
  { value: 'voucher', label: '票券' },
  { value: 'designated_paid', label: '指定（需收費）' },
  { value: 'designated_free', label: '指定（不需收費）' }
]
```

---

## 重要邏輯規則

### 1. 多教練回報機制

- 每個教練獨立回報自己教的參與者
- 系統自動過濾已被其他教練回報的會員
- 避免重複回報同一個會員

### 2. 軟刪除機制

- 參與者記錄不會真正刪除，而是標記 `is_deleted = true`
- 保留歷史記錄用於追蹤和審計
- 查詢時都要加上 `is_deleted = false` 條件

### 3. 修改追蹤機制

- 使用 `replaces_id` 追蹤修改來源
- 舊記錄會被軟刪除
- 新記錄的 `replaces_id` 指向舊記錄的 ID
- 在待處理列表中可以看到修改前後的對比

### 4. 會員與非會員處理

- **會員** (`member_id` 不為 null)
  - `status = 'pending'` → 進入待處理扣款列表
  - 需要在「待處理扣款」Tab 中處理
  - 完成後 `status = 'processed'`

- **非會員** (`member_id` 為 null)
  - `status = 'not_applicable'` → 不進入待處理列表
  - 不需要扣款處理
  - 記錄僅用於統計和回報

### 5. 駕駛回報的特殊情況

**情況 A：船只預約 - 有教練也有明確指定駕駛**
```
預約：G23
教練：阿明
駕駛：小華（明確指定）
結果：
- 阿明回報：參與者（reportType = 'coach'）
- 小華回報：駕駛時數（reportType = 'driver'）
```

**情況 B：船只預約 - 有教練但沒指定駕駛**
```
預約：G23
教練：阿明
駕駛：無（沒有勾選"需要駕駛"或沒指定）
結果：
- 阿明是隱式駕駛（isImplicitDriver = true）
- 阿明回報：參與者 + 駕駛時數（reportType = 'both'）
- 原因：船不可能自己開，教練必須開船
```

**情況 C：預約只有駕駛（沒有教練）**
```
預約：G23
教練：無
駕駛：小華
結果：
- 小華回報：參與者 + 駕駛時數（reportType = 'both'）
- 駕駛需要同時回報兩者
```

**情況 D：彈簧床 - 有教練沒駕駛**
```
預約：彈簧床
教練：阿明
駕駛：無
結果：
- 阿明不是隱式駕駛（isImplicitDriver = false）
- 阿明回報：參與者（reportType = 'coach'）
- 不需要回報駕駛時數（彈簧床不需要有人開）
```

### 6. `requires_driver` 欄位說明

**欄位含義：** "是否強制指定駕駛"（不是"是否需要有人開船"）

- `requires_driver = true`：在排班時**必須**指定駕駛（教練和駕駛分開）
- `requires_driver = false`：在排班時**不強制**指定駕駛（可能是教練兼任，或是彈簧床）

**設定規則：**（在 NewBookingDialog 中）
- 彈簧床：強制 `false`（不可勾選）
- 沒有教練：強制 `false`（不可勾選）
- 船只 + 有教練：可勾選（用戶決定是否分開教練和駕駛）

**與回報邏輯的關係：**
- 回報系統**不使用** `requires_driver` 來判斷是否需要駕駛回報
- 而是使用 `isFacility(boatName)` 來判斷
- 原因：即使沒有勾選"需要駕駛"，船只還是需要有人開

---

## Tab 2: 待處理扣款

### 資料載入

#### `loadPendingReports()` 函數

載入當天所有 `status = 'pending'` 的參與者記錄（會員記錄）。

**查詢條件：**
- `status = 'pending'`：待處理扣款
- `is_deleted = false`：未被軟刪除
- 時間範圍：選定日期的 00:00-23:59

**回傳資料：**
- 參與者基本資訊
- 所屬預約資訊
- 教練資訊
- 原始記錄（如果是修改，`replaces_id` 會指向原記錄）

### 處理扣款

#### `handleProcessTransaction(report)` 函數

1. 驗證會員（`member_id` 不為 null）
2. 載入完整會員資料
3. 開啟 `TransactionDialog` 進行扣款
4. 扣款完成後更新狀態為 `'processed'`

---

## Tab 3: 非會員記錄

### 目的

- 追蹤所有非會員的教學和駕駛時數
- 讓管理員（寶哥）決定是否將記錄關聯到會員
- 或者直接結案（不關聯會員，僅保留時數統計）

### 資料載入

#### `loadNonMemberReports()` 函數

載入當天所有 `status = 'not_applicable'` 的參與者記錄（非會員記錄）。

**查詢條件：**
- `status = 'not_applicable'`：非會員
- `is_deleted = false`：未被軟刪除
- 時間範圍：選定日期的 00:00-23:59

### 操作功能

#### 1. 關聯會員 (`handleLinkMember`)

**流程：**
1. 點擊「🔗 關聯會員」按鈕
2. 開啟會員搜尋對話框
3. 搜尋並選擇會員
4. 更新記錄：
   - 設定 `member_id`
   - 更新 `participant_name`（使用會員暱稱或姓名）
   - 狀態從 `'not_applicable'` 改為 `'pending'`
5. 記錄移至「待處理扣款」Tab

**結果：**
- 非會員記錄轉變為會員記錄
- 需要在 Tab 2 進行扣款處理

#### 2. 直接結案 (`handleCloseNonMemberReport`)

**流程：**
1. 點擊「✓ 直接結案」按鈕
2. 確認對話框
3. 更新狀態從 `'not_applicable'` 改為 `'processed'`
4. 記錄移至「已結案記錄」Tab

**結果：**
- 不關聯任何會員
- 僅保留時數統計
- 可用於真正的非會員客人記錄

---

## Tab 4: 已結案記錄（教練細帳）

### 目的

- 顯示當天所有已完成的教練工作記錄
- 統計各教練的教學時數和駕駛時數
- 提供詳細的細帳明細

### 資料載入

#### `loadCompletedReports()` 函數

並行載入兩種資料：

**1. 教學記錄** (`booking_participants`)
- `status = 'processed'`：已處理/已結案
- `is_deleted = false`：未被軟刪除
- 包含會員和非會員的所有已結案記錄

**2. 駕駛記錄** (`coach_reports`)
- 所有駕駛回報記錄
- 按預約時間排序

### 數據統計

#### `coachStats` 計算邏輯

按教練 ID 分組統計：

```typescript
{
  coachId: string
  coachName: string
  teachingMinutes: number      // 教學總時數
  drivingMinutes: number       // 駕駛總時數
  teachingRecords: any[]       // 教學明細記錄
  drivingRecords: any[]        // 駕駛明細記錄
}
```

**統計規則：**
1. 遍歷所有 `completedReports`（教學記錄），累加各教練的 `duration_min`
2. 遍歷所有 `completedDriverReports`（駕駛記錄），累加各教練的 `driver_duration_min`
3. 按教練姓名排序

### UI 顯示

**1. 總計卡片**
- 當日總教學時數（所有教練總和）
- 當日總駕駛時數（所有教練總和）
- 顯示分鐘和小時單位

**2. 各教練詳細卡片**
- 教練姓名
- 教學/駕駛時數統計
- 教學明細列表：
  - 時間、船隻
  - 學員姓名（會員/非會員標記）
  - 時數、付款方式
- 駕駛明細列表：
  - 時間、船隻
  - 駕駛時數

---

## UI 元件結構

```
CoachReport
├── PageHeader
├── Tab 切換按鈕
│   ├── 教練回報 Tab
│   ├── 待處理扣款 Tab (顯示待處理數量)
│   ├── 非會員記錄 Tab (顯示非會員記錄數量)
│   └── 已結案記錄 Tab
│
├── [Tab 1: 教練回報]
│   ├── 篩選區
│   │   ├── 查看模式切換按鈕
│   │   │   ├── 📅 按日期查看
│   │   │   └── ⚠️ 查看所有未回報（近30天）
│   │   └── 日期選擇（僅在按日期模式顯示）
│   └── 預約列表
│       └── 預約卡片 (按教練/駕駛分組)
│           ├── 預約資訊
│           ├── 教練列表 (每個教練有回報按鈕)
│           └── 駕駛列表 (每個駕駛有回報按鈕)
│
├── [Tab 2: 待處理扣款]
│   ├── 日期選擇
│   └── 待處理列表 (按預約分組)
│       └── 預約卡片
│           └── 參與者列表
│               └── 參與者卡片 (顯示處理扣款按鈕)
│
├── [Tab 3: 非會員記錄]
│   ├── 日期選擇
│   └── 非會員列表 (按預約分組)
│       └── 預約卡片
│           └── 參與者列表
│               └── 參與者卡片
│                   ├── 🔗 關聯會員按鈕
│                   └── ✓ 直接結案按鈕
│
├── [Tab 4: 已結案記錄]
│   ├── 日期選擇
│   ├── 總計卡片
│   │   ├── 總教學時數
│   │   └── 總駕駛時數
│   └── 教練列表
│       └── 教練卡片
│           ├── 教練統計 (教學時數/駕駛時數)
│           ├── 教學明細列表
│           └── 駕駛明細列表
│
├── 回報對話框 (Modal)
│   ├── 預約資訊摘要
│   ├── [駕駛回報區塊]（條件顯示）
│   │   └── 實際駕駛時數輸入
│   ├── [教練回報區塊]（條件顯示）
│   │   ├── 提示訊息
│   │   ├── 參與者列表
│   │   │   └── 參與者表單
│   │   │       ├── 會員狀態標籤
│   │   │       ├── 姓名輸入（含會員搜尋）
│   │   │       ├── 時數輸入
│   │   │       ├── 付款方式選擇
│   │   │       └── 刪除按鈕
│   │   └── 新增客人按鈕
│   └── 提交/取消按鈕
│
├── 關聯會員對話框 (Modal - Tab 3 專用)
│   ├── 當前記錄資訊
│   ├── 會員搜尋輸入框
│   ├── 搜尋結果列表
│   └── 取消按鈕
├── TransactionDialog (扣款對話框)
└── Footer
```

---

## 使用流程範例

### 範例 1: 標準教練回報

1. 教練登入後進入「教練回報」頁面
2. 選擇今天的日期（預設）
3. 看到自己的預約列表（已結束的預約）
4. 點擊某個預約旁的「回報」按鈕
5. 系統自動帶入預約的會員
6. 教練確認或修改參與者、時數、付款方式
7. 如有非會員客人，點擊「新增客人」
8. 提交回報
9. 會員參與者進入「待處理扣款」列表

### 範例 2: 駕駛回報（沒有教練）

1. 駕駛進入「教練回報」頁面
2. 看到自己的預約（標示為駕駛）
3. 點擊「回報」按鈕
4. 看到兩個區塊：
   - 駕駛回報：填寫駕駛時數
   - 教練回報：填寫參與者資訊
5. 同時完成兩個回報並提交

### 範例 3: 處理待扣款

1. 切換到「待處理扣款」Tab
2. 看到所有 `status = 'pending'` 的會員參與者
3. 點擊某個會員的「處理扣款」按鈕
4. 打開 `TransactionDialog`
5. 執行扣款操作
6. 完成後該記錄 `status` 更新為 `'processed'`
7. 從列表中移除

### 範例 4: 修改已回報的記錄

1. 教練發現之前回報有誤
2. 再次點擊該預約的「回報」按鈕
3. 系統載入之前回報的參與者列表
4. 教練修改參與者資訊（時數、付款方式等）
5. 提交修改
6. 系統軟刪除舊記錄
7. 插入新記錄，`replaces_id` 指向舊記錄
8. 如果參與者是會員，新的待處理記錄會顯示 "🔄 修改" 標籤

### 範例 5: 查看所有未回報（防止遺漏）

1. 教練進入「教練回報」頁面
2. 點擊「⚠️ 查看所有未回報（近30天）」按鈕
3. 系統顯示過去 30 天內所有未完成回報的預約
4. 預約按日期分組顯示，方便查看
5. 教練看到之前遺漏的預約
6. 點擊「回報」完成遺漏的回報
7. 完成後該預約自動從未回報列表中消失
8. 可以隨時切換回「📅 按日期查看」模式

### 範例 6: 關聯非會員到會員

1. 管理員（寶哥）進入「非會員記錄」Tab
2. 看到教練回報的非會員「小明」
3. 發現「小明」其實是會員「王小明」用了別名
4. 點擊「🔗 關聯會員」按鈕
5. 搜尋「王小明」
6. 點擊選擇會員
7. 系統將記錄關聯到會員王小明
8. 記錄移至「待處理扣款」Tab
9. 在 Tab 2 進行正常扣款流程

### 範例 7: 非會員記錄直接結案

1. 管理員進入「非會員記錄」Tab
2. 看到教練回報的非會員「路人甲」
3. 確認這是真正的非會員（一次性客人）
4. 點擊「✓ 直接結案」按鈕
5. 確認對話框
6. 記錄狀態更新為 `processed`
7. 記錄移至「已結案記錄」Tab
8. 時數統計保留，但不關聯任何會員

### 範例 8: 查看教練細帳

1. 管理員進入「已結案記錄」Tab
2. 選擇要查看的日期
3. 看到當日總計：
   - 總教學時數：480分 (8小時)
   - 總駕駛時數：360分 (6小時)
4. 展開各教練詳細記錄
5. 阿明教練：
   - 教學：240分 (4h)
     - 10:00 G23 | 王小明 (會員) • 60分 • 扣儲值
     - 11:00 彈簧床 | 李大華 (會員) • 60分 • 現金
     - 14:00 G23 | 路人甲 (非會員) • 60分 • 現金
     - 15:00 G21 | 張三 (會員) • 60分 • 票券
   - 駕駛：180分 (3h)
     - 10:00 G23 • 60分
     - 14:00 G23 • 60分
     - 15:00 G21 • 60分
6. 可以清楚看到每位教練的工作量

---

## 錯誤處理

### 載入錯誤
- **載入預約失敗**：console.error 並顯示空列表
- **載入教練失敗**：console.error 並顯示空列表
- **載入會員失敗**：console.error 並保持空的參與者列表

### 提交錯誤（詳細錯誤訊息）

**駕駛回報錯誤**：
- 在瀏覽器控制台顯示詳細錯誤
- 包含 booking_id, coach_id, driver_duration_min

**教練回報錯誤（分步驟顯示）**：
1. **載入現有記錄失敗**：顯示具體的資料庫錯誤
2. **軟刪除記錄失敗**：顯示哪些記錄無法標記刪除
3. **刪除舊記錄失敗**：顯示清理舊資料時的錯誤
4. **插入新記錄失敗**：
   - 在控制台顯示準備插入的資料
   - 顯示具體的插入錯誤（如欄位驗證、外鍵約束等）

**調試方式**：
- 所有錯誤都會輸出到瀏覽器控制台 (F12)
- alert 訊息會提示打開控制台查看詳細錯誤
- 使用 console.log 顯示關鍵資料

### 驗證失敗
- **時數 ≤ 0** → alert 提示"時數必須大於 0"
- **姓名空白** → 自動過濾掉
- **沒有參與者** → alert 提示"請至少新增一位參與者"
- **缺少 booking_id 或 coach_id** → alert 提示"缺少必要資訊"

---

## 效能優化

1. **並行資料載入**
   - 使用 `Promise.all` 同時載入多個資料表
   - 減少等待時間

2. **過濾設施**
   - 使用 `isFacility()` 過濾彈簧床等設施
   - 減少不必要的資料處理

3. **條件渲染**
   - 只在需要時才載入和顯示對話框
   - 使用 `activeTab` 條件渲染

4. **資料關聯**
   - 在前端組裝資料，減少資料庫查詢次數

---

## 與其他元件的整合

### TransactionDialog
- 處理會員扣款
- 支援多種付款方式（儲值、票券等）
- 更新會員餘額
- 建立交易記錄

### useMemberSearch Hook
- 提供會員搜尋功能
- 支援按姓名、暱稱、電話搜尋
- 即時過濾結果

### PageHeader
- 顯示用戶資訊
- 提供導航功能
- 顯示「回到 Bao」連結

---

## 資料庫權限需求

- **讀取權限**：
  - `bookings`
  - `booking_members`
  - `booking_coaches`
  - `booking_drivers`
  - `coach_reports`
  - `booking_participants`
  - `members`
  - `coaches`
  - `boats`

- **寫入權限**：
  - `coach_reports` (INSERT/UPDATE)
  - `booking_participants` (INSERT/UPDATE/DELETE)
  - `members` (UPDATE - 透過 TransactionDialog)
  - `transactions` (INSERT - 透過 TransactionDialog)

---

## 未來改進方向

1. **批量回報**：允許一次回報多個預約
2. **離線支援**：支援離線記錄，上線後同步
3. **回報統計**：教練回報完成率、平均回報時間等
4. **通知功能**：提醒教練尚未回報的預約
5. **歷史記錄查看**：查看被軟刪除的歷史記錄
6. **匯出功能**：匯出回報資料為 Excel

---

## 常見問題 FAQ

### Q1: 為什麼有些會員沒有自動帶入？
A: 因為該會員已經被其他教練回報了。系統會自動過濾已被回報的會員，避免重複。

### Q2: 如何處理非會員客人？
A: 點擊「新增客人」按鈕，輸入客人姓名即可。非會員不會進入待處理扣款列表。

### Q3: 修改回報後原本的記錄會怎樣？
A: 原本的記錄會被軟刪除（`is_deleted = true`），新記錄會記錄 `replaces_id` 指向原記錄。

### Q4: 為什麼有些預約顯示「已回報」但還能再次回報？
A: 系統允許修改已回報的記錄。再次回報會更新資料。

### Q5: 駕駛回報和教練回報有什麼區別？
A: 
- **駕駛回報**：記錄實際駕駛時數，用於計算駕駛工作量
- **教練回報**：記錄參與者和教學時數，用於會員扣款和統計

### Q6: 「可搜尋會員或輸入客人姓名」是什麼意思？
A: 該輸入框同時支援：
- 搜尋並選擇現有會員（自動填入會員資訊）
- 直接輸入非會員客人的姓名

---

## 更新日誌

### 2025-11-18 (更新 5) - 新增 Tab 3 和 Tab 4
- **Tab 3: 非會員記錄**
  - 追蹤所有非會員的教學和駕駛時數
  - 管理員可選擇關聯到會員或直接結案
  - 關聯會員：將記錄轉為會員記錄，移至待處理扣款
  - 直接結案：不關聯會員，僅保留時數統計
- **Tab 4: 已結案記錄（教練細帳）**
  - 顯示當日所有已完成的教練工作
  - 統計各教練的教學時數和駕駛時數
  - 提供詳細的細帳明細（包含會員和非會員）
  - 總計卡片顯示當日總教學和駕駛時數
- **資料流程完整化**
  - `not_applicable` (非會員) → 關聯會員 → `pending` (待處理扣款) → `processed` (已結案)
  - `not_applicable` (非會員) → 直接結案 → `processed` (已結案)
  - `pending` (會員待扣款) → 完成扣款 → `processed` (已結案)

### 2025-11-18 (更新 4) - 修正駕駛回報判斷邏輯
- **重要修正**：修正隱式駕駛（isImplicitDriver）的判斷邏輯
  - ❌ 錯誤邏輯：使用 `requires_driver` 判斷（會導致船只預約沒勾選時教練不回報駕駛時數）
  - ✅ 正確邏輯：使用 `isFacility(boatName)` 判斷
  - **關鍵理解**：`requires_driver` 是"是否強制指定駕駛"，不是"是否需要有人開船"
  - **結果**：船只預約只要沒指定駕駛，教練就必須兼任駕駛回報（因為船不可能自己開）
- **文檔更新**：詳細說明 `requires_driver` 欄位的真正含義和使用場景

### 2025-11-18 (更新 3)
- **新增查看模式**：增加「查看所有未回報（近30天）」功能
  - 防止教練遺漏之前日期的未回報預約
  - 可在「按日期查看」和「查看所有未回報」之間切換
- **彈簧床回報**：將設施（彈簧床）納入回報系統
  - 移除過濾設施的邏輯（不再排除彈簧床）
  - 彈簧床只需教練回報，不需駕駛回報

### 2025-11-18 (更新 2)
- 修改非會員標籤為「🔍 可搜尋會員或輸入客人姓名」
- 改進 UI 提示，避免用戶誤以為輸入框被鎖定
- 使用橙色警告色系替代灰色，更明確提示可操作性

### 2025-11-18 (更新 1)
- 初始版本文檔建立

