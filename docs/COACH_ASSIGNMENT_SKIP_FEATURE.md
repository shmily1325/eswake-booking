# 排班「略過 (Skip)」功能設計文件

> 適用版本：2026-05-27 上線版
> 主要檔案：`src/pages/coach/CoachAssignment.tsx`

---

## 1. 功能動機

### 痛點

在排班頁面 (`/assignment`) 一次儲存所有改動時，若**任何一筆**預約缺少教練/駕駛或不符合「需要駕駛」規則，**整批儲存會失敗**。

實務情境：
- 教練今天還沒回覆要不要值班 → 整批卡住
- 想先把確定的排好、剩一筆等晚點再決定 → 沒辦法

### 解法

提供一個 **😏 略過** 按鈕，讓特定預約**暫時被當作「沒排班」**，跳過驗證以便其他預約可正常儲存。

---

## 2. 核心設計決策

### 2.1 「略過 = 沒排班」（最終語意）

點 😏 = 等同於：

1. 把這筆預約的駕駛清空 (`driverIds = []`)
2. 跳過「缺駕駛」驗證
3. **照常寫入 DB**（駕駛清空會被儲存）
4. **照常記錄 audit log**（例：「駕駛: 侑曄 → 無」）

### 2.2 為什麼是這個語意？

考慮過兩種設計：

| 設計 | 缺點 |
|---|---|
| **A. Skip = 暫停，不動 DB** | 用戶若先移除駕駛 → 再 skip → 儲存，移除動作會被默默丟棄。違反直覺。 |
| **B. Skip = 沒排班，DB 同步**（採用） | 行為一致：UI 看到沒駕駛 → DB 就是沒駕駛。Audit log 完整。 |

### 2.3 `coachIds` 永不清空

`coachIds` 是**客人/櫃檯在預約建立時指定的真實資料**（例：「指定 Casper 教練」），不屬於排班頁面的「駕駛分配」職責。

略過動作只清 `driverIds`，`coachIds` 維持原樣。

### 2.4 `skipped` flag 為頁面內 transient state

| 屬性 | 值 |
|---|---|
| 是否存 DB | **否** |
| 是否跨頁面保留 | 否（離開頁面清掉） |
| 重整 / 切換日期 | 重置為 `false` |
| 用意 | 下次打開頁面，未排班的預約仍然會被提醒，不會被永久「藏起來」 |

---

## 3. 資料模型

### 3.1 In-memory state

```ts
const [assignments, setAssignments] = useState<Record<number, {
  coachIds: string[]      // 指定教練（永不被 skip 清空）
  driverIds: string[]     // 指定駕駛（skip 時清空）
  notes: string           // 排班備註
  conflicts: string[]     // 即時衝突提示（skip 時清空）
  requiresDriver: boolean // 是否需要駕駛
  skipped: boolean        // 略過 flag（不存 DB，每次載入歸零）
}>>({})
```

### 3.2 DB schema

**沒有新增任何欄位**。`skipped` 只活在 React state 裡。

DB 寫入的是「skip 後的結果」：
- `booking_drivers` 表：略過的預約的駕駛紀錄會被刪除（因為 `driverIds = []`）
- `bookings.schedule_notes`、`bookings.requires_driver`：照常處理

---

## 4. 行為對照表

### 4.1 點 😏 後的即時變化

| 階段 | 結果 |
|---|---|
| `state.driverIds` | 設為 `[]` |
| `state.conflicts` | 設為 `[]` |
| `state.coachIds` | **不動**（指定教練保留） |
| `state.skipped` | `true` |
| 駕駛按鈕外觀 | 全部變回白底（無已選） |
| 😏 按鈕外觀 | 變橘底白字 |
| 預約卡片標題 | 多一個 `✋ Skip` 橘色徽章 |
| 衝突警告 ⚠️ | 消失 |

### 4.2 取消略過（再點一次 😏）

| 階段 | 結果 |
|---|---|
| `state.driverIds` | 維持 `[]`（不還原） |
| `state.conflicts` | 維持 `[]` |
| `state.skipped` | `false` |
| 視覺 | `✋ Skip` 徽章消失，駕駛按鈕仍全白 |

> **設計理由**：skip 不是「暫時隱藏」，而是「這筆當作沒排」。要重新排駕駛只需重新點駕駛按鈕。

### 4.3 在 skipped 狀態下點駕駛按鈕

自動 un-skip 並指派該駕駛：

```ts
if (currentAssignment.skipped) {
  toggleSkipped(booking.id)   // 先取消 skip
}
toggleDriver(booking.id, c.id) // 再指派
```

---

## 5. 儲存流程影響

### 5.1 驗證階段

| 驗證項目 | 對 skipped 預約 |
|---|---|
| `missingPersonnel`（未指定任何人） | **跳過** |
| `driverIssues`（不符合需要駕駛規則） | **跳過** |

### 5.2 衝突檢查階段

| 檢查項目 | 對 skipped 預約 |
|---|---|
| In-memory 衝突檢查 | **照常**（`driverIds=[]` 自然不誤報；但 `coachIds` 衝突仍會被抓到） |
| DB 衝突檢查 | **照常** |
| `checkConflictRealtime`（即時 UI 提示） | **照常**（從 toggleCoach/toggleDriver 觸發） |

> **重要**：略過不代表這筆預約完全跳過所有檢查。**指定教練的時間衝突仍然會擋下儲存**。

### 5.3 主 save 迴圈

| 行為 | 對 skipped 預約 |
|---|---|
| `hasChanges` 判斷 | 一視同仁。`driverIds: [Y] → []` 會被判定為有變動 |
| 寫入 `booking_drivers` | 一視同仁。略過的預約會把舊駕駛刪除、不寫入新駕駛 |
| 寫入 `bookings.schedule_notes` / `requires_driver` | 一視同仁 |
| Audit log (`logCoachAssignment`) | 一視同仁。例：「駕駛: 侑曄 → 無」 |

---

## 6. UI 元素位置

### 6.1 😏 按鈕

**位置**：未排班區塊 → 點預約卡片展開「指定駕駛」區 → 駕駛按鈕列的最後一個。

**為什麼放這裡？**
- 預約已排好駕駛時不會在「未排班」區塊出現，自然看不到 😏（沒必要 skip）
- 與駕駛按鈕並列：點駕駛 = 確定排，點 😏 = 確定不排，視覺上互斥

**樣式**：
```ts
border: skipped ? 'none' : '1px solid #ddd'
background: skipped ? '#ff9800' : 'white'
color: skipped ? 'white' : '#666'
```

### 6.2 ✋ Skip 徽章

**位置**：未排班區塊的預約卡片標題列右側。

**特性**：
- 收合 / 展開都顯示
- 即使 skipped 預約有指定教練同時出現在教練分組，**教練分組那邊不顯示徽章**（因為教練分組的 booking 卡是不同渲染區塊；這是已知並接受的設計）

---

## 7. 影響範圍盤點（其他模組）

### 7.1 DayView 未排班計數

**檔案**：`src/pages/DayView.tsx`

DayView 直接讀 DB 的 `booking_drivers`，**不知道 `skipped` flag**。

判斷邏輯：
- skipped 後 DB 的 `driverIds = []`
- DayView 看到 `requires_driver=true` 但沒駕駛 → 列為未排班 ✓

> 完美一致：用戶 skip 一筆 → DayView 仍然提醒這筆未排班。

### 7.2 排班頁的 `unassignedCount`（DailyStaffDisplay 警告）

完全只看 `coachIds.length` / `driverIds.length` / `requires_driver`，不看 `skipped`。
skipped 後 `driverIds=[]` → 自然算入未排班 ✓

### 7.3 今日總覽統計

| 統計類型 | 來源 | skipped 影響 |
|---|---|---|
| 教練統計 | `assignment.coachIds` | 仍計入（designated coach 是真資料） |
| 駕駛統計 | `assignment.driverIds` | 不計入（已 = `[]`） |
| 合併統計（教練+駕駛） | 兩者聯集 | 駕駛部分不計入 |

### 7.4 `isCoachAvailable`（駕駛按鈕反灰邏輯）

只看 state 的 `coachIds` / `driverIds`：
- skipped 後 `driverIds=[]` → 不會擋其他預約的駕駛選擇
- `coachIds` 仍在 → 仍會擋其他預約的同一人 ✓

### 7.5 預約分類（教練分組 / 未排班）

```
needsDriverBookings：
  - assignment.conflicts.length > 0  OR
  - (requires_driver && driverIds.length === 0)  OR
  - (coachIds.length === 0 && driverIds.length === 0)

coachGroups[X]：
  - X 在 coachIds 內
  OR
  - X 在 driverIds 內 且 不在 coachIds 內
```

skipped 後（`driverIds=[]`、`coachIds=[X]`）：
- 進入 `needsDriverBookings`（因為符合 `requires_driver && no driver` 或 `no coach & no driver`）
- 同時可能進入 `coachGroups[X]`（如果有指定教練）

> 兩邊同時顯示是已知可接受設計。`✋ Skip` 徽章只在未排班區那邊顯示。

---

## 8. 邊角案例驗證

### 案例 1：典型流程（昨天排好，今天想取消）

**場景**：A 預約原本 `driver = 侑曄`，今天決定不排。

```
Step 1: 進排班頁 → A 在「侑曄」分組
Step 2: 點 A 旁邊的 ❌ → driver 移除 → A 進入「未排班」
Step 3: 展開 A → 點 😏 → state.skipped=true, driverIds=[]
Step 4: 儲存 → DB 駕駛清空 → audit「駕駛: 侑曄 → 無」
Step 5: DayView 看到 A 沒駕駛 → 列為未排班 ✓
```

### 案例 2：有指定教練 + skip

**場景**：A 預約有 `coach = Casper`（客人指定），尚未排駕駛，今天先跳過。

```
Step 1: 進排班頁 → A 在「Casper」分組（因為有 coachIds=[Casper]）
        且 A 也在「未排班」（因為 requires_driver && no driver）
Step 2: 在「未排班」展開 A → 點 😏 → skipped=true, conflicts=[], driverIds=[]
        coachIds=[Casper] 不動
Step 3: 儲存 → 不報「缺駕駛」錯
        若 Casper 跟其他預約有時間衝突仍會擋（這是對的）
Step 4: 重整 → skipped 重置，A 仍提醒未排班 ✓
```

### 案例 3：先排駕駛產生衝突再 skip

**場景**：A 在未排班 → 點駕駛 Y → Y 跟其他預約衝突 → 算了改 skip。

```
Step 1: 點 Y → driverIds=[Y], conflicts=["Y 在 ... 衝突"]
        A 留在「未排班」（因為 conflicts.length > 0）
Step 2: 點 😏 → driverIds=[], conflicts=[], skipped=true
        UI: Y 按鈕變白、衝突警告消失、😏 變橘 ✓
Step 3: 儲存正常
```

### 案例 4：skip 後想反悔

**場景**：A 點了 😏 但又想排回侑曄。

```
Step 1: skipped=true, driverIds=[]
Step 2: 點駕駛侑曄 → toggleSkipped 自動觸發（un-skip）→ driverIds=[侑曄]
        skipped=false, ✋ Skip 徽章消失 ✓
```

> 注意：如果只點 😏 取消 skip（不點駕駛），driverIds 維持 `[]`，不會還原成原本的駕駛。要重排請直接點駕駛按鈕。

### 案例 5：只 skip 不改其他 → 「沒有變動」

**場景**：使用者進排班頁只點了一個 😏 在一筆**原本就沒駕駛**的預約上，按儲存。

```
原狀態: coachIds=[], driverIds=[], notes='', requires_driver=true
Skip 後: coachIds=[], driverIds=[], notes='', skipped=true (transient)
hasChanges 判斷: 全部相同 → false → 不寫 DB
UI: 顯示「✅ 沒有變動，無需儲存」
```

> 這是符合實際資料行為的，已確認接受。

### 案例 6：切換日期 / 重新整理

```
所有 skipped 全部重置為 false
未完成的 skip 操作完全消失
原 DB 狀態維持
```

> 設計上**就是要每次提醒未排班預約**，避免使用者忘記。

---

## 9. 已知不修但記錄在案的細節

| 項目 | 行為 | 為什麼不修 |
|---|---|---|
| Skipped 預約若有指定教練，會同時出現在教練分組（無 ✋ 徽章） | 兩個渲染區塊獨立 | 指定教練是真資料，本來就該顯示 |
| 只有 skip 沒其他變動時，會跳「沒有變動」訊息（不 navigate） | 符合 hasChanges 判斷 | 沒寫 DB 就沒必要 navigate；下次來仍會提醒 |
| skip 後再 un-skip，原 driverIds 不還原 | 第一次 skip 已清空 | 一致語意：skip = 清掉駕駛 |
| 即時衝突檢查不會在 skipped 預約上自動更新 | conflicts 已被清空且不會重算 | 儲存時的 in-memory 檢查仍會抓 coachIds 衝突，安全 |

---

## 10. 程式碼定位

| 功能 | 檔案 / 行數 |
|---|---|
| `assignments` state 定義 | `CoachAssignment.tsx:85-92` |
| `loadBookings` 初始化 skipped=false | `CoachAssignment.tsx:189-201` |
| `toggleSkipped` 函式 | `CoachAssignment.tsx:247-267` |
| `missingPersonnel` 跳過 skipped | `CoachAssignment.tsx:401` |
| `driverIssues` 跳過 skipped | `CoachAssignment.tsx:419` |
| 駕駛按鈕點擊自動 un-skip | `CoachAssignment.tsx:2066-2070` |
| 😏 按鈕 UI | `CoachAssignment.tsx:2089-2109` |
| ✋ Skip 徽章 UI | `CoachAssignment.tsx:1982-1994` |

---

## 11. 上線檢查清單

- [x] State 結構含 `skipped: boolean`
- [x] 4 處 fallback default object 都含 `skipped: false`
- [x] `loadBookings` 一律初始化為 `false`
- [x] `toggleSkipped` 清空 `driverIds` + `conflicts`、保留 `coachIds`
- [x] `missingPersonnel` 驗證跳過 skipped
- [x] `driverIssues` 驗證跳過 skipped
- [x] In-memory / DB 衝突檢查照常運作
- [x] Save 主迴圈照 `hasChanges` 判斷寫入
- [x] Audit log 一視同仁記錄
- [x] 點駕駛自動 un-skip
- [x] 😏 按鈕 UI 完成
- [x] ✋ Skip 徽章 UI 完成
- [x] DayView 未排班計數行為正確
- [x] 今日總覽統計行為正確
- [x] `isCoachAvailable` 行為正確
- [x] 切換日期 / 重整 skipped 重置
- [x] Lint 無錯

---

## 12. 後續可考慮的擴充（目前不做）

1. **持久化 skip**：若有「真的不排，不要再提醒」的需求，可以新增 DB 欄位（會跟 cancellation 概念重疊，需小心設計）
2. **Skip 歷史記錄**：在 audit log 多加一個「略過」分類，目前是用「駕駛: X → 無」表達
3. **Bulk skip**：一鍵略過所有未排班，作為「結束今日排班」的快捷
4. **教練分組的 Skip 視覺提示**：在 Casper 的分組看到 A 上面也標 `✋`，目前用兩邊獨立判斷
