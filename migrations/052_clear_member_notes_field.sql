-- 052_clear_member_notes_field.sql
-- 清除 members 表的 notes 欄位
-- 因為資料已經整理到 member_notes 表了

-- 先查看有多少筆有 notes 的會員
SELECT COUNT(*) as members_with_notes FROM members WHERE notes IS NOT NULL AND notes != '';

-- 清除所有 notes 欄位
UPDATE members SET notes = NULL WHERE notes IS NOT NULL;

-- 確認清除完成
SELECT COUNT(*) as members_with_notes_after FROM members WHERE notes IS NOT NULL AND notes != '';

