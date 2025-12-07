-- 051_import_additional_member_notes.sql
-- 補充會員過去續約紀錄和其他備註

-- 1. 何峻宏 (Carl) - 過去續約紀錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-06-05', '續約', '續約（過去紀錄）' FROM members WHERE name = '何峻宏' OR nickname = '何峻宏' OR nickname = 'Carl' LIMIT 1;

-- 5. 邱俊翔 (Ivan) - 過去續約紀錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-10-10', '續約', '續約（過去紀錄）' FROM members WHERE name = '邱俊翔' OR nickname = '邱俊翔' OR nickname = 'Ivan' LIMIT 1;

-- 7. 楊世雯 (可樂) - 過去續約紀錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-07-29', '續約', '續約（過去紀錄）' FROM members WHERE name = '楊世雯' OR nickname = '楊世雯' OR nickname = '可樂' LIMIT 1;

-- 8. 邱柏瑞 (Ray) - 過去續約紀錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-08-02', '續約', '續約（過去紀錄）' FROM members WHERE name = '邱柏瑞' OR nickname = '邱柏瑞' OR nickname = 'Ray' LIMIT 1;

-- 10. 張沛然 (黑炭) - 過去續約紀錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-09-02', '續約', '續約（過去紀錄）' FROM members WHERE name = '張沛然' OR nickname = '張沛然' OR nickname = '黑炭' LIMIT 1;

-- 12. 王月櫻 (Joanna) - 過去續約紀錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-10-30', '續約', '續會（過去紀錄）' FROM members WHERE name = '王月櫻' OR nickname = '王月櫻' OR nickname = 'Joanna' LIMIT 1;

-- 15. 吳典荳 (Darren) - 過去續約紀錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2022-10-18', '續約', '續約（過去紀錄）' FROM members WHERE name = '吳典荳' OR nickname = '吳典荳' OR nickname = 'Darren' LIMIT 1;

-- 20. 洪瀅淳 (水晶) - 受傷記錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2023-05-21', '備註', '受傷膝蓋病假2個月' FROM members WHERE name = '洪瀅淳' OR nickname = '洪瀅淳' OR nickname = '水晶' LIMIT 1;

-- 完成後顯示匯入統計
SELECT 
  '補充匯入完成' as status,
  COUNT(*) as total_notes
FROM member_notes
WHERE created_at >= NOW() - INTERVAL '5 minutes';

