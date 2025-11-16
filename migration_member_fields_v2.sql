-- =============================================
-- 会员字段升级迁移脚本 V2
-- 
-- 变更内容：
-- 1. 新增 vip_voucher_amount（VIP 票券金额）
-- 2. 新增 gift_boat_hours（赠送大船时数）
-- 3. 重命名 boat_voucher_g21_minutes → boat_voucher_g21_panther_minutes
-- 4. 迁移 free_hours 数据到 gift_boat_hours
-- 5. 移除旧字段 free_hours, free_hours_used, free_hours_notes
-- =============================================

-- 步骤 1: 添加新字段
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS vip_voucher_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gift_boat_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS boat_voucher_g21_panther_minutes INTEGER DEFAULT 0;

-- 步骤 2: 迁移数据
-- 将 free_hours 数据迁移到 gift_boat_hours
UPDATE members 
SET gift_boat_hours = COALESCE(free_hours, 0)
WHERE gift_boat_hours = 0;

-- 将 boat_voucher_g21_minutes 数据迁移到 boat_voucher_g21_panther_minutes
UPDATE members 
SET boat_voucher_g21_panther_minutes = COALESCE(boat_voucher_g21_minutes, 0)
WHERE boat_voucher_g21_panther_minutes = 0;

-- 步骤 3: 移除旧字段（可选，如果确认数据已迁移）
-- 注意：执行前请确保数据已备份！
-- ALTER TABLE members DROP COLUMN IF EXISTS free_hours;
-- ALTER TABLE members DROP COLUMN IF EXISTS free_hours_used;
-- ALTER TABLE members DROP COLUMN IF EXISTS free_hours_notes;
-- ALTER TABLE members DROP COLUMN IF EXISTS boat_voucher_g21_minutes;

-- 步骤 4: 添加注释
COMMENT ON COLUMN members.vip_voucher_amount IS 'VIP 票券金额';
COMMENT ON COLUMN members.gift_boat_hours IS '赠送大船时数（分钟）';
COMMENT ON COLUMN members.boat_voucher_g21_panther_minutes IS 'G21/黑豹共通船券时数（分钟）';

-- 验证迁移结果
SELECT 
  COUNT(*) as total_members,
  SUM(CASE WHEN vip_voucher_amount > 0 THEN 1 ELSE 0 END) as members_with_vip_voucher,
  SUM(CASE WHEN gift_boat_hours > 0 THEN 1 ELSE 0 END) as members_with_gift_hours,
  SUM(CASE WHEN boat_voucher_g21_panther_minutes > 0 THEN 1 ELSE 0 END) as members_with_g21_voucher
FROM members;

-- 查看示例数据
SELECT 
  name, 
  nickname,
  balance,
  vip_voucher_amount,
  designated_lesson_minutes,
  boat_voucher_g23_minutes,
  boat_voucher_g21_panther_minutes,
  gift_boat_hours
FROM members 
LIMIT 5;

