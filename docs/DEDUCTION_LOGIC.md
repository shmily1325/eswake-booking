# 扣款邏輯與價格表

> 文檔版本：2025-11-24  
> 組件位置：`src/components/PendingDeductionItem.tsx`

---

## 📋 扣款類別

### 1. 💰 扣儲值 (balance)
- **說明**：扣除會員儲值金額
- **資料庫欄位**：`members.balance`
- **單位**：元（$）
- **交易記錄**：`transactions.amount` (負數), `transactions.balance_after`

### 2. 🚤 G23船券 (boat_voucher_g23)
- **說明**：扣除 G23 船隻使用券的時數
- **資料庫欄位**：`members.boat_voucher_g23_minutes`
- **單位**：分鐘
- **交易記錄**：`transactions.minutes` (負數), `transactions.boat_voucher_g23_minutes_after`

### 3. 🚤 G21/黑豹券 (boat_voucher_g21_panther)
- **說明**：扣除 G21/黑豹船隻使用券的時數
- **資料庫欄位**：`members.boat_voucher_g21_panther_minutes`
- **單位**：分鐘
- **交易記錄**：`transactions.minutes` (負數), `transactions.boat_voucher_g21_panther_minutes_after`

### 4. 🎓 指定課時數 (designated_lesson)
- **說明**：扣除指定教練課程的時數
- **資料庫欄位**：`members.designated_lesson_minutes`
- **單位**：分鐘
- **交易記錄**：`transactions.minutes` (負數), `transactions.designated_lesson_minutes_after`

### 5. 💎 VIP票券 (vip_voucher)
- **說明**：扣除 VIP 票券金額（不同於一般儲值）
- **資料庫欄位**：`members.vip_voucher_amount`
- **單位**：元（$）
- **交易記錄**：`transactions.amount` (負數), `transactions.vip_voucher_amount_after`

### 6. ⭐ 方案 (plan)
- **說明**：記錄方案使用（不扣除任何餘額，只記錄）
- **資料庫欄位**：無（不更新會員餘額）
- **單位**：無
- **交易記錄**：`transactions.amount = 0`, `transactions.minutes = 0`, `transactions.notes` 記錄方案名稱
- **特殊**：必須填寫方案名稱（如：9999暢滑方案）

### 7. 🎁 贈送時數 (gift_boat_hours)
- **說明**：扣除贈送的船隻使用時數
- **資料庫欄位**：`members.gift_boat_hours`
- **單位**：分鐘
- **交易記錄**：`transactions.minutes` (負數), `transactions.gift_boat_hours_after`

---

## 💰 扣儲值價格表

### G23
| 時間 | 金額 |
|------|------|
| 30分 | 5400 |
| 40分 | 7200 |
| 60分 | 10800 |
| 90分 | 16200 |
| 其他 | 自訂輸入 |

### G21/黑豹
| 時間 | 金額 |
|------|------|
| 20分 | 2000 |
| 30分 | 3000 |
| 40分 | 4000 |
| 60分 | 6000 |
| 90分 | 9000 |
| 其他 | 自訂輸入 |

### 粉紅/200
| 時間 | 金額 |
|------|------|
| 20分 | 1200 |
| 30分 | 1800 |
| 40分 | 2400 |
| 60分 | 3600 |
| 90分 | 5400 |
| 其他 | 自訂輸入 |

---

## 💎 VIP票券價格表

### G23
| 時間 | 金額 |
|------|------|
| 30分 | 4250 |
| 40分 | 5667 |
| 60分 | 8500 |
| 90分 | 12750 |
| 其他 | 自訂輸入 |

### G21/黑豹
| 時間 | 金額 |
|------|------|
| 20分 | 1667 |
| 30分 | 2500 |
| 40分 | 3333 |
| 60分 | 5000 |
| 90分 | 7500 |
| 其他 | 自訂輸入 |

### 粉紅/200
- 無預設金額，需自訂輸入

---

## 🤖 自動判斷邏輯

### 根據教練回報的付款方式自動判斷

#### 1. 現金 (cash) / 匯款 (transfer)
- **預設行為**：直接顯示「現金/匯款結清」介面
- **操作**：一鍵確認，標記為 `processed`，不扣款
- **記錄**：在 `notes` 欄位記錄 `[現金結清]` 或 `[匯款結清]`

#### 2. 票券 (voucher)
- **預設類別**：根據船隻自動判斷
  - G23 → `boat_voucher_g23`
  - G21/黑豹 → `boat_voucher_g21_panther`
- **預設時數**：教練回報的分鐘數
- **常用時數**：20, 30, 40, 60, 90 分鐘（可自訂）

#### 3. 扣儲值 (balance)
- **預設類別**：`balance`
- **預設金額**：根據船隻和時間自動顯示常用金額（見價格表）
- **船隻判斷邏輯**：
  ```javascript
  if (boatName.includes('G23')) → G23價格
  else if (boatName.includes('G21') || boatName.includes('黑豹')) → G21價格
  else if (boatName.includes('粉紅') || boatName.includes('200')) → 粉紅價格
  ```

---

## 📝 說明欄位自動生成

### 格式
```
{船隻名稱} {時數}分 {教練名稱}教課 ({參與者名稱})
```

### 範例
```
G21 60分 Anita教課 (林敏2號)
```

### 特殊處理：非會員關聯
如果 `notes` 欄位包含 `非會員：XXX`，會自動附加到參與者名稱：
```
G21 60分 Anita教課 (林敏2號 (非會員：小明))
```

### 資料來源
- **船隻名稱**：`report.bookings.boats.name`
- **時數**：`report.duration_min` （教練回報的實際時數）
- **教練名稱**：`report.coaches.name`
- **參與者名稱**：`report.participant_name`
- **非會員資訊**：從 `report.notes` 提取

---

## 🔄 扣款流程

### 1. 展開待處理項目
- 點擊待處理扣款項目
- 自動載入會員資料
- 根據教練回報自動判斷扣款類別

### 2. 檢查/修改扣款明細
- **類別選擇**：可手動切換扣款類別
- **金額/時數**：點選常用選項或自訂輸入
- **方案名稱**：方案類別必填（如：9999暢滑方案）
- **說明**：自動生成，不可編輯
- **註解**：選填，用於補充說明

### 3. 新增多筆扣款
- 點擊「新增項目」可為同一次預約新增多筆扣款
- 範例：扣船券 60分 + 指定課 60分

### 4. 確認扣款
- 檢查餘額變化
- 點擊「確認扣款」
- 系統執行：
  1. 更新會員餘額（方案除外）
  2. 記錄交易明細
  3. 標記 `booking_participants.status = 'processed'`

---

## ⚠️ 特殊規則

### 方案 (plan)
- **不扣除任何餘額**
- 只記錄交易（`amount = 0`, `minutes = 0`）
- **必須填寫方案名稱**（記錄在 `transactions.notes`）
- 用途：記錄預付型方案的使用情況（如：暢滑9999方案）

### 現金/匯款結清
- **不需要扣款操作**
- 直接標記為已處理
- 在 `notes` 欄位記錄結清方式

### 非會員關聯
- 非會員被關聯到會員後，原非會員名稱會保留在 `notes`
- 格式：`非會員：{原名}`
- 說明欄位會自動包含此資訊

### 餘額不足警告
- 扣款後餘額 < 0 時，顯示紅色警告
- 但不會阻止扣款操作（允許負餘額）

---

## 🗄️ 資料庫欄位對應

### Members 表
```sql
balance                          -- 儲值餘額（元）
boat_voucher_g23_minutes         -- G23船券時數（分）
boat_voucher_g21_panther_minutes -- G21/黑豹船券時數（分）
designated_lesson_minutes        -- 指定課時數（分）
gift_boat_hours                  -- 贈送時數（分）
vip_voucher_amount              -- VIP票券金額（元）
```

### Transactions 表
```sql
member_id                        -- 會員ID
booking_participant_id           -- 預約參與者ID
transaction_type                 -- 交易類型（consume）
category                         -- 扣款類別（見上方類別列表）
description                      -- 說明（自動生成）
notes                           -- 註解（手動輸入或方案名稱）
transaction_date                 -- 交易日期
operator_id                      -- 操作者ID
amount                          -- 金額變動（負數為扣款）
minutes                         -- 時數變動（負數為扣款）
balance_after                   -- 扣款後儲值餘額
boat_voucher_g23_minutes_after  -- 扣款後G23船券時數
boat_voucher_g21_panther_minutes_after -- 扣款後G21船券時數
designated_lesson_minutes_after -- 扣款後指定課時數
gift_boat_hours_after          -- 扣款後贈送時數
vip_voucher_amount_after       -- 扣款後VIP票券金額
```

### Booking_Participants 表
```sql
status                          -- 處理狀態
  - 'pending'      : 待處理（需扣款）
  - 'processed'    : 已處理（已扣款或結清）
  - 'not_applicable': 非會員記錄（不需扣款）
```

---

## 🔧 修改指南

### 修改價格
修改 `getCommonAmounts()` 或 `getVipVoucherAmounts()` 函數中的價格表。

### 新增扣款類別
1. 在 `DeductionCategory` 類型中新增
2. 在 `categories` 陣列中新增顯示標籤
3. 在 `getCategoryField()` 中新增欄位對應
4. 在 `calculateBalance()` 中新增餘額計算邏輯
5. 在 `handleConfirm()` 中新增扣款處理邏輯

### 修改自動判斷邏輯
修改 `getDefaultCategory()` 函數中的判斷條件。

### 修改說明格式
修改 `generateDescription()` 函數中的字串組合邏輯。

---

## 📞 聯絡資訊

如有問題或需要調整，請聯絡開發團隊。

**最後更新**：2025-11-24

