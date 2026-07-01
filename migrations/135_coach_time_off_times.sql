-- =============================================
-- 教練休假：支援部分時段（上午／下午／自訂時間）
-- start_time / end_time 皆 NULL = 整天（向下相容）
-- =============================================

ALTER TABLE coach_time_off
ADD COLUMN IF NOT EXISTS start_time TEXT,
ADD COLUMN IF NOT EXISTS end_time TEXT;

COMMENT ON COLUMN coach_time_off.start_time IS '開始時間 (HH:mm)，NULL 表示該日 00:00 或整天';
COMMENT ON COLUMN coach_time_off.end_time IS '結束時間 (HH:mm)，NULL 表示該日 24:00 或整天';
