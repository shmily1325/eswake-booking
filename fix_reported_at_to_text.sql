-- ==========================================
-- 修復 booking_participants.reported_at 欄位
-- 從 TIMESTAMPTZ 轉換為 TEXT（與代碼一致）
-- ==========================================

-- ==========================================
-- 步驟 1: 查看現有資料
-- ==========================================
SELECT 
  id,
  booking_id,
  participant_name,
  reported_at,
  pg_typeof(reported_at) as reported_at_type
FROM booking_participants
WHERE reported_at IS NOT NULL
LIMIT 10;

-- ==========================================
-- 步驟 2: 創建新的 TEXT 欄位
-- ==========================================
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS reported_at_text TEXT;

-- ==========================================
-- 步驟 3: 轉換現有資料到本地時間字串
-- ==========================================
-- 將 TIMESTAMPTZ 轉換為台灣本地時間 TEXT 格式
UPDATE booking_participants
SET reported_at_text = TO_CHAR(reported_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD"T"HH24:MI:SS')
WHERE reported_at IS NOT NULL;

-- ==========================================
-- 步驟 4: 刪除舊欄位
-- ==========================================
ALTER TABLE booking_participants
DROP COLUMN reported_at;

-- ==========================================
-- 步驟 5: 重命名新欄位
-- ==========================================
ALTER TABLE booking_participants
RENAME COLUMN reported_at_text TO reported_at;

-- ==========================================
-- 步驟 6: 添加註釋
-- ==========================================
COMMENT ON COLUMN booking_participants.reported_at IS '回報時間（格式：YYYY-MM-DDTHH:mm:ss，本地時間）';

-- ==========================================
-- 步驟 7: 重建索引
-- ==========================================
DROP INDEX IF EXISTS idx_booking_participants_reported_at;
CREATE INDEX IF NOT EXISTS idx_booking_participants_reported_at 
ON booking_participants(reported_at) 
WHERE is_deleted = false;

-- ==========================================
-- 步驟 8: 驗證結果
-- ==========================================
SELECT 
  column_name,
  data_type,
  udt_name,
  column_default
FROM information_schema.columns
WHERE table_name = 'booking_participants' 
  AND column_name = 'reported_at';

SELECT 
  id,
  booking_id,
  participant_name,
  reported_at,
  pg_typeof(reported_at) as reported_at_type
FROM booking_participants
WHERE reported_at IS NOT NULL
LIMIT 10;

-- 完成！
SELECT '✅ reported_at 欄位已成功轉換為 TEXT 格式！' as status;

