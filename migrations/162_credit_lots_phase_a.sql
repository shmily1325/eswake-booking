-- =============================================================================
-- 162_credit_lots_phase_a.sql
--
-- 階段 A（結構 only）：
-- - 新增 credit_lots（分年剩餘快取，先空表）
-- - transactions.voucher_year（可空，先不回填）
-- - system_settings.current_voucher_year（目前販售年預設 2026）
-- - 唯讀稽核 view：lot 加總 vs members（供之後對帳）
--
-- 本 migration：
-- - 不寫入任何歷史流水年份
-- - 不修改 process_deduction_transaction
-- - 不改 members 餘額
--
-- 回滾（必要時手動執行，見檔案末尾註解）
-- =============================================================================

BEGIN;

-- 1) 交易可標券年（可空 = 尚未標註）
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS voucher_year integer;

COMMENT ON COLUMN public.transactions.voucher_year IS
  '券／VIP 所屬販售年（例如 2025/2026/2027）。可空表示尚未標註。階段 A 不回填歷史。';

CREATE INDEX IF NOT EXISTS idx_transactions_member_category_voucher_year
  ON public.transactions (member_id, category, voucher_year)
  WHERE voucher_year IS NOT NULL;

-- 2) 分年剩餘（快取表；階段 A 不塞資料）
CREATE TABLE IF NOT EXISTS public.credit_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN (
      'vip_voucher',
      'boat_voucher_g23',
      'boat_voucher_g21_panther'
    )
  ),
  voucher_year integer NOT NULL CHECK (
    voucher_year >= 2020 AND voucher_year <= 2100
  ),
  -- 允許負數：與現行 members 允許負餘額一致（例如欠帳）
  remaining numeric(12, 2) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_lots_member_category_year_unique
    UNIQUE (member_id, category, voucher_year)
);

COMMENT ON TABLE public.credit_lots IS
  'VIP／G23／G21黑豹 分年剩餘快取。Σ remaining 必須等於 members 對應欄位；階段 A 先建空表，資料於後續階段乾跑驗證後再寫入。';

CREATE INDEX IF NOT EXISTS idx_credit_lots_member
  ON public.credit_lots (member_id);

CREATE INDEX IF NOT EXISTS idx_credit_lots_member_category_year
  ON public.credit_lots (member_id, category, voucher_year);

ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to credit_lots"
  ON public.credit_lots;
CREATE POLICY "Allow authenticated users full access to credit_lots"
  ON public.credit_lots
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3) 目前販售年（入帳預設用；可手動改成 2027）
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'current_voucher_year',
  '2026',
  '目前販售中的船券／VIP 年份（入帳預設）。年末改賣隔年時更新此值。'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 4) 唯讀稽核：有 lot 的會員，加總是否等於 members
CREATE OR REPLACE VIEW public.credit_lots_balance_audit AS
SELECT
  m.id AS member_id,
  m.nickname,
  m.name,
  c.category,
  CASE c.category
    WHEN 'vip_voucher' THEN COALESCE(m.vip_voucher_amount, 0)::numeric
    WHEN 'boat_voucher_g23' THEN COALESCE(m.boat_voucher_g23_minutes, 0)::numeric
    WHEN 'boat_voucher_g21_panther' THEN COALESCE(m.boat_voucher_g21_panther_minutes, 0)::numeric
  END AS members_total,
  COALESCE(SUM(cl.remaining), 0) AS lots_total,
  CASE c.category
    WHEN 'vip_voucher' THEN COALESCE(m.vip_voucher_amount, 0)::numeric
    WHEN 'boat_voucher_g23' THEN COALESCE(m.boat_voucher_g23_minutes, 0)::numeric
    WHEN 'boat_voucher_g21_panther' THEN COALESCE(m.boat_voucher_g21_panther_minutes, 0)::numeric
  END - COALESCE(SUM(cl.remaining), 0) AS delta_members_minus_lots,
  COUNT(cl.id) AS lot_count
FROM public.members m
CROSS JOIN (
  VALUES
    ('vip_voucher'),
    ('boat_voucher_g23'),
    ('boat_voucher_g21_panther')
) AS c(category)
LEFT JOIN public.credit_lots cl
  ON cl.member_id = m.id
 AND cl.category = c.category
GROUP BY
  m.id,
  m.nickname,
  m.name,
  c.category,
  m.vip_voucher_amount,
  m.boat_voucher_g23_minutes,
  m.boat_voucher_g21_panther_minutes;

COMMENT ON VIEW public.credit_lots_balance_audit IS
  '分年 lot 加總 vs members 對應欄位。階段 B/D 寫入後，delta 必須為 0（僅檢查有 lot 的列）。';

GRANT SELECT ON public.credit_lots_balance_audit TO authenticated;

COMMIT;

-- =============================================================================
-- 回滾（僅在確認要撤銷階段 A 時手動執行；不會動 members／transactions 金額）
-- =============================================================================
-- BEGIN;
-- DROP VIEW IF EXISTS public.credit_lots_balance_audit;
-- DROP TABLE IF EXISTS public.credit_lots;
-- ALTER TABLE public.transactions DROP COLUMN IF EXISTS voucher_year;
-- DELETE FROM public.system_settings WHERE setting_key = 'current_voucher_year';
-- COMMIT;
