-- 重置並更新儲值金額 (以 2024/12/5 為基準)
-- 執行前請確認！這會清空所有交易紀錄並覆蓋所有餘額

-- 1. 清空交易紀錄
DELETE FROM transactions;

-- 2. 先把所有人的金流欄位歸零
UPDATE members SET 
  balance = 0,
  vip_voucher_amount = 0,
  designated_lesson_minutes = 0,
  boat_voucher_g23_minutes = 0,
  boat_voucher_g21_panther_minutes = 0,
  gift_boat_hours = 0;

-- 3. 更新儲值金額（用 nickname 或 name 匹配）

-- 直接匹配的（nickname 完全符合）
UPDATE members SET balance = 1650 WHERE nickname ILIKE 'Vincent';
UPDATE members SET balance = 6250 WHERE nickname = '小奧';
UPDATE members SET balance = 20560 WHERE nickname ILIKE 'James' AND nickname NOT ILIKE '%小%';
UPDATE members SET balance = 780 WHERE nickname = '江月';
UPDATE members SET balance = -2450 WHERE nickname ILIKE 'Alan W';
UPDATE members SET balance = 3132 WHERE name = '林昱';
UPDATE members SET balance = 3160 WHERE nickname = '小James';
UPDATE members SET balance = 250 WHERE nickname ILIKE 'Andrea';
UPDATE members SET balance = 10550 WHERE nickname = '正男';
UPDATE members SET balance = 57160 WHERE nickname ILIKE 'Chiao' OR name LIKE '%巧%';
UPDATE members SET balance = 7500 WHERE nickname ILIKE 'Pieere' OR nickname ILIKE 'Pierre';
UPDATE members SET balance = 4350 WHERE nickname = '已升';
UPDATE members SET balance = 1450 WHERE nickname ILIKE 'Lucas';
UPDATE members SET balance = 1675 WHERE nickname ILIKE 'Ingrid';
UPDATE members SET balance = 5100 WHERE nickname ILIKE 'Joanna';
UPDATE members SET balance = 200 WHERE nickname = '小楊';
UPDATE members SET balance = 17600 WHERE nickname ILIKE 'Ellen Kao';
UPDATE members SET balance = 3176 WHERE nickname = '考特 scott';
UPDATE members SET balance = 2360 WHERE nickname ILIKE 'Gordon old';
UPDATE members SET balance = 3310 WHERE nickname ILIKE 'Timmy';
UPDATE members SET balance = 21560 WHERE nickname = '丹尼爾 洪';
UPDATE members SET balance = 8400 WHERE nickname ILIKE 'Jimmy L';
UPDATE members SET balance = 68550 WHERE nickname = '阿逢';
UPDATE members SET balance = 7242 WHERE nickname ILIKE 'Jocelyn';
UPDATE members SET balance = 12850 WHERE nickname = '阿宏';
UPDATE members SET balance = 292 WHERE nickname ILIKE 'Yen';
UPDATE members SET balance = 50 WHERE nickname = '阿中';
UPDATE members SET balance = -8838 WHERE nickname ILIKE 'Ray';
UPDATE members SET balance = -276 WHERE nickname ILIKE 'Safin';
UPDATE members SET balance = 3959 WHERE nickname ILIKE 'Jillian';
UPDATE members SET balance = 7525 WHERE nickname ILIKE 'YYK';
UPDATE members SET balance = -4270 WHERE nickname ILIKE 'Tony W' OR nickname ILIKE 'Tony王';
UPDATE members SET balance = 600 WHERE nickname = '368';
UPDATE members SET balance = 2570 WHERE nickname = '愛德恩';
UPDATE members SET balance = 7967 WHERE nickname ILIKE 'Jack';
UPDATE members SET balance = 8200 WHERE nickname = 'thomas方';
UPDATE members SET balance = 7007 WHERE nickname ILIKE 'Thomas' AND name LIKE '%劉%';
UPDATE members SET balance = 400 WHERE nickname ILIKE 'ting H';
UPDATE members SET balance = 6444 WHERE nickname ILIKE 'Ming' OR name = '林敏';
UPDATE members SET balance = -3841 WHERE nickname ILIKE 'Tin';
UPDATE members SET balance = 26000 WHERE nickname ILIKE 'Susan';
UPDATE members SET balance = 513 WHERE nickname ILIKE 'Simon';
UPDATE members SET balance = 4281 WHERE nickname ILIKE '何Sing' OR name LIKE '%何星%';
UPDATE members SET balance = 9705 WHERE nickname = '大貓咪';
UPDATE members SET balance = 4000 WHERE nickname ILIKE 'Penny';
UPDATE members SET balance = 3600 WHERE nickname = 'RUBY陳';
UPDATE members SET balance = -4538 WHERE nickname ILIKE 'Murphy';
UPDATE members SET balance = 17000 WHERE name = '楊希傑';
UPDATE members SET balance = -25541 WHERE nickname = '黑炭';
UPDATE members SET balance = 35974 WHERE nickname ILIKE 'Sunny' AND name LIKE '%王%';
UPDATE members SET balance = 6200 WHERE nickname = '瓜';
UPDATE members SET balance = -10695 WHERE nickname ILIKE 'Queenie';
UPDATE members SET balance = 4200 WHERE nickname ILIKE 'Ivan';
UPDATE members SET balance = 250 WHERE nickname ILIKE 'Jennifer';
UPDATE members SET balance = 4618 WHERE nickname = '凱瑟琳';
UPDATE members SET balance = 20600 WHERE nickname = '旦旦';
UPDATE members SET balance = 7400 WHERE nickname ILIKE 'Cherry';
UPDATE members SET balance = 5450 WHERE nickname ILIKE 'Celine Yu';
UPDATE members SET balance = 34000 WHERE nickname ILIKE 'Tom';
UPDATE members SET balance = 96625 WHERE nickname ILIKE 'Candy W';
UPDATE members SET balance = -1210 WHERE nickname ILIKE 'LISA L' OR nickname ILIKE 'LISA';
UPDATE members SET balance = -2700 WHERE nickname ILIKE 'JOE LIN' OR nickname ILIKE 'R ONE';
UPDATE members SET balance = 5000 WHERE nickname ILIKE 'GLORYA';
UPDATE members SET balance = 9110 WHERE nickname ILIKE 'Amelia';
UPDATE members SET balance = 8750 WHERE nickname = '連醫師';
UPDATE members SET balance = 700 WHERE nickname = '卡稱' OR name LIKE '%葉其琛%';
UPDATE members SET balance = 4200 WHERE nickname = '小新';
UPDATE members SET balance = 8975 WHERE nickname ILIKE 'Avan';
UPDATE members SET balance = 12050 WHERE nickname = '妍' OR nickname ILIKE 'Alice妍';
UPDATE members SET balance = 500 WHERE nickname ILIKE 'SH綺綺' OR nickname = '綺綺';
UPDATE members SET balance = 224147 WHERE nickname ILIKE 'Fish';
UPDATE members SET balance = 11000 WHERE nickname ILIKE 'Jimmy煮麵';
UPDATE members SET balance = 2098 WHERE nickname ILIKE 'Remy';
UPDATE members SET balance = 200 WHERE nickname ILIKE 'Amos';
UPDATE members SET balance = 21125 WHERE nickname ILIKE 'Joye';

