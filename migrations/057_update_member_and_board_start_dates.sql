-- 057_update_member_and_board_start_dates.sql
-- 更新會員的會籍開始日和置板開始日

-- 1. 何峻宏 Carl - 會籍 2020-05-20
UPDATE members SET membership_start_date = '2020-05-20' WHERE name = '何峻宏' OR nickname = 'Carl';

-- 2. 李奇勳 Safim - 會籍 2020-06-26, 置板 2020-06-26
UPDATE members SET membership_start_date = '2020-06-26' WHERE name = '李奇勳' OR nickname = 'Safim' OR nickname = 'Safin';
UPDATE board_storage SET start_date = '2020-06-26' WHERE member_id IN (SELECT id FROM members WHERE name = '李奇勳' OR nickname = 'Safim' OR nickname = 'Safin') AND status = 'active';

-- 3. 李權恩 Nick - 會籍 2024-08-26, 置板 2020-04-14
UPDATE members SET membership_start_date = '2024-08-26' WHERE name = '李權恩' OR nickname = 'Nick';
UPDATE board_storage SET start_date = '2020-04-14' WHERE member_id IN (SELECT id FROM members WHERE name = '李權恩' OR nickname = 'Nick') AND status = 'active';

-- 4. 楊長峯 Teddy - 會籍 2020-08-05, 置板 2020-08-05
UPDATE members SET membership_start_date = '2020-08-05' WHERE name = '楊長峯' OR nickname = 'Teddy';
UPDATE board_storage SET start_date = '2020-08-05' WHERE member_id IN (SELECT id FROM members WHERE name = '楊長峯' OR nickname = 'Teddy') AND status = 'active';

-- 5. 邱俊翔 Ivan - 會籍 2020-08-11, 置板 2020-08-11
UPDATE members SET membership_start_date = '2020-08-11' WHERE name = '邱俊翔' OR nickname = 'Ivan';
UPDATE board_storage SET start_date = '2020-08-11' WHERE member_id IN (SELECT id FROM members WHERE name = '邱俊翔' OR nickname = 'Ivan') AND status = 'active';

-- 6. 汪弘城 Alan W - 會籍 2020-04-07, 置板 2020-04-07
UPDATE members SET membership_start_date = '2020-04-07' WHERE name = '汪弘城' OR nickname = 'Alan W' OR nickname = 'Alan';
UPDATE board_storage SET start_date = '2020-04-07' WHERE member_id IN (SELECT id FROM members WHERE name = '汪弘城' OR nickname = 'Alan W' OR nickname = 'Alan') AND status = 'active';

-- 7. 楊世雯 可樂 - 會籍 2020-05-16, 置板 2020-05-16
UPDATE members SET membership_start_date = '2020-05-16' WHERE name = '楊世雯' OR nickname = '可樂';
UPDATE board_storage SET start_date = '2020-05-16' WHERE member_id IN (SELECT id FROM members WHERE name = '楊世雯' OR nickname = '可樂') AND status = 'active';

-- 8. 邱柏瑞 Ray - 會籍 2020-06-16, 置板 2020-06-16
UPDATE members SET membership_start_date = '2020-06-16' WHERE name = '邱柏瑞' OR nickname = 'Ray';
UPDATE board_storage SET start_date = '2020-06-16' WHERE member_id IN (SELECT id FROM members WHERE name = '邱柏瑞' OR nickname = 'Ray') AND status = 'active';

-- 9. 林昱萱 林昱 - 會籍 2020-07-24, 置板 2020-01-01
UPDATE members SET membership_start_date = '2020-07-24' WHERE name = '林昱萱' OR nickname = '林昱';
UPDATE board_storage SET start_date = '2020-01-01' WHERE member_id IN (SELECT id FROM members WHERE name = '林昱萱' OR nickname = '林昱') AND status = 'active';

-- 10. 張沛然 黑炭 - 會籍 2020-07-31, 置板 2020-07-31
UPDATE members SET membership_start_date = '2020-07-31' WHERE name = '張沛然' OR nickname = '黑炭';
UPDATE board_storage SET start_date = '2020-07-31' WHERE member_id IN (SELECT id FROM members WHERE name = '張沛然' OR nickname = '黑炭') AND status = 'active';

-- 11. 賴奕茵 Ingrid - 會籍 2019-08-11, 置板 2019-08-11
UPDATE members SET membership_start_date = '2019-08-11' WHERE name = '賴奕茵' OR nickname = 'Ingrid';
UPDATE board_storage SET start_date = '2019-08-11' WHERE member_id IN (SELECT id FROM members WHERE name = '賴奕茵' OR nickname = 'Ingrid') AND status = 'active';

-- 12. 王月櫻 Joanna - 會籍 2020-09-18, 置板 2020-09-18
UPDATE members SET membership_start_date = '2020-09-18' WHERE name = '王月櫻' OR nickname = 'Joanna';
UPDATE board_storage SET start_date = '2020-09-18' WHERE member_id IN (SELECT id FROM members WHERE name = '王月櫻' OR nickname = 'Joanna') AND status = 'active';

-- 13. 王奕翔 Sky - 會籍 2020-11-30, 置板 2020-11-30
UPDATE members SET membership_start_date = '2020-11-30' WHERE name = '王奕翔' OR nickname = 'Sky';
UPDATE board_storage SET start_date = '2020-11-30' WHERE member_id IN (SELECT id FROM members WHERE name = '王奕翔' OR nickname = 'Sky') AND status = 'active';

-- 14. 賴宇瑄 小賴 - 會籍 2020-05-10, 置板 2020-05-10
UPDATE members SET membership_start_date = '2020-05-10' WHERE name = '賴宇瑄' OR nickname = '小賴';
UPDATE board_storage SET start_date = '2020-05-10' WHERE member_id IN (SELECT id FROM members WHERE name = '賴宇瑄' OR nickname = '小賴') AND status = 'active';

-- 15. 吳典豈 Darren - 會籍 2020-08-07, 置板 2020-08-07
UPDATE members SET membership_start_date = '2020-08-07' WHERE name = '吳典豈' OR nickname = 'Darren';
UPDATE board_storage SET start_date = '2020-08-07' WHERE member_id IN (SELECT id FROM members WHERE name = '吳典豈' OR nickname = 'Darren') AND status = 'active';

-- 16. 劉益逢 阿逢 - 會籍 2020-08-09, 置板 2020-08-09
UPDATE members SET membership_start_date = '2020-08-09' WHERE name = '劉益逢' OR nickname = '阿逢';
UPDATE board_storage SET start_date = '2020-08-09' WHERE member_id IN (SELECT id FROM members WHERE name = '劉益逢' OR nickname = '阿逢') AND status = 'active';

-- 17. 陳依婷 Candy C - 會籍 2020-10-04, 置板 2020-10-04
UPDATE members SET membership_start_date = '2020-10-04' WHERE name = '陳依婷' OR nickname = 'Candy C' OR nickname = 'Candy';
UPDATE board_storage SET start_date = '2020-10-04' WHERE member_id IN (SELECT id FROM members WHERE name = '陳依婷' OR nickname = 'Candy C' OR nickname = 'Candy') AND status = 'active';

-- 18. 劉建宏 Thomas - 會籍 2020-10-05, 置板 2020-10-05
UPDATE members SET membership_start_date = '2020-10-05' WHERE name = '劉建宏' OR nickname = 'Thomas';
UPDATE board_storage SET start_date = '2020-10-05' WHERE member_id IN (SELECT id FROM members WHERE name = '劉建宏' OR nickname = 'Thomas') AND status = 'active';

-- 19. 許書源 巨陽尼 - 會籍 2020-10-04, 置板 2020-10-04
UPDATE members SET membership_start_date = '2020-10-04' WHERE name = '許書源' OR nickname = '巨陽尼';
UPDATE board_storage SET start_date = '2020-10-04' WHERE member_id IN (SELECT id FROM members WHERE name = '許書源' OR nickname = '巨陽尼') AND status = 'active';

-- 20. 洪瀅淳 水晶 - 會籍 2020-11-24, 置板 2020-11-24
UPDATE members SET membership_start_date = '2020-11-24' WHERE name = '洪瀅淳' OR nickname = '水晶';
UPDATE board_storage SET start_date = '2020-11-24' WHERE member_id IN (SELECT id FROM members WHERE name = '洪瀅淳' OR nickname = '水晶') AND status = 'active';

-- 21. 鄭宇峰 Tony C - 會籍 2021-01-01, 置板 2024-03-01
UPDATE members SET membership_start_date = '2021-01-01' WHERE name = '鄭宇峰' OR nickname = 'Tony C';
UPDATE board_storage SET start_date = '2024-03-01' WHERE member_id IN (SELECT id FROM members WHERE name = '鄭宇峰' OR nickname = 'Tony C') AND status = 'active';

-- 22. 陳羽榛 Anita - 會籍 2020-01-01, 置板 2020-01-01
UPDATE members SET membership_start_date = '2020-01-01' WHERE name = '陳羽榛' OR nickname = 'Anita';
UPDATE board_storage SET start_date = '2020-01-01' WHERE member_id IN (SELECT id FROM members WHERE name = '陳羽榛' OR nickname = 'Anita') AND status = 'active';

-- 23. 鍾宜欣 Jocelyn - 會籍 2021-04-05, 置板 2021-04-05
UPDATE members SET membership_start_date = '2021-04-05' WHERE name = '鍾宜欣' OR nickname = 'Jocelyn';
UPDATE board_storage SET start_date = '2021-04-05' WHERE member_id IN (SELECT id FROM members WHERE name = '鍾宜欣' OR nickname = 'Jocelyn') AND status = 'active';

-- 24. 郭家華 Queenie - 會籍 2023-06-03, 置板 2023-06-03
UPDATE members SET membership_start_date = '2023-06-03' WHERE name = '郭家華' OR nickname = 'Queenie';
UPDATE board_storage SET start_date = '2023-06-03' WHERE member_id IN (SELECT id FROM members WHERE name = '郭家華' OR nickname = 'Queenie') AND status = 'active';

-- 25. 李家銘 Jimmy L - 會籍 2021-07-09, 置板 2021-07-09
UPDATE members SET membership_start_date = '2021-07-09' WHERE name = '李家銘' OR nickname = 'Jimmy L';
UPDATE board_storage SET start_date = '2021-07-09' WHERE member_id IN (SELECT id FROM members WHERE name = '李家銘' OR nickname = 'Jimmy L') AND status = 'active';

-- 26. 黃高宇 高宇 - 會籍 2021-07-11, 置板 2021-07-11
UPDATE members SET membership_start_date = '2021-07-11' WHERE name = '黃高宇' OR nickname = '高宇';
UPDATE board_storage SET start_date = '2021-07-11' WHERE member_id IN (SELECT id FROM members WHERE name = '黃高宇' OR nickname = '高宇') AND status = 'active';

-- 27. 董彥良 Yen - 會籍 2021-09-18, 置板 2021-09-18
UPDATE members SET membership_start_date = '2021-09-18' WHERE name = '董彥良' OR nickname = 'Yen';
UPDATE board_storage SET start_date = '2021-09-18' WHERE member_id IN (SELECT id FROM members WHERE name = '董彥良' OR nickname = 'Yen') AND status = 'active';

-- 28. 李幸純 Shirley - 會籍 2020-01-01, 置板 2020-01-01
UPDATE members SET membership_start_date = '2020-01-01' WHERE name = '李幸純' OR nickname = 'Shirley';
UPDATE board_storage SET start_date = '2020-01-01' WHERE member_id IN (SELECT id FROM members WHERE name = '李幸純' OR nickname = 'Shirley') AND status = 'active';

-- 29. 王智瑋 Tony W - 會籍 2022-04-09, 置板 2023-06-03
UPDATE members SET membership_start_date = '2022-04-09' WHERE name = '王智瑋' OR nickname = 'Tony W';
UPDATE board_storage SET start_date = '2023-06-03' WHERE member_id IN (SELECT id FROM members WHERE name = '王智瑋' OR nickname = 'Tony W') AND status = 'active';

-- 30. 阿中 - 會籍 2025-07-13, 置板 2025-07-13
UPDATE members SET membership_start_date = '2025-07-13' WHERE name = '阿中' OR nickname = '阿中';
UPDATE board_storage SET start_date = '2025-07-13' WHERE member_id IN (SELECT id FROM members WHERE name = '阿中' OR nickname = '阿中') AND status = 'active';

-- 31. 林冠宇 Josh - 會籍 2022-05-07, 置板 2022-05-07
UPDATE members SET membership_start_date = '2022-05-07' WHERE name = '林冠宇' OR nickname = 'Josh';
UPDATE board_storage SET start_date = '2022-05-07' WHERE member_id IN (SELECT id FROM members WHERE name = '林冠宇' OR nickname = 'Josh') AND status = 'active';

-- 32. 郭祖睿 Eric - 會籍 2022-05-08, 置板 2022-05-08
UPDATE members SET membership_start_date = '2022-05-08' WHERE name = '郭祖睿' OR nickname = 'Eric';
UPDATE board_storage SET start_date = '2022-05-08' WHERE member_id IN (SELECT id FROM members WHERE name = '郭祖睿' OR nickname = 'Eric') AND status = 'active';

-- 33. 王國維 Simon - 會籍 2022-05-29, 置板 2022-05-29
UPDATE members SET membership_start_date = '2022-05-29' WHERE name = '王國維' OR nickname = 'Simon';
UPDATE board_storage SET start_date = '2022-05-29' WHERE member_id IN (SELECT id FROM members WHERE name = '王國維' OR nickname = 'Simon') AND status = 'active';

-- 34. 林敏 Ming - 會籍 2022-06-04, 置板 2022-06-04
UPDATE members SET membership_start_date = '2022-06-04' WHERE name = '林敏' OR nickname = 'Ming';
UPDATE board_storage SET start_date = '2022-06-04' WHERE member_id IN (SELECT id FROM members WHERE name = '林敏' OR nickname = 'Ming') AND status = 'active';

-- 35. 王怡文 凱瑟琳 - 會籍 2022-07-02, 置板 2022-07-02
UPDATE members SET membership_start_date = '2022-07-02' WHERE name = '王怡文' OR nickname = '凱瑟琳';
UPDATE board_storage SET start_date = '2022-07-02' WHERE member_id IN (SELECT id FROM members WHERE name = '王怡文' OR nickname = '凱瑟琳') AND status = 'active';

-- 36. 陳沁彤 大貓咪 - 會籍 2022-07-13, 置板 2023-07-15
UPDATE members SET membership_start_date = '2022-07-13' WHERE name = '陳沁彤' OR nickname = '大貓咪';
UPDATE board_storage SET start_date = '2023-07-15' WHERE member_id IN (SELECT id FROM members WHERE name = '陳沁彤' OR nickname = '大貓咪') AND status = 'active';

-- 37. 何星岱 何Sing - 會籍 2022-11-03, 置板 2022-11-03
UPDATE members SET membership_start_date = '2022-11-03' WHERE name = '何星岱' OR nickname = '何Sing';
UPDATE board_storage SET start_date = '2022-11-03' WHERE member_id IN (SELECT id FROM members WHERE name = '何星岱' OR nickname = '何Sing') AND status = 'active';

-- 38. 林孟穎 Mandy - 會籍 2023-03-12, 置板 2023-03-12
UPDATE members SET membership_start_date = '2023-03-12' WHERE name = '林孟穎' OR nickname = 'Mandy';
UPDATE board_storage SET start_date = '2023-03-12' WHERE member_id IN (SELECT id FROM members WHERE name = '林孟穎' OR nickname = 'Mandy') AND status = 'active';

-- 39. 廖英夙 Susan - 會籍 2023-04-30, 置板 2023-04-30
UPDATE members SET membership_start_date = '2023-04-30' WHERE name = '廖英夙' OR nickname = 'Susan';
UPDATE board_storage SET start_date = '2023-04-30' WHERE member_id IN (SELECT id FROM members WHERE name = '廖英夙' OR nickname = 'Susan') AND status = 'active';

-- 40. 李思愉 LISA L - 會籍 2024-04-06, 置板 2024-06-02
UPDATE members SET membership_start_date = '2024-04-06' WHERE name = '李思愉' OR nickname = 'LISA L' OR nickname = 'LISA';
UPDATE board_storage SET start_date = '2024-06-02' WHERE member_id IN (SELECT id FROM members WHERE name = '李思愉' OR nickname = 'LISA L' OR nickname = 'LISA') AND status = 'active';

-- 41. 蔡志權 Scott - 會籍 2023-06-29, 置板 2023-06-29
UPDATE members SET membership_start_date = '2023-06-29' WHERE name = '蔡志權' OR nickname = 'Scott';
UPDATE board_storage SET start_date = '2023-06-29' WHERE member_id IN (SELECT id FROM members WHERE name = '蔡志權' OR nickname = 'Scott') AND status = 'active';

-- 42. 陳又嘉 Elaine - 會籍 2023-07-15, 置板 2023-08-10
UPDATE members SET membership_start_date = '2023-07-15' WHERE name = '陳又嘉' OR nickname = 'Elaine';
UPDATE board_storage SET start_date = '2023-08-10' WHERE member_id IN (SELECT id FROM members WHERE name = '陳又嘉' OR nickname = 'Elaine') AND status = 'active';

-- 43. 羅宜亭 JO - 會籍 2023-08-08, 置板 2023-11-21
UPDATE members SET membership_start_date = '2023-08-08' WHERE name = '羅宜亭' OR nickname = 'JO';
UPDATE board_storage SET start_date = '2023-11-21' WHERE member_id IN (SELECT id FROM members WHERE name = '羅宜亭' OR nickname = 'JO') AND status = 'active';

-- 44. 孫可恩 可恩 - 會籍 2023-08-28, 置板 2024-10-30
UPDATE members SET membership_start_date = '2023-08-28' WHERE name = '孫可恩' OR nickname = '可恩';
UPDATE board_storage SET start_date = '2024-10-30' WHERE member_id IN (SELECT id FROM members WHERE name = '孫可恩' OR nickname = '可恩') AND status = 'active';

-- 45. 楊希傑 - 會籍 2023-09-10 (無置板)
UPDATE members SET membership_start_date = '2023-09-10' WHERE name = '楊希傑' OR nickname = '楊希傑';

-- 46. 何翠蘋 翠蘋 - 會籍 2023-10-15, 置板 2023-12-10
UPDATE members SET membership_start_date = '2023-10-15' WHERE name = '何翠蘋' OR nickname = '翠蘋';
UPDATE board_storage SET start_date = '2023-12-10' WHERE member_id IN (SELECT id FROM members WHERE name = '何翠蘋' OR nickname = '翠蘋') AND status = 'active';

-- 47. 陳建宏 Edric - 會籍 2023-10-16 (無置板)
UPDATE members SET membership_start_date = '2023-10-16' WHERE name = '陳建宏' OR nickname = 'Edric';

-- 48. 童瓊慧 Markus - 會籍 2023-11-23, 置板 2023-11-29
UPDATE members SET membership_start_date = '2023-11-23' WHERE name = '童瓊慧Joy(媽媽)' OR name = '童瓊慧' OR nickname = 'Markus' OR nickname = 'Joy';
UPDATE board_storage SET start_date = '2023-11-29' WHERE member_id IN (SELECT id FROM members WHERE name = '童瓊慧Joy(媽媽)' OR name = '童瓊慧' OR nickname = 'Markus' OR nickname = 'Joy') AND status = 'active';

-- 49. 黃千芮 Remy - 會籍 2024-02-20, 置板 2024-07-01
UPDATE members SET membership_start_date = '2024-02-20' WHERE name = '黃千芮' OR nickname = 'Remy';
UPDATE board_storage SET start_date = '2024-07-01' WHERE member_id IN (SELECT id FROM members WHERE name = '黃千芮' OR nickname = 'Remy') AND status = 'active';

-- 50. 鍾旻峻 Jim - 會籍 2024-04-14, 置板 2024-11-09
UPDATE members SET membership_start_date = '2024-04-14' WHERE name = '鍾旻峻' OR nickname = 'Jim';
UPDATE board_storage SET start_date = '2024-11-09' WHERE member_id IN (SELECT id FROM members WHERE name = '鍾旻峻' OR nickname = 'Jim') AND status = 'active';

-- 51. 林紘盛 Edison - 會籍 2024-04-02, 置板 2024-04-29
UPDATE members SET membership_start_date = '2024-04-02' WHERE name = '林紘盛' OR nickname = 'Edison';
UPDATE board_storage SET start_date = '2024-04-29' WHERE member_id IN (SELECT id FROM members WHERE name = '林紘盛' OR nickname = 'Edison') AND status = 'active';

-- 52. 陳奕潔 Stan - 會籍 2024-04-15, 置板 2024-04-15
UPDATE members SET membership_start_date = '2024-04-15' WHERE name = '陳奕潔' OR nickname = 'Stan';
UPDATE board_storage SET start_date = '2024-04-15' WHERE member_id IN (SELECT id FROM members WHERE name = '陳奕潔' OR nickname = 'Stan') AND status = 'active';

-- 53. 黃家畇 瓜 - 會籍 2024-04-13, 置板 2025-04-26
UPDATE members SET membership_start_date = '2024-04-13' WHERE name = '黃家畇' OR nickname = '瓜';
UPDATE board_storage SET start_date = '2025-04-26' WHERE member_id IN (SELECT id FROM members WHERE name = '黃家畇' OR nickname = '瓜') AND status = 'active';

-- 54. 陳柏年 Morris - 會籍 2024-05-25, 置板 2023-09-23
UPDATE members SET membership_start_date = '2024-05-25' WHERE name = '陳柏年' OR nickname = 'Morris';
UPDATE board_storage SET start_date = '2023-09-23' WHERE member_id IN (SELECT id FROM members WHERE name = '陳柏年' OR nickname = 'Morris') AND status = 'active';

-- 55. JOE LIN R ONE - 會籍 2024-05-04 (無置板)
UPDATE members SET membership_start_date = '2024-05-04' WHERE name = 'JOE LIN' OR nickname = 'R ONE' OR nickname = 'JOE';

-- 56. 張婷 Tin - 會籍 2024-06-29, 置板 2023-12-10
UPDATE members SET membership_start_date = '2024-06-29' WHERE name = '張婷' OR nickname = 'Tin';
UPDATE board_storage SET start_date = '2023-12-10' WHERE member_id IN (SELECT id FROM members WHERE name = '張婷' OR nickname = 'Tin') AND status = 'active';

-- 57. Fish - 會籍 2024-07-06, 置板 2024-07-06
UPDATE members SET membership_start_date = '2024-07-06' WHERE name = 'Fish' OR nickname = 'Fish';
UPDATE board_storage SET start_date = '2024-07-06' WHERE member_id IN (SELECT id FROM members WHERE name = 'Fish' OR nickname = 'Fish') AND status = 'active';

-- 58. 連建閔 連醫師 - 會籍 2024-06-08, 置板 2025-06-08
UPDATE members SET membership_start_date = '2024-06-08' WHERE name = '連建閔' OR nickname = '連醫師';
UPDATE board_storage SET start_date = '2025-06-08' WHERE member_id IN (SELECT id FROM members WHERE name = '連建閔' OR nickname = '連醫師') AND status = 'active';

-- 59. 陳室融 Amelia - 會籍 2024-08-02, 置板 2024-09-18
UPDATE members SET membership_start_date = '2024-08-02' WHERE name = '陳室融' OR nickname = 'Amelia';
UPDATE board_storage SET start_date = '2024-09-18' WHERE member_id IN (SELECT id FROM members WHERE name = '陳室融' OR nickname = 'Amelia') AND status = 'active';

-- 60. JAMES MILNES / AXEL CATUSSE - 會籍 2024-08-12 (無置板)
UPDATE members SET membership_start_date = '2024-08-12' WHERE name = 'JAMES MILNES / AXEL CATUSSE' OR name = 'JAMES MILNES' OR name = 'AXEL CATUSSE' OR nickname = 'JAMES /AXEL' OR nickname = 'JAMES' OR nickname = 'AXEL';

-- 61. 葉其琛 卡稱 - 會籍 2024-08-18 (無置板)
UPDATE members SET membership_start_date = '2024-08-18' WHERE name = '葉其琛' OR nickname = '卡稱';

-- 62. 王智俊 Jimmy W - 會籍 2024-07-28, 置板 2025-07-24
UPDATE members SET membership_start_date = '2024-07-28' WHERE name = '王智俊' OR nickname = 'Jimmy W';
UPDATE board_storage SET start_date = '2025-07-24' WHERE member_id IN (SELECT id FROM members WHERE name = '王智俊' OR nickname = 'Jimmy W') AND status = 'active';

-- 63. 揚宗修 Hugh - 會籍 2024-09-02 (無置板)
UPDATE members SET membership_start_date = '2024-09-02' WHERE name = '揚宗修' OR name = '楊宗修' OR nickname = 'Hugh';

-- 64. 林鈺恆 Neo - 會籍 2024-10-22 (無置板)
UPDATE members SET membership_start_date = '2024-10-22' WHERE name = '林鈺恆' OR nickname = 'Neo';

-- 65. 余思瑩 Celine Yu - 會籍 2025-03-11, 置板 2023-09-07
UPDATE members SET membership_start_date = '2025-03-11' WHERE name = '余思瑩' OR nickname = 'Celine Yu';
UPDATE board_storage SET start_date = '2023-09-07' WHERE member_id IN (SELECT id FROM members WHERE name = '余思瑩' OR nickname = 'Celine Yu') AND status = 'active';

-- 66. 呂立仁 Mike呂 - 會籍 2024-11-23, 置板 2025-04-19
UPDATE members SET membership_start_date = '2024-11-23' WHERE name = '呂立仁' OR nickname = 'Mike呂';
UPDATE board_storage SET start_date = '2025-04-19' WHERE member_id IN (SELECT id FROM members WHERE name = '呂立仁' OR nickname = 'Mike呂') AND status = 'active';

-- 67. MATTHEW - 會籍 2024-11-23 (無置板)
UPDATE members SET membership_start_date = '2024-11-23' WHERE name = 'MATTHEW' OR nickname = 'Matthew';

-- 68. 陳俊瑛 Mike C - 會籍 2024-12-05, 置板 2025-04-20
UPDATE members SET membership_start_date = '2024-12-05' WHERE name = '陳俊瑛' OR nickname = 'Mike C';
UPDATE board_storage SET start_date = '2025-04-20' WHERE member_id IN (SELECT id FROM members WHERE name = '陳俊瑛' OR nickname = 'Mike C') AND status = 'active';

-- 69. 王心恬 Candy W - 會籍 2025-03-12, 置板 2020-01-01
UPDATE members SET membership_start_date = '2025-03-12' WHERE name = '王心恬' OR nickname = 'Candy W';
UPDATE board_storage SET start_date = '2020-01-01' WHERE member_id IN (SELECT id FROM members WHERE name = '王心恬' OR nickname = 'Candy W') AND status = 'active';

-- 70. 楊翊 小楊 - 會籍 2025-04-01, 置板 2020-12-13
UPDATE members SET membership_start_date = '2025-04-01' WHERE name = '楊翊' OR nickname = '小楊';
UPDATE board_storage SET start_date = '2020-12-13' WHERE member_id IN (SELECT id FROM members WHERE name = '楊翊' OR nickname = '小楊') AND status = 'active';

-- 71. 李婉瑄 小貝 - 會籍 2025-04-01, 置板 2021-04-24
UPDATE members SET membership_start_date = '2025-04-01' WHERE name = '李婉瑄' OR nickname = '小貝';
UPDATE board_storage SET start_date = '2021-04-24' WHERE member_id IN (SELECT id FROM members WHERE name = '李婉瑄' OR nickname = '小貝') AND status = 'active';

-- 72. 王芳怡 Maggie - 會籍 2024-12-15, 置板 2024-02-28
UPDATE members SET membership_start_date = '2024-12-15' WHERE name = '王芳怡' OR nickname = 'Maggie';
UPDATE board_storage SET start_date = '2024-02-28' WHERE member_id IN (SELECT id FROM members WHERE name = '王芳怡' OR nickname = 'Maggie') AND status = 'active';

-- 73. 黃妍甄 Alice妍 - 會籍 2025-04-24 (置板無開始日)
UPDATE members SET membership_start_date = '2025-04-24' WHERE name = '黃妍甄' OR nickname = 'Alice妍';

-- 74. 吳芮綺 小太陽 - 會籍 2025-05-08 (無置板)
UPDATE members SET membership_start_date = '2025-05-08' WHERE name = '吳芮綺' OR nickname = '小太陽';

-- 75. 鍾启駿 Avan - 會籍 2025-05-14, 置板 2025-06-23
UPDATE members SET membership_start_date = '2025-05-14' WHERE name = '鍾启駿' OR nickname = 'Avan';
UPDATE board_storage SET start_date = '2025-06-23' WHERE member_id IN (SELECT id FROM members WHERE name = '鍾启駿' OR nickname = 'Avan') AND status = 'active';

-- 76. 林子翔 Sean - 會籍 2025-05-14 (無置板)
UPDATE members SET membership_start_date = '2025-05-14' WHERE name = '林子翔' OR nickname = 'Sean';

-- 77. 朱黛咪 黛咪 - 會籍 2025-05-30 (無置板)
UPDATE members SET membership_start_date = '2025-05-30' WHERE name = '朱黛咪' OR nickname = '黛咪';

-- 78. 曾愷悌 Kaiti - 會籍 2025-06-13, 置板 2025-10-12
UPDATE members SET membership_start_date = '2025-06-13' WHERE name = '曾愷悌' OR nickname = 'Kaiti';
UPDATE board_storage SET start_date = '2025-10-12' WHERE member_id IN (SELECT id FROM members WHERE name = '曾愷悌' OR nickname = 'Kaiti') AND status = 'active';

-- 79. 侯新郇 Joshua - 會籍 2024-09-01, 置板 2025-09-21
UPDATE members SET membership_start_date = '2024-09-01' WHERE name = '侯新郇' OR nickname = 'Joshua';
UPDATE board_storage SET start_date = '2025-09-21' WHERE member_id IN (SELECT id FROM members WHERE name = '侯新郇' OR nickname = 'Joshua') AND status = 'active';

-- 80. 陳薇巧 Vivian 巧 - 會籍 2025-08-03 (無置板)
UPDATE members SET membership_start_date = '2025-08-03' WHERE name = '陳薇巧' OR nickname = 'Vivian 巧' OR nickname = 'Vivian';

-- 81. 陳誌鳴 Jimmy煮麵 - 會籍 2025-08-05, 置板 2025-09-09
UPDATE members SET membership_start_date = '2025-08-05' WHERE name = '陳誌鳴' OR nickname = 'Jimmy煮麵';
UPDATE board_storage SET start_date = '2025-09-09' WHERE member_id IN (SELECT id FROM members WHERE name = '陳誌鳴' OR nickname = 'Jimmy煮麵') AND status = 'active';

-- 83. 陳巧瑜 Chiao - 會籍 2025-08-16 (無置板)
UPDATE members SET membership_start_date = '2025-08-16' WHERE name = '陳巧瑜' OR nickname = 'Chiao';

-- 84. 鄭媺璇 小媺 - 會籍 2025-08-16 (無置板)
UPDATE members SET membership_start_date = '2025-08-16' WHERE name = '鄭媺璇' OR nickname = '小媺';

-- 85. 葉彤彤 彤彤 - 會籍 2025-08-18 (無置板)
UPDATE members SET membership_start_date = '2025-08-18' WHERE name = '葉彤彤' OR nickname = '彤彤';

-- 86. 吳佳瑈 Winnie - 會籍 2025-08-21 (無置板)
UPDATE members SET membership_start_date = '2025-08-21' WHERE name = '吳佳瑈' OR nickname = 'Winnie';

-- 87. 許毅平 阿平 - 會籍 2025-08-23, 置板 2025-10-04
UPDATE members SET membership_start_date = '2025-08-23' WHERE name = '許毅平' OR nickname = '阿平';
UPDATE board_storage SET start_date = '2025-10-04' WHERE member_id IN (SELECT id FROM members WHERE name = '許毅平' OR nickname = '阿平') AND status = 'active';

-- 88. 楊惠茹 Leona - 會籍 2025-08-24 (無置板)
UPDATE members SET membership_start_date = '2025-08-24' WHERE name = '楊惠茹' OR nickname = 'Leona';

-- 89. 劉容亘 旦旦 - 會籍 2025-09-07 (無置板)
UPDATE members SET membership_start_date = '2025-09-07' WHERE name = '劉容亘' OR nickname = '旦旦';

-- 90. 李子嫥 Sunnie - 會籍 2025-09-10 (無置板)
UPDATE members SET membership_start_date = '2025-09-10' WHERE name = '李子嫥' OR nickname = 'Sunnie';

-- 91. 林季賢 Amos - 會籍 2025-09-13, 置板 2023-09-05
UPDATE members SET membership_start_date = '2025-09-13' WHERE name = '林季賢' OR nickname = 'Amos';
UPDATE board_storage SET start_date = '2023-09-05' WHERE member_id IN (SELECT id FROM members WHERE name = '林季賢' OR nickname = 'Amos') AND status = 'active';

-- 92. 曾愛芸 艾克 - 會籍 2025-10-01 (無置板)
UPDATE members SET membership_start_date = '2025-10-01' WHERE name = '曾愛芸' OR nickname = '艾克';

-- 93. 信嫂 Joye - 會籍 2025-06-20, 置板 2025-06-20
UPDATE members SET membership_start_date = '2025-06-20' WHERE name = '信嫂' OR nickname = 'Joye';
UPDATE board_storage SET start_date = '2025-06-20' WHERE member_id IN (SELECT id FROM members WHERE name = '信嫂' OR nickname = 'Joye') AND status = 'active';

-- 94. 包崇芸 MS包 - 會籍 2025-10-10, 置板 2025-10-10
UPDATE members SET membership_start_date = '2025-10-10' WHERE name = '包崇芸' OR nickname = 'MS包';
UPDATE board_storage SET start_date = '2025-10-10' WHERE member_id IN (SELECT id FROM members WHERE name = '包崇芸' OR nickname = 'MS包') AND status = 'active';

-- 95. 何蕙均 泡泡 - 會籍 2025-10-09, 置板 2025-10-09
UPDATE members SET membership_start_date = '2025-10-09' WHERE name = '何蕙均' OR nickname = '泡泡';
UPDATE board_storage SET start_date = '2025-10-09' WHERE member_id IN (SELECT id FROM members WHERE name = '何蕙均' OR nickname = '泡泡') AND status = 'active';

-- 96. 謝典霖 - 會籍 2025-10-09 (無置板)
UPDATE members SET membership_start_date = '2025-10-09' WHERE name = '謝典霖' OR nickname = '謝典霖';

-- 97. 黃平 - 會籍 2025-10-11 (無置板)
UPDATE members SET membership_start_date = '2025-10-11' WHERE name = '黃平' OR nickname = '黃平';

-- 98. 林冠伻 Kuanbon - 會籍 2025-10-11 (無置板)
UPDATE members SET membership_start_date = '2025-10-11' WHERE name = '林冠伻' OR nickname = 'Kuanbon';

-- 100. 王韋翰 Sunny - 會籍 2020-07-16, 置板 2020-07-16
UPDATE members SET membership_start_date = '2020-07-16' WHERE name = '王韋翰' OR nickname = 'Sunny';
UPDATE board_storage SET start_date = '2020-07-16' WHERE member_id IN (SELECT id FROM members WHERE name = '王韋翰' OR nickname = 'Sunny') AND status = 'active';

-- 顯示更新統計
SELECT 
  '更新完成' as status,
  (SELECT COUNT(*) FROM members WHERE membership_start_date IS NOT NULL) as members_with_start_date,
  (SELECT COUNT(*) FROM board_storage WHERE start_date IS NOT NULL AND status = 'active') as boards_with_start_date;

