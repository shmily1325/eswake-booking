# CoachOverview 頁面邏輯說明

## 📋 頁面概述

**路徑：** `/coach-overview`  
**用途：** 教練工作報表 - 查看教練的教學與駕駛時數統計  
**權限：** 僅管理員可訪問

---

## 🎯 功能架構

### Tab 1: 歷史記錄（已實現）
- 查看本月或指定月份的教練工作統計
- 顯示教學和駕駛時數對比圖表
- 可展開查看每個教練的詳細記錄

### Tab 2: 未來預約（預留）
- 顯示未來預約的統計數據
- 功能尚未實現

---

## 📊 數據來源

### 1. 教學記錄（booking_participants）
```sql
SELECT *
FROM booking_participants
WHERE status = 'processed'
  AND is_teaching = true
  AND is_deleted = false
  AND bookings.start_at BETWEEN '月初' AND '月底'
```

**關聯：**
- `bookings` - 取得預約時間、船隻、時長
- `coaches` - 取得教練姓名
- `members` - 取得會員姓名（如果有）

### 2. 駕駛記錄（coach_reports）
```sql
SELECT *
FROM coach_reports
WHERE bookings.start_at BETWEEN '月初' AND '月底'
```

**關聯：**
- `bookings` - 取得預約時間、船隻
- `coaches` - 取得教練姓名

---

## 🔢 統計計算邏輯

### CoachStats 數據結構
```typescript
interface CoachStats {
  coachId: string
  coachName: string
  teachingMinutes: number    // 教學總時數
  teachingCount: number       // 教學總筆數
  drivingMinutes: number      // 駕駛總時數
  drivingCount: number        // 駕駛總筆數
  totalMinutes: number        // 總時數（教學 + 駕駛）
  details: BookingDetail[]    // 細帳列表
}
```

### 統計摘要
1. **總教學時數** = 所有 CoachStats 的 teachingMinutes 總和
2. **總駕駛時數** = 所有 CoachStats 的 drivingMinutes 總和
3. **總預約數** = 所有不重複的 booking_id 數量

### 排序規則
- 教練列表按 `totalMinutes`（總時數）降序排列
- 最忙的教練顯示在最上面

---

## 📈 圖表顯示

### 教學時數圖表（藍色）
- 顯示每個教練的教學時數
- 柱狀圖長度 = `(該教練教學時數 / 最大教學時數) * 100%`
- 顯示時數和筆數

### 駕駛時數圖表（綠色）
- 顯示每個教練的駕駛時數
- 柱狀圖長度 = `(該教練駕駛時數 / 最大駕駛時數) * 100%`
- 顯示時數和筆數

**特點：**
- 兩個圖表獨立計算最大值
- 並排顯示（桌面版）或上下堆疊（手機版）
- 支持平滑過渡動畫

---

## 📋 細帳展開

### 顯示內容
點擊教練卡片可展開細帳，使用表格顯示：

| 列 | 內容 | 說明 |
|---|---|---|
| 日期時間 | 2025-11-19<br>09:15 | 預約的開始時間 |
| 船隻 | G21<br>(60分) | 船名和預約時長 |
| 學員 | **Ming**<br>不指定 60分 | 會員用藍色粗體<br>非會員用黑色 |
| 教學 | 60分 | 該預約的教學總時數 |
| 駕駛 | 60分 | 該預約的駕駛時數（如有） |

### 會員標示
- **會員**：藍色粗體顯示會員姓名（nickname 或 name）
- **非會員**：黑色顯示參與者姓名

### 課程類型翻譯
```typescript
{
  'undesignated': '不指定',
  'designated_paid': '指定（需收費）',
  'designated_free': '指定（不需收費）'
}
```

---

## 🔍 篩選功能

### 月份選擇
- 使用 `<input type="month">` 選擇器
- 默認為當前月份
- 格式：`YYYY-MM`

### 教練篩選
- 下拉選單顯示所有有記錄的教練
- 選項：「全部教練」+ 各個教練姓名
- 篩選後，統計摘要和圖表會相應更新

---

## 🎨 UI 設計

### 統計摘要卡片
- 3 個並排卡片（手機版堆疊）
- 顏色區分：
  - 教學：藍色 (`#f0f9ff` 背景)
  - 駕駛：綠色 (`#f0fdf4` 背景)
  - 預約：黃色 (`#fef3c7` 背景)

### 圖表卡片
- 左右並排（手機版上下）
- 標題顏色與數據顏色一致
- 教學：`#2196f3`
- 駕駛：`#4caf50`

### 細帳表格
- 斑馬紋（交替行顏色）
- 支持水平滾動（防止小屏幕溢出）
- 緊湊設計（字體 13px）

---

## 📱 響應式設計

### 桌面版 (isMobile = false)
- 統計摘要：3 欄並排
- 圖表：左右並排
- 表格：完整顯示

### 手機版 (isMobile = true)
- 統計摘要：單欄堆疊
- 圖表：上下堆疊
- 表格：水平滾動

---

## 🔄 數據處理流程

### 1. 頁面初始化
```
用戶進入頁面
  ↓
設置默認月份（當前月份）
  ↓
設置默認篩選（全部教練）
  ↓
載入數據
```

### 2. 載入數據 (loadPastData)
```
根據選擇的月份，計算日期範圍
  ↓
並行載入：
  - booking_participants (教學記錄)
  - coach_reports (駕駛記錄)
  ↓
整理數據到 Map<coachId, CoachStats>
  ↓
處理教學記錄：
  - 累加教學時數
  - 創建或更新 BookingDetail
  - 添加參與者信息
  ↓
處理駕駛記錄：
  - 累加駕駛時數
  - 更新 BookingDetail 的駕駛時數
  ↓
計算總時數
  ↓
按總時數排序
  ↓
篩選教練（如果有選擇特定教練）
  ↓
更新 state
```

### 3. 展開/收起細帳
```
點擊教練卡片
  ↓
設置 expandedCoachId
  ↓
顯示/隱藏該教練的細帳表格
```

---

## 🐛 注意事項

### 1. 課程類型
- 只有 3 種：`undesignated`、`designated_paid`、`designated_free`
- 不要使用 `designated`（已廢棄）或 `trial`（不存在）

### 2. 數據關聯
- 一個預約可能有多個參與者（教學記錄）
- 一個預約只有一個駕駛記錄
- 在細帳中按 booking_id 合併顯示

### 3. 會員識別
- 優先顯示 `member.nickname`
- 如果沒有 nickname，顯示 `member.name`
- 如果不是會員，顯示 `participant_name`

### 4. 時間格式
- 數據庫：`YYYY-MM-DD HH:MM:SS`
- 顯示日期：`YYYY-MM-DD`
- 顯示時間：`HH:MM`

---

## 🚀 未來擴展

### 待實現功能
1. **未來預約 Tab**
   - 顯示未來的預約統計
   - 預計工作量分析
   
2. **導出功能**
   - 匯出 Excel 報表
   - 匯出 PDF 報表

3. **更多篩選**
   - 按船隻篩選
   - 按日期範圍篩選（不限月份）
   
4. **趨勢分析**
   - 多月對比
   - 折線圖顯示趨勢

---

## 📝 相關文件
- `CoachReport-Logic.md` - 教練回報邏輯
- `CoachReport-Architecture.md` - 回報系統架構
- `CoachReport-Optimization.md` - 優化記錄

