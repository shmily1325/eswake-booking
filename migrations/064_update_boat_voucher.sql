-- 更新 2025 船券 (以 2025/12/5 為基準)
-- 不分船 = G21/黑豹共通船券 (boat_voucher_g21_panther_minutes)
-- G23 = G23船券 (boat_voucher_g23_minutes)

-- ==================== G21/黑豹共通船券 (不分船) ====================

-- IVY 150分
UPDATE members SET boat_voucher_g21_panther_minutes = 150 WHERE nickname ILIKE 'Ivy';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 150, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 150
FROM members WHERE nickname ILIKE 'Ivy';

-- YEN 115分
UPDATE members SET boat_voucher_g21_panther_minutes = 115 WHERE nickname ILIKE 'Yen';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 115, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 115
FROM members WHERE nickname ILIKE 'Yen';

-- 光佑 85分
UPDATE members SET boat_voucher_g21_panther_minutes = 85 WHERE nickname = '光佑';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 85, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 85
FROM members WHERE nickname = '光佑';

-- CARL 40分
UPDATE members SET boat_voucher_g21_panther_minutes = 40 WHERE nickname ILIKE 'Carl';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 40, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 40
FROM members WHERE nickname ILIKE 'Carl';

-- 林昱 150分
UPDATE members SET boat_voucher_g21_panther_minutes = 150 WHERE nickname = '林昱';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 150, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 150
FROM members WHERE nickname = '林昱';

-- 張婷 25分
UPDATE members SET boat_voucher_g21_panther_minutes = 25 WHERE nickname ILIKE 'Tin' OR name = '張婷';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 25, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 25
FROM members WHERE nickname ILIKE 'Tin' OR name = '張婷';

-- 高宇 -70分 (負數)
UPDATE members SET boat_voucher_g21_panther_minutes = -70 WHERE nickname = '高宇' OR name LIKE '%高宇%';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', -70, 'decrease', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', -70
FROM members WHERE nickname = '高宇' OR name LIKE '%高宇%';

-- MIKE 210分 (Mike C)
UPDATE members SET boat_voucher_g21_panther_minutes = 210 WHERE nickname ILIKE 'Mike C';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 210, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 210
FROM members WHERE nickname ILIKE 'Mike C';

-- 可樂 220分
UPDATE members SET boat_voucher_g21_panther_minutes = 220 WHERE nickname = '可樂';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 220, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 220
FROM members WHERE nickname = '可樂';

-- 連醫生 410分 (資料庫是連醫師)
UPDATE members SET boat_voucher_g21_panther_minutes = 410 WHERE nickname = '連醫師' OR name LIKE '%連%';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 410, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 410
FROM members WHERE nickname = '連醫師' OR name LIKE '%連%';

-- Maggie 420分
UPDATE members SET boat_voucher_g21_panther_minutes = 420 WHERE nickname ILIKE 'Maggie';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 420, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 420
FROM members WHERE nickname ILIKE 'Maggie';

-- Elaine 260分
UPDATE members SET boat_voucher_g21_panther_minutes = 260 WHERE nickname ILIKE 'Elaine';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 260, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 260
FROM members WHERE nickname ILIKE 'Elaine';

-- JOSH 10分
UPDATE members SET boat_voucher_g21_panther_minutes = 10 WHERE nickname ILIKE 'Josh';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 10, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 10
FROM members WHERE nickname ILIKE 'Josh';

-- JIMMY 王 340分
UPDATE members SET boat_voucher_g21_panther_minutes = 340 WHERE nickname ILIKE 'Jimmy W';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 340, 'increase', '2025/12/5 資料轉移 - 2025不分船', '2025-12-05', 340
FROM members WHERE nickname ILIKE 'Jimmy W';

-- ==================== G23船券 ====================

-- TONY鄭 60分
UPDATE members SET boat_voucher_g23_minutes = 60 WHERE nickname ILIKE 'Tony C';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g23_minutes_after)
SELECT id, 'charge', 'boat_voucher_g23', 60, 'increase', '2025/12/5 資料轉移 - 2025G23', '2025-12-05', 60
FROM members WHERE nickname ILIKE 'Tony C';

