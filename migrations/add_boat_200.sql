-- 新增船隻 200（石板灰色）
-- 執行日期: 2025-11-22

-- 石板灰色 #708090 (SlateGray)
-- 與 G23 的 #9E9E9E 有明顯區別，帶有一點藍調

INSERT INTO boats (name, color, is_active) 
VALUES ('200', '#708090', true);

-- 查看更新後的所有船隻
SELECT id, name, color, is_active FROM boats ORDER BY id;

