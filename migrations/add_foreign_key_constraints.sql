-- 添加外鍵約束，防止未來出現髒資料
-- 注意：執行前必須先清理現有的無效資料

-- 1. 為 booking_coaches 添加外鍵約束
-- 如果 coach 被刪除，自動刪除相關的 booking_coaches 記錄
ALTER TABLE booking_coaches
ADD CONSTRAINT fk_booking_coaches_coach
FOREIGN KEY (coach_id)
REFERENCES coaches(id)
ON DELETE CASCADE;

-- 2. 為 booking_drivers 添加外鍵約束
ALTER TABLE booking_drivers
ADD CONSTRAINT fk_booking_drivers_driver
FOREIGN KEY (driver_id)
REFERENCES coaches(id)
ON DELETE CASCADE;

-- 3. 為 booking_members 添加外鍵約束（如果還沒有的話）
ALTER TABLE booking_members
ADD CONSTRAINT fk_booking_members_member
FOREIGN KEY (member_id)
REFERENCES members(id)
ON DELETE CASCADE;

-- 4. 為 bookings 添加外鍵約束
ALTER TABLE bookings
ADD CONSTRAINT fk_bookings_boat
FOREIGN KEY (boat_id)
REFERENCES boats(id)
ON DELETE RESTRICT; -- 不允許刪除有預約的船隻

