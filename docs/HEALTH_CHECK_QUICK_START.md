# 🚀 健康檢查快速開始

## 📝 背景

系統健康檢查可以幫助你：
- ✅ 發現潛在的資料問題
- ✅ 確保財務記錄準確
- ✅ 找出卡住的流程
- ✅ 在問題變嚴重前及早發現

**重點：這是「零風險」的檢查，只讀取資料，不會修改任何東西。**

---

## ⚡ 5 分鐘快速檢查

### 步驟 1：打開 Supabase SQL Editor

1. 登入 Supabase Dashboard
2. 選擇你的專案
3. 左側選單點擊 `SQL Editor`

### 步驟 2：執行關鍵檢查

複製貼上以下 SQL（這是最重要的 5 個檢查）：

```sql
-- ⚠️ 檢查 1: 會員餘額為負數（絕對不應該發生）
SELECT 
  id, 
  name,
  balance,
  COALESCE(vip_voucher_amount, 0) as vip_voucher_amount,
  COALESCE(boat_voucher_g23_minutes, 0) as boat_voucher_g23_minutes
FROM members
WHERE status = 'active'
  AND (
    balance < 0 
    OR COALESCE(vip_voucher_amount, 0) < 0
    OR COALESCE(boat_voucher_g23_minutes, 0) < 0
  );

-- ⚠️ 檢查 2: 餘額與交易記錄不一致
SELECT 
  m.id,
  m.name,
  m.balance as current_balance,
  t.balance_after as last_transaction_balance,
  m.balance - t.balance_after as difference
FROM members m
LEFT JOIN LATERAL (
  SELECT balance_after, created_at
  FROM transactions
  WHERE member_id = m.id
    AND category = 'balance'
    AND balance_after IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
) t ON true
WHERE m.status = 'active'
  AND t.balance_after IS NOT NULL
  AND ABS(m.balance - t.balance_after) > 0.01
ORDER BY ABS(m.balance - t.balance_after) DESC
LIMIT 10;

-- ⚠️ 檢查 3: 待處理扣款（超過 3 天）
SELECT 
  bp.id,
  bp.booking_id,
  bp.participant_name,
  bp.reported_at,
  (NOW()::date - bp.reported_at::date) as days_pending,
  b.start_at
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
WHERE bp.status = 'pending'
  AND bp.is_deleted = false
  AND bp.reported_at IS NOT NULL
  AND bp.reported_at < (NOW() - INTERVAL '3 days')::text
ORDER BY bp.reported_at;

-- ⚠️ 檢查 4: 已處理但沒有交易記錄（可能扣款遺漏）
SELECT 
  bp.id,
  bp.booking_id,
  bp.participant_name,
  bp.payment_method,
  bp.reported_at,
  b.start_at
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
WHERE bp.member_id IS NOT NULL
  AND bp.payment_method IN ('balance', 'voucher', 'vip')
  AND bp.status = 'processed'
  AND bp.is_deleted = false
  AND bp.reported_at > '2025-11-01'
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.booking_participant_id = bp.id
  )
ORDER BY bp.reported_at DESC
LIMIT 20;

-- ⚠️ 檢查 5: 今日船隻時間衝突
WITH boat_bookings AS (
  SELECT 
    b.boat_id,
    bt.name as boat_name,
    b.id as booking_id,
    b.start_at,
    b.start_at::timestamp + (b.duration_min || ' minutes')::interval as end_at,
    b.contact_name
  FROM bookings b
  JOIN boats bt ON b.boat_id = bt.id
  WHERE b.start_at::date = CURRENT_DATE
)
SELECT 
  bb1.boat_name,
  bb1.booking_id as booking_1,
  bb1.start_at as start_1,
  bb1.contact_name as contact_1,
  bb2.booking_id as booking_2,
  bb2.start_at as start_2,
  bb2.contact_name as contact_2
FROM boat_bookings bb1
JOIN boat_bookings bb2 
  ON bb1.boat_id = bb2.boat_id 
  AND bb1.booking_id < bb2.booking_id
WHERE bb1.start_at::timestamp < bb2.end_at 
  AND bb2.start_at::timestamp < bb1.end_at
ORDER BY bb1.boat_name, bb1.start_at;
```

### 步驟 3：解讀結果

#### ✅ 好消息：沒有結果
如果查詢返回 **0 rows**，表示該項目沒有問題！

#### ⚠️ 發現問題：有結果
如果查詢返回有資料，需要判斷：

**檢查 1 & 2（餘額問題）→ 嚴重！**
- 需要立即調查
- 記錄下來（會員ID、差異金額）
- 不要馬上修改，先了解原因

**檢查 3（待處理扣款）→ 中等**
- 可能是正常的（週末累積的）
- 可能是流程卡住了
- 建議手動處理

**檢查 4（扣款遺漏）→ 嚴重！**
- 可能造成財務損失
- 需要補扣款
- 需要了解為什麼沒扣到

**檢查 5（船隻衝突）→ 中等**
- 可能是正常的（前後銜接）
- 可能是誤操作（需要調整）

---

## 📋 完整檢查（每週執行）

如果你想做完整的健康檢查：

1. 打開 `docs/SQL_HEALTH_CHECKS.sql`
2. 複製整個文件
3. 貼到 Supabase SQL Editor
4. **一個一個執行**（不要一次全部執行）
5. 記錄結果到 `docs/HEALTH_CHECK_LOG.md`

---

## 🎯 檢查頻率建議

### 每天（如果有空）
- ✅ 檢查 5：今日船隻衝突
- ✅ 檢查 3：待處理扣款

### 每週一次 ⭐
- ✅ 檢查 1：會員餘額為負數
- ✅ 檢查 2：餘額與交易不一致
- ✅ 檢查 4：扣款遺漏

### 每月一次
- ✅ 完整執行所有檢查
- ✅ 記錄趨勢變化

---

## 💡 常見問題

### Q1: 我發現了問題，該怎麼辦？

**A:** 先不要急著修改！

1. **記錄下來**（截圖或複製結果）
2. **了解原因**（為什麼會這樣？）
3. **評估影響**（嚴重程度？）
4. **再決定**是否修改

### Q2: 檢查會影響系統運作嗎？

**A:** 不會！這些都是 `SELECT` 查詢，只讀取資料，不會修改任何東西。

### Q3: 執行這些檢查需要多久？

**A:** 
- 快速檢查（5個查詢）：約 30 秒
- 完整檢查（所有查詢）：約 3-5 分鐘

### Q4: 為什麼要定期檢查？

**A:** 
- 及早發現問題（還沒變嚴重）
- 了解系統健康趨勢
- 避免財務損失
- 確保資料一致性

### Q5: 我執行時出現錯誤怎麼辦？

**A:** 常見錯誤：

```
❌ "relation does not exist"
→ 表名稱錯誤，請確認使用最新版的 SQL 腳本（v2）

❌ "column does not exist"
→ 欄位名稱錯誤，可能你的資料庫結構不同

❌ "syntax error"
→ SQL 語法錯誤，請確認完整複製貼上
```

如果遇到錯誤，請記錄錯誤訊息，我們可以一起調查。

---

## 📊 結果範例

### ✅ 正常結果（0 rows）
```
Showing 0 rows
```
恭喜！這表示沒有問題。

### ⚠️ 發現問題
```
id    | name  | balance | difference
------|-------|---------|------------
abc   | Ming  | 5000.00 | 100.00
def   | John  | 3000.00 | -50.00
```
這表示 Ming 的餘額與交易記錄差了 100 元，需要調查。

---

## 🔧 下一步

完成第一次檢查後：

1. **記錄結果**到 `docs/HEALTH_CHECK_LOG.md`
2. **設定提醒**（每週一早上執行）
3. **觀察趨勢**（問題變多還是變少？）
4. **建立基準線**（知道「正常狀態」是什麼樣子）

---

## 📞 需要幫助？

如果你：
- 發現嚴重問題不知如何處理
- 執行時遇到錯誤
- 不確定結果是否正常
- 想要客製化檢查項目

請記錄下問題，我們可以一起解決！

---

**記住：健康檢查是「預防勝於治療」，定期執行可以避免大問題！** 🎯

