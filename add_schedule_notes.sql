-- 新增排班註解欄位到 bookings 表
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS schedule_notes TEXT;

COMMENT ON COLUMN bookings.schedule_notes IS '排班註解 - 由寶哥在排班時填寫';

