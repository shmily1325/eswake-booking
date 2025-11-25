-- =============================================
-- 為 coaches 表添加指定課價格欄位
-- 用於設定每個教練 30 分鐘指定課的價格
-- =============================================

-- 1. 添加指定課價格欄位（30分鐘）
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS designated_lesson_price_30min INTEGER;

-- 2. 添加註解
COMMENT ON COLUMN coaches.designated_lesson_price_30min IS '指定課價格（30分鐘，單位：元）';

-- 3. 設定預設值（可選，根據需要調整）
-- UPDATE coaches 
-- SET designated_lesson_price_30min = 1000 
-- WHERE designated_lesson_price_30min IS NULL;

-- 注意：
-- - 此欄位為選填，未設定時扣款介面會顯示自訂輸入框
-- - 可在「人員管理」→「指定課價格」tab 中設定
-- - 價格為 30 分鐘的金額，其他時長會自動換算

