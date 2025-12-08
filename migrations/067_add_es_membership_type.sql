-- 新增 ES 員工會員類型

-- 1. 更新已存在的會員為 ES 類型
UPDATE members SET membership_type = 'es' WHERE nickname = '巨陽尼' OR name = '許書源';
UPDATE members SET membership_type = 'es' WHERE nickname ILIKE 'Sky' OR name = '王奕翔';
UPDATE members SET membership_type = 'es' WHERE nickname = '何靜' OR name LIKE '%何靜%';
UPDATE members SET membership_type = 'es' WHERE nickname = '林昱' OR name = '林昱萱';
UPDATE members SET membership_type = 'es' WHERE nickname ILIKE 'Tin' OR name = '張婷';
UPDATE members SET membership_type = 'es' WHERE nickname ILIKE 'Anita' OR name = '陳羽榛';

-- 2. 新增不存在的 ES 員工
INSERT INTO members (name, nickname, membership_type, status) VALUES
('葉宸瑋', 'ED', 'es', 'active'),
('蘇賢恩', 'Casper', 'es', 'active'),
('蕭竣源', 'Jerry', 'es', 'active'),
('許智凱', '智凱', 'es', 'active'),
('周義揚', '義揚', 'es', 'active'),
('吳昌諭', '阿寶', 'es', 'active'),
('徐廷瑋', '小胖', 'es', 'active'),
('卓致宏', '木鳥', 'es', 'active');

