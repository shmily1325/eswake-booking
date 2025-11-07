-- 為 booking_participants 表添加必要的字段

ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS duration_min INTEGER,
ADD COLUMN IF NOT EXISTS is_designated BOOLEAN DEFAULT FALSE;

-- 更新註釋
COMMENT ON COLUMN booking_participants.duration_min IS '參與者實際時長（分鐘）';
COMMENT ON COLUMN booking_participants.is_designated IS '是否為指定課';

