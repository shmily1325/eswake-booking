-- =============================================
-- 交易記錄自動同步會員餘額 Trigger
-- 
-- 功能：當 transactions 表有 INSERT/UPDATE/DELETE 時，
--       自動重新計算會員的各種餘額
-- 
-- 注意：這個 trigger 已經在資料庫中存在
--       此檔案用於記錄和版本控制
-- =============================================

-- 1. 建立重新計算餘額的函數
CREATE OR REPLACE FUNCTION public.recalculate_member_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  target_member_id UUID;
BEGIN
  -- 取得要更新的會員 ID
  IF TG_OP = 'DELETE' THEN
    target_member_id := OLD.member_id;
  ELSE
    target_member_id := NEW.member_id;
  END IF;

  -- 如果是 UPDATE 且 member_id 改變了，也要更新舊的會員
  IF TG_OP = 'UPDATE' AND OLD.member_id != NEW.member_id THEN
    -- 更新舊會員的餘額
    UPDATE members SET
      balance = COALESCE((
        SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(amount) ELSE -ABS(amount) END) 
        FROM transactions WHERE member_id = OLD.member_id AND category = 'balance'
      ), 0),
      vip_voucher_amount = COALESCE((
        SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(amount) ELSE -ABS(amount) END) 
        FROM transactions WHERE member_id = OLD.member_id AND category = 'vip_voucher'
      ), 0),
      designated_lesson_minutes = COALESCE((
        SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(minutes) ELSE -ABS(minutes) END) 
        FROM transactions WHERE member_id = OLD.member_id AND category = 'designated_lesson'
      ), 0),
      boat_voucher_g23_minutes = COALESCE((
        SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(minutes) ELSE -ABS(minutes) END) 
        FROM transactions WHERE member_id = OLD.member_id AND category = 'boat_voucher_g23'
      ), 0),
      boat_voucher_g21_panther_minutes = COALESCE((
        SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(minutes) ELSE -ABS(minutes) END) 
        FROM transactions WHERE member_id = OLD.member_id AND category = 'boat_voucher_g21_panther'
      ), 0),
      gift_boat_hours = COALESCE((
        SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(minutes) ELSE -ABS(minutes) END) 
        FROM transactions WHERE member_id = OLD.member_id AND category = 'gift_boat_hours'
      ), 0)
    WHERE id = OLD.member_id;
  END IF;

  -- 更新目標會員的餘額
  UPDATE members SET
    balance = COALESCE((
      SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(amount) ELSE -ABS(amount) END) 
      FROM transactions WHERE member_id = target_member_id AND category = 'balance'
    ), 0),
    vip_voucher_amount = COALESCE((
      SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(amount) ELSE -ABS(amount) END) 
      FROM transactions WHERE member_id = target_member_id AND category = 'vip_voucher'
    ), 0),
    designated_lesson_minutes = COALESCE((
      SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(minutes) ELSE -ABS(minutes) END) 
      FROM transactions WHERE member_id = target_member_id AND category = 'designated_lesson'
    ), 0),
    boat_voucher_g23_minutes = COALESCE((
      SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(minutes) ELSE -ABS(minutes) END) 
      FROM transactions WHERE member_id = target_member_id AND category = 'boat_voucher_g23'
    ), 0),
    boat_voucher_g21_panther_minutes = COALESCE((
      SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(minutes) ELSE -ABS(minutes) END) 
      FROM transactions WHERE member_id = target_member_id AND category = 'boat_voucher_g21_panther'
    ), 0),
    gift_boat_hours = COALESCE((
      SELECT SUM(CASE WHEN adjust_type = 'increase' THEN ABS(minutes) ELSE -ABS(minutes) END) 
      FROM transactions WHERE member_id = target_member_id AND category = 'gift_boat_hours'
    ), 0)
  WHERE id = target_member_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

COMMENT ON FUNCTION recalculate_member_balance() IS '當交易記錄變動時，自動重新計算會員的所有餘額';

-- 2. 建立 Triggers
DROP TRIGGER IF EXISTS trigger_transaction_insert ON transactions;
CREATE TRIGGER trigger_transaction_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_member_balance();

DROP TRIGGER IF EXISTS trigger_transaction_update ON transactions;
CREATE TRIGGER trigger_transaction_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_member_balance();

DROP TRIGGER IF EXISTS trigger_transaction_delete ON transactions;
CREATE TRIGGER trigger_transaction_delete
  AFTER DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_member_balance();

-- =============================================
-- 說明
-- =============================================
-- 
-- 這個 trigger 確保：
-- 1. 新增交易 → 會員餘額自動更新
-- 2. 修改交易 → 會員餘額自動重算
-- 3. 刪除交易 → 會員餘額自動重算
-- 
-- 計算邏輯：
-- - adjust_type = 'increase' → 金額/分鐘為正
-- - adjust_type = 'decrease' 或其他 → 金額/分鐘為負
-- 
-- 支援的類別：
-- - balance (儲值餘額)
-- - vip_voucher (VIP票券)
-- - designated_lesson (指定課分鐘)
-- - boat_voucher_g23 (G23船票券)
-- - boat_voucher_g21_panther (G21/黑豹船票券)
-- - gift_boat_hours (贈送大船時數)
-- =============================================

