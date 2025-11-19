-- 更新船隻顏色
-- 粉紅 -> 深粉色 (#FF69B4 - Hot Pink，更明顯)
-- G23 -> 綠色 (#4CAF50)
-- G21 -> 藍色 (#2196F3)
-- 黑豹 -> 咖啡色 (#8D6E63 或 #795548)
-- 彈簧床 -> 黑色 (#424242 或 #212121)

UPDATE boats SET color = '#FF69B4' WHERE name = '粉紅';
UPDATE boats SET color = '#4CAF50' WHERE name = 'G23';
UPDATE boats SET color = '#2196F3' WHERE name = 'G21';
UPDATE boats SET color = '#795548' WHERE name = '黑豹';
UPDATE boats SET color = '#424242' WHERE name = '彈簧床';

-- 查看更新後的結果
SELECT id, name, color FROM boats ORDER BY 
  CASE name
    WHEN 'G23' THEN 1
    WHEN 'G21' THEN 2
    WHEN '黑豹' THEN 3
    WHEN '粉紅' THEN 4
    WHEN '彈簧床' THEN 5
    ELSE 99
  END;

