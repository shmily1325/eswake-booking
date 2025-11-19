# 教練回報系統架構 - 重構說明

## 重構日期：2025-11-18

## 📋 重構背景

原本的 `CoachReport.tsx` 包含了 4 個 Tab，功能混雜：
- Tab 1: 教練回報（教練操作）
- Tab 2: 待處理扣款（管理員操作）
- Tab 3: 非會員記錄（管理員操作）
- Tab 4: 已結案記錄（管理員查看）

**問題**：
1. 職責混雜 - 一個頁面同時服務教練和管理員
2. 用戶角色不清晰 - 教練只需要 Tab 1，管理員需要 Tab 2, 3, 4
3. Tab 數量過多 - 在移動端體驗不佳
4. 維護困難 - 代碼超過 2300 行

## 🎯 重構方案：角色分離

### 新架構

```
CoachReport.tsx (教練專用)
└── 教練回報功能
    ├── 按日期查看
    └── 查看所有未回報（近30天）

CoachAdmin.tsx (管理員專用)
├── Tab 1: 待處理記錄
│   ├── 會員待扣款
│   └── 非會員記錄
└── Tab 2: 已結案記錄
    ├── 📋 按預約查看
    └── 👤 按教練統計
```

## 📂 文件結構

### 1. `CoachReport.tsx` (簡化版 - 1051 行)

**功能範圍**：
- ✅ 教練回報（教學 + 駕駛）
- ✅ 按日期查看預約
- ✅ 查看所有未回報預約（近30天）
- ✅ 教練篩選
- ✅ 會員搜尋
- ✅ 非會員記錄

**移除功能**：
- ❌ 待處理扣款管理
- ❌ 非會員關聯會員
- ❌ 已結案記錄查看
- ❌ TransactionDialog

**核心邏輯**：
```typescript
// 判斷回報類型
getReportType(booking, coachId): 'coach' | 'driver' | 'both' | null

// 判斷回報狀態
getReportStatus(booking, coachId): { hasCoachReport, hasDriverReport }

// 提交回報
submitDriverReport()  // 駕駛時數
submitCoachReport()   // 參與者 + 時數
```

### 2. `CoachAdmin.tsx` (新建 - 1306 行)

**功能範圍**：

#### Tab 1: 待處理記錄

**查看模式**：
- 📅 **按日期查看** - 查看特定日期的待處理記錄
- 📋 **查看全部** - 查看所有日期的待處理記錄（防止遺漏）

**會員待扣款列表**（`status = 'pending'`）
  - 處理會員扣款（TransactionDialog）
  - 顯示修改記錄標記
  
**非會員記錄列表**（`status = 'not_applicable'`）
  - 🔗 關聯會員功能
  - ✓ 直接結案功能

#### Tab 2: 已結案記錄
- **按預約查看模式** (預設)
  - 以預約為單位組織
  - 顯示教練回報（參與者列表）
  - 顯示駕駛回報
  - 顯示學生結帳資訊
  
- **按教練統計模式**
  - 以教練為單位統計
  - 總教學時數 / 總駕駛時數
  - 教學明細列表
  - 駕駛明細列表

**核心邏輯**：
```typescript
// Tab 1 查看模式
pendingViewMode: 'date' | 'all'

// Tab 1 資料載入（根據 pendingViewMode 決定是否過濾日期）
loadPendingReports()      // 會員待扣款
loadNonMemberReports()    // 非會員記錄

// Tab 1 操作
handleProcessTransaction() // 處理會員扣款
handleLinkMember()        // 關聯非會員到會員
handleCloseNonMemberReport() // 直接結案

// Tab 2 資料載入
loadCompletedReports()    // 已結案記錄

// Tab 2 統計
coachStats    // 按教練統計
bookingStats  // 按預約統計
```

## 🗺️ 路由配置

```typescript
// src/App.tsx
<Route path="/coach-report" element={<CoachReport user={user} />} />
<Route path="/coach-admin" element={<CoachAdmin user={user} />} />
```

## 🏠 入口配置

```typescript
// src/pages/BaoHub.tsx
{
  title: '預約回報',
  icon: '📝',
  link: '/coach-report'
},
{
  title: '預約管理後台',
  icon: '👨‍🏫',
  link: '/coach-admin'
}
```

## 📊 數據流程

### CoachReport (教練回報)

```
1. 教練選擇日期/查看未回報
   ↓
2. 系統載入已結束的預約
   ↓
3. 顯示需要該教練回報的預約
   ↓
4. 教練點擊「回報」
   ↓
5. 填寫駕駛時數（如需要）+ 參與者資訊
   ↓
6. 提交回報
   ↓
7. 插入 booking_participants (status: pending/not_applicable)
8. 更新/插入 coach_reports
```

### CoachAdmin - Tab 1 (待處理記錄)

```
查看模式切換：
- 📅 按日期查看：過濾特定日期的記錄
- 📋 查看全部：顯示所有日期的記錄（防止遺漏）

會員待扣款：
1. 載入 status='pending' 的 booking_participants
   - 根據 pendingViewMode 決定是否過濾日期
   ↓
2. 管理員點擊「處理扣款」
   ↓
3. 打開 TransactionDialog
   ↓
4. 完成扣款後更新 status='processed'
   ↓
5. 自動重新載入資料
   ↓
6. 顯示成功提示

非會員記錄：
1. 載入 status='not_applicable' 的 booking_participants
   - 根據 pendingViewMode 決定是否過濾日期
   ↓
2a. 關聯會員：
    - 更新 member_id
    - 更新 participant_name
    - 更新 status='pending'
    - 自動重新載入資料
    - 記錄移至會員待扣款區域
    - 顯示成功提示：「✅ 已成功關聯到會員：XXX」
   
2b. 直接結案：
    - 確認對話框
    - 更新 status='processed'
    - 自動重新載入資料
    - 記錄移至已結案記錄頁籤
    - 顯示成功提示：「✅ 已成功結案：XXX」
```

### CoachAdmin - Tab 2 (已結案記錄)

```
1. 載入當日所有 status='processed' 的記錄
   - booking_participants (教學記錄)
   - coach_reports (駕駛記錄)
   ↓
2a. 按預約查看：
    - 以 booking_id 分組
    - 顯示該預約的所有教練回報
    - 顯示該預約的所有駕駛回報
    - 顯示該預約的所有學生結帳
   
2b. 按教練統計：
    - 以 coach_id 分組
    - 累加教學時數
    - 累加駕駛時數
    - 顯示明細列表
```

## 🔑 關鍵改進

### 1. 職責單一化
- **CoachReport**: 只負責回報，教練日常使用
- **CoachAdmin**: 只負責管理，管理員後台操作

### 2. 更好的權限控制
- 可以為兩個頁面設置不同的權限
- 教練只能訪問 `/coach-report`
- 管理員可以訪問兩者

### 3. 代碼可維護性
- **CoachReport**: 1051 行 (原 2373 行)
- **CoachAdmin**: 1306 行 (全新)
- 總行數減少約 1000 行
- 邏輯更清晰，更易維護

### 4. 用戶體驗優化
- 教練頁面簡潔，只有必要功能
- 管理員頁面功能完整，分類清晰
- Tab 數量合理（教練 0 個，管理員 2 個）

### 5. 新功能：按預約查看
- 可以看到單個預約的完整結案情況
- 包含教練回報、駕駛回報、學生結帳
- 更符合實際業務流程

### 6. 新功能：待處理記錄查看模式
- **按日期查看**：查看特定日期的待處理記錄（日常使用）
- **查看全部**：查看所有日期的待處理記錄（防止遺漏，清理積壓）
- 靈活切換，避免遺漏歷史未處理記錄

## 📝 參考文檔

- **CoachReport 詳細邏輯**: `CoachReport-Logic.md`
  - 包含原始的完整邏輯說明
  - 核心概念：回報類型、角色判定
  - 數據表關聯
  - 使用流程範例

## 🎉 總結

這次重構採用了**角色分離**的策略，將原本龐大的單一頁面拆分為兩個職責清晰的頁面：

1. **CoachReport**: 教練專用，快速回報
2. **CoachAdmin**: 管理員專用，完整管理

優點：
- ✅ 代碼更清晰
- ✅ 維護更容易
- ✅ 用戶體驗更好
- ✅ 權限控制更靈活
- ✅ 新增功能更容易

---

更新日期：2025-11-19
- 新增待處理記錄查看模式（按日期查看 / 查看全部）

