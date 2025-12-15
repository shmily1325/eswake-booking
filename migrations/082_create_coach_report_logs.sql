-- 創建教練回報記錄表
-- 用於追蹤每次教練回報操作的詳細信息

CREATE TABLE IF NOT EXISTS coach_report_logs (
  id SERIAL PRIMARY KEY,
  
  -- 回報人資訊
  coach_id UUID NOT NULL REFERENCES coaches(id),
  coach_email TEXT,  -- 登入的 email（方便查詢）
  
  -- 預約資訊
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  booking_start_at TIMESTAMP,  -- 預約時間（冗餘存儲方便查詢）
  contact_name TEXT,  -- 預約人（冗餘存儲）
  boat_name TEXT,  -- 船隻（冗餘存儲）
  
  -- 回報操作類型
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete')),
  
  -- 回報內容摘要
  participants_summary TEXT,  -- 例如：「Josh 40分 票券, Ming 30分 扣儲值」
  driver_duration_min INTEGER,  -- 駕駛時數（如果有）
  
  -- 詳細變更記錄（JSON 格式）
  changes_detail JSONB,  -- 例如：{"participants": [...], "driver_duration": {...}}
  
  -- 時間戳
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_coach_report_logs_coach_id ON coach_report_logs(coach_id);
CREATE INDEX idx_coach_report_logs_booking_id ON coach_report_logs(booking_id);
CREATE INDEX idx_coach_report_logs_created_at ON coach_report_logs(created_at DESC);

-- 註解
COMMENT ON TABLE coach_report_logs IS '教練回報操作記錄，用於追蹤和審計';
COMMENT ON COLUMN coach_report_logs.action_type IS '操作類型：create=新增回報, update=修改回報, delete=刪除回報';
COMMENT ON COLUMN coach_report_logs.participants_summary IS '參與者摘要，方便快速查看';
COMMENT ON COLUMN coach_report_logs.changes_detail IS 'JSON 格式的詳細變更記錄';

