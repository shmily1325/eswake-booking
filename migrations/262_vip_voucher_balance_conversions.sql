-- =============================================================================
-- 262_vip_voucher_balance_conversions.sql
--
-- 年度 VIP 票券與儲值等值轉換：
-- - VIP $1 = 儲值 $1
-- - 指定 credit_lots 年份，不走 FIFO
-- - VIP 與儲值交易永遠原子新增／修改／取消
-- =============================================================================

BEGIN;

CREATE TABLE public.vip_voucher_balance_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key UUID NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  voucher_year INTEGER NOT NULL CHECK (voucher_year BETWEEN 2020 AND 2100),
  direction TEXT NOT NULL CHECK (
    direction IN ('vip_to_balance', 'balance_to_vip')
  ),
  amount NUMERIC(12, 2) NOT NULL CHECK (
    amount > 0 AND trunc(amount) = amount
  ),
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vip_voucher_balance_conversions_member
  ON public.vip_voucher_balance_conversions(member_id, transaction_date DESC);

ALTER TABLE public.transactions
  ADD COLUMN vip_balance_conversion_id UUID
  REFERENCES public.vip_voucher_balance_conversions(id) ON DELETE RESTRICT;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_single_balance_conversion
  CHECK (num_nonnulls(balance_conversion_id, vip_balance_conversion_id) <= 1);

CREATE INDEX idx_transactions_vip_balance_conversion
  ON public.transactions(vip_balance_conversion_id)
  WHERE vip_balance_conversion_id IS NOT NULL;

CREATE UNIQUE INDEX uq_transactions_vip_balance_conversion_category
  ON public.transactions(vip_balance_conversion_id, category)
  WHERE vip_balance_conversion_id IS NOT NULL;

COMMENT ON COLUMN public.transactions.vip_balance_conversion_id IS
  'VIP 票券與儲值轉換群組；同群組固定包含 VIP 與儲值兩筆交易。';

ALTER TABLE public.vip_voucher_balance_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_voucher_balance_conversions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vip_voucher_balance_conversions
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.vip_voucher_balance_conversions TO service_role;

CREATE OR REPLACE FUNCTION public.protect_balance_conversion_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.balance_conversion_write', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT'
       AND (NEW.balance_conversion_id IS NOT NULL
         OR NEW.vip_balance_conversion_id IS NOT NULL) THEN
      RAISE EXCEPTION '轉換交易只能由專用功能建立';
    ELSIF TG_OP = 'UPDATE'
       AND (OLD.balance_conversion_id IS NOT NULL
         OR NEW.balance_conversion_id IS NOT NULL
         OR OLD.vip_balance_conversion_id IS NOT NULL
         OR NEW.vip_balance_conversion_id IS NOT NULL) THEN
      RAISE EXCEPTION '轉換交易請從轉換明細整組修改或取消';
    ELSIF TG_OP = 'DELETE'
       AND (OLD.balance_conversion_id IS NOT NULL
         OR OLD.vip_balance_conversion_id IS NOT NULL) THEN
      RAISE EXCEPTION '轉換交易請從轉換明細整組修改或取消';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_vip_voucher_balance_conversion(
  p_request_key UUID,
  p_member_id UUID,
  p_voucher_year INTEGER,
  p_amount NUMERIC,
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
  v_lot_remaining NUMERIC;
  v_direction TEXT;
  v_vip_delta NUMERIC;
  v_balance_delta NUMERIC;
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
  FROM public.vip_voucher_balance_conversions
  WHERE request_key = p_request_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'conversion_id', v_existing, 'duplicate', true
    );
  END IF;

  IF p_voucher_year IS NULL
     OR p_voucher_year NOT BETWEEN 2020 AND 2100
     OR p_amount IS NULL
     OR p_amount <= 0
     OR trunc(p_amount) <> p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', '轉換資料無效');
  END IF;

  PERFORM 1 FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  PERFORM 1
  FROM public.credit_lots
  WHERE member_id = p_member_id AND category = 'vip_voucher'
  FOR UPDATE;

  IF NOT public.credit_lots_are_consistent(p_member_id, 'vip_voucher') THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '會員 VIP 總額與年度餘額不一致，尚未轉換'
    );
  END IF;

  SELECT remaining INTO v_lot_remaining
  FROM public.credit_lots
  WHERE member_id = p_member_id
    AND category = 'vip_voucher'
    AND voucher_year = p_voucher_year
  FOR UPDATE;
  IF NOT FOUND OR v_lot_remaining = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '此年度沒有可轉換的 VIP 票券');
  END IF;
  IF p_amount > abs(v_lot_remaining) THEN
    RETURN jsonb_build_object('success', false, 'error', '轉換金額超過此年度餘額');
  END IF;

  v_direction := CASE
    WHEN v_lot_remaining > 0 THEN 'vip_to_balance'
    ELSE 'balance_to_vip'
  END;
  v_vip_delta := CASE
    WHEN v_direction = 'vip_to_balance' THEN -p_amount ELSE p_amount
  END;
  v_balance_delta := -v_vip_delta;

  INSERT INTO public.vip_voucher_balance_conversions(
    request_key, member_id, voucher_year, direction, amount,
    transaction_date, notes, created_by
  ) VALUES (
    p_request_key, p_member_id, p_voucher_year, v_direction, p_amount,
    v_date, nullif(btrim(p_notes), ''), auth.uid()
  )
  RETURNING id INTO v_conversion_id;

  UPDATE public.members
  SET
    vip_voucher_amount = COALESCE(vip_voucher_amount, 0) + v_vip_delta,
    balance = COALESCE(balance, 0) + v_balance_delta
  WHERE id = p_member_id;

  IF NOT public.adjust_credit_lot_remaining(
    p_member_id, 'vip_voucher', p_voucher_year, v_vip_delta
  ) THEN
    RAISE EXCEPTION '無法更新指定年度 VIP 票券';
  END IF;
  IF NOT public.credit_lots_are_consistent(p_member_id, 'vip_voucher') THEN
    RAISE EXCEPTION '轉換後會員 VIP 總額與年度餘額不一致';
  END IF;

  v_description := format(
    '%s %s',
    p_voucher_year,
    CASE WHEN v_direction = 'vip_to_balance'
      THEN 'VIP票券轉儲值' ELSE '儲值補VIP票券' END
  );
  v_allocations := CASE
    WHEN v_direction = 'vip_to_balance' THEN
      jsonb_build_array(jsonb_build_object(
        'voucher_year', p_voucher_year, 'qty', p_amount
      ))
    ELSE NULL
  END;

  PERFORM set_config('app.balance_conversion_write', 'on', true);

  INSERT INTO public.transactions(
    member_id, transaction_type, category, adjust_type, amount,
    description, notes, transaction_date, operator_id, voucher_year,
    lot_allocations, voucher_package_managed, vip_balance_conversion_id,
    balance_after, vip_voucher_amount_after,
    designated_lesson_minutes_after, boat_voucher_g23_minutes_after,
    boat_voucher_g21_panther_minutes_after, gift_boat_hours_after
  )
  SELECT
    p_member_id, 'adjust', 'vip_voucher',
    CASE WHEN v_direction = 'vip_to_balance' THEN 'decrease' ELSE 'increase' END,
    p_amount, v_description, nullif(btrim(p_notes), ''),
    public.as_transaction_date_text(v_date), auth.uid(), p_voucher_year,
    v_allocations, true, v_conversion_id,
    m.balance, m.vip_voucher_amount, m.designated_lesson_minutes,
    m.boat_voucher_g23_minutes, m.boat_voucher_g21_panther_minutes,
    m.gift_boat_hours
  FROM public.members m WHERE m.id = p_member_id;

  INSERT INTO public.transactions(
    member_id, transaction_type, category, adjust_type, amount,
    description, notes, transaction_date, operator_id,
    voucher_package_managed, vip_balance_conversion_id,
    balance_after, vip_voucher_amount_after,
    designated_lesson_minutes_after, boat_voucher_g23_minutes_after,
    boat_voucher_g21_panther_minutes_after, gift_boat_hours_after
  )
  SELECT
    p_member_id, 'adjust', 'balance',
    CASE WHEN v_direction = 'vip_to_balance' THEN 'increase' ELSE 'decrease' END,
    p_amount, v_description, nullif(btrim(p_notes), ''),
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
    FROM public.vip_voucher_balance_conversions
    WHERE request_key = p_request_key;
    RETURN jsonb_build_object(
      'success', true, 'conversion_id', v_existing, 'duplicate', true
    );
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vip_voucher_balance_conversion(
  p_conversion_id UUID,
  p_member_id UUID,
  p_amount NUMERIC,
  p_transaction_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversion public.vip_voucher_balance_conversions%ROWTYPE;
  v_lot_remaining NUMERIC;
  v_amount_delta NUMERIC;
  v_vip_delta NUMERIC;
  v_description TEXT;
  v_allocations JSONB;
  v_tx_count INTEGER;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_amount IS NULL
     OR p_amount <= 0
     OR trunc(p_amount) <> p_amount
     OR p_transaction_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '轉換資料無效');
  END IF;

  SELECT * INTO v_conversion
  FROM public.vip_voucher_balance_conversions
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
  WHERE member_id = p_member_id AND category = 'vip_voucher'
  FOR UPDATE;

  IF NOT public.credit_lots_are_consistent(p_member_id, 'vip_voucher') THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '會員 VIP 總額與年度餘額不一致，尚未修改'
    );
  END IF;

  SELECT remaining INTO v_lot_remaining
  FROM public.credit_lots
  WHERE member_id = p_member_id
    AND category = 'vip_voucher'
    AND voucher_year = v_conversion.voucher_year
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到原轉換年度 VIP 票券';
  END IF;

  v_amount_delta := p_amount - v_conversion.amount;
  IF v_amount_delta > 0
     AND (
       (v_conversion.direction = 'vip_to_balance'
         AND (v_lot_remaining <= 0 OR v_amount_delta > v_lot_remaining))
       OR
       (v_conversion.direction = 'balance_to_vip'
         AND (v_lot_remaining >= 0 OR v_amount_delta > abs(v_lot_remaining)))
     ) THEN
    RAISE EXCEPTION '目前年度餘額不足以增加轉換金額';
  END IF;

  v_vip_delta := CASE
    WHEN v_conversion.direction = 'vip_to_balance'
      THEN -v_amount_delta ELSE v_amount_delta
  END;
  IF v_vip_delta <> 0 THEN
    UPDATE public.members
    SET
      vip_voucher_amount = COALESCE(vip_voucher_amount, 0) + v_vip_delta,
      balance = COALESCE(balance, 0) - v_vip_delta
    WHERE id = p_member_id;
    IF NOT public.adjust_credit_lot_remaining(
      p_member_id, 'vip_voucher', v_conversion.voucher_year, v_vip_delta
    ) THEN
      RAISE EXCEPTION '無法更新指定年度 VIP 票券';
    END IF;
    IF NOT public.credit_lots_are_consistent(p_member_id, 'vip_voucher') THEN
      RAISE EXCEPTION '修改後會員 VIP 總額與年度餘額不一致';
    END IF;
  END IF;

  UPDATE public.vip_voucher_balance_conversions
  SET
    amount = p_amount,
    transaction_date = p_transaction_date,
    notes = nullif(btrim(p_notes), ''),
    updated_at = now()
  WHERE id = p_conversion_id;

  v_description := format(
    '%s %s',
    v_conversion.voucher_year,
    CASE WHEN v_conversion.direction = 'vip_to_balance'
      THEN 'VIP票券轉儲值' ELSE '儲值補VIP票券' END
  );
  v_allocations := CASE
    WHEN v_conversion.direction = 'vip_to_balance' THEN
      jsonb_build_array(jsonb_build_object(
        'voucher_year', v_conversion.voucher_year, 'qty', p_amount
      ))
    ELSE NULL
  END;

  PERFORM set_config('app.balance_conversion_write', 'on', true);

  UPDATE public.transactions t
  SET
    adjust_type = CASE WHEN v_conversion.direction = 'vip_to_balance'
      THEN 'decrease' ELSE 'increase' END,
    amount = p_amount,
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
  WHERE t.vip_balance_conversion_id = p_conversion_id
    AND t.category = 'vip_voucher'
    AND m.id = p_member_id;
  GET DIAGNOSTICS v_tx_count = ROW_COUNT;
  IF v_tx_count <> 1 THEN RAISE EXCEPTION 'VIP 轉換交易不完整'; END IF;

  UPDATE public.transactions t
  SET
    adjust_type = CASE WHEN v_conversion.direction = 'vip_to_balance'
      THEN 'increase' ELSE 'decrease' END,
    amount = p_amount,
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
  WHERE t.vip_balance_conversion_id = p_conversion_id
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

CREATE OR REPLACE FUNCTION public.delete_vip_voucher_balance_conversion(
  p_conversion_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversion public.vip_voucher_balance_conversions%ROWTYPE;
  v_vip_delta NUMERIC;
  v_tx_count INTEGER;
BEGIN
  PERFORM public.assert_membership_admin();

  SELECT * INTO v_conversion
  FROM public.vip_voucher_balance_conversions
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
  WHERE member_id = p_member_id AND category = 'vip_voucher'
  FOR UPDATE;
  IF NOT public.credit_lots_are_consistent(p_member_id, 'vip_voucher') THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '會員 VIP 總額與年度餘額不一致，尚未取消'
    );
  END IF;

  v_vip_delta := CASE
    WHEN v_conversion.direction = 'vip_to_balance'
      THEN v_conversion.amount ELSE -v_conversion.amount
  END;
  UPDATE public.members
  SET
    vip_voucher_amount = COALESCE(vip_voucher_amount, 0) + v_vip_delta,
    balance = COALESCE(balance, 0) - v_vip_delta
  WHERE id = p_member_id;
  IF NOT public.adjust_credit_lot_remaining(
    p_member_id, 'vip_voucher', v_conversion.voucher_year, v_vip_delta
  ) THEN
    RAISE EXCEPTION '無法還原指定年度 VIP 票券';
  END IF;
  IF NOT public.credit_lots_are_consistent(p_member_id, 'vip_voucher') THEN
    RAISE EXCEPTION '取消後會員 VIP 總額與年度餘額不一致';
  END IF;

  PERFORM set_config('app.balance_conversion_write', 'on', true);
  DELETE FROM public.transactions
  WHERE vip_balance_conversion_id = p_conversion_id;
  GET DIAGNOSTICS v_tx_count = ROW_COUNT;
  IF v_tx_count <> 2 THEN RAISE EXCEPTION '轉換交易不完整，尚未取消'; END IF;

  DELETE FROM public.vip_voucher_balance_conversions
  WHERE id = p_conversion_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_vip_voucher_balance_conversions(
  p_member_id UUID
)
RETURNS SETOF public.vip_voucher_balance_conversions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_membership_admin();
  RETURN QUERY
  SELECT c.*
  FROM public.vip_voucher_balance_conversions c
  WHERE c.member_id = p_member_id
  ORDER BY c.transaction_date DESC, c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.create_vip_voucher_balance_conversion(
  UUID, UUID, INTEGER, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_vip_voucher_balance_conversion(
  UUID, UUID, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_vip_voucher_balance_conversion(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_member_vip_voucher_balance_conversions(UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_vip_voucher_balance_conversion(
  UUID, UUID, INTEGER, NUMERIC, DATE, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_vip_voucher_balance_conversion(
  UUID, UUID, NUMERIC, DATE, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_vip_voucher_balance_conversion(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_vip_voucher_balance_conversions(UUID)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
