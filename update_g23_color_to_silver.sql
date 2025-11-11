-- 更新 G23 船隻顏色為銀灰色
-- 執行日期: 2025-11-11

-- 銀灰色選項：
-- #9E9E9E (Material Design Grey 500)
-- #BDBDBD (Material Design Grey 400 - 較亮)
-- #757575 (Material Design Grey 600 - 較暗)
-- #C0C0C0 (標準銀色)

UPDATE boats SET color = '#9E9E9E' WHERE name = 'G23';

-- 查看更新後的結果
SELECT id, name, color FROM boats WHERE name = 'G23';

