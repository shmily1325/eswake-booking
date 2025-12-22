# `*_after` 欄位說明

> 最後更新：2025-12-22

## 背景

`transactions` 表中有以下 `*_after` 欄位，用來記錄「交易後的餘額/時數」：

- `balance_after`
- `vip_voucher_amount_after`
- `designated_lesson_minutes_after`
- `boat_voucher_g23_minutes_after`
- `boat_voucher_g21_panther_minutes_after`
- `gift_boat_hours_after`

## 問題

這些欄位的值**可能不正確**，原因包括：

1. **編輯交易時**：當修改過去的交易金額，只會更新該筆交易的 `*_after`，但**不會更新後續交易**的 `*_after`
2. **並發交易**：兩筆交易幾乎同時發生時，可能會有 race condition
3. **資料遷移**：歷史資料轉移時可能產生的不一致

## 決策（2025-12-22）

### ✅ 採用方案：保留但不使用

| 項目 | 說明 |
|------|------|
| **資料庫欄位** | 保留，不刪除 |
| **寫入** | 繼續寫入（維持現有邏輯） |
| **讀取** | **不再讀取**用於顯示或計算 |

### 原因

1. **安全性**：`process_deduction_transaction` stored procedure 會寫入這些欄位，若刪除欄位會導致扣款功能失敗
2. **風險低**：繼續寫入不會造成任何問題
3. **乾淨的替代方案**：改用動態計算（從交易記錄加總）

## 受影響的功能

### 已修改（不再讀取 `*_after`）

| 功能 | 檔案 | 修改內容 |
|------|------|---------|
| CSV 匯出（總帳） | `BackupPage.tsx` | 移除「交易後餘額」欄位 |
| CSV 匯出（總帳） | `MemberTransaction.tsx` | 移除「交易後餘額」欄位 |
| 月報表期初/期末計算 | `TransactionDialog.tsx` | 改用動態計算 |

### 未修改（繼續寫入 `*_after`）

| 功能 | 檔案/位置 | 說明 |
|------|---------|------|
| 新增交易 | `TransactionDialog.tsx` | 繼續寫入 |
| 編輯交易 | `TransactionDialog.tsx` | 繼續寫入 |
| 扣款處理 | `process_deduction_transaction` (DB) | 繼續寫入 |

## 正確的餘額來源

會員的**真實餘額**儲存在 `members` 表：

- `members.balance` - 儲值餘額
- `members.vip_voucher_amount` - VIP 票券
- `members.designated_lesson_minutes` - 指定課時數
- `members.boat_voucher_g23_minutes` - G23 船券
- `members.boat_voucher_g21_panther_minutes` - G21/黑豹船券
- `members.gift_boat_hours` - 贈送時數

這些值在每次交易時都會**直接更新**，因此永遠是正確的。

## 未來考量

如果需要完全移除 `*_after` 欄位，需要：

1. 修改 `process_deduction_transaction` stored procedure
2. 修改 `TransactionDialog.tsx` 的寫入邏輯
3. 執行資料庫 migration 刪除欄位
4. 重新產生 `supabase.ts` 型態定義

但目前**不建議**這樣做，因為風險大於收益。

