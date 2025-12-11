# 金流驗證查詢

用於確認會員餘額與交易記錄是否一致。

## 1. 完整驗證查詢（儲值餘額 + 指定課）

```sql
-- 驗證所有會員的儲值餘額和指定課分鐘是否與交易記錄對得上
WITH transaction_summary AS (
  SELECT 
    member_id,
    -- 儲值餘額：考慮 adjust_type
    SUM(
      CASE 
        WHEN category = 'balance' AND adjust_type = 'decrease' THEN -ABS(amount)
        WHEN category = 'balance' AND adjust_type = 'increase' THEN ABS(amount)
        WHEN category = 'balance' THEN COALESCE(amount, 0)
        ELSE 0
      END
    ) as calculated_balance,
    -- 指定課分鐘：考慮 adjust_type
    SUM(
      CASE 
        WHEN category = 'designated_lesson' AND adjust_type = 'decrease' THEN -ABS(minutes)
        WHEN category = 'designated_lesson' AND adjust_type = 'increase' THEN ABS(minutes)
        WHEN category = 'designated_lesson' THEN COALESCE(minutes, 0)
        ELSE 0
      END
    ) as calculated_designated
  FROM transactions
  GROUP BY member_id
)
SELECT 
  m.id,
  m.name,
  m.nickname,
  m.balance as "目前餘額",
  COALESCE(ts.calculated_balance, 0) as "交易計算餘額",
  (m.balance - COALESCE(ts.calculated_balance, 0)) as "餘額差異",
  m.designated_lesson_minutes as "目前指定課",
  COALESCE(ts.calculated_designated, 0) as "交易計算指定課",
  (m.designated_lesson_minutes - COALESCE(ts.calculated_designated, 0)) as "指定課差異"
FROM members m
LEFT JOIN transaction_summary ts ON m.id = ts.member_id
WHERE m.balance != 0 
   OR m.designated_lesson_minutes != 0
   OR ts.calculated_balance IS NOT NULL
ORDER BY ABS(m.balance - COALESCE(ts.calculated_balance, 0)) DESC;
```

**說明：**
- 如果「餘額差異」和「指定課差異」都是 0，代表資料正確
- 有差異的會排在最上面

---

## 2. 只查有差異的會員

```sql
-- 只顯示有差異的會員（快速檢查用）
WITH transaction_summary AS (
  SELECT 
    member_id,
    SUM(
      CASE 
        WHEN category = 'balance' AND adjust_type = 'decrease' THEN -ABS(amount)
        WHEN category = 'balance' AND adjust_type = 'increase' THEN ABS(amount)
        WHEN category = 'balance' THEN COALESCE(amount, 0)
        ELSE 0
      END
    ) as calculated_balance,
    SUM(
      CASE 
        WHEN category = 'designated_lesson' AND adjust_type = 'decrease' THEN -ABS(minutes)
        WHEN category = 'designated_lesson' AND adjust_type = 'increase' THEN ABS(minutes)
        WHEN category = 'designated_lesson' THEN COALESCE(minutes, 0)
        ELSE 0
      END
    ) as calculated_designated
  FROM transactions
  GROUP BY member_id
)
SELECT 
  m.name,
  m.nickname,
  m.balance as "目前餘額",
  ts.calculated_balance as "交易計算餘額",
  (m.balance - COALESCE(ts.calculated_balance, 0)) as "餘額差異",
  m.designated_lesson_minutes as "目前指定課",
  ts.calculated_designated as "交易計算指定課",
  (m.designated_lesson_minutes - COALESCE(ts.calculated_designated, 0)) as "指定課差異"
FROM members m
LEFT JOIN transaction_summary ts ON m.id = ts.member_id
WHERE ABS(m.balance - COALESCE(ts.calculated_balance, 0)) > 0.01
   OR ABS(m.designated_lesson_minutes - COALESCE(ts.calculated_designated, 0)) > 0
ORDER BY ABS(m.balance - COALESCE(ts.calculated_balance, 0)) DESC;
```

**說明：**
- 結果是空的 = 全部對上 ✅
- 有資料 = 需要檢查 ⚠️

---

## 3. 查看特定會員的交易明細

```sql
-- 替換 MEMBER_ID 為實際的會員 UUID
SELECT 
  id,
  transaction_date,
  transaction_type,
  category,
  adjust_type,
  amount,
  minutes,
  description
FROM transactions
WHERE member_id = 'MEMBER_ID'
ORDER BY transaction_date DESC, id DESC;
```

---

## 4. 交易類型說明

| transaction_type | 說明 |
|------------------|------|
| charge | 儲值/加值 |
| consume | 消費/扣款 |
| adjust | 手動調整 |
| refund | 退款 |

| category | 說明 |
|----------|------|
| balance | 儲值餘額 |
| designated_lesson | 指定課分鐘 |
| vip_voucher | VIP票券 |
| boat_voucher_g23 | G23船票券 |
| boat_voucher_g21_panther | G21/黑豹船票券 |
| gift_boat_hours | 贈送大船時數 |

| adjust_type | 說明 |
|-------------|------|
| increase | 增加（正數）|
| decrease | 減少（負數）|

---

## 5. 快速統計

```sql
-- 統計交易記錄概況
SELECT 
  COUNT(*) as "總交易數",
  MIN(transaction_date) as "最早交易日期",
  MAX(transaction_date) as "最新交易日期",
  COUNT(DISTINCT member_id) as "有交易的會員數"
FROM transactions;
```

---

## 自動同步機制

資料庫有設定 **trigger** 會自動同步餘額：

| Trigger | 事件 | 說明 |
|---------|------|------|
| `trigger_transaction_insert` | INSERT | 新增交易後自動重算餘額 |
| `trigger_transaction_update` | UPDATE | 修改交易後自動重算餘額 |
| `trigger_transaction_delete` | DELETE | 刪除交易後自動重算餘額 |

詳見：`migrations/070_transaction_balance_sync_trigger.sql`

---

## 注意事項

1. **adjust_type 很重要**：`adjust` 類型的交易會用 `adjust_type` 決定正負
   - `increase` = 加
   - `decrease` = 減

2. **consume 類型**：通常 amount/minutes 已經是負數

3. **charge 類型**：通常 amount/minutes 是正數

4. **資料轉移記錄**：2025-12-05 有批次資料轉移，描述會標註「資料轉移」

