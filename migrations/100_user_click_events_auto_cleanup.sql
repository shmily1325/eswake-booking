-- user_click_events 自動清理：超過上限時刪除最舊的紀錄
-- 預設保留最近 50,000 筆，可手動呼叫並傳入不同參數
--
-- 使用方式：
--   1. 手動執行：SELECT cleanup_user_click_events();        -- 使用預設 50000
--   2. 自訂上限：SELECT cleanup_user_click_events(100000);   -- 保留 100000 筆

CREATE OR REPLACE FUNCTION cleanup_user_click_events(keep_count int DEFAULT 50000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total int;
  deleted int;
BEGIN
  SELECT COUNT(*) INTO total FROM user_click_events;
  IF total <= keep_count THEN
    RETURN 0;
  END IF;

  WITH to_delete AS (
    SELECT id
    FROM user_click_events
    ORDER BY id ASC
    LIMIT total - keep_count
  )
  DELETE FROM user_click_events WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_user_click_events IS '刪除超出上限的舊點擊紀錄，預設保留 50000 筆';
