-- 查詢 12/6 的調整記錄是否還存在
-- 用來確認匯出總帳撈到的資料來源

-- 查看 12/6 所有調整類型的交易
SELECT 
  t.id,
  m.name as member_name,
  m.nickname,
  t.transaction_date,
  t.transaction_type,
  t.category,
  t.amount,
  t.minutes,
  t.description,
  t.notes,
  t.created_at
FROM transactions t
LEFT JOIN members m ON t.member_id = m.id
WHERE t.transaction_date = '2025-12-06'
  AND t.transaction_type = 'adjust'
ORDER BY t.created_at DESC;

-- 如果確認要刪除這些調整記錄，可以使用以下語句：
-- DELETE FROM transactions 
-- WHERE transaction_date = '2025-12-06'
--   AND transaction_type = 'adjust'
--   AND id IN (具體的 ID);



