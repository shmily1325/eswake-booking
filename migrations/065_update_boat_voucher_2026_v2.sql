-- 更新 2026 船券 (期初餘額，每人一筆交易紀錄)
-- 不分船 = G21/黑豹共通船券 (boat_voucher_g21_panther_minutes)
-- G23 = G23船券 (boat_voucher_g23_minutes)

-- ==================== INGRID ====================
-- 總餘額: 465 + 1200 = 1665
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1665 WHERE nickname ILIKE 'Ingrid';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1665, 'increase', '2025/12/5 資料轉移 - 2026不分船 (船券入帳日期: 2025/10/1, 2025/11/26)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ingrid';

-- ==================== 林敏 ====================
-- 總餘額: 0 + 575 + 1200 + 1200 + 1200 = 4175
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 4175 WHERE nickname ILIKE 'Ming' OR name = '林敏';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 4175, 'increase', '2026 不分船船券 - 期初餘額 (2025/9/29入帳x3, 2025/11/1入帳, 2025/11/23入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ming' OR name = '林敏';

-- ==================== 艾克 ====================
-- 總餘額: 510
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 510 WHERE nickname = '艾克';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 510, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/1入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '艾克';

-- ==================== 小媺 ====================
-- 總餘額: 300
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 300 WHERE nickname = '小媺';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 300, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/4入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '小媺';

-- ==================== JIMMY 李 (Jimmy L) ====================
-- 總餘額: 1120
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1120 WHERE nickname ILIKE 'Jimmy L';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1120, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/4入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Jimmy L';

-- ==================== 翠蘋 ====================
-- 總餘額: 775
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 775 WHERE nickname = '翠蘋';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 775, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/5入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '翠蘋';

-- ==================== Alice妍 ====================
-- 總餘額: 1200
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname ILIKE 'Alice妍';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/6入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Alice妍';

-- ==================== Safin ====================
-- 總餘額: 195 + 1200 = 1395
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1395 WHERE nickname ILIKE 'Safin';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1395, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/7入帳x2)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Safin';

-- ==================== Kaiti ====================
-- 總餘額: 720
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 720 WHERE nickname ILIKE 'Kaiti';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 720, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/7入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Kaiti';

-- ==================== MS包 ====================
-- 總餘額: 990
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 990 WHERE nickname ILIKE 'MS包';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 990, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/10入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'MS包';

-- ==================== 可樂 ====================
-- 總餘額: 1200 (已有2025餘額220，會加上去)
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname = '可樂';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/9入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '可樂';

-- ==================== Jimmy煮麵 ====================
-- 總餘額: 1120
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1120 WHERE nickname ILIKE 'Jimmy煮麵';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1120, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/15入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Jimmy煮麵';

-- ==================== 水晶 ====================
-- 總餘額: 1125
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1125 WHERE nickname = '水晶';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1125, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/17入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '水晶';

-- ==================== Remy ====================
-- 總餘額: 1010
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1010 WHERE nickname ILIKE 'Remy';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1010, 'increase', '2026 不分船船券 - 期初餘額 (2025/10/31入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Remy';

-- ==================== Amos ====================
-- 總餘額: 1135
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1135 WHERE nickname ILIKE 'Amos';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1135, 'increase', '2026 不分船船券 - 期初餘額 (2025/11/5入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Amos';

-- ==================== Stan ====================
-- 總餘額: 950
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 950 WHERE nickname ILIKE 'Stan';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 950, 'increase', '2026 不分船船券 - 期初餘額 (2025/11/9入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Stan';

-- ==================== Chiao ====================
-- 總餘額: 570
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 570 WHERE nickname ILIKE 'Chiao';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 570, 'increase', '2026 不分船船券 - 期初餘額 (2025/11/15入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Chiao';

-- ==================== 凱瑟琳 ====================
-- 總餘額: 1060
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1060 WHERE nickname = '凱瑟琳';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1060, 'increase', '2026 不分船船券 - 期初餘額 (2025/11/15入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '凱瑟琳';

-- ==================== 小貝 ====================
-- 總餘額: 1190
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1190 WHERE nickname = '小貝';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1190, 'increase', '2026 不分船船券 - 期初餘額 (2025/11/18入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '小貝';

-- ==================== Joanna ====================
-- 總餘額: 1020
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1020 WHERE nickname ILIKE 'Joanna';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1020, 'increase', '2026 不分船船券 - 期初餘額 (2025/11/23入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Joanna';

-- ==================== 小楊 ====================
-- 總餘額: 1180
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1180 WHERE nickname = '小楊';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1180, 'increase', '2026 不分船船券 - 期初餘額 (2025/11/23入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '小楊';

-- ==================== 可恩 (G23) ====================
-- 總餘額: 140
UPDATE members SET boat_voucher_g23_minutes = boat_voucher_g23_minutes + 140 WHERE nickname = '可恩';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g23_minutes_after)
SELECT id, 'charge', 'boat_voucher_g23', 140, 'increase', '2026 G23船券 - 期初餘額 (2025/9/1舊票卷)', '2025-12-05', boat_voucher_g23_minutes
FROM members WHERE nickname = '可恩';

-- ==================== Teddy (不分船) ====================
-- 總餘額: 300
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 300 WHERE nickname ILIKE 'Teddy';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 300, 'increase', '2026 不分船船券 - 期初餘額 (2025/12/1入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Teddy';

-- ==================== Teddy (G23) ====================
-- 總餘額: 120
UPDATE members SET boat_voucher_g23_minutes = boat_voucher_g23_minutes + 120 WHERE nickname ILIKE 'Teddy';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g23_minutes_after)
SELECT id, 'charge', 'boat_voucher_g23', 120, 'increase', '2026 G23船券 - 期初餘額 (2025/12/1入帳)', '2025-12-05', boat_voucher_g23_minutes
FROM members WHERE nickname ILIKE 'Teddy';

-- ==================== Ivan ====================
-- 總餘額: 975
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 975 WHERE nickname ILIKE 'Ivan';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 975, 'increase', '2026 不分船船券 - 期初餘額 (2025/12/1入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Ivan';

-- ==================== 大貓咪 ====================
-- 總餘額: 1200
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname = '大貓咪';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 期初餘額 (2025/12/1入帳2期)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname = '大貓咪';

-- ==================== Thomas ====================
-- 總餘額: 1200
UPDATE members SET boat_voucher_g21_panther_minutes = boat_voucher_g21_panther_minutes + 1200 WHERE nickname ILIKE 'Thomas' AND name LIKE '%劉%';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, boat_voucher_g21_panther_minutes_after)
SELECT id, 'charge', 'boat_voucher_g21_panther', 1200, 'increase', '2026 不分船船券 - 期初餘額 (2025/12/3入帳)', '2025-12-05', boat_voucher_g21_panther_minutes
FROM members WHERE nickname ILIKE 'Thomas' AND name LIKE '%劉%';

