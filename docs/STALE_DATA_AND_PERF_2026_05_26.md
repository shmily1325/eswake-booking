# 全站 Stale Data 修復 + Read Query 並行化

> 日期：2026-05-26
> Commit：[`43ee5a5`](../../commit/43ee5a5) `perf+fix(ux): 全站修掉「換條件殘留舊資料」+ 多處 query 並行化`
> 範圍：20 個檔案，+395 / −243

---

## 起因

使用者反映切換 DayView 日期時，上方「未排班 X 筆」與「公告/維修」會殘留前一天的內容約 400~800ms，體驗不順。

順著這條 thread 做了全站掃描，發現是一個**系統性問題**：很多 useEffect 在條件變更時直接 fetch，但沒有先清掉舊 state，導致新資料載入前畫面殘留前條件的內容。最嚴重的一處（LineSettings）甚至有**正確性風險** — 換日後沒清 bookings，使用者可能對舊日學員按下發送 LINE。

同時順手把 8 處明顯可以平行化的 read query 改成 `Promise.all`，省 1~2 輪 RTT。

---

## 設計原則

整個 PR 嚴守三條紅線：

1. **不動業務邏輯** — 沒有改任何權限判斷、扣款規則、排程演算法。
2. **不動 write 路徑** — `INSERT/UPDATE/DELETE` 全部保持原本順序執行，partial failure 語意 100% 不變。曾經考慮把 CoachAssignment 的 coaches/drivers insert 並行化，因為會改變「一個成功一個失敗」的行為而**主動取消**。
3. **不改 realtime 訂閱觸發路徑** — state 清空動作只放在 input-changed 的 useEffect 開頭（`selectedDate`、`coachId`、`filter` 等變化時），realtime 的靜默刷新走另一條 useEffect 不會走到清空、所以不會閃。

---

## 修正類別 A：換條件時殘留舊資料（16 處）

模式：在依賴 input 的 useEffect 開頭把畫面顯示用的 state 重置為空陣列/初始值，再呼叫 loader。

| 檔案 | 觸發條件 | 清空的 state | 風險等級 |
|---|---|---|---|
| `pages/DayView.tsx` | 換日 | `conflictReasons` / `boatUnavailableBlocks` / `restrictionDayBlocks` | UX |
| `pages/coach/CoachDailyView.tsx` | 換日 | `bookings` / `conflictedIds` / `conflictReasons` / `boatUnavailableBlocks` / `restrictionDayBlocks` | UX |
| `pages/coach/CoachAssignment.tsx` | 換日 | `bookings` / `assignments`（避免 unassignedCount 閃錯誤筆數） | UX |
| `pages/TomorrowReminder.tsx` | 換日 | `bookings` | UX |
| **`pages/admin/LineSettings.tsx`** | **換日** | **`bookings`（防止對舊日學員按下發送 LINE）** | **⚠️ 正確性** |
| `pages/admin/AnnouncementManagement.tsx` | 換月/換排序 | `announcements` / `restrictionsMap` | UX |
| `pages/admin/AuditLog.tsx` | 換 filter / 日期 | `logs` | UX |
| `pages/coach/CoachAdmin.tsx` | 切到已結案 tab / 換日 | `completedReports` / `completedDriverReports` | UX |
| `pages/coach/CoachReport.tsx` | 換日 / 教練 / viewMode | `bookings` / `allBookings` / `availableCoaches` | UX |
| `pages/coach/CoachSchedulePreviewTable.tsx` | 換 coachId | `bookings` | UX |
| `components/StatisticsTab.tsx` | 換日 / 教練 | `allCoachStats` / `coachStats` | UX |
| `pages/admin/Statistics/index.tsx` | 換月 | `coachStats` / `memberStats` / `weekdayStats` / `monthlyCoachPracticeSessions` | UX |
| `components/TransactionDialog.tsx` | 換月（history tab） | `transactions` | UX |
| `components/RepeatBookingDialog.tsx` | 重開 dialog | `customDates` | UX |
| `pages/HomePage.tsx` | user 變更 | `isCoach` / `editorFeatureFlags` / `hasViewPermission` + 啟用 skeleton | UX（菜單殘留前一使用者） |

---

## 修正類別 B：用 `key` prop 強制 dialog remount

針對「內部表單 state 跟 prop 沒同步」的 dialog，用 `key={某個會變的 id}` 讓 React 在資料變更時直接 unmount + 新建，最徹底也最安全。

| 檔案 | 套用對象 | key |
|---|---|---|
| `pages/DayView.tsx` | `EditBookingDialog` | `selectedBooking?.id ?? 'none'` |
| `pages/SearchBookings.tsx` | `EditBookingDialog` | `selectedBookingForEdit.id` |
| `pages/admin/products/ProductManagement.tsx` | `ProductEditView` | `edit-${productId}` / `'create'` |

**沒套用 `key` 的 dialog**：
- `MemberDetailDialog` — 因為它有「在 dialog 內切會員（onSwitchMember partner）」功能，用 `key` 會在 partner 切換時整個 unmount 閃白。讀完發現它**本來就有 `loading ? <載入中> : ...` guard 擋住閃爍**，不需要修。

---

## 修正類別 C：useDailyStaff loading state 衍生化

**問題**：原本 `loading` 是獨立 state，`date` prop 變化時要等下一個 render + useEffect 才會 `setLoading(true)`，這中間有一幀仍顯示前一天的清單。

**修法**：把 `loading` 改成衍生值 `loadedDate !== date || isReloading`，讓 `date` prop 變化的當下 `loading` 就立刻為 `true`，shimmer 同步出現。

---

## 效能優化：Read Query 並行化（不動 write）

把同一個 loader 裡互相獨立、只依賴相同輸入的 supabase 查詢從串行改成 `Promise.all`。

| 檔案 | 並行化的查詢 | 省下 |
|---|---|---|
| `hooks/useDailyStaff.ts` | `coaches` + `coach_time_off` | 1 RTT |
| `pages/coach/CoachDailyView.tsx::computeConflicts` | `restriction` + `boat_unavailable` | 1 RTT |
| `pages/TomorrowReminder.tsx` | `booking_coaches` + `booking_drivers` + `booking_members` | 2 RTT |
| `pages/admin/LineSettings.tsx::fetchData` | `booking_coaches` + `booking_members` | 1 RTT |
| `pages/admin/LineSettings.tsx::loadLineBindings` | `line_bindings` + `members count` | 1 RTT |
| `pages/admin/AnnouncementManagement.tsx` | 三條 `daily_announcements` 查詢 | 2 RTT |
| `pages/coach/CoachReport.tsx` | `booking_members` + `booking_participants` | 1 RTT |
| `pages/admin/Statistics/index.tsx` | 六個月 trend / finance 迴圈、future + reported、teaching + driving stats | 5+ RTT |
| `pages/member/MemberImport.tsx` | 刪除前 4 個關聯檢查、bulk delete 前 7 個統計查詢 | 3 + 6 RTT |
| `components/MemberDetailDialog.tsx` | 把備忘錄查詢納入既有的 Promise.all | 1 RTT |

對於 Statistics Dashboard 這種會跑 6 個月迴圈的頁面，並行化後初次載入時間明顯感覺得出來。

---

## 主動取消（為了不引入新錯誤）

| 項目 | 取消原因 |
|---|---|
| CoachAssignment 把 coaches insert 跟 drivers insert 並行化 | 改變 partial failure 語意：原本「coaches 失敗就不會插 drivers」變成「兩者獨立、可能只成功一半」，DB 進入不一致狀態 |
| EditBookingDialog 的 write 並行化 | 同上 |
| CoachDailyView restriction/boat 查詢提前到跨 useEffect（與 loadBookings 並行） | 需動 realtime 訂閱觸發路徑，複雜度高、收益小（這次 computeConflicts 內部已並行化，主要 RTT 已省下） |
| useBookingForm 教練休假即時標記 | 超出「純清空 state」範圍，需改下拉選單渲染邏輯（loading 期間 disable），改動面太大 |

---

## 驗證

| 檢查 | 結果 |
|---|---|
| `git ls-files --eol`（20 個檔案行尾一致性） | 全綠，無 CRLF/LF 混亂 |
| ESLint（限定改過的檔案） | 0 個新增錯誤，剩下都是 pre-existing 的 `any`/unused vars |
| `npx vitest run` | 1055 passed, 2 skipped, 0 failed |
| `npm run build`（tsc + vite build） | exit code 0，1246 modules transformed |

---

## 行為對比

### 換 DayView 日期前後

| 階段 | Before | After |
|---|---|---|
| t = 0ms（點下日期） | 顯示前一天的「未排班 5 筆」「公告：停電維修」 | 「未排班」shimmer、「公告」空白 |
| t ≈ 400ms（資料回來） | 跳到正確新資料 | 跳到正確新資料 |
| 體感 | 看到一閃的錯誤數字，誤以為 bug | shimmer 後直接出新資料，順 |

### LineSettings 換日（這條是正確性 bug）

| 階段 | Before | After |
|---|---|---|
| 切換到新日期但資料還沒回來 | 顯示昨天的學員清單，**操作者可能對昨天的學員按下「發送 LINE」** | 清單清空 + shimmer，不會誤觸 |

---

## 設計筆記

### 為什麼有些用「清空 state」、有些用「key remount」？

- **清空 state**：適用於頁面層級、loader 是內部 function、state 結構單純的場景。改動最小、不會 unmount 子元件、不會閃白。
- **`key` remount**：適用於 dialog 內部表單欄位是另一個 hook（如 `useBookingForm`）管理、prop 變化但內部 state 不會跟著重置的場景。最徹底也最不容易遺漏。

### 為什麼 read 並行化但 write 不並行化？

Read 並行化是純效能優化，所有查詢都成功 → 沒問題；任一查詢失敗 → 整體失敗，跟原本一樣。

Write 並行化會改變 **partial failure** 行為：
- 串行：A 失敗 → 直接 return，B 根本沒執行 → DB 乾淨
- 並行：A 失敗 + B 成功 → DB 進入「只有 B 沒有 A」的不一致狀態

對於 booking 這種有 audit log、有金額扣抵的場景，這種不一致是災難。所以 write 永遠串行。

---

## 後續可選工作（這次未做）

1. **CoachDailyView restriction 提前載入** — 跨 useEffect 動 realtime 訂閱路徑，複雜度高，收益是再省約 200ms shimmer 時間
2. **useBookingForm 教練休假即時標記** — 要動下拉選單渲染邏輯
3. **MemberDetailDialog 防禦性清空** — 雖然現況沒問題，但若想未來重構時誤刪 loading guard 也不會 leak，可在 `loadMemberData()` 開頭加 `setMember(null); setBoardStorage([]); setMemberNotes([])`

以上都不是必要，視需求再評估。
