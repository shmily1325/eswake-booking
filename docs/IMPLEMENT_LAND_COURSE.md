# 陸上課程實作清單

> 陸上課程與彈簧床相似，但**可重疊預約**（無固定場地設施）。  
> ✅ 已完成實作 (2025-03-23)

## 規格摘要

| 項目 | 陸上課程 |
|------|----------|
| 可重疊預約 | ✅ 是 |
| 需要駕駛 | ❌ 否 |
| 清理時間 | 0 |
| 收船費 | ❌ 不收 |
| 明日提醒/LINE | 顯示「XX:XX 陸上課程」 |
| 船次計數 | 不計入 |
| 教學時數 | 待定（建議比照彈簧床：全部計入） |

---

## 1. 資料庫

### 1.1 新增 migration：插入陸上課程

```sql
-- migrations/098_add_land_course.sql
INSERT INTO boats (name, color, is_active) 
VALUES ('陸上課程', '#XXXXXX', true);
```

- 需選一個顏色（如 `#8B7355` 棕色，或沿用彈簧床風格）
- 陸上課程的 `cleanup_minutes` 會在建立預約時由前端設為 0

### 1.2 更新 cleanup_minutes 的 migration（可選）

若沿用 `044_add_cleanup_minutes_to_bookings.sql` 的邏輯，可新增 migration 將「陸上課程」也設為 0：
（實際上新建預約會由前端帶入，歷史資料可之後補）

---

## 2. 設施與重疊邏輯

### 2.1 `src/utils/facility.ts`

- [ ] 將 `'陸上課程'` 加入 `FACILITIES`
- [ ] 新增 `ALLOW_OVERLAP_FACILITIES = ['陸上課程']` 或類似常數
- [ ] 新增 `isOverlapAllowed(boatName): boolean`

### 2.2 `src/utils/boatUtils.ts`

- [ ] 在 `BOAT_DISPLAY_ORDER` 中加入 `'陸上課程'`（建議放在彈簧床之後）

---

## 3. 預約衝突檢查（核心差異）

### 3.1 `src/utils/bookingConflict.ts`

- [ ] `checkBoatConflict`：若為可重疊設施，直接 `return { hasConflict: false }`（不查同船同時間衝突）
- [ ] `checkBoatConflictFromCache`：同上

### 3.2 `src/hooks/useBookingConflict.ts`

- [ ] 傳入 `isOverlapAllowed` 或由 `isFacility` 衍生的參數給 `checkBoatConflict`
- （或：在 `checkBoatConflict` 內依 `boatName` 判斷）

---

## 4. 預約建立/編輯

### 4.1 `NewBookingDialog.tsx`、`EditBookingDialog.tsx`、`RepeatBookingDialog.tsx`

- [ ] `cleanup_minutes: isSelectedBoatFacility ? 0 : 15` → 已由 `isFacility` 涵蓋，陸上課程加入 FACILITIES 後會自動生效

### 4.2 `src/hooks/useBookingForm.ts`

- [ ] `isSelectedBoatFacility` 已由 `isFacility(selectedBoat?.name)` 決定，加入 FACILITIES 即可

### 4.3 `CoachSelector.tsx`、`EditBookingDialog.tsx`

- [ ] 駕駛提示改為泛用：「設施不需要駕駛」或依設施類型顯示，避免只寫「彈簧床」

---

## 5. 教練排班 (CoachAssignment)

- [ ] 教練時間計算：`isFacility` 已涵蓋，陸上課程 cleanup = 0
- [ ] 駕駛統計：改為 `isFacility(boatName)` 或排除 FACILITIES，不只用「彈簧床」

---

## 6. 教練回報 (CoachReport)

- [ ] `isImplicitDriver`：已用 `isFacility(boatName)`，加入 FACILITIES 即可
- [ ] `participantValidation.ts`：若陸上課程比照彈簧床，在 `calculateIsTeaching` 中加上 `boatName.includes('陸上課程')`

---

## 7. 待處理扣款 (PendingDeductionItem)

- [ ] `isTrampolineFreeLesson` 改為 `isFacilityFreeLesson`，涵蓋彈簧床與陸上課程
- [ ] `isTrampoline` 改為 `isNoBoatFee`（或類似名稱），涵蓋彈簧床與陸上課程
- [ ] 邏輯：陸上課程不收船費，扣款規則比照彈簧床

---

## 8. 顯示與 UI

### 8.1 明日提醒 / LINE

**`TomorrowReminder.tsx`**、**`LineSettings.tsx`**：

目前邏輯：

```ts
const isFacility = boatName.includes('彈簧床')
if (isFacility) message += `${startTime}彈簧床\n`
else message += `${startTime}下水\n`
```

需改為依設施類型顯示：

```ts
// 依船隻類型顯示不同標籤
const facilityLabel = getFacilityMessageLabel(boatName)  // '彈簧床' | '陸上課程' | null
if (facilityLabel) message += `${startTime}${facilityLabel}\n`
else message += `${startTime}下水\n`
```

- [ ] 新增 `getFacilityMessageLabel(boatName)` 或類似函數
- [ ] 傳回：`'彈簧床'`、`'陸上課程'` 或 `null`（代表一般船）

### 8.2 船次計數

- [ ] `if (!isFacility)` → 已由 `isFacility` 涵蓋，陸上課程會自動不計入船次

### 8.3 DayView

- [ ] 清理時段：`boat.name !== '彈簧床'` 改為 `!isFacility(boat.name)` 
- [ ] cleanup 計算：`boat.name === '彈簧床'` 改為 `isFacility(boat?.name)`
- [ ] 行事曆設施顯示：`booking.boats?.name === '彈簧床'` 改為 `isFacility(booking.boats?.name)`
- [ ] 說明文字：改為「設施不需接船時間」等泛用描述

### 8.4 船隻管理 (BoatManagement)

- [ ] 「不收船費」：`boat.name.includes('彈簧床')` 改為 `isFacility(boat.name)` 或 `['彈簧床','陸上課程'].includes(boat.name)`

### 8.5 TodayOverview

- [ ] 駕駛統計：`booking.boats?.name === '彈簧床'` 改為 `isFacility(booking.boats?.name)`

### 8.6 date.ts `formatDurationWithPickup`

- [ ] `boatName === '彈簧床'` 改為 `isFacility(boatName)`

---

## 9. BatchEditBookingDialog

- [ ] 使用 `isFacility` 判斷設施，確保陸上課程正確處理

---

## 10. 測試

- [ ] `facility.test.ts`：加入 陸上課程 案例
- [ ] `boatUtils.test.ts`：更新顯示順序
- [ ] `participantValidation.test.ts`：陸上課程教學時數
- [ ] `bookingConflict.test.ts`：陸上課程可重疊、不衝突
- [ ] `date.test.ts`：陸上課程時長顯示

---

## 11. 文件

- [ ] 更新 `DEDUCTION_FLOW.md` 陸上課程情境
- [ ] 更新 `CoachReport-Logic.md`
- [ ] 若有的話，更新 API / 後台說明

---

## 實作順序建議

1. Migration 新增陸上課程
2. `facility.ts`：FACILITIES + 重疊邏輯
3. `bookingConflict.ts`：可重疊時略過船衝突
4. `boatUtils.ts`：顯示順序
5. 明日提醒 / LINE：`getFacilityMessageLabel`
6. 將硬編碼「彈簧床」改為 `isFacility` 或設施列表
7. PendingDeductionItem 扣款邏輯
8. participantValidation 教學時數
9. 測試與文件
