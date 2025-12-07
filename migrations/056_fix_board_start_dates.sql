-- 056_fix_board_start_dates.sql
-- 修正置板會員的日期：清空會籍開始日，設定置板開始日

-- 1. 李傑克 Jack - 置板開始日 2020-04-03
UPDATE members SET membership_start_date = NULL WHERE name = '李傑克' OR nickname = 'Jack';
UPDATE board_storage SET start_date = '2020-04-03' 
WHERE member_id IN (SELECT id FROM members WHERE name = '李傑克' OR nickname = 'Jack');

-- 2. 陳宥名 Chris - 置板開始日 2019-08-12
UPDATE members SET membership_start_date = NULL WHERE name = '陳宥名' OR nickname = 'Chris';
UPDATE board_storage SET start_date = '2019-08-12' 
WHERE member_id IN (SELECT id FROM members WHERE name = '陳宥名' OR nickname = 'Chris');

-- 3. 簡佑叡 Yo Ray - 置板開始日 2020-06-27
UPDATE members SET membership_start_date = NULL WHERE name = '簡佑叡' OR nickname = 'Yo Ray';
UPDATE board_storage SET start_date = '2020-06-27' 
WHERE member_id IN (SELECT id FROM members WHERE name = '簡佑叡' OR nickname = 'Yo Ray');

-- 4. JOYCE - 置板開始日 2020-08-11
UPDATE members SET membership_start_date = NULL WHERE name = 'JOYCE' OR nickname = 'JOYCE';
UPDATE board_storage SET start_date = '2020-08-11' 
WHERE member_id IN (SELECT id FROM members WHERE name = 'JOYCE' OR nickname = 'JOYCE');

-- 5. 何靜 - 置板開始日 2020-01-01
UPDATE members SET membership_start_date = NULL WHERE name = '何靜' OR nickname = '何靜';
UPDATE board_storage SET start_date = '2020-01-01' 
WHERE member_id IN (SELECT id FROM members WHERE name = '何靜' OR nickname = '何靜');

-- 6. 郭彥妤 YYK - 置板開始日 2020-08-18
UPDATE members SET membership_start_date = NULL WHERE name = '郭彥妤' OR nickname = 'YYK';
UPDATE board_storage SET start_date = '2020-08-18' 
WHERE member_id IN (SELECT id FROM members WHERE name = '郭彥妤' OR nickname = 'YYK');

-- 7. 陳昱汝 Naomi - 置板開始日 2021-12-24
UPDATE members SET membership_start_date = NULL WHERE name = '陳昱汝' OR nickname = 'Naomi';
UPDATE board_storage SET start_date = '2021-12-24' 
WHERE member_id IN (SELECT id FROM members WHERE name = '陳昱汝' OR nickname = 'Naomi');

-- 8. 何星老婆 Aria - 置板開始日 2023-06-01
UPDATE members SET membership_start_date = NULL WHERE name = '何星老婆' OR nickname = 'Aria';
UPDATE board_storage SET start_date = '2023-06-01' 
WHERE member_id IN (SELECT id FROM members WHERE name = '何星老婆' OR nickname = 'Aria');

-- 9. 何雅琴 Ivy - 置板開始日 2024-05-31
UPDATE members SET membership_start_date = NULL WHERE name = '何雅琴' OR nickname = 'Ivy';
UPDATE board_storage SET start_date = '2024-05-31' 
WHERE member_id IN (SELECT id FROM members WHERE name = '何雅琴' OR nickname = 'Ivy');

-- 10. 黃議員 Steven - 置板開始日 2024-05-09
UPDATE members SET membership_start_date = NULL WHERE name = '黃議員' OR nickname = 'Steven';
UPDATE board_storage SET start_date = '2024-05-09' 
WHERE member_id IN (SELECT id FROM members WHERE name = '黃議員' OR nickname = 'Steven');

-- 11. 魏立寧 魏立 - 置板開始日 2024-11-27
UPDATE members SET membership_start_date = NULL WHERE name = '魏立寧' OR nickname = '魏立';
UPDATE board_storage SET start_date = '2024-11-27' 
WHERE member_id IN (SELECT id FROM members WHERE name = '魏立寧' OR nickname = '魏立');

-- 12. 潘姵如 PJ - 置板開始日 2024-08-03 (第一個格位)
UPDATE members SET membership_start_date = NULL WHERE name = '潘姵如' OR nickname = 'PJ';
-- 注意：潘姵如有兩個格位，需要分別設定
-- 假設第一個格位的開始日是 2024-08-03
UPDATE board_storage SET start_date = '2024-08-03' 
WHERE member_id IN (SELECT id FROM members WHERE name = '潘姵如' OR nickname = 'PJ')
  AND start_date IS NULL
  AND id = (SELECT MIN(id) FROM board_storage WHERE member_id IN (SELECT id FROM members WHERE name = '潘姵如' OR nickname = 'PJ') AND status = 'active');

-- 潘姵如第二個格位的開始日是 2025-11-01
UPDATE board_storage SET start_date = '2025-11-01' 
WHERE member_id IN (SELECT id FROM members WHERE name = '潘姵如' OR nickname = 'PJ')
  AND start_date IS NULL
  AND status = 'active';

-- 13. 賴珮羚 Liz - 置板開始日 2021-09-11
UPDATE members SET membership_start_date = NULL WHERE name = '賴珮羚' OR nickname = 'Liz';
UPDATE board_storage SET start_date = '2021-09-11' 
WHERE member_id IN (SELECT id FROM members WHERE name = '賴珮羚' OR nickname = 'Liz');

-- 14. 黃芷羚 Penny - 置板開始日 2020-06-12
UPDATE members SET membership_start_date = NULL WHERE name = '黃芷羚' OR nickname = 'Penny';
UPDATE board_storage SET start_date = '2020-06-12' 
WHERE member_id IN (SELECT id FROM members WHERE name = '黃芷羚' OR nickname = 'Penny');

-- 15. 皮爾 Pieere - 置板開始日 2024-09-05
UPDATE members SET membership_start_date = NULL WHERE name = '皮爾' OR nickname = 'Pieere' OR nickname = 'Pierre';
UPDATE board_storage SET start_date = '2024-09-05' 
WHERE member_id IN (SELECT id FROM members WHERE name = '皮爾' OR nickname = 'Pieere' OR nickname = 'Pierre');

-- 16. 陳俊堯 Vincent - 置板開始日 2020-04-22
UPDATE members SET membership_start_date = NULL WHERE name = '陳俊堯' OR nickname = 'Vincent';
UPDATE board_storage SET start_date = '2020-04-22' 
WHERE member_id IN (SELECT id FROM members WHERE name = '陳俊堯' OR nickname = 'Vincent');

-- 17. CELINE 邱 Celine - 置板開始日 2025-07-01
UPDATE members SET membership_start_date = NULL WHERE name = 'CELINE 邱' OR name = 'CELINE邱' OR nickname = 'Celine';
UPDATE board_storage SET start_date = '2025-07-01' 
WHERE member_id IN (SELECT id FROM members WHERE name = 'CELINE 邱' OR name = 'CELINE邱' OR nickname = 'Celine');

-- 18. 張心瑋 Yumi / Miya - 置板開始日 2023-04-29
UPDATE members SET membership_start_date = NULL WHERE name = '張心瑋' OR nickname = 'Yumi' OR nickname = 'Miya';
UPDATE board_storage SET start_date = '2023-04-29' 
WHERE member_id IN (SELECT id FROM members WHERE name = '張心瑋' OR nickname = 'Yumi' OR nickname = 'Miya');

-- 19. 馬啓馨 MA - 置板開始日 2025-10-07
UPDATE members SET membership_start_date = NULL WHERE name = '馬啓馨' OR nickname = 'MA';
UPDATE board_storage SET start_date = '2025-10-07' 
WHERE member_id IN (SELECT id FROM members WHERE name = '馬啓馨' OR nickname = 'MA');

-- 20. 鄭硯綺 SH綺綺 - 置板開始日 2025-10-09
UPDATE members SET membership_start_date = NULL WHERE name = '鄭硯綺' OR nickname = 'SH綺綺';
UPDATE board_storage SET start_date = '2025-10-09' 
WHERE member_id IN (SELECT id FROM members WHERE name = '鄭硯綺' OR nickname = 'SH綺綺');

-- 21. 吳亞柏 Albert - 置板開始日 2024-08-03
UPDATE members SET membership_start_date = NULL WHERE name = '吳亞柏' OR nickname = 'Albert';
UPDATE board_storage SET start_date = '2024-08-03' 
WHERE member_id IN (SELECT id FROM members WHERE name = '吳亞柏' OR nickname = 'Albert');

-- 22. Fish 澤澤 - 置板開始日 2025-11-19
UPDATE members SET membership_start_date = NULL WHERE name = 'Fish' OR nickname = '澤澤';
UPDATE board_storage SET start_date = '2025-11-19' 
WHERE member_id IN (SELECT id FROM members WHERE name = 'Fish' OR nickname = '澤澤');

-- 23. Fish Jessica甯甯 - 置板開始日 2025-11-19
-- 注意：這個可能是同一個 Fish 會員的另一個格位，或者是另一個會員
UPDATE members SET membership_start_date = NULL WHERE nickname = 'Jessica甯甯' OR nickname = '甯甯';
UPDATE board_storage SET start_date = '2025-11-19' 
WHERE member_id IN (SELECT id FROM members WHERE nickname = 'Jessica甯甯' OR nickname = '甯甯');

-- 顯示更新結果
SELECT 
  m.name,
  m.nickname,
  m.membership_start_date,
  bs.slot_number,
  bs.start_date as board_start_date,
  bs.expires_at as board_expires_at
FROM members m
LEFT JOIN board_storage bs ON m.id = bs.member_id AND bs.status = 'active'
WHERE m.name IN ('李傑克', '陳宥名', '簡佑叡', 'JOYCE', '何靜', '郭彥妤', '陳昱汝', '何星老婆', '何雅琴', '黃議員', '魏立寧', '潘姵如', '賴珮羚', '黃芷羚', '皮爾', '陳俊堯', 'CELINE 邱', 'CELINE邱', '張心瑋', '馬啓馨', '鄭硯綺', '吳亞柏', 'Fish')
   OR m.nickname IN ('Jack', 'Chris', 'Yo Ray', 'JOYCE', '何靜', 'YYK', 'Naomi', 'Aria', 'Ivy', 'Steven', '魏立', 'PJ', 'Liz', 'Penny', 'Pieere', 'Pierre', 'Vincent', 'Celine', 'Yumi', 'Miya', 'MA', 'SH綺綺', 'Albert', '澤澤', 'Jessica甯甯', '甯甯')
ORDER BY m.name;

