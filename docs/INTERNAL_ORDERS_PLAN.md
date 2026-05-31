# 內部商品訂單系統規劃

> **定位**：店內用開單／報帳／扣庫存工具。**不**取代公開 `/shop` 型錄（見 `SHOP_PLAN.md`）。
>
> 📅 規劃日期：2026-05-31  
> 🚧 狀態：規劃完成，待實作

---

## 0. 與公開商城的關係

| 項目 | 公開 `/shop` | 內部訂單 |
|------|-------------|----------|
| 對象 | 路人、LINE 詢問 | 登入後台店員 |
| 下單 | ❌ LINE 詢問 | ✅ 後台開單 |
| 金流 | ❌ | ✅ 報帳扣款 |
| 庫存 | 只顯示有貨／缺貨 | reserve + 結帳扣 stock |
| LIFF | ❌ | Phase 3 會員查進度 |

**一句話**：型錄讓客人看；訂單讓店員登記與報帳。

---

## 1. 核心流程（對齊預約 + 報帳）

分工類比：

| 預約系統 | 商品訂單 |
|----------|----------|
| 開預約 | 開單（訂單成立） |
| 等條件成熟 | 等貨／可送報帳 |
| 教練回報 | 商品同事 **送報帳** |
| 待扣款（CoachAdmin） | **待報帳** |
| 扣儲值／現金／匯款 | 同上，可 **代扣** |
| 刪除已有交易 → 人工處理帳 | 同上 |

### 1.1 五步程序

```
① 訂單成立（商品同事）
   訂購人、品項、成交價、面交／寄送、備註

② 等貨 or 可送報帳（系統依 stock 提示，不 reserve）
   ├─ **到貨、有現貨** → 該列出現在「可送報帳」（可送數量 ≤ 現有 stock − 已 reserve）
   └─ 還沒現貨 → 「等貨」（預購可拖很久；**不能**送報帳）

③ 送報帳（商品同事）
   確認這批貨可以跟客人收錢了（面交／寄出前後由店內習慣決定）
   → **僅在有現貨時可送**；RPC 檢查 `qty_submit ≤ stock − reserved_qty`
   → 通過後 reserve + 增加 qty_pending_bill

④ 待報帳（**管理員** inbox · 訂單報帳頁）
   儲值／匯款／現金；可指定代扣會員

⑤ 已結帳
   寫 transactions（儲值時）、扣 stock、釋放 reserve、增加 qty_paid
```

**Reserve 時點**：只在 **③ 送報帳**，不在開單時。長預購不占用 `reserved_qty`。

**付款時點**：**取貨／交貨才收款** → 實務上由商品在適當時機按「送報帳」，結帳同事在「待報帳」扣款。

---

## 2. 不做的事（v1）

| 項目 | 原因 |
|------|------|
| ❌ 客人線上下單／結帳 | 公開型錄走 LINE |
| ❌ 自動退儲值 | 跟現行金流：作廢後人工到會員交易處理 |
| ❌ 訂單多人會員 | 只選一位會員或手動姓名 |
| ❌ 混合付款拆多筆 | v1 單一 payment_method 一次結清本批 |
| ❌ LINE push 通知 | Messaging API 未通 |
| ❌ 物流 API／發票／金流閘道 | 超出範圍 |
| ❌ 訂單來源統計（型錄轉換） | v2 |
| ❌ 銷售報表 UI | v2（表結構預留欄位） |
| ❌ LIFF 訂單查詢 | Phase 3 |

---

## 3. 訂單與品項資料

### 3.1 `shop_orders`

| 欄位 | 說明 |
|------|------|
| `id` | UUID |
| `order_no` | 內部編號，如 `SO-260531-03`（列表／對帳用；客人多半念品名） |
| `member_id` | 可 NULL（非會員僅 `contact_name`） |
| `contact_name` | 訂購人顯示名（會員暱稱或手動輸入） |
| `delivery_method` | `pickup_es` \| `shipping` |
| `shipping_info` | 地址、宅配單號等（可空） |
| `customer_note` | 給客人看（LIFF 後用；例：預計 8 月到貨） |
| `internal_notes` | 店內用 |
| `cancelled_at` | 作廢時間（NULL = 有效） |
| `created_at` / `created_by` | 開單 |
| `updated_at` / `updated_by` | |

### 3.1b `shop_order_settlements`（結帳紀錄 · v1 就要）

每次管理員在「訂單報帳」結清一批，寫一筆（**含匯款／現金**，供 Phase 2 報表；**不**強制寫入 `transactions`）。

| 欄位 | 說明 |
|------|------|
| `id` | UUID |
| `order_id` | FK |
| `payment_method` | `balance` \| `transfer` \| `cash` |
| `charge_member_id` | 扣儲值／代扣對象（現金匯款可 NULL） |
| `amount_total` | 本批結帳總額（帳務端可調後寫入） |
| `settled_by` | 操作者 |
| `settled_at` | 結帳時間 |
| `notes` | 可空 |
| `items_snapshot` | JSONB：本批 `{ item_id, variant_id, qty, unit_price, line_total }`（結帳當下帳務認定數字） |

儲值扣款仍另寫 `transactions`（`shop_order_id`）；匯款／現金以 `shop_order_settlements` 為準。

**帳務調整後**若與已扣 `transactions.amount` 不一致 → **不**自動沖帳；管理員到會員交易人工處理（與作廢策略一致）。

### 3.2 `shop_order_items`

| 欄位 | 說明 |
|------|------|
| `order_id` | FK |
| `variant_id` | FK → `product_variants` |
| `unit_price` | 開單時成交單價快照（商品端可改，**送報帳後鎖**） |
| `qty` | 訂購總數（**送報帳後鎖**；未送部分商品端仍可改） |
| `qty_pending_bill` | 已送報帳、待扣款（已 reserve） |
| `qty_paid` | 已結帳數量 |

**可送報帳數量**（前端計算，須 **到貨有現貨**）：

```text
qty_billable = min(
  qty - qty_pending_bill - qty_paid,   # 尚未送出的訂量
  stock - reserved_qty                  # 現場可售（不含預購未到貨部分）
)
```

`qty_billable = 0` → 該列留在「等貨」。送報帳 RPC 以同一公式檢查，不足則拒絕。

**部分報帳範例**：訂 3 → 到 1 → 送報帳 1 → 結帳 1 → 再到 2 → 送報帳 2 → 結帳 2。

### 3.3 `product_variants` 新增

| 欄位 | 說明 |
|------|------|
| `reserved_qty` | 已送報帳尚未結帳的保留量 |

```text
實際可售 ≈ stock - reserved_qty
```

### 3.4 `transactions` 擴充

| 欄位 | 說明 |
|------|------|
| `shop_order_id` | UUID FK → `shop_orders`，`ON DELETE SET NULL` |

儲值扣款：`transaction_type = consume`，`category = balance`，`description` 含訂單號與品項摘要。

---

## 4. 三個 Inbox（UI 視角）

| Inbox | 誰 | 篩選邏輯 |
|-------|-----|----------|
| **等貨** | 商品 | 有列 `(qty - qty_pending_bill - qty_paid) > 0` 且可報帳量 = 0 |
| **可送報帳** | 商品 | 有列可報帳量 > 0 |
| **待報帳** | 管理員（訂單報帳） | 有列 `qty_pending_bill > 0`（或 join 待結批次） |

另：**全部訂單** 列表（搜尋、訂單號、訂購人）。

---

## 5. RPC（原子操作）

### 5.1 `submit_shop_order_billing(p_order_id, p_items jsonb, p_operator_id)`

- `p_items`: `[{ "item_id": "...", "qty": 2 }, ...]`
- 每列：`qty_submit ≤ qty - qty_pending_bill - qty_paid`
- 每列：`qty_submit ≤ stock - reserved_qty`（variant 層級 `FOR UPDATE`）
- 更新：`qty_pending_bill += qty_submit`，`reserved_qty += qty_submit`

### 5.2 `settle_shop_order(p_order_id, p_items jsonb, p_charge_member_id, p_payment_method, p_operator_id)`

- `p_items`: `[{ "item_id", "qty", "unit_price", "line_total" }, ...]` — **帳務端可調**單價／折扣後的金額（品項 `variant_id` 不可改）
- 只結 `qty_pending_bill` 中指定數量（v1 整批結清該次 pending）
- `balance`：依 `p_items` 加總後扣款，寫 `shop_order_id`
- **餘額不足**：**不擋**（與現有預約報帳相同，允許扣成負餘額）
- `cash` / `transfer`：不寫 `transactions`，寫 `shop_order_settlements` + `items_snapshot`
- 每批結帳：插入 `shop_order_settlements`；品項 `stock -= qty_settle`，`reserved_qty -= qty_settle`，`qty_pending_bill -= qty_settle`，`qty_paid += qty_settle`
- **Idempotent**：同一批不可重複結帳（pending 歸零檢查）

### 5.2b `adjust_shop_order_settlement(...)`（v1 可選；至少 UI 要能改 settlement 紀錄）

- **僅 `isAdmin`**；**不可**改 `variant_id`、訂單 `qty`、庫存
- 可改：`shop_order_settlements.amount_total`、`items_snapshot` 內單價／折扣／line_total、`notes`
- 已扣儲值 **不**自動重算；差額走人工會員交易

### 5.3 `cancel_shop_order_billing(p_order_id, p_items jsonb, p_operator_id)`

- **誰能叫**：`can_products`（商品同事；管理員當然可以）
- 撤回尚未結帳的送報帳：`qty_pending_bill` 減少、`reserved_qty` 釋放
- 管理員尚未扣款前，商品端可修正誤送

### 5.4 作廢訂單

- 若 `qty_pending_bill > 0`：先釋放 reserve
- 若已有 `transactions`  linked：前端 **警告** → 刪除／作廢訂單本體 → transactions 保留、`shop_order_id` SET NULL → 提示到會員金流人工處理
- **不**自動退儲值

---

## 6. 刪除、作廢與鎖定規則

### 6.1 誰能改什麼（**送報帳 = 商品確定**）

| 欄位／動作 | 開單～送報帳前（商品 Tab） | 待報帳（訂單報帳） | 已結帳後 |
|------------|---------------------------|-------------------|----------|
| 品項 SKU、加減列 | ✅ 商品同事 | ❌ | ❌ |
| 訂購 `qty`（整列） | ✅（未送出的部分） | ❌ 已 pending 部分 | ❌ |
| `unit_price` | ✅ 商品同事 | ✅ **管理員可調**（折扣／改價） | ✅ **管理員可調帳務紀錄** |
| 本批結帳金額 | — | ✅ 管理員（比照 `PendingDeductionItem`） | ✅ 管理員改 `settlements` |
| 送報帳／撤回 | ✅ 商品 | ❌ | ❌ |
| 扣款／付款方式 | — | ✅ 管理員 | 調帳不重跑自動扣款 |

**一句話**：**商品定品項與數量；帳務定價格與折扣**（待報帳與結帳後皆可調數字，但不動 SKU／庫存）。

### 6.2 作廢

| 狀態 | 行為 |
|------|------|
| 僅開單、未送報帳 | 可直接作廢／刪除 |
| 已送報帳、未結帳 | 先 `cancel_shop_order_billing` 釋放 reserve，再作廢 |
| 已有扣款 transactions | ⚠️ 確認框（比照 `CoachReport` 刪回報）→ 作廢訂單 → **交易保留**，人工調帳 |

已結帳後 **不可改品項**；金額調整走 §6.1 帳務端，不作廢整單除非特殊情況。

---

## 7. 訂購人與代扣

- **一位會員** 或 **手動姓名**（不做預約那種多人 `MemberSelector`）
- UI 可簡化版 picker：搜尋會員 + 非會員姓名輸入
- **代扣**：結帳時選 `charge_member_id`（預設 `order.member_id`）；非會員訂單只能用匯款／現金，或指定代扣會員

---

## 8. 交貨方式

| `delivery_method` | 用途 |
|-------------------|------|
| `pickup_es` | ES 面交 |
| `shipping` | 寄送，`shipping_info` 填地址／單號 |

不用複雜物流狀態機；長預購進度靠 `customer_note` + LIFF（後做）。

---

## 9. 權限

| 入口 | 能力 | 誰能進 |
|------|------|--------|
| 商品管理 › Tab **訂單** | 開單、改單（未結清前）、送報帳、等貨／可送報帳 | `can_products`（超級管理員當然可以） |
| **訂單報帳** | 待報帳 inbox、扣款、代扣 | **`isAdmin`  only**（不新增 DB 權限欄） |

- **不**新增 `can_settle_orders`：報帳一律由管理員處理，跟會員管理／會員儲值同一層。
- `can_products_view`：**不能**開單（唯讀庫存 Tab；訂單 Tab 隱藏或唯讀—實作時以隱藏為準）。

---

## 10. 實作位置（定案）

### 10.1 兩個入口、同一套 `shop_orders`

```
BAO › 營運管理 › 商品管理
  ├─ Tab「庫存」     ← 現有 ProductManagement
  └─ Tab「訂單」     ← 開單、等貨、可送報帳、全部訂單

BAO › 會員相關 › 訂單報帳     ← 新增 icon
  └─ 待報帳、扣款、代扣（含非會員匯款／現金）
```

| 路由 | 頁面標題 | 權限 |
|------|----------|------|
| `/products` | 商品管理 · 庫存（預設） | `can_products` 或 `can_products_view` |
| `/products/orders` | 商品管理 · **訂單** | `can_products` |
| `/order-settle` | **訂單報帳** | `isAdmin` |

**導覽修改**：

- `BaoHub.tsx` › 會員相關：新增 `{ title: '訂單報帳', icon: '🧾', link: '/order-settle' }`（與會員儲值並列）
- `ProductHub.tsx`（新）：包一層頂 Tab「庫存 \| 訂單」，內嵌既有 `ProductManagement` + `OrderManagement`
- **不**在首頁另加圖示；管理員從 BAO 進（BAO 本身已 `isAdmin`）

**為什麼訂單 Tab 在商品管理、報帳在會員相關？**

- 商品同事：SKU 與開單同一上下文
- 管理員報帳：跟 **會員儲值** 同區，管錢的習慣一致
- 跟「預約表 vs 回報管理（CoachAdmin）」同型，只是商品報帳放在會員區而非預約區

### 10.2 目錄結構

```
src/pages/admin/products/
  ProductHub.tsx           # 路由 /products/*，Tab：庫存 | 訂單
  ProductManagement.tsx    # 庫存（現有，略改）
  api.ts / schema.ts       # 沿用

src/pages/admin/orders/
  OrderManagement.tsx      # Tab「訂單」主頁（等貨 | 可送報帳 | 全部）
  OrderEditDialog.tsx      # 開單／編輯
  OrderDetailPanel.tsx     # 送報帳、作廢
  OrderSettlePage.tsx      # /order-settle · 訂單報帳
  PendingOrderSettleItem.tsx  # 對標 PendingDeductionItem
  OrderMemberPicker.tsx    # 單一會員 + 手動名
  api.ts
  types.ts
```

**共用**：

- 扣款 UI：`PendingDeductionItem.tsx`、`DEDUCTION_FLOW.md`
- 版型：`CoachAdmin.tsx`（待報帳列表）

**不修改**：

- `src/pages/shop/*` 公開型錄

### 10.3 資料庫

```
migrations/121_shop_orders.sql
  - shop_orders, shop_order_items, shop_order_settlements
  - product_variants.reserved_qty
  - transactions.shop_order_id + FK SET NULL
  - RPC: submit / settle / cancel_billing
  - （不新增 editor_users 欄位）
```

編號接在 `120_variant_cover_image.sql` 之後。

### 10.4 LIFF（Phase 3）

```
src/pages/liff/
  types.ts                 # + ShopOrder 型別
  components/OrdersList.tsx
  LiffMyBookings.tsx       # Tab「商品訂單」
```

- 查詢：`shop_orders.member_id = 綁定會員` 且未作廢
- 顯示：`customer_note`、品項、qty／已送報帳／已付、delivery 白話
- RLS：anon SELECT + 前端只查自己的 `member_id`（比照 transactions）

---

## 11. 開發階段

### Phase 1 — MVP（先上線店內流程）

- [x] migration 121（`migrations/121_shop_orders.sql`）
- [ ] `ProductHub` + `/products/orders` 開單、列表、等貨／可送報帳
- [ ] 送報帳 RPC + reserve
- [ ] `/order-settle` 訂單報帳 + 扣款（`isAdmin`；儲值／匯款／現金、代扣）
- [ ] `BaoHub` 會員相關新增「訂單報帳」入口
- [ ] 作廢 + 刪除警告（已有交易）

### Phase 2 — 營運加強

- [ ] 訂單號每日流水、`Statistics` 或獨立銷售報表（資料來源：`shop_order_settlements` + `transactions`）
- [ ] 匯出 CSV

### Phase 3 — 會員 LIFF

- [ ] Tab 商品訂單
- [ ] `customer_note` 編輯捷徑（商品同事）

### Phase 4 — 可選

- [ ] 訂單來源（LINE 詢問／現場）
- [ ] 型錄連結一鍵帶入品項

---

## 12. 已拍板決策

| # | 問題 | 決定 |
|---|------|------|
| 1 | 匯款／現金要不要留結帳紀錄？ | **要**：v1 建 `shop_order_settlements`（§3.1b）；不寫 `transactions` |
| 2 | 誰能撤回送報帳？ | **商品同事**（`can_products`），管理員未扣款前 |
| 3 | 何時能送報帳？ | **到貨、有現貨才行**；`qty_billable` 見 §3.2；預購未到貨 = 等貨 |
| 4 | 儲值不足是否擋？ | **不擋**（跟現有報帳一樣） |
| 5 | 一次送報帳可否只送部分 qty？ | **是** |
| 6 | 結帳是否整批結清該次 `qty_pending_bill`？ | v1 **是** |
| 7 | 訂單報帳誰能進？ | **`isAdmin`**，不開新權限 |
| 8 | 非會員 `contact_name` | **必填** |
| 9 | 報帳後帳務能否改價？ | **能**（管理員）；**商品**（SKU／qty）送報帳後鎖定；已扣儲值差額人工處理 |

---

## 13. 相關檔案索引

### 既有可複用

| 檔案 | 用途 |
|------|------|
| `migrations/106_create_inventory_tables.sql` | products / variants |
| `src/pages/admin/products/api.ts` | 商品搜尋 |
| `src/pages/admin/products/schema.ts` | 規格顯示 |
| `src/components/booking/MemberSelector.tsx` | 參考 UX（改為單人版） |
| `src/pages/coach/CoachAdmin.tsx` | 待報帳 inbox 版型 |
| `src/components/PendingDeductionItem.tsx` | 扣款互動 |
| `migrations/086_fix_transaction_amount_positive.sql` | `process_deduction_transaction` |
| `docs/DEDUCTION_FLOW.md` | 現金／匯款／儲值慣例 |
| `docs/SHOP_PLAN.md` | 公開型錄（刻意不做訂單） |

### 將新增

| 檔案 | 用途 |
|------|------|
| `migrations/121_shop_orders.sql` | 表 + RPC |
| `src/pages/admin/products/ProductHub.tsx` | 庫存／訂單 Tab |
| `src/pages/admin/orders/*` | 見 §10.2 |
| `docs/INTERNAL_ORDERS_PLAN.md` | 本文件 |

### 將修改

| 檔案 | 用途 |
|------|------|
| `src/App.tsx` | 路由 `/products/*`、`/order-settle` |
| `src/pages/BaoHub.tsx` | 會員相關 › 訂單報帳 |

---

## 14. 設計決策記錄

### 為什麼送報帳才 reserve

- 預購可能拖數月；開單即 reserve 會長期鎖死可售量
- 與「確定要收這批錢」同步，較貼近取貨才付款

### 為什麼不作廢自動退儲值

- 與預約刪回報、交易保留策略一致
- 避免 RPC 自動退款與人工調帳雙軌

### 為什麼訂單與 `/shop` 完全分路由

- 公開 bundle 不含後台；訂單僅 authenticated
- 避免 demo 購物車與正式內部單混淆

### 為什麼訂單報帳不另開權限旗標

- 報帳固定由管理員處理；BAO 與 `/order-settle` 用 `isAdmin` 即可
- 商品開單仍用既有 `can_products`，小編可開單、不可報帳

### 為什麼報帳入口放在 BAO「會員相關」

- 與會員儲值同區，語意是「收錢／扣儲值」
- 名稱用 **訂單報帳**（不用「會員訂單」），因含非會員匯款／現金

### 為什麼報帳後帳務仍可改數字

- 現場常事後折扣、抹零；與 `PendingDeductionItem` 可改扣款金額一致
- 商品送報帳後不再動 SKU／數量，避免庫存與實物對不上
- 儲值差額不自動沖帳，維持單一人工金流習慣

---

## 15. 流程圖（總覽）

```mermaid
flowchart TD
  A[開單] --> B{有現貨可報?}
  B -->|否| C[等貨]
  B -->|是| D[可送報帳]
  C -->|進貨| D
  D --> E[送報帳: reserve]
  E --> F[待報帳 inbox]
  F --> G{payment}
  G -->|balance| H[扣儲值 + transactions]
  G -->|cash/transfer| I[不寫 balance]
  H --> J[stock -= qty, reserved -= qty, qty_paid +=]
  I --> J
```

---

*文件版本：v1.3 — 2026-05-31：送報帳鎖商品；帳務端可調價／折扣（含結帳後），對齊 PendingDeductionItem。*
