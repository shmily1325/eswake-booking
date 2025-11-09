-- 創建 booking_drivers 表，支援多個專門駕駛
-- 用於存儲額外指定的專門駕駛（不是教練的人，或特別指定的駕駛）

CREATE TABLE IF NOT EXISTS booking_drivers (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (booking_id, driver_id)
);

COMMENT ON TABLE booking_drivers IS '預約的專門駕駛（可多個）- 如果有值，這些人負責回報船的部分；如果表為空，教練們輪流回報駕駛部分';

CREATE INDEX idx_booking_drivers_booking ON booking_drivers(booking_id);
CREATE INDEX idx_booking_drivers_driver ON booking_drivers(driver_id);

-- 移除舊的 driver_id 欄位（因為現在用 booking_drivers 表）
ALTER TABLE bookings DROP COLUMN IF EXISTS driver_id;

