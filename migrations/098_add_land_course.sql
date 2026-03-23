-- 新增陸上課程（可重疊預約，無固定場地設施）
-- 執行日期: 2025-03-23

-- 棕色 #8B7355 (Brown) - 陸地/大地色系
INSERT INTO boats (name, color, is_active) 
VALUES ('陸上課程', '#8B7355', true);

-- 若有歷史預約（理論上初期不會有），設定 cleanup_minutes = 0
UPDATE bookings SET cleanup_minutes = 0
WHERE boat_id IN (SELECT id FROM boats WHERE name = '陸上課程');
