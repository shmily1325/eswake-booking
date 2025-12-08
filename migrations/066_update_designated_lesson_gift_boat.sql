-- 更新指定課和贈送大船時數 (以 2025/12/5 為基準)
-- designated_lesson_minutes: 指定課（分鐘）
-- gift_boat_hours: 贈送大船（實際存的是分鐘）

-- Carl - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Carl';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Carl';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Carl';

-- Safin - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname ILIKE 'Safin';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname ILIKE 'Safin';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname ILIKE 'Safin';

-- Nick - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname ILIKE 'Nick';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname ILIKE 'Nick';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname ILIKE 'Nick';

-- Teddy - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Teddy';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Teddy';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Teddy';

-- Ivan - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Ivan';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Ivan';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Ivan';

-- 可樂 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '可樂';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '可樂';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '可樂';

-- Ray - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Ray';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Ray';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Ray';

-- 林昱 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '林昱';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '林昱';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '林昱';

-- 黑炭 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '黑炭';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '黑炭';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '黑炭';

-- Darren - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Darren';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Darren';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Darren';

-- 阿逢 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '阿逢';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '阿逢';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '阿逢';

-- Thomas - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE 'Thomas' AND name LIKE '%劉%';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Thomas' AND name LIKE '%劉%';

-- 水晶 - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname = '水晶';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '水晶';

-- Tony C - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Tony C';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Tony C';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Tony C';

-- Jocelyn - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname ILIKE 'Jocelyn';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname ILIKE 'Jocelyn';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname ILIKE 'Jocelyn';

-- Queenie - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname ILIKE 'Queenie';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname ILIKE 'Queenie';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname ILIKE 'Queenie';

-- Jimmy L - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Jimmy L';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Jimmy L';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Jimmy L';

-- 高宇 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '高宇';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '高宇';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '高宇';

-- Yen - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Yen';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Yen';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Yen';

-- 阿中 - 指定課: 15, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 15 WHERE nickname = '阿中';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname = '阿中';

-- Josh - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE 'Josh';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Josh';

-- Eric - 指定課: 10, 大船: 20
UPDATE members SET designated_lesson_minutes = 10, gift_boat_hours = 20 WHERE nickname ILIKE 'Eric';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 10, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 10 FROM members WHERE nickname ILIKE 'Eric';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname ILIKE 'Eric';

-- Simon - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Simon';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Simon';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Simon';

-- Ming - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE 'Ming' OR name = '林敏';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Ming' OR name = '林敏';

-- 凱瑟琳 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '凱瑟琳';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '凱瑟琳';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '凱瑟琳';

-- 大貓咪 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '大貓咪';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '大貓咪';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '大貓咪';

-- 何Sing - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE '何Sing';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE '何Sing';

-- Susan - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname ILIKE 'Susan';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname ILIKE 'Susan';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname ILIKE 'Susan';

-- LISA L - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname ILIKE 'LISA L';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname ILIKE 'LISA L';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname ILIKE 'LISA L';

-- Scott - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Scott';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Scott';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Scott';

-- Elaine - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Elaine';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Elaine';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Elaine';

-- JO - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'JO';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'JO';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'JO';

-- 可恩 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '可恩';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '可恩';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '可恩';

-- 翠蘋 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '翠蘋';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '翠蘋';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '翠蘋';

-- Edric - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Edric';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Edric';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Edric';

-- Remy - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Remy';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Remy';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Remy';

-- Jim - 指定課: 0, 大船: 40 (只有大船)
UPDATE members SET gift_boat_hours = 40 WHERE nickname ILIKE 'Jim';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Jim';

-- Edison - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE 'Edison';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Edison';

-- Stan - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Stan';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Stan';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Stan';

-- 瓜 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '瓜';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '瓜';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '瓜';

-- Morris - 指定課: 0, 大船: 10 (只有大船)
UPDATE members SET gift_boat_hours = 10 WHERE nickname ILIKE 'Morris';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 10, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 10 FROM members WHERE nickname ILIKE 'Morris';

-- R ONE - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'R ONE';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'R ONE';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'R ONE';

-- 連醫師 - 指定課: 0, 大船: 40 (只有大船)
UPDATE members SET gift_boat_hours = 40 WHERE nickname = '連醫師';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '連醫師';

-- Amelia - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE 'Amelia';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Amelia';

-- JAMES /AXEL - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE 'JAMES /AXEL' OR nickname ILIKE 'JAMES/AXEL';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'JAMES /AXEL' OR nickname ILIKE 'JAMES/AXEL';

-- Hugh - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Hugh';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Hugh';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Hugh';

-- Neo - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Neo';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Neo';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Neo';

-- Celine Yu - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Celine Yu';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Celine Yu';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Celine Yu';

-- Matthew - 指定課: 0, 大船: 10 (只有大船)
UPDATE members SET gift_boat_hours = 10 WHERE nickname ILIKE 'Matthew';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 10, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 10 FROM members WHERE nickname ILIKE 'Matthew';

-- Candy W - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE 'Candy W';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Candy W';

-- 小楊 - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname = '小楊';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname = '小楊';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname = '小楊';

-- 小貝 - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname = '小貝';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname = '小貝';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname = '小貝';

-- Maggie - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Maggie';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Maggie';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Maggie';

-- Sean - 指定課: 0, 大船: 40 (只有大船)
UPDATE members SET gift_boat_hours = 40 WHERE nickname ILIKE 'Sean';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Sean';

-- 黛咪 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '黛咪';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '黛咪';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '黛咪';

-- Kaiti - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname ILIKE 'Kaiti';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Kaiti';

-- Vivian 巧 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Vivian%巧%' OR name = '陳薇巧';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Vivian%巧%' OR name = '陳薇巧';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Vivian%巧%' OR name = '陳薇巧';

-- Alvin - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Alvin';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Alvin';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Alvin';

-- Winnie - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Winnie';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Winnie';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Winnie';

-- 阿平 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '阿平';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '阿平';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '阿平';

-- Leona - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Leona';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Leona';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Leona';

-- 旦旦 - 指定課: 30, 大船: 0 (只有指定課)
UPDATE members SET designated_lesson_minutes = 30 WHERE nickname = '旦旦';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '旦旦';

-- Amos - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Amos';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Amos';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Amos';

-- 艾克 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '艾克';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '艾克';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '艾克';

-- Joye - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Joye';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Joye';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Joye';

-- 泡泡 - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname = '泡泡';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname = '泡泡';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname = '泡泡';

-- 黃平 - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname = '黃平';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname = '黃平';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname = '黃平';

-- Kuanbon - 指定課: 15, 大船: 20
UPDATE members SET designated_lesson_minutes = 15, gift_boat_hours = 20 WHERE nickname ILIKE 'Kuanbon';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 15, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 15 FROM members WHERE nickname ILIKE 'Kuanbon';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 20, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 20 FROM members WHERE nickname ILIKE 'Kuanbon';

-- Hans - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Hans';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Hans';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Hans';

-- Sunny - 指定課: 30, 大船: 40
UPDATE members SET designated_lesson_minutes = 30, gift_boat_hours = 40 WHERE nickname ILIKE 'Sunny' AND name LIKE '%王%';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, designated_lesson_minutes_after)
SELECT id, 'charge', 'designated_lesson', 30, 'increase', '2025/12/5 資料轉移 - 指定課', '2025-12-05', 30 FROM members WHERE nickname ILIKE 'Sunny' AND name LIKE '%王%';
INSERT INTO transactions (member_id, transaction_type, category, minutes, adjust_type, description, transaction_date, gift_boat_hours_after)
SELECT id, 'charge', 'gift_boat_hours', 40, 'increase', '2025/12/5 資料轉移 - 贈送大船', '2025-12-05', 40 FROM members WHERE nickname ILIKE 'Sunny' AND name LIKE '%王%';

