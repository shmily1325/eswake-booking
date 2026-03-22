# 交辦事項公告系統 - 完整邏輯檢查報告

> 檢查日期：2025-03-15

---

## 一、資料流與檔案對應

| 階段 | 檔案 | 說明 |
|------|------|------|
| DB Schema | `migrations/095_*.sql`, `types/supabase.ts` | display_date, end_date, show_one_day_early |
| 工具函式 | `src/utils/announcement.ts` | 所有日期計算與分組邏輯 |
| 今日公告 | `src/components/DailyAnnouncement.tsx` | 首頁顯示、查詢、分組渲染 |
| 管理頁 | `src/pages/admin/AnnouncementManagement.tsx` | 新增/編輯/刪除、月份查詢 |

---

## 二、核心邏輯驗證

### 1. getEventStartDate（事項開始日）

| 條件 | 回傳 |
|------|------|
| show_one_day_early === true | display_date + 1 |
| show_one_day_early === false | display_date |
| 舊資料（null）：display_date 與 end 差 1 天 | end（推定為提前單日） |
| 舊資料：其他 | display_date |

✅ 邏輯正確

### 2. getEventDateLabel（顯示用日期字串）

| 情境 | 回傳 |
|------|------|
| 單日（display_date === end） | null |
| 區間單日（event_start === end） | "3/17" |
| 區間多日 | "3/16 - 3/21" |

✅ 邏輯正確

### 3. groupAnnouncementsForDisplay（今日/明日分組）

| 分組 | 條件 |
|------|------|
| 今日 | event_start <= today <= end |
| 明日提醒 | event_start === tomorrow |
| 其他 | 不顯示（過濾掉） |

每組內：先 single（display_date === end），後 range。

✅ 邏輯正確

### 4. computeDisplayDate / parseForEdit（表單 ↔ DB）

- 儲存：display_date = show_one_day_early ? event_start - 1 : event_start
- 還原：event_start = isEarly ? display_date + 1 : display_date
- 舊資料推定：display_date 與 end 差 1 天 → isEarly = true

✅ 邏輯正確

---

## 三、查詢邏輯驗證

### DailyAnnouncement（今日公告）

```
display_date <= today  AND  (end_date >= today  OR  end_date IS NULL)
```

- 涵蓋：今天在 [display_date, end_date] 內的公告
- 提前一天：display_date = today、event_start = tomorrow 時會符合

✅ 正確

### AnnouncementManagement（月份查詢）

| 查詢 | 條件 | 用途 |
|------|------|------|
| 1 | display_date ∈ [月初, 月底] | 事項開始在當月 |
| 2 | display_date < 月初, end_date ∈ [月初, 月底] | 跨月，結束在當月 |
| 3 | display_date < 月初, end_date > 月底 | 橫跨整月 |

✅ 邏輯正確。注意：Query 2、3 使用 end_date，若 end_date 為 null 會排除；目前新增/編輯都會設定 end_date，實務上無影響。

---

## 四、邊界情境測試矩陣

| 情境 | display_date | end_date | show_early | 3/15 顯示 | 3/16 顯示 |
|------|--------------|-----------|------------|-----------|-----------|
| 單日 3/16，未勾 | 3/16 | 3/16 | false | 不顯示 | 今日 |
| 單日 3/17，勾提前 | 3/16 | 3/17 | true | 明日提醒 | 今日 |
| 區間 3/16-3/21，未勾 | 3/16 | 3/21 | false | 不顯示 | 今日 |
| 區間 3/17-3/22，勾提前 | 3/16 | 3/22 | true | 明日提醒 | 今日 |
| 區間 3/16-3/21，勾提前 | 3/15 | 3/21 | true | 明日提醒 | 今日 |

✅ 皆符合預期

---

## 五、潛在問題與建議

### 1. 跨日不重新載入（低優先）

**現象**：使用者從 23:59 待到 00:01，DailyAnnouncement 不會重新 fetch，today 在 render 時已變，可能出現短暫顯示異常。

**建議**：可選實作 `useEffect` 偵測日期變更並重新 loadData，或保持現狀（多數情境可接受）。

### 2. formatDateShort 無效輸入（低優先）

**現象**：若 dateStr 格式錯誤，可能回傳 "NaN/NaN"。

**建議**：可加防呆，例如 `if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr`。DB 資料正常時影響小。

### 3. 舊資料 [提前一天顯示] 標籤

**現象**：舊資料（show_one_day_early 為 null）若由 display_date/end_date 推定為提前，parseForEdit 會正確還原，但列表的 `[提前一天顯示]` 只檢查 `announcement.show_one_day_early`，故不會顯示。

**建議**：若希望舊資料也顯示標籤，可改為使用 `parseForEdit(a).showOneDayEarly` 或等效邏輯。

---

## 六、函式使用狀況

| 函式 | DailyAnnouncement | AnnouncementManagement |
|------|-------------------|-------------------------|
| groupAnnouncementsForDisplay | ✓ | - |
| getEventDateLabel | ✓ | ✓ |
| getEventStartDate | - | ✓ |
| parseForEdit | - | ✓ |
| computeDisplayDate | - | ✓ |
| formatDateShort | - | ✓ |

✅ 無未使用匯入或死碼

---

## 七、結論

整體邏輯一致，查詢、分組、表單與 DB 轉換皆正確。上述潛在問題皆為低優先，可視需求再調整。
