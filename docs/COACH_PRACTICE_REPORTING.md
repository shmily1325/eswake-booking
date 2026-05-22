# 教練練習 — 練習時數回報與船使用時數

> 規格整理與實作指引（2026-05）。  
> 目標：教練練習預約可填報「練習時數（分鐘）」；資料**獨立於**一般預約回報與 `coach_reports` 駕駛回報；彙總用於 **Dashboard** 與 **區間時數合計**，且與營運／收錢時數**分開呈現**。

---

## 1. 背景與現況

- `bookings.is_coach_practice`：標記教練練習預約。
- 預約表單（`BookingDetails.tsx`）目前文案：教練練習會上時間表、需排班、**不需要回報**（上線本功能後需改文案）。
- `CoachReport.tsx` 載入預約時 `.eq('is_coach_practice', false)`，教練練習**不會**出現在一般「預約回報」列表。
- **區間時數合計**（`src/utils/boatUsageRangeStats.ts`）：`practiceMinutes` 目前為同區間內 `is_coach_practice = true` 且未取消之 **`bookings.duration_min` 加總**（排定時長，非填報）。
- **Dashboard**（`src/pages/admin/Statistics/`）：多處查詢排除教練練習（例如 `is_coach_practice` 過濾）；尚無「填報之練習船時」專用指標。

本功能上線後：**教練練習的船使用時數以「填報彙總」為主**（見第 6 節與既有 `duration_min` 的銜接策略）。

---

## 2. 產品定義

### 2.1 語意

- **教練練習**：教練**下水練習**，不是「練駕駛」。
- **練習時數**：使用者填寫之分鐘數；UI 一律使用此用語，**不要**寫成駕駛回報。

### 2.2 誰可填

- **被排班選到的人**（`booking_coaches` / `booking_drivers` 對應之 `coach_id`）可填自己的一筆。
- **管理員**（與現有「回報管理」`CoachAdmin` 可進入者相同邏輯）可代填／修改。

### 2.3 多人與一趟加總

- 多人可各填一段；**對外／報表以「趟」（`booking_id`）加總為一個數字**（`SUM` 各人之有效分鐘），**不必**在 Dashboard 上拆到人。
- **同一人、同一趟重複送出**：**覆蓋**該人該趟之一筆（實作上等價 `UNIQUE(booking_id, coach_id)` + upsert）。

### 2.4 驗證（與一般駕駛欄位對齊）

- **允許 0**；不擋、不額外軟提醒（與現有 `CoachReport` 駕駛分鐘行為一致）。
- **超過 `bookings.duration_min`**：不提醒、不硬擋。

### 2.5 預約生命週期（與現有預約規格一致）

- 預約有**會清掉回報／參與者**之變更時，一併清除本功能之**教練練習填報**明細（與 `EditBookingDialog` 等既有「改動清回報」行為對齊）。
- **複製／重複預約**：新 `booking_id`，**不帶**舊趟填報。
- **一般課 ↔ 教練練習**切換：依現有規則清理相關資料後，練習填報一併清空或隨預約類型重算權限。

### 2.6 與營運／收錢

- 練習時數**僅**用於內部船使用統計（與 Dashboard／區間）；**不**寫入 `booking_participants`、**不**走扣款流程。
- 報表上與「有收錢的營運時數」**分開欄位或分區**，必要時再加「合計」列需產品確認。

---

## 3. 資料模型（建議）

### 3.1 獨立表（不寫入 `coach_reports`）

避免與「駕駛回報」語意與既有 `hasDriverReport` 等邏輯混淆，建議**新表**存練習填報，例如：

**表名（示意）**：`coach_practice_minutes`（實際命名以 migration 為準）

| 欄位 | 說明 |
|------|------|
| `id` | PK |
| `booking_id` | FK → `bookings.id` |
| `coach_id` | FK → `coaches.id`（填報者＝排班上該人；管理員代填仍建議寫**被代填之 coach_id**） |
| `minutes` | 非負整數；允許 0 |
| `reported_at` | 首次或最後更新時間（擇一或兩者皆有） |
| `updated_at` | 可選 |

**約束**：`UNIQUE(booking_id, coach_id)` → 同一人同一趟覆蓋更新。

可選：`submitted_by_email` 或 `created_by` 供管理員代填稽核（規格未強制，視需求）。

### 3.2 趟級彙總

- **不需**冗餘欄位即可：`SELECT booking_id, SUM(minutes) ... GROUP BY booking_id`（僅限 `is_coach_practice = true` 之預約）。
- 若日後效能需要，再考慮快取欄位於 `bookings`（非第一階段必須）。

### 3.3 舊資料與未填報

- **上線日（或功能開關日）之前**已結束之教練練習：可 **批次結案** — 將該趟 `SUM` 視為 `duration_min` 或 0，並標記「歷史預設」不再要求補填（細節待產品定稿）。
- **上線後**：未填報之趟在區間／Dashboard 主指標是否計入，需二選一（建議主指標只計**有填報之趟**，或另列「排定時長」對照）。

---

## 4. UI／資訊架構

| 位置 | 用途 |
|------|------|
| **`CoachReport.tsx`（或 `/my-report-detail`）** | 新增子 Tab 或檢視：**「教練練習」** — 列表＋填報表單（僅練習時數），行為盡量贴近現有回報（對話框／列表節奏）。 |
| **`CoachAdmin.tsx`（回報管理）** | 新增 Tab：**教練練習填報明細** — 全站或依日期篩選、未完成標示、管理員代填入口。 |
| **`Statistics` Dashboard、`BoatUsageHoursPage`** | **不**新增「明細 Tab」；僅接**彙總查詢**（與營運分開顯示）。 |

預約表單／詳情：更新「不需要回報」文案，改為需填練習時數（或連結至回報頁）。

---

## 5. 權限與 API

- **RLS**：`INSERT`/`UPDATE`/`DELETE` 僅限 — 該 `booking_id` 之排班教練／駕駛 `coach_id` 本人，或具管理員身分之帳號（與現有 `coach-admin` 路由保護一致）。
- **讀取彙總**：Dashboard／區間頁目前多為管理端；RLS 需允許具權限角色讀取區間內各 `booking_id` 之加總（或僅後端 service role／已存在之 admin 查詢模式 — 依專案慣例）。

---

## 6. 與現有程式對接（實作檢查清單）

### 6.1 資料庫

1. 新增 migration：建立 `coach_practice_minutes`（或最終表名）、索引（`booking_id`、`coach_id`、複合 unique）。
2. `COMMENT ON` 說明與 `coach_reports` 無關。
3. RLS policies。
4. 更新 `src/types/supabase.ts`（若專案由 codegen 產生則跑產生指令）。

### 6.2 預約變更時清除填報

- 在與「清除 `coach_reports` / `booking_participants`」相同路徑上，**刪除**（或軟刪，建議先硬刪與預約生命週期一致）對應 `booking_id` 之 `coach_practice_minutes` 列。  
- 需搜尋：`EditBookingDialog`、`BatchEditBookingDialog`、刪除預約等流程。

### 6.3 教練端：`CoachReport`

1. 移除或放寬僅查 `is_coach_practice = false` 的限制：改為**兩個子檢視**（一般預約／教練練習），或 Tab 切換查詢。
2. 教練練習列表：已結束、`confirmed`、僅顯示與當前使用者（或所選教練）有排班之預約。
3. 表單：單一數字「練習時數」；提交寫入新表 upsert。
4. 可選：重用 `PageHeader` 導向 `CoachAdmin` 之教練練習 Tab。

### 6.4 管理端：`CoachAdmin`

1. `TabType` 擴充（現有：`'pending' | 'completed' | 'statistics' | 'billing'`）新增例如 `'coach_practice'`。
2. 查詢：join `bookings`、`boats`、排班；顯示每趟 `SUM(minutes)`、是否未完成（規則見 3.3）。
3. 列表明細列：可展開顯示每人分鐘（除錯用）；對外報表仍以趟加總為主。

### 6.5 區間時數：`boatUsageRangeStats.ts` + `BoatUsageHoursPage.tsx`

- 現況：`practiceMinutes` 來自 `bookings.duration_min`（見檔案註解）。
- 改動方向（擇一或並列）：
  - **A**：`practiceMinutes` 改為區間內每艘船對「教練練習預約」之 **`SUM(填報趟加總)`**（無填報則 0 或排除 — 與產品 3.3 一致）。
  - **B**：保留一欄「排定練習時長」、新增一欄「填報練習時數」、`totalMinutes` 定義需重寫說明與 UI 文案。

頁面說明文字（第 76 行附近）需同步更新。

### 6.6 Dashboard：`Statistics/index.tsx` 及相關 tab

- 依產品決定是否新增「教練練習船時（填報）」卡片或趨勢列；查詢應與 `boatUsageRangeStats` **口徑一致**，避免兩處數字對不起來。
- 現有排除 `is_coach_practice` 的**營運**查詢應維持不變；新增的是**另一條**練習填報彙總。

### 6.7 文案與其他

- `BookingDetails.tsx`：教練練習說明。
- `api/line-reminder.ts`、`TomorrowReminder.tsx` 等：確認是否需提醒填報（未於規格強制）。
- `offline.html`：若有類似文案則一併更新。

---

## 7. 實作順序建議

1. **Migration + RLS + types**  
2. **清除邏輯**（預約變更／刪除）接上新表  
3. **`CoachReport` 教練練習 Tab + 寫入**（最小可用）  
4. **`loadBoatUsageRangeStats` + `BoatUsageHoursPage` 口徑**  
5. **`CoachAdmin` 明細 Tab**  
6. **Dashboard 指標**（與第 4 步口徑對齊）  
7. **文案、歷史資料批次、測試**

---

## 8. 尚待釐清或風險

| 項目 | 說明 |
|------|------|
| **未填報趟在區間／Dashboard 是否計入** | 只計填報／排定二選一或雙欄對照；影響數字是否「跳動」。 |
| **歷史批次結案日** | 固定上線日與 migration 腳本是否寫入一次性「視同填報」或僅文件約定沿用 `duration_min`。 |
| **`totalMinutes` 定義** | 若區間頁改為「填報練習」，總和是否仍為 `general + practice` 或需第三欄。 |
| **RLS 與 admin 查詢** | 與現有 Supabase 使用方式一致，避免 Dashboard 查不到資料。 |
| **測試** | 多人覆寫、改期清資料、複製預約、設施船是否排除（與 `isFacility` 行為一致）。 |

---

## 9. 參考檔案（現況）

| 檔案 | 關聯 |
|------|------|
| `src/pages/coach/CoachReport.tsx` | 預約列表查詢、`is_coach_practice` 過濾 |
| `src/pages/coach/CoachAdmin.tsx` | Tab 架構、回報管理入口 |
| `src/components/booking/BookingDetails.tsx` | 教練練習勾選與文案 |
| `src/utils/boatUsageRangeStats.ts` | 區間教練練習分鐘（目前為 `duration_min`） |
| `src/pages/admin/BoatUsageHoursPage.tsx` | 區間 UI 與說明 |
| `src/pages/admin/Statistics/index.tsx` | Dashboard 查詢排除練習預約 |
| `src/components/EditBookingDialog.tsx` | 預約變更與清除回報相關提示 |

---

## 10. 決策摘要（對齊討論結論）

- 資料**不**進 `coach_reports` 駕駛欄位；**獨立表**存練習分鐘。  
- 填報 UX：**極贴近現有回報**，僅拿掉參與者／扣款相關。  
- **趟**對外為 `SUM(minutes) by booking_id`；同 coach 同趟覆蓋。  
- **明細**：`CoachAdmin` Tab；**彙總**：Dashboard + 區間時數，不塞明細 Tab。  
- 營運與練習船時**分開**顯示。
