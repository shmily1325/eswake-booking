# 資料健康檢查指南

定期執行這些 SQL 查詢，確保資料正確性。

---

## 📅 建議執行頻率

| 檢查項目 | 頻率 |
|---------|------|
| 參與者記錄檢查 | 每週 |
| 交易記錄檢查 | 每週 |
| 重複扣款檢查 | 每週 |
| 月度統計 | 每月 |

---

## 1️⃣ 參與者記錄檢查

### 1.1 各狀態分佈
```sql
-- 查看參與者記錄狀態分佈（調整日期範圍）
SELECT 
  bp.status,
  COUNT(*) as count,
  COUNT(bp.member_id) as member_count
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
WHERE b.start_at >= '2024-12-01'  -- 調整開始日期
  AND bp.is_deleted = false
GROUP BY bp.status
ORDER BY count DESC;
```

**預期結果：**
- `processed` - 已處理
- `pending` - 待處理（會員）
- `not_applicable` - 非會員

---

### 1.2 會員待處理超過 3 天（可能被遺忘）
```sql
SELECT 
  b.start_at::date as date,
  b.contact_name,
  bp.participant_name,
  m.name as member_name,
  bp.duration_min,
  bp.payment_method,
  c.name as coach_name
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
LEFT JOIN members m ON bp.member_id = m.id
LEFT JOIN coaches c ON bp.coach_id = c.id
WHERE bp.status = 'pending'
  AND bp.member_id IS NOT NULL
  AND bp.is_deleted = false
  AND b.start_at::date < CURRENT_DATE - INTERVAL '3 days'
ORDER BY b.start_at ASC;
```

**預期結果：** 空（沒有遺忘的待處理記錄）

---

### 1.3 已處理但無交易記錄（voucher/balance 應有交易）
```sql
SELECT 
  b.start_at::date as date,
  bp.participant_name,
  m.name as member_name,
  bp.duration_min,
  bp.payment_method,
  bp.status,
  c.name as coach_name,
  (
    SELECT COUNT(*) 
    FROM transactions t 
    WHERE t.booking_participant_id = bp.id
  ) as transaction_count
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
LEFT JOIN members m ON bp.member_id = m.id
LEFT JOIN coaches c ON bp.coach_id = c.id
WHERE b.start_at >= '2024-12-01'  -- 調整開始日期
  AND bp.status = 'processed'
  AND bp.member_id IS NOT NULL
  AND bp.payment_method IN ('voucher', 'balance')
  AND bp.is_deleted = false
  AND (SELECT COUNT(*) FROM transactions t WHERE t.booking_participant_id = bp.id) = 0
ORDER BY b.start_at DESC;
```

**預期結果：** 空（或只有刻意結清的記錄）

---

## 2️⃣ 交易記錄檢查

### 2.1 交易總覽
```sql
SELECT 
  transaction_type,
  category,
  COUNT(*) as count,
  SUM(CASE WHEN amount IS NOT NULL THEN ABS(amount) ELSE 0 END) as total_amount,
  SUM(CASE WHEN minutes IS NOT NULL THEN ABS(minutes) ELSE 0 END) as total_minutes
FROM transactions
GROUP BY transaction_type, category
ORDER BY transaction_type, count DESC;
```

---

### 2.2 檢查 created_at 是否有 NULL
```sql
SELECT COUNT(*) as null_created_at_count
FROM transactions
WHERE created_at IS NULL;
```

**預期結果：** `0`

---

### 2.3 檢查重複扣款（同會員同天同類別多筆）
```sql
SELECT 
  m.name as member_name,
  t.transaction_date,
  t.category,
  COUNT(*) as count,
  STRING_AGG(t.amount::text, ', ') as amounts,
  STRING_AGG(t.minutes::text, ', ') as minutes_list
FROM transactions t
JOIN members m ON t.member_id = m.id
WHERE t.transaction_type = 'consume'
GROUP BY m.name, t.member_id, t.transaction_date, t.category
HAVING COUNT(*) > 1
ORDER BY t.transaction_date DESC;
```

**預期結果：** 
- 如果有記錄，需人工確認是否為同一天多堂課（正常）或真正重複（異常）

---

### 2.4 檢查重複的詳細資料（有疑慮時使用）
```sql
-- 將 member_id 替換為要查詢的會員 ID
SELECT 
  t.transaction_date,
  t.category,
  t.amount,
  t.minutes,
  t.description,
  bp.participant_name,
  c.name as coach_name
FROM transactions t
LEFT JOIN booking_participants bp ON t.booking_participant_id = bp.id
LEFT JOIN coaches c ON bp.coach_id = c.id
WHERE t.member_id = '替換為會員ID'
  AND t.transaction_type = 'consume'
ORDER BY t.transaction_date DESC, t.id;
```

---

## 3️⃣ 月度統計

### 3.1 每月交易統計
```sql
SELECT 
  TO_CHAR(transaction_date::date, 'YYYY-MM') as month,
  transaction_type,
  COUNT(*) as count,
  SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as total_amount
FROM transactions
GROUP BY TO_CHAR(transaction_date::date, 'YYYY-MM'), transaction_type
ORDER BY month DESC, transaction_type;
```

---

### 3.2 每日回報統計
```sql
SELECT 
  b.start_at::date as date,
  COUNT(DISTINCT b.id) as bookings,
  COUNT(bp.id) as participants,
  COUNT(CASE WHEN bp.member_id IS NOT NULL THEN 1 END) as members,
  COUNT(CASE WHEN bp.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN bp.status = 'processed' THEN 1 END) as processed
FROM bookings b
LEFT JOIN booking_participants bp ON b.id = bp.booking_id AND bp.is_deleted = false
WHERE b.start_at >= '2024-12-01'  -- 調整開始日期
  AND b.start_at::date <= CURRENT_DATE
GROUP BY b.start_at::date
ORDER BY date DESC;
```

---

## 4️⃣ adjust 記錄審核

### 4.1 查看所有調整記錄
```sql
SELECT 
  t.transaction_date,
  m.name as member_name,
  t.category,
  t.amount,
  t.minutes,
  t.description,
  t.notes
FROM transactions t
JOIN members m ON t.member_id = m.id
WHERE t.transaction_type = 'adjust'
ORDER BY t.transaction_date DESC;
```

**說明：** 定期檢查確保調整記錄都有合理說明

---

## 🔧 問題修復指南

### 如果發現 created_at 為 NULL
```sql
-- 回填 NULL 的 created_at（用 transaction_date）
UPDATE transactions 
SET created_at = transaction_date || 'T12:00:00'
WHERE created_at IS NULL;
```

### 如果發現漏扣款
1. 在「回報管理」找到該筆記錄
2. 如果已結清，將 status 改回 pending：
```sql
UPDATE booking_participants
SET status = 'pending'
WHERE id = 替換為記錄ID;
```
3. 重新在系統中處理扣款

---

## 📝 檢查記錄

| 日期 | 執行人 | 結果 | 備註 |
|------|--------|------|------|
| 2024-12-16 | | ✅ 正常 | 首次檢查，修復 created_at |
| | | | |
| | | | |


