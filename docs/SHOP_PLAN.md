# 商品型錄頁規劃文件

> 線上商品展示頁規劃。**老大確認方向**：純型錄，不做訂單系統，按鈕導向官方 LINE 詢問。
>
> 📅 規劃日期：2026-05-26（原版）
> ♻️ 改版日期：2026-05-27（瘦身為純型錄版）
> 🚧 狀態：規劃完成，可動工

---

## 0. 改版說明（v2 vs v1）

| 項目 | v1（原規劃） | v2（現行）|
|------|------|------|
| 定位 | 商城 LIFF，含購物車/結帳 | 純商品型錄頁 |
| 訂單系統 | ✅ 做 `orders` / `order_items` | ❌ 不做，全砍 |
| 購物車 | ✅ 要 | ❌ 不要 |
| 結帳 | ✅ 要（餘額/匯款/現金）| ❌ 不要 |
| 庫存扣除 | ✅ confirmed 時扣 | ❌ 不動，現有後台手動管 |
| 訂單後台 | ✅ 做 | ❌ 不做 |
| LIFF | ✅ 獨立 LIFF App | ❌ 不需要（純 web 頁面）|
| 詢問購買 | （無）| ✅ 跳 LINE 官方帳號預填訊息 |

**砍掉的原因**：老大不想做訂單管理，沒人力處理金流/物流/出貨。Messaging API channel 也被舊的卡住，push 通知做不了。型錄頁 + LINE 詢問已能滿足「客人線上看商品、想買就 LINE 找店家」的核心需求。

---

## 1. 核心定位

### 1.1 系統位置

```
eswakeschool.com（Google Sites 官網）
├─ 首頁
├─ 最新消息
├─ 滑水船介紹
├─ 環境設備
├─ ES BOOKING       ← 連到既有 booking React app
└─ ES SHOP（新增）  ← 連到 booking app 的 /shop 路由
```

老大在 Google Sites 加一個導覽項，連到我們 React app 的 `/shop` 公開頁面（跟 `ES BOOKING` 同一個 host，不同 route）。

### 1.2 為什麼不用 LIFF

- 不需要拿 `userId`（沒有訂單、沒有會員綁定）
- 不需要強迫客人在 LINE app 裡看
- 公開 web 頁面在電腦/手機/Google 搜尋都能用
- 開發更簡單：不用 LIFF SDK、不用多一個 entry

### 1.3 為什麼用 LINE 詢問而不做下單

- 老大不想做訂單管理（沒人手處理）
- Messaging API channel 卡在舊綁定，push 通知短期內做不了
- LINE 預填訊息**完全不需要 API**，是 LINE 內建的 deep link 格式
- 客人點按鈕 → 跳官方 LINE → 訊息已填好 → 按送出 → 店家用既有 LINE 流程處理
- 跟現在客人 LINE 詢問的工作流一致，老大零學習成本

---

## 2. 不做的事（明確排除）

| 項目 | 原因 |
|------|------|
| ❌ 訂單系統 | 老大不要 |
| ❌ 購物車 | 沒下單就不需要 |
| ❌ 結帳 / 金流 | 老大不要 |
| ❌ 物流 / 出貨 | 老大不要 |
| ❌ Push message 通知 | Messaging API channel 卡住，且型錄頁沒需要 |
| ❌ LIFF | 不需要 userId，公開頁更通用 |
| ❌ 訪客註冊 | 純展示頁，不收任何客人資料 |
| ❌ 商品分類管理頁 | 沿用既有硬寫 schema（`src/pages/admin/products/schema.ts`） |

---

## 3. 功能規格

### 3.1 頁面結構

```
/shop（公開頁）
├─ 商品列表
│   ├─ 分類 Tab（救生衣 / 防寒衣 / WB 板 / WS 板 / ...）
│   ├─ 商品卡片（圖、品牌、型號、起始價、缺貨標籤）
│   └─ 點卡片 → 詳情頁
│
└─ 商品詳情 /shop/:productId
    ├─ 圖片
    ├─ 品牌 + 型號 + 說明
    ├─ 規格選擇（顏色 / 尺寸 / 厚度等，由 schema 決定）
    ├─ 顯示對應 variant 的價格、現貨狀態
    ├─ 數量選擇
    └─ 【📞 LINE 詢問購買】按鈕
        └─ 點下去 → LINE deep link，預填訊息
```

### 3.2 LINE 詢問購買按鈕

**deep link 格式**：

```
https://line.me/R/oaMessage/{官方帳號ID}/?{URL encode 過的訊息}
```

**預填訊息範例**：
```
我想詢問商品
品項：Hyperlite State 2.0
規格：顏色: 黑 / 尺寸: 140cm
數量：1
```

**行為**：
- 手機：喚起 LINE app，打開 `@eswake` 對話框，訊息預填於輸入框
- 電腦：跳到 LINE 桌面版 / web LINE，行為相同
- 客人按送出後，店家在既有官方 LINE 後台收到訊息

**待提供**：老大的官方 LINE 帳號 ID（@ 開頭那個，例如 `@eswake`）

### 3.3 顯示規則

| 元素 | 顯示邏輯 |
|------|---------|
| 商品 | `products.is_public = true` 才顯示 |
| 變體（規格） | `product_variants.is_active = true` 才顯示 |
| 價格 | 顯示 `variants.price`；同商品不同規格價格不同時，列表顯示最低價 |
| 庫存 | 不顯示確切數量，只顯示「有貨 / 缺貨」 |
| 缺貨變體 | 灰色 disabled，仍可選但「LINE 詢問」按鈕改為「詢問補貨」 |
| 無圖商品 | fallback 顯示分類 emoji（schema.icon） |

### 3.4 不做的 UI 細節（v1 之後再說）

- ❌ 搜尋框
- ❌ 排序（價格高低、新品）
- ❌ 篩選器（價格區間、品牌）
- ❌ 多商品比較
- ❌ 我的最愛 / 收藏
- ❌ 評論評分

---

## 4. 資料層設計

### 4.1 新增 / 修改 migration

| 編號 | 內容 |
|------|------|
| `114_add_products_is_public.sql` | `products.is_public BOOLEAN DEFAULT false` |
| （可選）`115_shop_public_read_policy.sql` | 讓 anon 角色能讀 `is_public=true` 的商品（如果現有 RLS 不允許）|

> 編號 113 已被 `113_editor_feature_can_products_view.sql` 用掉。

### 4.2 不動的東西

- `products`、`product_variants` 表結構**完全不動**（除了加 `is_public`）
- `members`、`editor_users` 不動
- 既有 RLS policy 不動
- 既有商品管理後台不動（只加一個 toggle 開關）

### 4.3 RLS 重點

- anon 角色需能 `SELECT` `products` where `is_public=true` 及對應 variants
- 寫入仍只限 authenticated + `can_products`

---

## 5. 後台改動

### 5.1 商品管理頁加開關

`src/pages/admin/products/ProductManagement.tsx`：
- 每張商品列加一個「公開」toggle（綁 `is_public`）
- 列表加篩選：「全部 / 已公開 / 未公開」
- 預設未公開（避免一鍵全上架走光）

### 5.2 不做後台訂單頁

整個 `src/pages/admin/orders/` 不存在。

---

## 6. 開發階段

### Stage 0：型錄 demo（半天 ~ 1 天）

**目標**：可點擊的型錄頁 demo，給老大確認 UX。

**做什麼**：
- 開分支 `feat/shop`，main 不動
- 新增路由 `/shop` 與 `/shop/:productId`
- 撈真實 `products` / `product_variants`（demo 階段先不卡 `is_public`，全部顯示）
- 商品列表（分類 tab）、詳情頁（規格選擇）、LINE 按鈕（先用假 OA ID）
- 部署 Vercel preview，把連結給老大看

**不做**：
- 不動 DB（不跑 migration）
- 不動既有 booking / 後台

### Stage 1：根據老大回饋調整（半天）
- 文案、UI、排版微調
- 確認官方 LINE 帳號 ID

### Stage 2：正式版（半天）
- 跑 migration 114（加 `is_public`）
- 後台商品管理加 toggle
- `/shop` 頁面改為只顯示 `is_public=true`
- 上 main、部署 production
- 老大去 Google Sites 加導覽項

### Stage 3（可選）：之後想再做的
- 搜尋 / 篩選 / 排序
- 商品說明（多行 markdown / 圖片輪播）
- SEO meta 與 Open Graph（分享卡片）
- Google Analytics 追點擊轉換

---

## 7. 權限矩陣

| 角色 | 看 /shop | 後台改商品 | 後台 toggle 公開 |
|------|---------|-----------|----------------|
| 路人（無登入）| ✅ | ❌ | ❌ |
| LINE 用戶 | ✅ | ❌ | ❌ |
| 商品管理員（`can_products`） | ✅ | ✅ | ✅ |
| 全權管理者 | ✅ | ✅ | ✅ |

> 沒有 `can_orders` 概念了，因為沒訂單。

---

## 8. 待後續決定的事

| 項目 | 說明 |
|------|------|
| 官方 LINE ID | 需老大提供，例如 `@eswake` |
| 哪些商品先公開 | 老大 / 商品管理員自行勾選 |
| 商品說明欄位 | 目前 `products` 沒有 description 欄位；要不要加（v1 先不加，看老大需求）|
| 商品圖片數量 | 目前一張，要不要支援多張 / 輪播（v1 先用單張）|
| 分類顯示名稱 | schema 已有中文 name，預設沿用 |
| 對外網域 | 要不要設一個好記的 subdomain，例如 `shop.eswakeschool.com`（v1 先用既有 booking 同網域）|

---

## 9. 相關檔案索引

### 既有可複用
- `migrations/106_create_inventory_tables.sql` — `products` / `product_variants` 表
- `migrations/107_create_product_images_storage.sql` — 商品圖片 Storage
- `migrations/111_inventory_rls_policies.sql` — RLS 慣例參考
- `src/pages/admin/products/schema.ts` — 規格欄位定義（型錄頁直接讀這個）
- `src/pages/admin/products/api.ts` — 商品/變體 CRUD helpers

### 將要新增
- `migrations/114_add_products_is_public.sql`
- `src/pages/shop/ShopList.tsx`（或類似結構）
- `src/pages/shop/ShopDetail.tsx`
- `src/lib/lineDeepLink.ts`（產生 LINE 預填訊息 URL）
- `src/App.tsx` 加 `/shop` 路由

### 將要修改
- `src/pages/admin/products/ProductManagement.tsx` — 加 `is_public` toggle

---

## 10. 設計決策記錄

### 為什麼放在 booking app 而不是另外開一個專案
- 共用 Supabase client、auth、商品 query 邏輯
- 共用部署 pipeline（Vercel）
- 老大只需要記一個 host

### 為什麼不用 iframe 嵌進 Google Sites
- iframe 高度動態變化不好處理（雙捲軸）
- Google Sites embed 有 sandbox 限制
- 手機體驗差
- SEO 完全沒有
- 改用「外連分頁」跟 `ES BOOKING` 一致

### 為什麼用 LINE deep link 而不做 webhook
- LINE deep link 是純前端 URL，零 API 依賴
- 不需要 Messaging API channel（目前卡住）
- 不需要伺服器接收 webhook
- 訊息流跟客人現有的 LINE 詢問完全一致，店家零學習成本

### 為什麼預設 is_public=false
- 避免老大跑 migration 後，商品一鍵全部上架走光
- 強迫商品管理員逐一確認後才公開
- 既有 booking 系統的習慣（`is_active` 預設 false 風險低）

### 為什麼不需要 LIFF
- 公開頁不用拿 `userId`
- 型錄要讓「沒 LINE 帳號的人」也能看（Google 搜尋進來）
- LIFF 開發成本（多一個 entry、SDK 載入、debug）對純展示頁不值得

---

## 11. 已完成里程碑（feat/shop 分支）

> 📅 完工 2026-05-27 ~ 2026-05-28，已合回 main 待 demo

- ✅ M1 路由與骨架
- ✅ M2 列表頁（分類 Tab + 卡片）
- ✅ M3 詳情頁（規格選擇、數量、加入購物車）
- ✅ M4 購物車頁
- ✅ M5 LINE deep link（單筆 + 統一詢問）
- ✅ Polish：圖片 fallback、搜尋、排序、詳情頁變體縮圖列、404 友善頁、code-split、OG meta tags、列表/詳情/購物車視覺統一（灰底浮卡）、LINE 訊息帶商品連結（budget-aware）

---

## 12. 下一階段 TODO（合回 main 後做）

### 必做（功能 / 上線前必補）

- [ ] **`is_public` 欄位 migration**
  - 新增 `products.is_public boolean default false`
  - migration 檔名建議 `116_add_products_is_public.sql`（avoid clashing with 114/115 security migrations）
  - 既有商品全部預設 `false`，避免上線當天一鍵全部對外
- [ ] **後台 ProductManagement 加「顯示在商城」勾選**
  - 編輯介面新增 `is_public` toggle
  - 列表頁顯示「商城公開中」標籤，方便老闆一眼掃過
- [ ] **商城 fetch 加 `is_public` 過濾**
  - `src/pages/shop/ShopList.tsx` 與 `ShopDetail.tsx` 撈商品時 `.eq('is_public', true)`
  - 詳情頁如果商品 `is_public=false`，導向 404 友善頁
- [ ] **Vercel 環境變數**
  - `VITE_SHOP_LINE_OA_ID` = 真實 OA ID（目前是 demo `@785eqymb`）
  - `VITE_SHOP_BASE_URL` = `https://shop.eswakeschool.com`（網域接通後再設，否則先別設讓 LINE 訊息不附連結）
- [ ] **`shop.eswakeschool.com` 子網域接通**
  - GoDaddy 加 CNAME 記錄 → `cname.vercel-dns.com`
  - Vercel Project Settings → Domains → 新增 `shop.eswakeschool.com`
  - 等 Vercel 顯示「Valid Configuration」
  - 接通後才設 `VITE_SHOP_BASE_URL`

### 待釐清（先決定方向）

- [ ] **「schema 兩層」** — 老闆提到要把 schema 改成兩層，待確認意思：
  - A. 分類兩層（巢狀分類）
  - B. Product → Color → Size 三層結構
  - C. 後台 / 商城 TypeScript schema 拆兩層
  - D. 權限兩層

### 可選（demo 時不一定需要、看老闆要不要）

- [ ] LINE 加好友邀請按鈕（放 ShopHeader 或 footer）
- [ ] Footer 補聯絡資訊、店址、營業時間
- [ ] Hero 區換真實照片背景（取代純文字標題）
- [ ] VariantPicker 改成屬性分組（顏色一列、尺寸一列）
- [ ] Footer 加使用條款 / 隱私政策連結
- [ ] 完整手機 LINE 喚起測試（不同 OS / LINE 版本）
- [ ] OG 升級為「每件商品獨立預覽」（C 方案：Vercel Edge Function 動態注入）
