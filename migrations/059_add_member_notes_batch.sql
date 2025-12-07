-- 批次新增會員備忘錄

-- 董彥良：續約 + 傷停
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2025-08-03', '續約', '續約'
FROM members WHERE name = '董彥良';

INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, '2024-10-13', '備註', '傷停1個月（2024/10/13-2025/11/13）'
FROM members WHERE name = '董彥良';

-- 王芳怡：地址
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', '台北市基隆路四段75號'
FROM members WHERE name = '王芳怡';

-- 吳佳瑈：地址
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', '桃園市八德區介壽路二段361巷43弄14號'
FROM members WHERE name = '吳佳瑈';

-- 劉容亘：家庭關係
INSERT INTO member_notes (member_id, event_date, event_type, description)
SELECT id, NULL, '備註', '家庭朋友 Sunny 哥哥（浩哥）妹妹（竹妹）'
FROM members WHERE name = '劉容亘';

