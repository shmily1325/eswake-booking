-- =============================================
-- 新增船隻維修/停用時間欄位
-- =============================================

-- 1. 新增時間欄位
ALTER TABLE boat_unavailable_dates 
ADD COLUMN IF NOT EXISTS start_time TEXT, -- 格式：'HH:mm'，例如 '10:00'
ADD COLUMN IF NOT EXISTS end_time TEXT;   -- 格式：'HH:mm'，例如 '12:00'

COMMENT ON COLUMN boat_unavailable_dates.start_time IS '開始時間 (HH:mm)，若為 NULL 表示該日全天';
COMMENT ON COLUMN boat_unavailable_dates.end_time IS '結束時間 (HH:mm)，若為 NULL 表示該日全天';

-- 2. 更新 is_boat_available 函數以支援時間判斷
-- 注意：這裡的 p_check_time 參數是新增的，為了保持向下相容，我們可以重載函數或修改原函數
-- 由於 Supabase/Postgres 支援函數重載，我們建立一個新的帶時間參數的版本，
-- 或者如果應用程式總是會傳入時間（例如預約時），我們可以直接修改。
-- 
-- 為了最完整的檢查，我們假設輸入是完整的 timestamp (YYYY-MM-DDTHH:mm:ss) 或者分開的日期與時間。
-- 這裡我們採用：檢查特定日期與時間範圍是否可用。
-- 
-- 新增函數：is_boat_available_for_range
-- 檢查船隻在指定的時間範圍內是否可用
-- p_start_datetime: 'YYYY-MM-DDTHH:mm:ss'
-- p_end_datetime: 'YYYY-MM-DDTHH:mm:ss'

CREATE OR REPLACE FUNCTION is_boat_available_range(
  p_boat_id INTEGER, 
  p_start_datetime TEXT, 
  p_end_datetime TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_check_date TEXT;
  v_check_start_time TEXT;
  v_check_end_time TEXT;
BEGIN
  -- 1. 檢查船隻是否啟用
  IF NOT EXISTS (SELECT 1 FROM boats WHERE id = p_boat_id AND is_active = TRUE) THEN
    RETURN FALSE;
  END IF;

  -- 提取日期和時間 (假設輸入格式為 ISO 8601)
  -- 簡單處理：直接字串擷取，假設格式固定為 YYYY-MM-DDTHH:mm:ss
  v_check_date := substring(p_start_datetime from 1 for 10);
  v_check_start_time := substring(p_start_datetime from 12 for 5); -- HH:mm
  v_check_end_time := substring(p_end_datetime from 12 for 5);     -- HH:mm

  -- 2. 檢查是否與任何停用時段重疊
  -- 停用記錄可能跨多天，也可能單日有時間限制
  -- 簡化邏輯：目前系統設計似乎偏向單日或連續多日。
  -- 如果是跨多日 (start_date != end_date)，通常視為全天停用 (時間欄位可能被忽略或需特殊處理)
  -- 如果是單日 (start_date == end_date)，則檢查時間重疊。

  RETURN NOT EXISTS (
    SELECT 1 FROM boat_unavailable_dates
    WHERE boat_id = p_boat_id
      AND is_active = TRUE
      AND (
        -- 情況 A: 停用範圍完全包含檢查日期 (跨多天)
        (start_date < v_check_date AND end_date > v_check_date)
        OR
        -- 情況 B: 停用開始日等於檢查日期
        (start_date = v_check_date AND (
           -- 如果是跨多天，開始日當天從 start_time 到 23:59
           (end_date > v_check_date AND (start_time IS NULL OR start_time <= v_check_end_time))
           OR
           -- 如果是單日
           (end_date = v_check_date AND (
             -- 全天停用
             (start_time IS NULL OR end_time IS NULL)
             OR
             -- 時間重疊：停用時段 [s, e] 與 檢查時段 [cs, ce] 重疊
             -- 重疊條件：max(s, cs) < min(e, ce)
             NOT (end_time <= v_check_start_time OR start_time >= v_check_end_time)
           ))
        ))
        OR
        -- 情況 C: 停用結束日等於檢查日期 (且是跨多天)
        (end_date = v_check_date AND start_date < v_check_date AND (
           -- 結束日當天從 00:00 到 end_time
           (end_time IS NULL OR end_time > v_check_start_time)
        ))
      )
  );
END;
$$ LANGUAGE plpgsql;

-- 註解：原有的 is_boat_available(p_boat_id, p_check_date) 仍保留用於僅檢查日期層級的可用性
-- 但建議後續都改用 is_boat_available_range 以獲得更精確的結果
