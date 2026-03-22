-- 更新 audit_log 的 details，將舊填表人格式統一為新格式
-- 與 migration 096 的對應一致

-- ============================================
-- 步驟 0：預覽（執行後檢查將被修改的筆數）
-- ============================================
-- SELECT COUNT(*) FROM audit_log WHERE details LIKE '%填表人:%' OR details LIKE '%課堂人%';

-- ============================================
-- 步驟 1：預覽受影響的舊值（執行前建議先跑）
-- ============================================
-- SELECT 
--   SUBSTRING(details FROM '\(填表人: ([^)]+)\)') AS 填表人,
--   COUNT(*) 
-- FROM audit_log 
-- WHERE details LIKE '%填表人:%' 
-- GROUP BY 1 ORDER BY 2 DESC;

-- ============================================
-- 步驟 2：備份（可選）
-- ============================================
-- CREATE TABLE audit_log_backup_20250323 AS SELECT * FROM audit_log;

-- ============================================
-- 步驟 3：執行更新（拆成多個 UPDATE 避免語法錯誤）
-- ============================================
BEGIN;

UPDATE audit_log SET details = REPLACE(details, '(填表人: b)', '(填表人: B)') WHERE details LIKE '%(填表人: b)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: k)', '(填表人: Kevin)') WHERE details LIKE '%(填表人: k)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: K)', '(填表人: Kevin)') WHERE details LIKE '%(填表人: K)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: ed)', '(填表人: ED)') WHERE details LIKE '%(填表人: ed)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: Ed)', '(填表人: ED)') WHERE details LIKE '%(填表人: Ed)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: ED)', '(填表人: ED)') WHERE details LIKE '%(填表人: ED)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: E)', '(填表人: ED)') WHERE details LIKE '%(填表人: E)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: cas)', '(填表人: Casper)') WHERE details LIKE '%(填表人: cas)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: Cas)', '(填表人: Casper)') WHERE details LIKE '%(填表人: Cas)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: CAS)', '(填表人: Casper)') WHERE details LIKE '%(填表人: CAS)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: CASPER)', '(填表人: Casper)') WHERE details LIKE '%(填表人: CASPER)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: tin)', '(填表人: Tin)') WHERE details LIKE '%(填表人: tin)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: L)', '(填表人: Lynn)') WHERE details LIKE '%(填表人: L)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: JH)', '(填表人: Jerry)') WHERE details LIKE '%(填表人: JH)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: 蘇賢恩)', '(填表人: Casper)') WHERE details LIKE '%(填表人: 蘇賢恩)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: 木)', '(填表人: 木鳥)') WHERE details LIKE '%(填表人: 木)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: Anita Chen)', '(填表人: Anita)') WHERE details LIKE '%(填表人: Anita Chen)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: 周義揚)', '(填表人: 義揚)') WHERE details LIKE '%(填表人: 周義揚)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: 許)', '(填表人: 許書源)') WHERE details LIKE '%(填表人: 許)%';
UPDATE audit_log SET details = REPLACE(details, '(填表人: 卓致宏)', '(填表人: 木鳥)') WHERE details LIKE '%(填表人: 卓致宏)%';

UPDATE audit_log SET details = REPLACE(details, '[課堂人：b]', '[課堂人：B]') WHERE details LIKE '%[課堂人：b]%';
UPDATE audit_log SET details = REPLACE(details, '[課堂人：k]', '[課堂人：Kevin]') WHERE details LIKE '%[課堂人：k]%';
UPDATE audit_log SET details = REPLACE(details, '[課堂人：L]', '[課堂人：Lynn]') WHERE details LIKE '%[課堂人：L]%';
UPDATE audit_log SET details = REPLACE(details, '[課堂人：JH]', '[課堂人：Jerry]') WHERE details LIKE '%[課堂人：JH]%';
UPDATE audit_log SET details = REPLACE(details, '[課堂人：蘇賢恩]', '[課堂人：Casper]') WHERE details LIKE '%[課堂人：蘇賢恩]%';
UPDATE audit_log SET details = REPLACE(details, '[課堂人：木]', '[課堂人：木鳥]') WHERE details LIKE '%[課堂人：木]%';

COMMIT;

-- ============================================
-- 若結果有問題可執行：ROLLBACK;（需在 COMMIT 前）
-- ============================================
