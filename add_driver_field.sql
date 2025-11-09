-- 新增駕駛欄位到 bookings 表
-- 用於存儲專門指定的駕駛（如果有的話）

ALTER TABLE bookings 
ADD COLUMN driver_id UUID REFERENCES coaches(id);

COMMENT ON COLUMN bookings.driver_id IS '專門指定的駕駛（選填）- 如果有值，駕駛負責回報船的部分；如果為空，每個教練都要回報駕駛部分';

CREATE INDEX idx_bookings_driver ON bookings(driver_id);

