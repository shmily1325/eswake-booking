-- 更新金流資料 (以 2025/12/5 為基準)
-- 使用交易紀錄方式入帳

-- ==================== 先清除舊的期初餘額紀錄 ====================
DELETE FROM transactions WHERE description LIKE '%期初餘額%';

-- ==================== 儲值期初餘額 ====================
-- 幫所有有儲值的人補上交易紀錄（balance 值已經設定好了）

INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, balance_after)
SELECT id, 'charge', 'balance', balance, 
       CASE WHEN balance >= 0 THEN 'increase' ELSE 'decrease' END,
       '2025/12/5 資料轉移', 
       '2025-12-05', 
       balance
FROM members 
WHERE balance != 0;

-- ==================== 2025 VIP 票券 ====================

-- 何星 28,667
UPDATE members SET vip_voucher_amount = 28667 WHERE nickname ILIKE '何Sing' OR name LIKE '%何星%';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 28667, 'increase', '2025/12/5 資料轉移 - 2025VIP票券', '2025-12-05', 28667
FROM members WHERE nickname ILIKE '何Sing' OR name LIKE '%何星%';

-- 可恩 -13,838
UPDATE members SET vip_voucher_amount = -13838 WHERE nickname = '可恩';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', -13838, 'decrease', '2025/12/5 資料轉移 - 2025VIP票券', '2025-12-05', -13838
FROM members WHERE nickname = '可恩';

-- MARKUS 71,190
UPDATE members SET vip_voucher_amount = 71190 WHERE nickname ILIKE 'Markus';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 71190, 'increase', '2025/12/5 資料轉移 - 2025VIP票券', '2025-12-05', 71190
FROM members WHERE nickname ILIKE 'Markus';

-- Lisa L. 214,859
UPDATE members SET vip_voucher_amount = 214859 WHERE nickname ILIKE 'LISA L' OR nickname ILIKE 'Lisa L.';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 214859, 'increase', '2025/12/5 資料轉移 - 2025VIP票券', '2025-12-05', 214859
FROM members WHERE nickname ILIKE 'LISA L' OR nickname ILIKE 'Lisa L.';

-- SIMON 65,755
UPDATE members SET vip_voucher_amount = 65755 WHERE nickname ILIKE 'Simon';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 65755, 'increase', '2025/12/5 資料轉移 - 2025VIP票券', '2025-12-05', 65755
FROM members WHERE nickname ILIKE 'Simon';

-- RAY 128,136
UPDATE members SET vip_voucher_amount = 128136 WHERE nickname ILIKE 'Ray';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 128136, 'increase', '2025/12/5 資料轉移 - 2025VIP票券', '2025-12-05', 128136
FROM members WHERE nickname ILIKE 'Ray';

-- 大貓咪 46,607
UPDATE members SET vip_voucher_amount = 46607 WHERE nickname = '大貓咪';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 46607, 'increase', '2025/12/5 資料轉移 - 2025VIP票券', '2025-12-05', 46607
FROM members WHERE nickname = '大貓咪';

-- ==================== 2026 VIP 票券 ====================

-- Joye 262,868
UPDATE members SET vip_voucher_amount = 262868 WHERE nickname ILIKE 'Joye';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 262868, 'increase', '2025/12/5 資料轉移 - 2026VIP票券', '2025-12-05', 262868
FROM members WHERE nickname ILIKE 'Joye';

-- 綺綺 263,338
UPDATE members SET vip_voucher_amount = 263338 WHERE nickname ILIKE 'SH綺綺' OR nickname = '綺綺';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 263338, 'increase', '2025/12/5 資料轉移 - 2026VIP票券', '2025-12-05', 263338
FROM members WHERE nickname ILIKE 'SH綺綺' OR nickname = '綺綺';

-- Fish 265,336
UPDATE members SET vip_voucher_amount = 265336 WHERE nickname ILIKE 'Fish';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 265336, 'increase', '2025/12/5 資料轉移 - 2026VIP票券', '2025-12-05', 265336
FROM members WHERE nickname ILIKE 'Fish';

-- Penny 204,344
UPDATE members SET vip_voucher_amount = 204344 WHERE nickname ILIKE 'Penny';
INSERT INTO transactions (member_id, transaction_type, category, amount, adjust_type, description, transaction_date, vip_voucher_amount_after)
SELECT id, 'charge', 'vip_voucher', 204344, 'increase', '2025/12/5 資料轉移 - 2026VIP票券', '2025-12-05', 204344
FROM members WHERE nickname ILIKE 'Penny';

