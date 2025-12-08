-- 更新 2026 船券 (期初餘額 + 分條入帳紀錄)
-- 不分船 = G21/黑豹共通船券 (boat_voucher_g21_panther_minutes)
-- G23 = G23船券 (boat_voucher_g23_minutes)

-- ==================== INGRID ====================
-- 期初餘額: 1,200 (加到現有餘額)
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname ILIKE 'Ingrid';
-- 10/1 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/1入帳', '2025-10-01', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ingrid';
-- 11/26 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/26入帳', '2025-11-26', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ingrid';

-- ==================== 林敏 ====================
-- 期初餘額: 1,200 (加到現有餘額)
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname ILIKE 'Ming' OR name = '林敏';
-- 9/29 入帳 1,200 x3
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 9/29入帳(1)', '2025-09-29', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ming' OR name = '林敏';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 9/29入帳(2)', '2025-09-29', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ming' OR name = '林敏';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 9/29入帳(3)', '2025-09-29', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ming' OR name = '林敏';
-- 11/1 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/1入帳', '2025-11-01', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ming' OR name = '林敏';
-- 11/23 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/23入帳', '2025-11-23', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ming' OR name = '林敏';

-- ==================== 艾克 ====================
-- 期初餘額: 510
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 510 WHERE nickname = '艾克';
-- 10/1 入帳 600
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 600, 'increase', '2026 不分船船券 - 10/1入帳', '2025-10-01', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '艾克';

-- ==================== 小媺 ====================
-- 期初餘額: 300
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 300 WHERE nickname = '小媺';
-- 10/4 入帳 600
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 600, 'increase', '2026 不分船船券 - 10/4入帳', '2025-10-04', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '小媺';

-- ==================== JIMMY 李 (Jimmy L) ====================
-- 期初餘額: 1,120
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1120 WHERE nickname ILIKE 'Jimmy L';
-- 10/4 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/4入帳', '2025-10-04', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Jimmy L';

-- ==================== 翠蘋 ====================
-- 期初餘額: 775
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 775 WHERE nickname = '翠蘋';
-- 10/5 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/5入帳', '2025-10-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '翠蘋';

-- ==================== Alice妍 ====================
-- 期初餘額: 1,200
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname ILIKE 'Alice妍';
-- 10/6 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/6入帳', '2025-10-06', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Alice妍';

-- ==================== Safin ====================
-- 期初餘額: 1,200
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname ILIKE 'Safin';
-- 10/7 入帳 1,200 x2
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/7入帳(1)', '2025-10-07', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Safin';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/7入帳(2)', '2025-10-07', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Safin';

-- ==================== Kaiti ====================
-- 期初餘額: 720
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 720 WHERE nickname ILIKE 'Kaiti';
-- 10/7 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/7入帳', '2025-10-07', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Kaiti';

-- ==================== MS包 ====================
-- 期初餘額: 990
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 990 WHERE nickname ILIKE 'MS包';
-- 10/10 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/10入帳', '2025-10-10', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'MS包';

-- ==================== 可樂 (已有2025餘額220) ====================
-- 期初餘額: 1,200 (加到現有 220)
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname = '可樂';
-- 10/9 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/9入帳', '2025-10-09', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '可樂';

-- ==================== Jimmy煮麵 ====================
-- 期初餘額: 1,120
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1120 WHERE nickname ILIKE 'Jimmy煮麵';
-- 10/15 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/15入帳', '2025-10-15', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Jimmy煮麵';

-- ==================== 水晶 ====================
-- 期初餘額: 1,125
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1125 WHERE nickname = '水晶';
-- 10/17 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/17入帳', '2025-10-17', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '水晶';

-- ==================== Remy ====================
-- 期初餘額: 1,010
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1010 WHERE nickname ILIKE 'Remy';
-- 10/31 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 10/31入帳', '2025-10-31', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Remy';

-- ==================== Amos ====================
-- 期初餘額: 1,135
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1135 WHERE nickname ILIKE 'Amos';
-- 11/5 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/5入帳', '2025-11-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Amos';

-- ==================== Stan ====================
-- 期初餘額: 950
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 950 WHERE nickname ILIKE 'Stan';
-- 11/9 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/9入帳', '2025-11-09', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Stan';

-- ==================== Chiao ====================
-- 期初餘額: 570
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 570 WHERE nickname ILIKE 'Chiao';
-- 11/15 入帳 600
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 600, 'increase', '2026 不分船船券 - 11/15入帳', '2025-11-15', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Chiao';

-- ==================== 凱瑟琳 ====================
-- 期初餘額: 1,060
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1060 WHERE nickname = '凱瑟琳';
-- 11/15 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/15入帳', '2025-11-15', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '凱瑟琳';

-- ==================== 小貝 ====================
-- 期初餘額: 1,190
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1190 WHERE nickname = '小貝';
-- 11/18 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/18入帳', '2025-11-18', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '小貝';

-- ==================== Joanna ====================
-- 期初餘額: 1,020
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1020 WHERE nickname ILIKE 'Joanna';
-- 11/23 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/23入帳', '2025-11-23', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Joanna';

-- ==================== 小楊 ====================
-- 期初餘額: 1,180
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1180 WHERE nickname = '小楊';
-- 11/23 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 11/23入帳', '2025-11-23', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '小楊';

-- ==================== 可恩 (G23) ====================
-- 期初餘額: 140
UPDATE members SET boat_voucher_g23_minutes = boat_voucher_g23_minutes + 140 WHERE nickname = '可恩';
-- 9/1 入帳 600
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g23_minutes_after)
SELECT id, 'charge', 'boat_voucher_g23', 600, 'increase', '2026 G23船券 - 9/1入帳(舊票卷)', '2025-09-01', boat_voucher_g23_minutes
FROM members WHERE nickname = '可恩';

-- ==================== Teddy ====================
-- 不分船 期初餘額: 300
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 300 WHERE nickname ILIKE 'Teddy';
-- 12/1 入帳 600
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 600, 'increase', '2026 不分船船券 - 12/1入帳', '2025-12-01', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Teddy';
-- G23 期初餘額: 120
UPDATE members SET boat_voucher_g23_minutes = boat_voucher_g23_minutes + 120 WHERE nickname ILIKE 'Teddy';
-- 12/1 入帳 120
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g23_minutes_after)
SELECT id, 'charge', 'boat_voucher_g23', 120, 'increase', '2026 G23船券 - 12/1入帳', '2025-12-01', boat_voucher_g23_minutes
FROM members WHERE nickname ILIKE 'Teddy';

-- ==================== Ivan ====================
-- 期初餘額: 975
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 975 WHERE nickname ILIKE 'Ivan';
-- 12/1 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 12/1入帳', '2025-12-01', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ivan';

-- ==================== 大貓咪 ====================
-- 期初餘額: 1,200
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname = '大貓咪';
-- 12/1 入帳 1,200 (2期)
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 12/1入帳(2期)', '2025-12-01', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '大貓咪';

-- ==================== Thomas ====================
-- 期初餘額: 1,200
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname ILIKE 'Thomas' AND name LIKE '%劉%';
-- 12/3 入帳 1,200
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 12/3入帳', '2025-12-03', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Thomas' AND name LIKE '%劉%';

