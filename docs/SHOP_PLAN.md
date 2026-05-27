# 商城（LIFF Shop）規劃文件

> 線上選購系統規劃。基於老大三項要求發展而來：
> 1. 每大項商品要有規格
> 2. 商品系統開放給所有人線上選購
> 3. 系統權限分級：管理者可改、瀏覽者/購買者不可改
>
> 📅 規劃日期：2026-05-26
> 🚧 狀態：規劃完成，待開工 Stage 0 (Demo)

---

## 1. 核心定位

### 1.1 系統架構：兩個獨立 LIFF

```
🛒 商城 LIFF（新建，路徑 /shop）       👤 會員專區 LIFF（既有，路徑 /liff）
   訪客可逛、可下單                       必須綁定才能用
   ─────────                              ─────────
   商品列表                                📅 預約
   商品詳情                                💰 儲值
   購物車                                  👤 會員
   結帳                                    📦 我的訂單  ← 新增 tab
                                              （顯示在商城下的訂單）
                  │                              │
                  └──────────┬───────────────────┘
                             ▼
                共用同一個 LINE Login Channel
                共用同一個 Supabase DB
                會員只需綁定一次（在會員專區）
```

### 1.2 技術重點
- **同一個 LINE Login Channel** 下的所有 LIFF App 共用 `userId`
- 商城用獨立 LIFF ID，會員專區用既有 LIFF ID
- DB 不變動 `members` 表，**不需要重新綁定**
- 商城前端是獨立 entry（`public/shop.html`），不影響既有 LIFF

---

## 2. 不做的事（明確排除）

| 項目 | 原因 |
|------|------|
| ❌ 金流串接 | 老大不要 |
| ❌ 物流 / 出貨 | 老大不要 |
| ❌ Push message 通知 | 目前 LINE push 卡住，先不做（schema 預留欄位） |
| ❌ 商品分類管理頁 | 規格 schema 暫時硬寫在 code 裡（等老大給規格） |

---

## 3. 商城 v1 規格定稿

| # | 項目 | 決定 |
|---|------|------|
| 1 | 商品分類 | 不分；用付款方式分流 |
| 2 | 付款方式 | `balance`（餘額）/ `bank_transfer`（匯款）/ `cash`（現金） |
| 3 | 訂單狀態 | `pending` → `confirmed` → `paid` → `completed` / `cancelled` |
| 4 | 庫存扣除時機 | `confirmed` 時才扣 |
| 5 | 取消權限 | 只有店家可取消 |
| 6 | 通知 | 暫不做，schema 預留 `notify_status` / `notified_at` 欄位 |
| 7 | 購物車 | 要 |
| 8 | 商品上下架 | `products.is_public` 控制（預設 false，避免一鍵全上架） |
| 9 | 變體選擇 UI | 列表顯示商品 → 詳情頁選規格（顏色/尺寸） |
| 10 | 折扣 | 預留 `discount_amount` 欄位，邏輯之後做 |
| 11 | 訪客下單 | 可，填姓名+電話即可 |
| 12 | 取貨機制 | 不做結構化欄位，用 `customer_note` 備註 |
| 13 | 預約 vs 訂單 | LIFF 分兩個 tab |

---

## 4. 訂單流程

### 4.1 狀態機

```
   下單
    │
    ▼
 pending（剛下單，未扣庫存）
    │
    ├─ 店家確認 → confirmed（扣庫存，記錄 payment_method）
    │    │
    │    ├─ 餘額付款 → 立刻扣餘額 → paid → completed
    │    └─ 線下付款 → 等店家手動標記「已收款」→ paid → completed
    │
    └─ 店家拒絕 → cancelled（不扣庫存，填 cancelled_reason）
```

### 4.2 已知風險與處理

| 風險 | 處理 |
|------|------|
| 「下單不扣庫存」可能多人搶同一件 | UI 提示「需店家確認，確認前不保留庫存」 |
| 餘額不足下單 | 結帳前檢查、不足時擋下並引導去儲值 |
| 商品被刪/改名後歷史訂單看不懂 | **snapshot 設計**：訂單成立時複製品名/規格/單價 |

### 4.3 訪客 vs 會員

```
進商城 LIFF
   │
   ├─ liff.init() 拿 userId
   │
   ├─ 用 userId 查 members 表
   │
   ├─ ✅ 找到 → 會員身份
   │           付款可選餘額/匯款/現金
   │           訂單 member_id = 會員 ID
   │           會員專區「我的訂單」看得到
   │
   └─ ❌ 沒找到 → 訪客身份
                結帳填姓名+電話
                訂單 member_id = NULL，guest_name/phone 必填
                結帳後可引導綁定（之後再做「補綁」邏輯）
```

> 沒 LINE 帳號也能用瀏覽器逛、下單（走訪客流程）

---

## 5. 資料層設計

### 5.1 新增 migration

| 編號 | 內容 |
|------|------|
| `113_create_orders_tables.sql` | 建 `orders` + `order_items` |
| `114_orders_rls_policies.sql` | RLS：anon 不能讀訂單，authenticated CRUD |
| `115_add_can_orders_flag.sql` | `editor_users.can_orders BOOLEAN DEFAULT true` |
| `116_add_products_is_public.sql` | `products.is_public BOOLEAN DEFAULT false` |

### 5.2 `orders` 主要欄位

```sql
orders
├─ id                  UUID PK
├─ order_no            TEXT UNIQUE          -- 顯示用單號 ORD-20260526-001
├─ member_id           UUID nullable        -- FK → members
├─ guest_name          TEXT nullable        -- 訪客姓名
├─ guest_phone         TEXT nullable        -- 訪客電話
├─ status              TEXT                 -- pending|confirmed|paid|completed|cancelled
├─ payment_method      TEXT nullable        -- balance|bank_transfer|cash
├─ subtotal            INTEGER
├─ discount_amount     INTEGER DEFAULT 0    -- 預留
├─ total_amount        INTEGER
├─ customer_note       TEXT                 -- 客人備註（取貨需求等）
├─ admin_note          TEXT                 -- 店家內部備註
├─ paid_at / completed_at / cancelled_at
├─ cancelled_reason    TEXT
├─ confirmed_by        TEXT                 -- email
├─ notify_status       TEXT DEFAULT 'pending'  -- 預留 push
├─ notified_at         TIMESTAMP nullable      -- 預留 push
└─ created_at / updated_at

CHECK (member_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_phone IS NOT NULL))
```

### 5.3 `order_items` 主要欄位（snapshot 設計）

```sql
order_items
├─ id              UUID PK
├─ order_id        UUID FK → orders ON DELETE CASCADE
├─ variant_id      UUID FK → product_variants  -- 不 cascade，刪商品不影響歷史單
├─ snapshot_name   TEXT       -- 「品牌 + 型號」當下快照
├─ snapshot_attrs  JSONB      -- 規格快照（顏色/尺寸等）
├─ unit_price      INTEGER    -- 下單當下單價快照
├─ quantity        INTEGER CHECK (quantity > 0)
└─ subtotal        INTEGER    -- unit_price × quantity
```

> **snapshot 設計**：訂單成立後，商品被改名/改價/下架，**不影響歷史訂單顯示**。
> 業界標準做法，避免半年後對帳對不起來。

---

## 6. 開發階段

### Stage 0：商城 Demo（半天～一天） ⬅️ 接下來做這個

**目標**：快速產出可點擊的 demo 給老大看，蒐集回饋。

**做什麼**：
- 開分支 `feat/shop`，main 完全不動
- 新增 `public/shop.html` + `src/pages/liff-shop/*`
- 用真實 `products` / `product_variants` 資料顯示
- 商品列表 / 詳情 / 變體選擇 / 購物車（localStorage）/ 結帳（不送單）
- 結帳按下後跳「Demo 模式：訂單尚未實際送出」提示

**不做**：
- 不動 DB
- 不動既有 LIFF
- 不動後台

**部署**：推 `feat/shop` → Vercel 自動產生 preview URL → 不影響線上會員

### Stage 1：根據老大回饋調整（半天～一天）
- 改文案、調 UI、加分類顯示等
- 反覆迭代到老大滿意

### Stage 2：接後端（約 2~3 天）
- 跑 migration 113~116
- 建 `src/pages/admin/orders/` 訂單管理後台
- 商城結帳改為真的送單
- 會員專區 LIFF 加「我的訂單」tab

### Stage 3：細節打磨（半天）
- 庫存併發保護
- 空狀態 / loading / error 文案
- audit log 整合

---

## 7. 權限矩陣

| 角色 | 商城瀏覽 | 商城下單 | 後台訂單管理 | 商品管理 |
|------|---------|---------|-------------|---------|
| 訪客（無 LINE） | ✅ | ✅（填姓名+電話） | ❌ | ❌ |
| LINE 用戶（未綁會員） | ✅ | ✅（填姓名+電話） | ❌ | ❌ |
| 已綁會員 | ✅ | ✅（可選餘額付款） | ❌ | ❌ |
| 店員（有 `can_orders`） | ✅ | ✅ | ✅ | ❌ |
| 商品管理員（`can_products`） | ✅ | ✅ | ❌ | ✅ |
| 全權管理者 | ✅ | ✅ | ✅ | ✅ |

> `can_orders` 是新加的 flag，預設 true（與既有權限慣例一致）

---

## 8. 待後續決定的事

| 項目 | 說明 |
|------|------|
| 規格 schema 動態化 | 等老大給每個大項的商品規格清單，先用硬寫的方式做 |
| 訪客單「補綁」邏輯 | 訪客之後綁定會員時，是否把舊訂單 `member_id` 補上 |
| 折扣 / 會員價 | 欄位預留，邏輯之後設計 |
| Push 通知 | 等 LINE push 通道修好再做 |
| 商品分類前端標題 | 老大可能想要中文分類名（不用 lifejacket 而用「救生衣」） |

---

## 9. 相關檔案索引

### 既有可複用
- `migrations/106_create_inventory_tables.sql` — `products` / `product_variants` 表
- `migrations/107_create_product_images_storage.sql` — 商品圖片 Storage
- `migrations/111_inventory_rls_policies.sql` — RLS 慣例參考
- `src/pages/admin/products/schema.ts` — 規格欄位定義（硬寫）
- `src/pages/admin/products/api.ts` — 商品/變體 CRUD helpers
- `src/pages/liff/` — 會員專區 LIFF 結構（可參考 styling）

### 將要新增
- `migrations/113~116_*.sql`
- `public/shop.html`
- `src/pages/liff-shop/*`
- `src/pages/admin/orders/*`
- `vite.config.ts` — 加 shop.html 為 multi-page entry（唯一改動的既有檔案）

---

## 10. 討論紀錄重點

### 為什麼分兩個 LIFF 而不是合併
- 商城受眾比會員專區廣（含訪客）
- 商城有自己的演化方向（活動、優惠碼等）
- 入口可分流（不同 Rich Menu / 連結）
- 工程成本只多 1~2 小時

### 為什麼選 demo 先行
- 老大不是程式人員，看 SQL 沒感覺
- 真實商品 + 可點擊體驗最能引出有效回饋
- 0 風險（不動 DB、不動既有功能）
- demo 被推翻只賠半天工

### 為什麼用分支不用 feature flag
- main 是線上版，會員每天在用
- 分支隔離 = 商城出包不影響 main
- Vercel preview URL 自動產生，不需配置
- 反悔成本低（刪分支即可）

### 為什麼用 snapshot 設計訂單
- 商品被改名/改價/下架時，歷史訂單仍正確
- 業界標準（蝦皮、momo 等都這樣做）
- 對帳、報稅、客訴的法律基礎
