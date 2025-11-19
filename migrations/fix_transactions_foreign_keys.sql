-- =============================================
-- 修正 transactions 表的外鍵約束
-- =============================================
-- 
-- 目的：確保刪除預約時，財務記錄不會被刪除
-- 
-- 原因：
-- 1. 財務記錄必須永久保存以便審計
-- 2. 即使預約被刪除，也應該能追蹤交易歷史
-- 
-- 修改：
-- - booking_participant_id: 無約束 → ON DELETE SET NULL
-- - related_booking_id: 無約束 → ON DELETE SET NULL
-- 
-- 執行步驟：
-- 1. 在 Supabase SQL Editor 執行此腳本
-- 2. 確認沒有錯誤
-- =============================================

-- 步驟 1: 刪除舊的外鍵約束
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_booking_participant_id_fkey;

ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_related_booking_id_fkey;

-- 步驟 2: 重新建立外鍵約束，加上 ON DELETE SET NULL
ALTER TABLE transactions
ADD CONSTRAINT transactions_booking_participant_id_fkey
FOREIGN KEY (booking_participant_id) 
REFERENCES booking_participants(id) 
ON DELETE SET NULL;

ALTER TABLE transactions
ADD CONSTRAINT transactions_related_booking_id_fkey
FOREIGN KEY (related_booking_id) 
REFERENCES bookings(id) 
ON DELETE SET NULL;

-- 步驟 3: 驗證約束已正確設定
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  confdeltype AS delete_action
FROM pg_constraint
WHERE conrelid = 'transactions'::regclass
  AND contype = 'f'
ORDER BY conname;

-- 預期結果：
-- delete_action 應該顯示：
-- 'a' = NO ACTION (member_id)
-- 'n' = SET NULL (booking_participant_id, related_booking_id)

COMMENT ON CONSTRAINT transactions_booking_participant_id_fkey ON transactions 
IS '刪除參與者記錄時，交易記錄保留但此欄位設為 NULL';

COMMENT ON CONSTRAINT transactions_related_booking_id_fkey ON transactions 
IS '刪除預約時，交易記錄保留但此欄位設為 NULL';

