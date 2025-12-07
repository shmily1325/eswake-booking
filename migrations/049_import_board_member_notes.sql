-- 049_import_board_member_notes.sql
-- 批次匯入置板會員備忘錄
-- 直接在 Supabase SQL Editor 執行此腳本

-- 先修改 event_date 欄位允許 NULL
ALTER TABLE member_notes ALTER COLUMN event_date DROP NOT NULL;

-- 1. 李傑克 (格位 1)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-05-28', '續約', '續約（過去續約紀錄）' FROM members WHERE name = '李傑克' OR nickname = '李傑克' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-07-20', '續約', '會員＋置板' FROM members WHERE name = '李傑克' OR nickname = '李傑克' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-20', '續約', '續約置板' FROM members WHERE name = '李傑克' OR nickname = '李傑克' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-28', '續約', '續約' FROM members WHERE name = '李傑克' OR nickname = '李傑克' LIMIT 1;

-- 2. 陳宥名 (格位 2)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-10-14', '續約', '改置板（過去續約紀錄）' FROM members WHERE name = '陳宥名' OR nickname = '陳宥名' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-20', '續約', '續約' FROM members WHERE name = '陳宥名' OR nickname = '陳宥名' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-21', '續約', '續約置板' FROM members WHERE name = '陳宥名' OR nickname = '陳宥名' LIMIT 1;

-- 3. 簡佑叡 (格位 3)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-08-02', '續約', '續約（過去紀錄）' FROM members WHERE name = '簡佑叡' OR nickname = '簡佑叡' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-09-03', '續約', '續約' FROM members WHERE name = '簡佑叡' OR nickname = '簡佑叡' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-19', '續約', '續約置板' FROM members WHERE name = '簡佑叡' OR nickname = '簡佑叡' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-11-13', '續約', '續約' FROM members WHERE name = '簡佑叡' OR nickname = '簡佑叡' LIMIT 1;

-- 5. JOYCE (格位 5)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-08-13', '續約', '續約' FROM members WHERE name = 'JOYCE' OR nickname = 'JOYCE' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-20', '贈送', '大船卷贈送置板已使用' FROM members WHERE name = 'JOYCE' OR nickname = 'JOYCE' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-12', '續約', '續約' FROM members WHERE name = 'JOYCE' OR nickname = 'JOYCE' LIMIT 1;

-- 6. 何靜 (格位 6)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', 'FREE (置板)' FROM members WHERE name = '何靜' OR nickname = '何靜' LIMIT 1;

-- 13. 郭彥妤 (格位 13)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-10-05', '續約', '續約' FROM members WHERE name = '郭彥妤' OR nickname = '郭彥妤' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-19', '續約', '續約置板' FROM members WHERE name = '郭彥妤' OR nickname = '郭彥妤' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-17', '續約', '續約置板' FROM members WHERE name = '郭彥妤' OR nickname = '郭彥妤' LIMIT 1;

-- 16. 陳昱汝 (格位 16)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-12-28', '續約', '續約' FROM members WHERE name = '陳昱汝' OR nickname = '陳昱汝' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-01-13', '續約', '續約轉置板' FROM members WHERE name = '陳昱汝' OR nickname = '陳昱汝' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-25', '續約', '續約' FROM members WHERE name = '陳昱汝' OR nickname = '陳昱汝' LIMIT 1;

-- 18. 何星老婆 (格位 18)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '何星G23船卷送置板' FROM members WHERE name = '何星老婆' OR nickname = '何星老婆' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-02', '續約', '續約' FROM members WHERE name = '何星老婆' OR nickname = '何星老婆' LIMIT 1;

-- 19. 何雅琴 (格位 19)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-05-19', '購買', '購買A1方案贈送(置板)' FROM members WHERE name = '何雅琴' OR nickname = '何雅琴' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-31', '贈送', '2025/5/31-2026/5/31 使用票卷贈送(置板)' FROM members WHERE name = '何雅琴' OR nickname = '何雅琴' LIMIT 1;

-- 20. 黃議員 (格位 20)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-05-09', '贈送', '船卷贈送2年(置板)' FROM members WHERE name = '黃議員' OR nickname = '黃議員' LIMIT 1;

-- 22. 魏立寧 (格位 22)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-11-27', '入會', '置板開始' FROM members WHERE name = '魏立寧' OR nickname = '魏立寧' LIMIT 1;

-- 23. 潘姵如 (格位 23)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-08-03', '入會', '置板開始' FROM members WHERE name = '潘姵如' OR nickname = '潘姵如' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-03', '贈送', '2025/8/3-2027/8/3 用26年票卷送*2(置板)' FROM members WHERE name = '潘姵如' OR nickname = '潘姵如' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-11-01', '使用', '2025/11/1-2026/11/1 使用26年票卷(置板)' FROM members WHERE name = '潘姵如' OR nickname = '潘姵如' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2026-11-01', '使用', '2026/11/1-2027/11/1 使用26年票卷(置板)' FROM members WHERE name = '潘姵如' OR nickname = '潘姵如' LIMIT 1;

-- 27. 賴珮羚 (格位 27)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-09-30', '續約', '續約轉置版' FROM members WHERE name = '賴珮羚' OR nickname = '賴珮羚' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-09-25', '續約', '續約' FROM members WHERE name = '賴珮羚' OR nickname = '賴珮羚' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-05-28', '續約', '續約置板' FROM members WHERE name = '賴珮羚' OR nickname = '賴珮羚' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-08', '續約', '續約' FROM members WHERE name = '賴珮羚' OR nickname = '賴珮羚' LIMIT 1;

-- 28. 黃芷羚 (格位 28)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-12-31', '續約', '續約（舊船卷＋新卷 共2年置板已使用）' FROM members WHERE name = '黃芷羚' OR nickname = '黃芷羚' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-10-09', '備註', '更新(置板)' FROM members WHERE name = '黃芷羚' OR nickname = '黃芷羚' LIMIT 1;

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-12-07', '備註', '確認不續約會員，使用之前購買船卷贈送置板（還有一年可以繼續使用）' FROM members WHERE name = '黃芷羚' OR nickname = '黃芷羚' LIMIT 1;

-- 33. 皮爾 (格位 33)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-09-05', '入會', '置板開始' FROM members WHERE name = '皮爾' OR nickname = '皮爾' LIMIT 1;

-- 34. 陳俊堯 (格位 34)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-11-10', '續約', '續約置板' FROM members WHERE name = '陳俊堯' OR nickname = '陳俊堯' LIMIT 1;

-- 36. CELINE 邱 (格位 36)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-01', '入會', '置板開始' FROM members WHERE name = 'CELINE 邱' OR nickname = 'CELINE 邱' OR name = 'CELINE邱' OR nickname = 'CELINE邱' LIMIT 1;

-- 37. 張心瑋 / Yumi (格位 37)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '贈送', '票卷贈送(置板)' FROM members WHERE name = '張心瑋' OR nickname = '張心瑋' OR name = 'Yumi' OR nickname = 'Yumi' LIMIT 1;

-- 38. 馬啓馨 (格位 38)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-07', '入會', '置板開始' FROM members WHERE name = '馬啓馨' OR nickname = '馬啓馨' LIMIT 1;

-- 39. 鄭硯綺 (格位 39)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-09', '入會', '置板開始' FROM members WHERE name = '鄭硯綺' OR nickname = '鄭硯綺' LIMIT 1;

-- 40. 吳亞柏 (格位 40)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-08-03', '入會', '置板開始' FROM members WHERE name = '吳亞柏' OR nickname = '吳亞柏' LIMIT 1;

-- 41. 澤澤 (格位 41)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-11-19', '入會', '置板開始' FROM members WHERE name = '澤澤' OR nickname = '澤澤' LIMIT 1;

-- 42. Jessica甯甯 (格位 42)
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-11-19', '入會', '置板開始' FROM members WHERE name = 'Jessica甯甯' OR nickname = 'Jessica甯甯' OR name = '甯甯' OR nickname = '甯甯' LIMIT 1;

-- 完成後顯示匯入統計
SELECT 
  '匯入完成' as status,
  COUNT(*) as total_notes,
  COUNT(DISTINCT member_id) as total_members
FROM member_notes
WHERE created_at >= NOW() - INTERVAL '5 minutes';

