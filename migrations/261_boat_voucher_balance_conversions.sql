-- =============================================================================
-- 261_boat_voucher_balance_conversions.sql
--
-- 年度船券與儲值的成組換算：
-- - 指定 credit_lots 年份，不走 FIFO
-- - 船券與儲值交易永遠原子新增／修改／取消
-- - 2025 版沿用至 2026；2027 版沿用到下一個生效版本
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.boat_voucher_conversion_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_year INTEGER NOT NULL CHECK (effective_year BETWEEN 2020 AND 2100),
  category TEXT NOT NULL CHECK (
    category IN ('boat_voucher_g23', 'boat_voucher_g21_panther')
  ),
  package_hours INTEGER NOT NULL CHECK (package_hours IN (10, 20)),
  package_minutes INTEGER NOT NULL CHECK (package_minutes > 0),
  package_price NUMERIC(12, 2) NOT NULL CHECK (package_price > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (effective_year, category, package_hours)
);

INSERT INTO public.boat_voucher_conversion_rates(
  effective_year, category, package_hours, package_minutes, package_price
)
VALUES
  (2025, 'boat_voucher_g21_panther', 10, 600, 55000),
  (2025, 'boat_voucher_g21_panther', 20, 1200, 100000),
  (2025, 'boat_voucher_g23', 10, 600, 93000),
  (2025, 'boat_voucher_g23', 20, 1200, 170000),
  (2027, 'boat_voucher_g21_panther', 10, 600, 58000),
  (2027, 'boat_voucher_g21_panther', 20, 1200, 115000),
  (2027, 'boat_voucher_g23', 10, 600, 98000),
  (2027, 'boat_voucher_g23', 20, 1200, 195000)
ON CONFLICT (effective_year, category, package_hours) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.boat_voucher_balance_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key UUID NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('boat_voucher_g23', 'boat_voucher_g21_panther')
  ),
  voucher_year INTEGER NOT NULL CHECK (voucher_year BETWEEN 2020 AND 2100),
  direction TEXT NOT NULL CHECK (
    direction IN ('voucher_to_balance', 'balance_to_voucher')
  ),
  package_hours INTEGER NOT NULL CHECK (package_hours IN (10, 20)),
  rate_effective_year INTEGER NOT NULL CHECK (rate_effective_year BETWEEN 2020 AND 2100),
  package_minutes INTEGER NOT NULL CHECK (package_minutes > 0),
  package_price NUMERIC(12, 2) NOT NULL CHECK (package_price > 0),
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  suggested_amount NUMERIC(12, 2) NOT NULL CHECK (suggested_amount >= 0),
  balance_amount NUMERIC(12, 2) NOT NULL CHECK (balance_amount > 0),
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boat_voucher_balance_conversions_member
  ON public.boat_voucher_balance_conversions(member_id, transaction_date DESC);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS balance_conversion_id UUID
  REFERENCES public.boat_voucher_balance_conversions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_transactions_balance_conversion
  ON public.transactions(balance_conversion_id)
  WHERE balance_conversion_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_balance_conversion_category
  ON public.transactions(balance_conversion_id, category)
  WHERE balance_conversion_id IS NOT NULL;

COMMENT ON COLUMN public.transactions.voucher_package_managed IS
  'true 表示此交易由方案或船券儲值換算 RPC 成組管理，不可從一般交易單獨編輯／刪除。';
COMMENT ON COLUMN public.transactions.balance_conversion_id IS
  '船券儲值換算群組；同群組固定包含船券與儲值兩筆交易。';

ALTER TABLE public.boat_voucher_conversion_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boat_voucher_conversion_rates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.boat_voucher_balance_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boat_voucher_balance_conversions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.boat_voucher_conversion_rates
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.boat_voucher_balance_conversions
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.boat_voucher_conversion_rates TO service_role;
GRANT ALL ON TABLE public.boat_voucher_balance_conversions TO service_role;

CREATE OR REPLACE FUNCTION public.get_boat_voucher_conversion_rate(
  p_voucher_year INTEGER,
  p_category TEXT,
  p_package_hours INTEGER
)
RETURNS TABLE(
  effective_year INTEGER,
  category TEXT,
  package_hours INTEGER,
  package_minutes INTEGER,
  package_price NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_category IS NULL
     OR p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther')
     OR p_package_hours IS NULL
     OR p_package_hours NOT IN (10, 20)
     OR p_voucher_year IS NULL
     OR p_voucher_year NOT BETWEEN 2020 AND 2100 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.effective_year,
    r.category,
    r.package_hours,
    r.package_minutes,
    r.package_price
  FROM public.boat_voucher_conversion_rates r
  WHERE r.category = p_category
    AND r.package_hours = p_package_hours
    AND r.effective_year <= p_voucher_year
  ORDER BY r.effective_year DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_member_for_boat_voucher_conversion(
  p_member_id UUID,
  p_category TEXT,
  p_voucher_delta INTEGER,
  p_balance_delta NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_category = 'boat_voucher_g23' THEN
    UPDATE public.members
    SET
      boat_voucher_g23_minutes =
        (COALESCE(boat_voucher_g23_minutes, 0) + p_voucher_delta)::INTEGER,
      balance = COALESCE(balance, 0) + p_balance_delta
    WHERE id = p_member_id;
  ELSIF p_category = 'boat_voucher_g21_panther' THEN
    UPDATE public.members
    SET
      boat_voucher_g21_panther_minutes =
        (COALESCE(boat_voucher_g21_panther_minutes, 0) + p_voucher_delta)::INTEGER,
      balance = COALESCE(balance, 0) + p_balance_delta
    WHERE id = p_member_id;
  ELSE
    RAISE EXCEPTION '船券類別無效';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_balance_conversion_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.balance_conversion_write', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' AND NEW.balance_conversion_id IS NOT NULL THEN
      RAISE EXCEPTION '船券儲值換算交易只能由專用功能建立';
    ELSIF TG_OP = 'UPDATE'
       AND (OLD.balance_conversion_id IS NOT NULL OR NEW.balance_conversion_id IS NOT NULL) THEN
      RAISE EXCEPTION '船券儲值換算請從轉換明細整組修改或取消';
    ELSIF TG_OP = 'DELETE' AND OLD.balance_conversion_id IS NOT NULL THEN
      RAISE EXCEPTION '船券儲值換算請從轉換明細整組修改或取消';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_balance_conversion_transaction
  ON public.transactions;
CREATE TRIGGER trg_protect_balance_conversion_transaction
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_balance_conversion_transaction();

CREATE OR REPLACE FUNCTION public.create_boat_voucher_balance_conversion(
  p_request_key UUID,
  p_member_id UUID,
  p_category TEXT,
  p_voucher_year INTEGER,
  p_package_hours INTEGER DEFAULT 20,
  p_minutes INTEGER DEFAULT NULL,
  p_balance_amount NUMERIC DEFAULT NULL,
  p_transaction_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_member public.members%ROWTYPE;
  v_lot_remaining NUMERIC;
  v_rate public.boat_voucher_conversion_rates%ROWTYPE;
  v_direction TEXT;
  v_voucher_delta INTEGER;
  v_balance_delta NUMERIC;
  v_suggested NUMERIC;
  v_date DATE := COALESCE(p_transaction_date, public.membership_venue_date());
  v_conversion_id UUID;
  v_description TEXT;
  v_allocations JSONB;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_request_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少防重複識別');
  END IF;

  SELECT id INTO v_existing
  FROM public.boat_voucher_balance_conversions
  WHERE request_key = p_request_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'conversion_id', v_existing, 'duplicate', true
    );
  END IF;

  IF p_category IS NULL
     OR p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther')
     OR p_package_hours IS NULL
     OR p_package_hours NOT IN (10, 20)
     OR p_voucher_year IS NULL
     OR p_voucher_year NOT BETWEEN 2020 AND 2100
     OR p_minutes IS NULL OR p_minutes <= 0
     OR p_balance_amount IS NULL OR p_balance_amount <= 0
     OR trunc(p_balance_amount) <> p_balance_amount THEN
    RETURN jsonb_build_object('success', false, 'error', '換算資料無效');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  PERFORM 1
  FROM public.credit_lots
  WHERE member_id = p_member_id AND category = p_category
  FOR UPDATE;

  IF NOT public.credit_lots_are_consistent(p_member_id, p_category) THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '會員船券總額與年度餘額不一致，尚未換算'
    );
  END IF;

  SELECT remaining INTO v_lot_remaining
  FROM public.credit_lots
  WHERE member_id = p_member_id
    AND category = p_category
    AND voucher_year = p_voucher_year
  FOR UPDATE;
  IF NOT FOUND OR v_lot_remaining = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '此年度沒有可換算的船券');
  END IF;
  IF p_minutes > abs(v_lot_remaining) THEN
    RETURN jsonb_build_object('success', false, 'error', '換算分鐘超過此年度餘額');
  END IF;

  SELECT r.* INTO v_rate
  FROM public.boat_voucher_conversion_rates r
  WHERE r.category = p_category
    AND r.package_hours = p_package_hours
    AND r.effective_year <= p_voucher_year
  ORDER BY r.effective_year DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '此年度尚未設定換算價格');
  END IF;

  v_suggested := floor(p_minutes::NUMERIC * v_rate.package_price / v_rate.package_minutes);
  v_direction := CASE
    WHEN v_lot_remaining > 0 THEN 'voucher_to_balance'
    ELSE 'balance_to_voucher'
  END;
  v_voucher_delta := CASE
    WHEN v_direction = 'voucher_to_balance' THEN -p_minutes ELSE p_minutes
  END;
  v_balance_delta := CASE
    WHEN v_direction = 'voucher_to_balance' THEN p_balance_amount ELSE -p_balance_amount
  END;

  INSERT INTO public.boat_voucher_balance_conversions(
    request_key, member_id, category, voucher_year, direction,
    package_hours, rate_effective_year, package_minutes, package_price,
    minutes, suggested_amount, balance_amount, transaction_date,
    notes, created_by
  ) VALUES (
    p_request_key, p_member_id, p_category, p_voucher_year, v_direction,
    p_package_hours, v_rate.effective_year, v_rate.package_minutes,
    v_rate.package_price, p_minutes, v_suggested, p_balance_amount,
    v_date, nullif(btrim(p_notes), ''), auth.uid()
  )
  RETURNING id INTO v_conversion_id;

  PERFORM public.change_member_for_boat_voucher_conversion(
    p_member_id, p_category, v_voucher_delta, v_balance_delta
  );
  IF NOT public.adjust_credit_lot_remaining(
    p_member_id, p_category, p_voucher_year, v_voucher_delta
  ) THEN
    RAISE EXCEPTION '無法更新指定年度船券';
  END IF;
  IF NOT public.credit_lots_are_consistent(p_member_id, p_category) THEN
    RAISE EXCEPTION '換算後會員船券總額與年度餘額不一致';
  END IF;

  v_description := format(
    '%s %s %s',
    p_voucher_year,
    CASE WHEN p_category = 'boat_voucher_g23' THEN 'G23' ELSE 'G21／黑豹' END,
    CASE WHEN v_direction = 'voucher_to_balance'
      THEN '船券轉儲值' ELSE '儲值補船券' END
  );
  v_allocations := CASE
    WHEN v_direction = 'voucher_to_balance' THEN
      jsonb_build_array(jsonb_build_object(
        'voucher_year', p_voucher_year, 'qty', p_minutes
      ))
    ELSE NULL
  END;

  PERFORM set_config('app.balance_conversion_write', 'on', true);

  INSERT INTO public.transactions(
    member_id, transaction_type, category, adjust_type, minutes,
    description, notes, transaction_date, operator_id, voucher_year,
    lot_allocations, voucher_package_managed, balance_conversion_id,
    balance_after, vip_voucher_amount_after,
    designated_lesson_minutes_after, boat_voucher_g23_minutes_after,
    boat_voucher_g21_panther_minutes_after, gift_boat_hours_after
  )
  SELECT
    p_member_id, 'adjust', p_category,
    CASE WHEN v_direction = 'voucher_to_balance' THEN 'decrease' ELSE 'increase' END,
    p_minutes, v_description, nullif(btrim(p_notes), ''),
    public.as_transaction_date_text(v_date), auth.uid(), p_voucher_year,
    v_allocations, true, v_conversion_id,
    m.balance, m.vip_voucher_amount, m.designated_lesson_minutes,
    m.boat_voucher_g23_minutes, m.boat_voucher_g21_panther_minutes,
    m.gift_boat_hours
  FROM public.members m WHERE m.id = p_member_id;

  INSERT INTO public.transactions(
    member_id, transaction_type, category, adjust_type, amount,
    description, notes, transaction_date, operator_id,
    voucher_package_managed, balance_conversion_id,
    balance_after, vip_voucher_amount_after,
    designated_lesson_minutes_after, boat_voucher_g23_minutes_after,
    boat_voucher_g21_panther_minutes_after, gift_boat_hours_after
  )
  SELECT
    p_member_id, 'adjust', 'balance',
    CASE WHEN v_direction = 'voucher_to_balance' THEN 'increase' ELSE 'decrease' END,
    p_balance_amount, v_description, nullif(btrim(p_notes), ''),
    public.as_transaction_date_text(v_date), auth.uid(),
    true, v_conversion_id,
    m.balance, m.vip_voucher_amount, m.designated_lesson_minutes,
    m.boat_voucher_g23_minutes, m.boat_voucher_g21_panther_minutes,
    m.gift_boat_hours
  FROM public.members m WHERE m.id = p_member_id;

  RETURN jsonb_build_object(
    'success', true,
    'conversion_id', v_conversion_id,
    'direction', v_direction
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.boat_voucher_balance_conversions
    WHERE request_key = p_request_key;
    RETURN jsonb_build_object(
      'success', true, 'conversion_id', v_existing, 'duplicate', true
    );
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_boat_voucher_balance_conversion(
  p_conversion_id UUID,
  p_member_id UUID,
  p_package_hours INTEGER,
  p_minutes INTEGER,
  p_balance_amount NUMERIC,
  p_transaction_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversion public.boat_voucher_balance_conversions%ROWTYPE;
  v_rate public.boat_voucher_conversion_rates%ROWTYPE;
  v_lot_remaining NUMERIC;
  v_old_voucher_delta INTEGER;
  v_old_balance_delta NUMERIC;
  v_new_voucher_delta INTEGER;
  v_new_balance_delta NUMERIC;
  v_suggested NUMERIC;
  v_description TEXT;
  v_allocations JSONB;
  v_tx_count INTEGER;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_package_hours NOT IN (10, 20)
     OR p_minutes IS NULL OR p_minutes <= 0
     OR p_balance_amount IS NULL OR p_balance_amount <= 0
     OR trunc(p_balance_amount) <> p_balance_amount
     OR p_transaction_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '換算資料無效');
  END IF;

  SELECT * INTO v_conversion
  FROM public.boat_voucher_balance_conversions
  WHERE id = p_conversion_id AND member_id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到轉換明細');
  END IF;

  PERFORM 1 FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;
  PERFORM 1
  FROM public.credit_lots
  WHERE member_id = p_member_id AND category = v_conversion.category
  FOR UPDATE;

  IF NOT public.credit_lots_are_consistent(p_member_id, v_conversion.category) THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '會員船券總額與年度餘額不一致，尚未修改'
    );
  END IF;

  v_old_voucher_delta := CASE
    WHEN v_conversion.direction = 'voucher_to_balance'
      THEN v_conversion.minutes ELSE -v_conversion.minutes
  END;
  v_old_balance_delta := CASE
    WHEN v_conversion.direction = 'voucher_to_balance'
      THEN -v_conversion.balance_amount ELSE v_conversion.balance_amount
  END;
  PERFORM public.change_member_for_boat_voucher_conversion(
    p_member_id, v_conversion.category, v_old_voucher_delta, v_old_balance_delta
  );
  IF NOT public.adjust_credit_lot_remaining(
    p_member_id, v_conversion.category, v_conversion.voucher_year,
    v_old_voucher_delta
  ) THEN
    RAISE EXCEPTION '無法還原原轉換年度船券';
  END IF;

  SELECT remaining INTO v_lot_remaining
  FROM public.credit_lots
  WHERE member_id = p_member_id
    AND category = v_conversion.category
    AND voucher_year = v_conversion.voucher_year
  FOR UPDATE;
  IF NOT FOUND
     OR (v_conversion.direction = 'voucher_to_balance' AND v_lot_remaining <= 0)
     OR (v_conversion.direction = 'balance_to_voucher' AND v_lot_remaining >= 0)
     OR p_minutes > abs(v_lot_remaining) THEN
    RAISE EXCEPTION '目前年度餘額不足以套用修改內容';
  END IF;

  IF p_package_hours = v_conversion.package_hours THEN
    v_rate.effective_year := v_conversion.rate_effective_year;
    v_rate.category := v_conversion.category;
    v_rate.package_hours := v_conversion.package_hours;
    v_rate.package_minutes := v_conversion.package_minutes;
    v_rate.package_price := v_conversion.package_price;
  ELSE
    SELECT r.* INTO v_rate
    FROM public.boat_voucher_conversion_rates r
    WHERE r.category = v_conversion.category
      AND r.package_hours = p_package_hours
      AND r.effective_year <= v_conversion.voucher_year
    ORDER BY r.effective_year DESC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION '此年度尚未設定換算價格';
    END IF;
  END IF;

  v_suggested := floor(p_minutes::NUMERIC * v_rate.package_price / v_rate.package_minutes);
  v_new_voucher_delta := CASE
    WHEN v_conversion.direction = 'voucher_to_balance' THEN -p_minutes ELSE p_minutes
  END;
  v_new_balance_delta := CASE
    WHEN v_conversion.direction = 'voucher_to_balance'
      THEN p_balance_amount ELSE -p_balance_amount
  END;
  PERFORM public.change_member_for_boat_voucher_conversion(
    p_member_id, v_conversion.category, v_new_voucher_delta, v_new_balance_delta
  );
  IF NOT public.adjust_credit_lot_remaining(
    p_member_id, v_conversion.category, v_conversion.voucher_year,
    v_new_voucher_delta
  ) THEN
    RAISE EXCEPTION '無法更新指定年度船券';
  END IF;
  IF NOT public.credit_lots_are_consistent(p_member_id, v_conversion.category) THEN
    RAISE EXCEPTION '修改後會員船券總額與年度餘額不一致';
  END IF;

  UPDATE public.boat_voucher_balance_conversions
  SET
    package_hours = p_package_hours,
    rate_effective_year = v_rate.effective_year,
    package_minutes = v_rate.package_minutes,
    package_price = v_rate.package_price,
    minutes = p_minutes,
    suggested_amount = v_suggested,
    balance_amount = p_balance_amount,
    transaction_date = p_transaction_date,
    notes = nullif(btrim(p_notes), ''),
    updated_at = now()
  WHERE id = p_conversion_id;

  v_description := format(
    '%s %s %s',
    v_conversion.voucher_year,
    CASE WHEN v_conversion.category = 'boat_voucher_g23'
      THEN 'G23' ELSE 'G21／黑豹' END,
    CASE WHEN v_conversion.direction = 'voucher_to_balance'
      THEN '船券轉儲值' ELSE '儲值補船券' END
  );
  v_allocations := CASE
    WHEN v_conversion.direction = 'voucher_to_balance' THEN
      jsonb_build_array(jsonb_build_object(
        'voucher_year', v_conversion.voucher_year, 'qty', p_minutes
      ))
    ELSE NULL
  END;

  PERFORM set_config('app.balance_conversion_write', 'on', true);

  UPDATE public.transactions t
  SET
    adjust_type = CASE WHEN v_conversion.direction = 'voucher_to_balance'
      THEN 'decrease' ELSE 'increase' END,
    minutes = p_minutes,
    description = v_description,
    notes = nullif(btrim(p_notes), ''),
    transaction_date = public.as_transaction_date_text(p_transaction_date),
    voucher_year = v_conversion.voucher_year,
    lot_allocations = v_allocations,
    balance_after = m.balance,
    vip_voucher_amount_after = m.vip_voucher_amount,
    designated_lesson_minutes_after = m.designated_lesson_minutes,
    boat_voucher_g23_minutes_after = m.boat_voucher_g23_minutes,
    boat_voucher_g21_panther_minutes_after = m.boat_voucher_g21_panther_minutes,
    gift_boat_hours_after = m.gift_boat_hours
  FROM public.members m
  WHERE t.balance_conversion_id = p_conversion_id
    AND t.category = v_conversion.category
    AND m.id = p_member_id;
  GET DIAGNOSTICS v_tx_count = ROW_COUNT;
  IF v_tx_count <> 1 THEN RAISE EXCEPTION '船券轉換交易不完整'; END IF;

  UPDATE public.transactions t
  SET
    adjust_type = CASE WHEN v_conversion.direction = 'voucher_to_balance'
      THEN 'increase' ELSE 'decrease' END,
    amount = p_balance_amount,
    description = v_description,
    notes = nullif(btrim(p_notes), ''),
    transaction_date = public.as_transaction_date_text(p_transaction_date),
    balance_after = m.balance,
    vip_voucher_amount_after = m.vip_voucher_amount,
    designated_lesson_minutes_after = m.designated_lesson_minutes,
    boat_voucher_g23_minutes_after = m.boat_voucher_g23_minutes,
    boat_voucher_g21_panther_minutes_after = m.boat_voucher_g21_panther_minutes,
    gift_boat_hours_after = m.gift_boat_hours
  FROM public.members m
  WHERE t.balance_conversion_id = p_conversion_id
    AND t.category = 'balance'
    AND m.id = p_member_id;
  GET DIAGNOSTICS v_tx_count = ROW_COUNT;
  IF v_tx_count <> 1 THEN RAISE EXCEPTION '儲值轉換交易不完整'; END IF;

  RETURN jsonb_build_object('success', true, 'conversion_id', p_conversion_id);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_boat_voucher_balance_conversion(
  p_conversion_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversion public.boat_voucher_balance_conversions%ROWTYPE;
  v_voucher_delta INTEGER;
  v_balance_delta NUMERIC;
  v_tx_count INTEGER;
BEGIN
  PERFORM public.assert_membership_admin();

  SELECT * INTO v_conversion
  FROM public.boat_voucher_balance_conversions
  WHERE id = p_conversion_id AND member_id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到轉換明細');
  END IF;

  PERFORM 1 FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;
  PERFORM 1
  FROM public.credit_lots
  WHERE member_id = p_member_id AND category = v_conversion.category
  FOR UPDATE;
  IF NOT public.credit_lots_are_consistent(p_member_id, v_conversion.category) THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '會員船券總額與年度餘額不一致，尚未取消'
    );
  END IF;

  v_voucher_delta := CASE
    WHEN v_conversion.direction = 'voucher_to_balance'
      THEN v_conversion.minutes ELSE -v_conversion.minutes
  END;
  v_balance_delta := CASE
    WHEN v_conversion.direction = 'voucher_to_balance'
      THEN -v_conversion.balance_amount ELSE v_conversion.balance_amount
  END;
  PERFORM public.change_member_for_boat_voucher_conversion(
    p_member_id, v_conversion.category, v_voucher_delta, v_balance_delta
  );
  IF NOT public.adjust_credit_lot_remaining(
    p_member_id, v_conversion.category, v_conversion.voucher_year,
    v_voucher_delta
  ) THEN
    RAISE EXCEPTION '無法還原指定年度船券';
  END IF;
  IF NOT public.credit_lots_are_consistent(p_member_id, v_conversion.category) THEN
    RAISE EXCEPTION '取消後會員船券總額與年度餘額不一致';
  END IF;

  PERFORM set_config('app.balance_conversion_write', 'on', true);
  DELETE FROM public.transactions
  WHERE balance_conversion_id = p_conversion_id;
  GET DIAGNOSTICS v_tx_count = ROW_COUNT;
  IF v_tx_count <> 2 THEN RAISE EXCEPTION '轉換交易不完整，尚未取消'; END IF;

  DELETE FROM public.boat_voucher_balance_conversions
  WHERE id = p_conversion_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_boat_voucher_balance_conversions(
  p_member_id UUID
)
RETURNS SETOF public.boat_voucher_balance_conversions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_membership_admin();
  RETURN QUERY
  SELECT c.*
  FROM public.boat_voucher_balance_conversions c
  WHERE c.member_id = p_member_id
  ORDER BY c.transaction_date DESC, c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_boat_voucher_conversion_rate(INTEGER, TEXT, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_member_for_boat_voucher_conversion(
  UUID, TEXT, INTEGER, NUMERIC
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_balance_conversion_transaction()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_boat_voucher_balance_conversion(
  UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_boat_voucher_balance_conversion(
  UUID, UUID, INTEGER, INTEGER, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_boat_voucher_balance_conversion(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_member_boat_voucher_balance_conversions(UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_boat_voucher_conversion_rate(INTEGER, TEXT, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_boat_voucher_balance_conversion(
  UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, DATE, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_boat_voucher_balance_conversion(
  UUID, UUID, INTEGER, INTEGER, NUMERIC, DATE, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_boat_voucher_balance_conversion(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_boat_voucher_balance_conversions(UUID)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
