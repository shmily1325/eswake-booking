-- 新增會員 Hans 和 Alvin

-- ========== Hans ==========
-- 會籍開始：2025-10-06，到期：2026-10-06，無置板

INSERT INTO members (
  name,
  nickname,
  membership_type,
  membership_start_date,
  membership_end_date,
  balance,
  designated_lesson_minutes,
  boat_voucher_g23_minutes,
  boat_voucher_g21_minutes,
  free_hours,
  free_hours_used,
  status
) VALUES (
  'Hans',
  'Hans',
  'general',
  '2025-10-06',
  '2026-10-06',
  0, 0, 0, 0, 0, 0,
  'active'
);

-- Hans 備忘錄
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-06', '入會', '入會'
FROM members WHERE name = 'Hans';

-- ========== Alvin ==========
-- 會籍開始：2025-07-26，到期：2026-07-26
-- 生日：1959-09-26，電話：0936905155
-- 置板 #16，開始：2025-10-01，到期：2026-10-01

INSERT INTO members (
  name,
  nickname,
  birthday,
  phone,
  membership_type,
  membership_start_date,
  membership_end_date,
  balance,
  designated_lesson_minutes,
  boat_voucher_g23_minutes,
  boat_voucher_g21_minutes,
  free_hours,
  free_hours_used,
  status
) VALUES (
  'Alvin',
  'Alvin',
  '1959-09-26',
  '0936905155',
  'general',
  '2025-07-26',
  '2026-07-26',
  0, 0, 0, 0, 0, 0,
  'active'
);

-- Alvin 備忘錄：入會
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-07-26', '入會', '入會'
FROM members WHERE name = 'Alvin';

-- Alvin 備忘錄：置板開始
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-10-01', '置板開始', '置板開始'
FROM members WHERE name = 'Alvin';

-- Alvin 置板 #16
INSERT INTO board_storage (member_id, slot_number, start_date, expires_at, status)
SELECT id, 16, '2025-10-01', '2026-10-01', 'active'
FROM members WHERE name = 'Alvin';

