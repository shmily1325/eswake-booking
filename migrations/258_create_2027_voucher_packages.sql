-- =============================================================================
-- 258_create_2027_voucher_packages.sql
--
-- 新增 2027 船券方案與權益追蹤。這份 migration：
-- - 不回填、不更新、不刪除任何既有會員、流水、年帳或置板資料
-- - 不取代既有手動記帳 RPC
-- - 所有新方案動作都由獨立 SECURITY DEFINER RPC 原子完成
-- =============================================================================

BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS voucher_package_managed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.transactions.voucher_package_managed IS
  'true 表示此流水由方案 RPC 成組管理，不可從一般交易編輯／刪除。';

CREATE TABLE IF NOT EXISTS public.voucher_package_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key UUID NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  voucher_year INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('boat_voucher_g23', 'boat_voucher_g21_panther')
  ),
  package_hours INTEGER NOT NULL CHECK (package_hours IN (10, 20)),
  book_count INTEGER NOT NULL CHECK (book_count > 0),
  minutes_per_book INTEGER NOT NULL CHECK (minutes_per_book > 0),
  price_per_book NUMERIC(12, 2) NOT NULL CHECK (price_per_book >= 0),
  total_minutes INTEGER NOT NULL CHECK (total_minutes > 0),
  total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
  balance_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (
    balance_deduction >= 0 AND balance_deduction <= total_price
  ),
  board_years_granted INTEGER NOT NULL DEFAULT 0 CHECK (board_years_granted >= 0),
  board_years_applied INTEGER NOT NULL DEFAULT 0 CHECK (
    board_years_applied >= 0 AND board_years_applied <= board_years_granted
  ),
  competition_uses_granted INTEGER NOT NULL DEFAULT 0 CHECK (
    competition_uses_granted >= 0
  ),
  competition_uses_used INTEGER NOT NULL DEFAULT 0 CHECK (
    competition_uses_used >= 0
    AND competition_uses_used <= competition_uses_granted
  ),
  voucher_transaction_id INTEGER REFERENCES public.transactions(id) ON DELETE SET NULL,
  balance_transaction_id INTEGER REFERENCES public.transactions(id) ON DELETE SET NULL,
  voucher_lot_allocations JSONB NOT NULL DEFAULT '[]'::JSONB,
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_package_purchases_year_member
  ON public.voucher_package_purchases(voucher_year, member_id, category);

CREATE TABLE IF NOT EXISTS public.voucher_package_competition_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key UUID NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  voucher_year INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('boat_voucher_g23', 'boat_voucher_g21_panther')
  ),
  books_redeemed INTEGER NOT NULL CHECK (books_redeemed > 0),
  minutes_added INTEGER NOT NULL CHECK (minutes_added > 0),
  note TEXT NOT NULL,
  transaction_id INTEGER REFERENCES public.transactions(id) ON DELETE SET NULL,
  purchase_allocations JSONB NOT NULL DEFAULT '[]'::JSONB,
  voucher_lot_allocations JSONB NOT NULL DEFAULT '[]'::JSONB,
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_package_competition_member
  ON public.voucher_package_competition_redemptions(
    voucher_year, member_id, category, redeemed_at DESC
  );

CREATE TABLE IF NOT EXISTS public.voucher_package_board_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key UUID NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  voucher_year INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('boat_voucher_g23', 'boat_voucher_g21_panther')
  ),
  board_storage_id INTEGER REFERENCES public.board_storage(id) ON DELETE SET NULL,
  slot_number INTEGER NOT NULL,
  years_applied INTEGER NOT NULL CHECK (years_applied > 0),
  old_expires_at DATE NOT NULL,
  new_expires_at DATE NOT NULL,
  purchase_allocations JSONB NOT NULL DEFAULT '[]'::JSONB,
  note TEXT,
  applied_by UUID REFERENCES auth.users(id),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_package_board_member
  ON public.voucher_package_board_applications(
    voucher_year, member_id, category, applied_at DESC
  );

COMMENT ON TABLE public.voucher_package_purchases IS
  '2027 起的新船券方案購買；不回填舊流水。';
COMMENT ON TABLE public.voucher_package_competition_redemptions IS
  '20 小時方案賽事兌換；每本每次加回原船券類別 60 分。';
COMMENT ON TABLE public.voucher_package_board_applications IS
  '20 小時方案贈送置板年數的實際套用紀錄。';

ALTER TABLE public.voucher_package_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_package_purchases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_package_competition_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_package_competition_redemptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_package_board_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_package_board_applications FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.voucher_package_purchases
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.voucher_package_competition_redemptions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.voucher_package_board_applications
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.voucher_package_purchases TO service_role;
GRANT ALL ON TABLE public.voucher_package_competition_redemptions TO service_role;
GRANT ALL ON TABLE public.voucher_package_board_applications TO service_role;

-- 將新入帳先補平任何負年度，剩餘才進指定年。
-- 呼叫端傳入 members 尚未加值前的總額，若年帳不一致就整筆中止。
CREATE OR REPLACE FUNCTION public.apply_voucher_package_credit_lots(
  p_member_id UUID,
  p_category TEXT,
  p_voucher_year INTEGER,
  p_qty NUMERIC,
  p_member_total_before NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_total NUMERIC;
  v_left NUMERIC := p_qty;
  v_lot RECORD;
  v_fill NUMERIC;
  v_alloc_map JSONB := '{}'::JSONB;
  v_allocations JSONB := '[]'::JSONB;
  v_year INTEGER;
  v_year_qty NUMERIC;
BEGIN
  IF p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    RAISE EXCEPTION '方案船券類別無效';
  END IF;
  IF p_voucher_year < 2020 OR p_voucher_year > 2100 OR p_qty <= 0 THEN
    RAISE EXCEPTION '方案年分或分鐘數無效';
  END IF;

  PERFORM 1
  FROM public.credit_lots
  WHERE member_id = p_member_id AND category = p_category
  FOR UPDATE;

  SELECT COUNT(*), COALESCE(SUM(remaining), 0)
  INTO v_count, v_total
  FROM public.credit_lots
  WHERE member_id = p_member_id AND category = p_category;

  IF v_count = 0 AND abs(COALESCE(p_member_total_before, 0)) >= 0.005 THEN
    RAISE EXCEPTION
      '此會員尚未建立年度餘額，且現有船券不為 0；為避免改動舊帳，方案尚未入帳';
  END IF;
  IF v_count > 0 AND abs(v_total - COALESCE(p_member_total_before, 0)) >= 0.005 THEN
    RAISE EXCEPTION '會員總額與年度餘額不一致，方案尚未入帳';
  END IF;

  FOR v_lot IN
    SELECT id, voucher_year, remaining
    FROM public.credit_lots
    WHERE member_id = p_member_id
      AND category = p_category
      AND remaining < 0
    ORDER BY voucher_year ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_fill := LEAST(-v_lot.remaining, v_left);
    UPDATE public.credit_lots
    SET remaining = remaining + v_fill, updated_at = now()
    WHERE id = v_lot.id;
    v_alloc_map := jsonb_set(
      v_alloc_map,
      ARRAY[v_lot.voucher_year::TEXT],
      to_jsonb(COALESCE((v_alloc_map ->> v_lot.voucher_year::TEXT)::NUMERIC, 0) + v_fill)
    );
    v_left := v_left - v_fill;
  END LOOP;

  IF v_left > 0 THEN
    INSERT INTO public.credit_lots(member_id, category, voucher_year, remaining)
    VALUES (p_member_id, p_category, p_voucher_year, v_left)
    ON CONFLICT (member_id, category, voucher_year)
    DO UPDATE SET
      remaining = public.credit_lots.remaining + EXCLUDED.remaining,
      updated_at = now();
    v_alloc_map := jsonb_set(
      v_alloc_map,
      ARRAY[p_voucher_year::TEXT],
      to_jsonb(COALESCE((v_alloc_map ->> p_voucher_year::TEXT)::NUMERIC, 0) + v_left)
    );
  END IF;

  FOR v_year, v_year_qty IN
    SELECT key::INTEGER, value::NUMERIC
    FROM jsonb_each_text(v_alloc_map)
    ORDER BY key::INTEGER
  LOOP
    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object('voucher_year', v_year, 'qty', v_year_qty)
    );
  END LOOP;

  RETURN v_allocations;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_voucher_package_credit_lots(
  p_member_id UUID,
  p_category TEXT,
  p_allocations JSONB
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
BEGIN
  IF jsonb_typeof(COALESCE(p_allocations, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION '方案年度配置格式錯誤';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    UPDATE public.credit_lots
    SET
      remaining = remaining - (v_item ->> 'qty')::NUMERIC,
      updated_at = now()
    WHERE member_id = p_member_id
      AND category = p_category
      AND voucher_year = (v_item ->> 'voucher_year')::INTEGER;
    IF NOT FOUND THEN
      RAISE EXCEPTION '找不到方案原始年度餘額，無法安全還原';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_voucher_package_purchase(
  p_request_key UUID,
  p_member_id UUID,
  p_category TEXT,
  p_package_hours INTEGER,
  p_book_count INTEGER,
  p_balance_deduction NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_transaction_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_purchase_id UUID;
  v_minutes_per_book INTEGER;
  v_price_per_book NUMERIC;
  v_total_minutes INTEGER;
  v_total_price NUMERIC;
  v_board_years INTEGER;
  v_competition_uses INTEGER;
  v_old_voucher_total NUMERIC;
  v_voucher_after NUMERIC;
  v_balance_after NUMERIC;
  v_lot_allocations JSONB;
  v_voucher_tx BIGINT;
  v_balance_tx BIGINT;
  v_description TEXT;
  v_date DATE := COALESCE(p_transaction_date, public.membership_venue_date());
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_request_key IS NULL OR p_book_count IS NULL OR p_book_count <= 0
     OR p_book_count > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', '方案本數無效');
  END IF;
  IF p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther')
     OR p_package_hours NOT IN (10, 20) THEN
    RETURN jsonb_build_object('success', false, 'error', '方案類型無效');
  END IF;

  v_minutes_per_book := p_package_hours * 60;
  v_price_per_book := CASE
    WHEN p_category = 'boat_voucher_g23' AND p_package_hours = 10 THEN 98000
    WHEN p_category = 'boat_voucher_g23' AND p_package_hours = 20 THEN 195000
    WHEN p_category = 'boat_voucher_g21_panther' AND p_package_hours = 10 THEN 58000
    WHEN p_category = 'boat_voucher_g21_panther' AND p_package_hours = 20 THEN 115000
  END;
  v_total_minutes := v_minutes_per_book * p_book_count;
  v_total_price := v_price_per_book * p_book_count;
  v_board_years := CASE WHEN p_package_hours = 20 THEN p_book_count ELSE 0 END;
  v_competition_uses := CASE WHEN p_package_hours = 20 THEN p_book_count * 3 ELSE 0 END;

  IF COALESCE(p_balance_deduction, 0) < 0
     OR COALESCE(p_balance_deduction, 0) > v_total_price THEN
    RETURN jsonb_build_object('success', false, 'error', '扣儲值金額不可超過方案總價');
  END IF;

  SELECT id INTO v_purchase_id
  FROM public.voucher_package_purchases
  WHERE request_key = p_request_key;
  IF v_purchase_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'purchase_id', v_purchase_id, 'duplicate', true
    );
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  INSERT INTO public.voucher_package_purchases(
    request_key, member_id, voucher_year, category, package_hours, book_count,
    minutes_per_book, price_per_book, total_minutes, total_price,
    balance_deduction, board_years_granted, competition_uses_granted,
    transaction_date, notes, created_by
  ) VALUES (
    p_request_key, p_member_id, 2027, p_category, p_package_hours, p_book_count,
    v_minutes_per_book, v_price_per_book, v_total_minutes, v_total_price,
    COALESCE(p_balance_deduction, 0), v_board_years, v_competition_uses,
    v_date, nullif(btrim(p_notes), ''), auth.uid()
  )
  RETURNING id INTO v_purchase_id;

  v_old_voucher_total := CASE p_category
    WHEN 'boat_voucher_g23' THEN COALESCE(v_member.boat_voucher_g23_minutes, 0)
    ELSE COALESCE(v_member.boat_voucher_g21_panther_minutes, 0)
  END;
  v_lot_allocations := public.apply_voucher_package_credit_lots(
    p_member_id, p_category, 2027, v_total_minutes, v_old_voucher_total
  );

  IF p_category = 'boat_voucher_g23' THEN
    UPDATE public.members
    SET boat_voucher_g23_minutes =
      COALESCE(boat_voucher_g23_minutes, 0) + v_total_minutes
    WHERE id = p_member_id
    RETURNING boat_voucher_g23_minutes INTO v_voucher_after;
  ELSE
    UPDATE public.members
    SET boat_voucher_g21_panther_minutes =
      COALESCE(boat_voucher_g21_panther_minutes, 0) + v_total_minutes
    WHERE id = p_member_id
    RETURNING boat_voucher_g21_panther_minutes INTO v_voucher_after;
  END IF;

  v_description := format(
    '2027 %s %s小時方案 × %s本',
    CASE WHEN p_category = 'boat_voucher_g23' THEN 'G23' ELSE 'G21／黑豹' END,
    p_package_hours,
    p_book_count
  );

  INSERT INTO public.transactions(
    member_id, transaction_type, category, adjust_type, minutes,
    description, notes, transaction_date, operator_id, voucher_year,
    lot_allocations, voucher_package_managed,
    balance_after, vip_voucher_amount_after,
    designated_lesson_minutes_after, boat_voucher_g23_minutes_after,
    boat_voucher_g21_panther_minutes_after, gift_boat_hours_after
  )
  SELECT
    p_member_id, 'adjust', p_category, 'increase', v_total_minutes,
    v_description, nullif(btrim(p_notes), ''),
    public.as_transaction_date_text(v_date), auth.uid(), 2027,
    v_lot_allocations, true, m.balance, m.vip_voucher_amount,
    m.designated_lesson_minutes, m.boat_voucher_g23_minutes,
    m.boat_voucher_g21_panther_minutes, m.gift_boat_hours
  FROM public.members m WHERE m.id = p_member_id
  RETURNING id INTO v_voucher_tx;

  IF COALESCE(p_balance_deduction, 0) > 0 THEN
    UPDATE public.members
    SET balance = COALESCE(balance, 0) - p_balance_deduction
    WHERE id = p_member_id
    RETURNING balance INTO v_balance_after;

    INSERT INTO public.transactions(
      member_id, transaction_type, category, adjust_type, amount,
      description, notes, transaction_date, operator_id,
      voucher_package_managed,
      balance_after, vip_voucher_amount_after, designated_lesson_minutes_after,
      boat_voucher_g23_minutes_after, boat_voucher_g21_panther_minutes_after,
      gift_boat_hours_after
    )
    SELECT
      p_member_id, 'adjust', 'balance', 'decrease', p_balance_deduction,
      v_description || '（扣儲值）', nullif(btrim(p_notes), ''),
      public.as_transaction_date_text(v_date), auth.uid(),
      true, m.balance, m.vip_voucher_amount, m.designated_lesson_minutes,
      m.boat_voucher_g23_minutes, m.boat_voucher_g21_panther_minutes,
      m.gift_boat_hours
    FROM public.members m WHERE m.id = p_member_id
    RETURNING id INTO v_balance_tx;
  ELSE
    v_balance_after := COALESCE(v_member.balance, 0);
  END IF;

  UPDATE public.voucher_package_purchases
  SET
    voucher_transaction_id = v_voucher_tx,
    balance_transaction_id = v_balance_tx,
    voucher_lot_allocations = v_lot_allocations
  WHERE id = v_purchase_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'voucher_balance_after', v_voucher_after,
    'balance_after', v_balance_after,
    'board_years_pending', v_board_years,
    'competition_uses', v_competition_uses
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_purchase_id
    FROM public.voucher_package_purchases
    WHERE request_key = p_request_key;
    RETURN jsonb_build_object(
      'success', true, 'purchase_id', v_purchase_id, 'duplicate', true
    );
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_voucher_package_purchase(
  p_purchase_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.voucher_package_purchases%ROWTYPE;
BEGIN
  PERFORM public.assert_membership_admin();

  SELECT * INTO v_purchase
  FROM public.voucher_package_purchases
  WHERE id = p_purchase_id AND member_id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到方案紀錄');
  END IF;

  PERFORM 1 FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  PERFORM public.reverse_voucher_package_credit_lots(
    p_member_id, v_purchase.category, v_purchase.voucher_lot_allocations
  );

  IF v_purchase.category = 'boat_voucher_g23' THEN
    UPDATE public.members
    SET boat_voucher_g23_minutes =
      COALESCE(boat_voucher_g23_minutes, 0) - v_purchase.total_minutes
    WHERE id = p_member_id;
  ELSE
    UPDATE public.members
    SET boat_voucher_g21_panther_minutes =
      COALESCE(boat_voucher_g21_panther_minutes, 0) - v_purchase.total_minutes
    WHERE id = p_member_id;
  END IF;

  IF v_purchase.balance_deduction > 0 THEN
    UPDATE public.members
    SET balance = COALESCE(balance, 0) + v_purchase.balance_deduction
    WHERE id = p_member_id;
  END IF;

  DELETE FROM public.transactions
  WHERE id IN (v_purchase.voucher_transaction_id, v_purchase.balance_transaction_id);
  DELETE FROM public.voucher_package_purchases WHERE id = p_purchase_id;

  RETURN jsonb_build_object(
    'success', true,
    'board_years_already_applied', v_purchase.board_years_applied,
    'competition_uses_already_used', v_purchase.competition_uses_used
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_voucher_package_board_years(
  p_request_key UUID,
  p_member_id UUID,
  p_voucher_year INTEGER,
  p_category TEXT,
  p_board_storage_id INTEGER,
  p_years INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_board public.board_storage%ROWTYPE;
  v_purchase RECORD;
  v_left INTEGER := p_years;
  v_take INTEGER;
  v_allocations JSONB := '[]'::JSONB;
  v_old_expiry DATE;
  v_new_expiry DATE;
  v_application_id UUID;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_request_key IS NULL OR p_years IS NULL OR p_years <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '置板年數無效');
  END IF;
  IF p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    RETURN jsonb_build_object('success', false, 'error', '方案類別無效');
  END IF;

  SELECT id INTO v_existing
  FROM public.voucher_package_board_applications
  WHERE request_key = p_request_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'application_id', v_existing, 'duplicate', true);
  END IF;

  SELECT * INTO v_board
  FROM public.board_storage
  WHERE id = p_board_storage_id
    AND member_id = p_member_id
    AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到此會員的有效置板');
  END IF;
  IF v_board.expires_at IS NULL
     OR v_board.expires_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('success', false, 'error', '置板尚未設定有效到期日');
  END IF;
  v_old_expiry := v_board.expires_at::DATE;

  FOR v_purchase IN
    SELECT id, board_years_granted, board_years_applied
    FROM public.voucher_package_purchases
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
      AND board_years_applied < board_years_granted
    ORDER BY transaction_date, created_at, id
    FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(
      v_left,
      v_purchase.board_years_granted - v_purchase.board_years_applied
    );
    UPDATE public.voucher_package_purchases
    SET board_years_applied = board_years_applied + v_take
    WHERE id = v_purchase.id;
    v_allocations := v_allocations || jsonb_build_array(
      jsonb_build_object('purchase_id', v_purchase.id, 'years', v_take)
    );
    v_left := v_left - v_take;
  END LOOP;

  IF v_left > 0 THEN
    RAISE EXCEPTION '可使用的贈送置板年數不足';
  END IF;

  v_new_expiry := v_old_expiry + make_interval(years => p_years);
  UPDATE public.board_storage
  SET expires_at = v_new_expiry::TEXT
  WHERE id = p_board_storage_id;

  INSERT INTO public.member_notes(member_id, event_date, event_type, description)
  VALUES (
    p_member_id,
    public.membership_venue_date()::TEXT,
    '續約置板',
    format(
      '方案贈送置板 #%s，%s 年（%s → %s）%s',
      v_board.slot_number,
      p_years,
      v_old_expiry,
      v_new_expiry,
      CASE WHEN nullif(btrim(p_note), '') IS NULL
        THEN ''
        ELSE '，' || btrim(p_note)
      END
    )
  );

  INSERT INTO public.voucher_package_board_applications(
    request_key, member_id, voucher_year, category, board_storage_id,
    slot_number, years_applied, old_expires_at, new_expires_at,
    purchase_allocations, note, applied_by
  ) VALUES (
    p_request_key, p_member_id, p_voucher_year, p_category, p_board_storage_id,
    v_board.slot_number, p_years, v_old_expiry, v_new_expiry,
    v_allocations, nullif(btrim(p_note), ''), auth.uid()
  )
  RETURNING id INTO v_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'new_expires_at', v_new_expiry
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.voucher_package_board_applications
    WHERE request_key = p_request_key;
    RETURN jsonb_build_object('success', true, 'application_id', v_existing, 'duplicate', true);
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_voucher_package_competition(
  p_request_key UUID,
  p_member_id UUID,
  p_voucher_year INTEGER,
  p_category TEXT,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_member public.members%ROWTYPE;
  v_purchase RECORD;
  v_take INTEGER;
  v_books INTEGER := 0;
  v_minutes INTEGER;
  v_old_total NUMERIC;
  v_after NUMERIC;
  v_purchase_allocations JSONB := '[]'::JSONB;
  v_lot_allocations JSONB;
  v_transaction_id BIGINT;
  v_redemption_id UUID;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_request_key IS NULL OR nullif(btrim(p_note), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '請輸入賽事備註');
  END IF;
  IF p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    RETURN jsonb_build_object('success', false, 'error', '方案類別無效');
  END IF;

  SELECT id INTO v_existing
  FROM public.voucher_package_competition_redemptions
  WHERE request_key = p_request_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'redemption_id', v_existing, 'duplicate', true);
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  FOR v_purchase IN
    SELECT id, book_count, competition_uses_granted, competition_uses_used
    FROM public.voucher_package_purchases
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
      AND competition_uses_used < competition_uses_granted
    ORDER BY transaction_date, created_at, id
    FOR UPDATE
  LOOP
    v_take := LEAST(
      v_purchase.book_count,
      v_purchase.competition_uses_granted - v_purchase.competition_uses_used
    );
    IF v_take <= 0 THEN CONTINUE; END IF;
    UPDATE public.voucher_package_purchases
    SET competition_uses_used = competition_uses_used + v_take
    WHERE id = v_purchase.id;
    v_purchase_allocations := v_purchase_allocations || jsonb_build_array(
      jsonb_build_object('purchase_id', v_purchase.id, 'uses', v_take)
    );
    v_books := v_books + v_take;
  END LOOP;

  IF v_books <= 0 THEN
    RAISE EXCEPTION '目前沒有可兌換的賽事資格';
  END IF;

  v_minutes := v_books * 60;
  v_old_total := CASE p_category
    WHEN 'boat_voucher_g23' THEN COALESCE(v_member.boat_voucher_g23_minutes, 0)
    ELSE COALESCE(v_member.boat_voucher_g21_panther_minutes, 0)
  END;
  v_lot_allocations := public.apply_voucher_package_credit_lots(
    p_member_id, p_category, p_voucher_year, v_minutes, v_old_total
  );

  IF p_category = 'boat_voucher_g23' THEN
    UPDATE public.members
    SET boat_voucher_g23_minutes =
      COALESCE(boat_voucher_g23_minutes, 0) + v_minutes
    WHERE id = p_member_id
    RETURNING boat_voucher_g23_minutes INTO v_after;
  ELSE
    UPDATE public.members
    SET boat_voucher_g21_panther_minutes =
      COALESCE(boat_voucher_g21_panther_minutes, 0) + v_minutes
    WHERE id = p_member_id
    RETURNING boat_voucher_g21_panther_minutes INTO v_after;
  END IF;

  INSERT INTO public.transactions(
    member_id, transaction_type, category, adjust_type, minutes,
    description, notes, transaction_date, operator_id, voucher_year,
    lot_allocations, voucher_package_managed,
    balance_after, vip_voucher_amount_after,
    designated_lesson_minutes_after, boat_voucher_g23_minutes_after,
    boat_voucher_g21_panther_minutes_after, gift_boat_hours_after
  )
  SELECT
    p_member_id, 'adjust', p_category, 'increase', v_minutes,
    format('%s 賽事兌換 × %s本', p_voucher_year, v_books),
    btrim(p_note),
    public.as_transaction_date_text(public.membership_venue_date()),
    auth.uid(), p_voucher_year, v_lot_allocations, true,
    m.balance, m.vip_voucher_amount, m.designated_lesson_minutes,
    m.boat_voucher_g23_minutes, m.boat_voucher_g21_panther_minutes,
    m.gift_boat_hours
  FROM public.members m WHERE m.id = p_member_id
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.voucher_package_competition_redemptions(
    request_key, member_id, voucher_year, category, books_redeemed,
    minutes_added, note, transaction_id, purchase_allocations,
    voucher_lot_allocations, redeemed_by
  ) VALUES (
    p_request_key, p_member_id, p_voucher_year, p_category, v_books,
    v_minutes, btrim(p_note), v_transaction_id, v_purchase_allocations,
    v_lot_allocations, auth.uid()
  )
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'books_redeemed', v_books,
    'minutes_added', v_minutes,
    'voucher_balance_after', v_after
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.voucher_package_competition_redemptions
    WHERE request_key = p_request_key;
    RETURN jsonb_build_object('success', true, 'redemption_id', v_existing, 'duplicate', true);
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_voucher_package_competition_redemption(
  p_redemption_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption public.voucher_package_competition_redemptions%ROWTYPE;
  v_item JSONB;
BEGIN
  PERFORM public.assert_membership_admin();

  SELECT * INTO v_redemption
  FROM public.voucher_package_competition_redemptions
  WHERE id = p_redemption_id AND member_id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到賽事兌換紀錄');
  END IF;

  PERFORM 1 FROM public.members WHERE id = p_member_id FOR UPDATE;
  PERFORM public.reverse_voucher_package_credit_lots(
    p_member_id, v_redemption.category, v_redemption.voucher_lot_allocations
  );

  IF v_redemption.category = 'boat_voucher_g23' THEN
    UPDATE public.members
    SET boat_voucher_g23_minutes =
      COALESCE(boat_voucher_g23_minutes, 0) - v_redemption.minutes_added
    WHERE id = p_member_id;
  ELSE
    UPDATE public.members
    SET boat_voucher_g21_panther_minutes =
      COALESCE(boat_voucher_g21_panther_minutes, 0) - v_redemption.minutes_added
    WHERE id = p_member_id;
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(v_redemption.purchase_allocations)
  LOOP
    UPDATE public.voucher_package_purchases
    SET competition_uses_used = GREATEST(
      0,
      competition_uses_used - (v_item ->> 'uses')::INTEGER
    )
    WHERE id = (v_item ->> 'purchase_id')::UUID;
  END LOOP;

  DELETE FROM public.transactions WHERE id = v_redemption.transaction_id;
  DELETE FROM public.voucher_package_competition_redemptions
  WHERE id = p_redemption_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_voucher_package_year_overview(
  p_voucher_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  PERFORM public.assert_membership_admin();

  WITH package_keys AS (
    SELECT member_id, category
    FROM public.voucher_package_purchases
    WHERE voucher_year = p_voucher_year
    UNION
    SELECT member_id, category
    FROM public.voucher_package_competition_redemptions
    WHERE voucher_year = p_voucher_year
    UNION
    SELECT member_id, category
    FROM public.voucher_package_board_applications
    WHERE voucher_year = p_voucher_year
  ),
  purchase_totals AS (
    SELECT
      member_id,
      category,
      COALESCE(SUM(book_count) FILTER (WHERE package_hours = 10), 0)::INTEGER AS books_10h,
      COALESCE(SUM(book_count) FILTER (WHERE package_hours = 20), 0)::INTEGER AS books_20h,
      COALESCE(SUM(board_years_granted), 0)::INTEGER AS board_years_granted,
      COALESCE(SUM(board_years_applied), 0)::INTEGER AS board_years_applied,
      COALESCE(SUM(competition_uses_granted), 0)::INTEGER AS competition_uses_granted,
      COALESCE(SUM(competition_uses_used), 0)::INTEGER AS competition_uses_used
    FROM public.voucher_package_purchases
    WHERE voucher_year = p_voucher_year
    GROUP BY member_id, category
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.category, x.display_name), '[]'::JSONB)
  INTO v_rows
  FROM (
    SELECT
      k.member_id,
      k.category,
      COALESCE(m.nickname, m.name, '—') AS display_name,
      m.name,
      COALESCE(t.books_10h, 0) AS books_10h,
      COALESCE(t.books_20h, 0) AS books_20h,
      COALESCE(t.board_years_granted, 0) AS board_years_granted,
      COALESCE(t.board_years_applied, 0) AS board_years_applied,
      COALESCE(t.competition_uses_granted, 0) AS competition_uses_granted,
      COALESCE(t.competition_uses_used, 0) AS competition_uses_used
    FROM package_keys k
    JOIN public.members m ON m.id = k.member_id
    LEFT JOIN purchase_totals t
      ON t.member_id = k.member_id AND t.category = k.category
  ) x;

  RETURN jsonb_build_object('success', true, 'rows', v_rows);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_voucher_package_detail(
  p_member_id UUID,
  p_voucher_year INTEGER,
  p_category TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchases JSONB;
  v_redemptions JSONB;
  v_board_applications JSONB;
  v_boards JSONB;
BEGIN
  PERFORM public.assert_membership_admin();

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.transaction_date DESC, x.created_at DESC), '[]'::JSONB)
  INTO v_purchases
  FROM (
    SELECT
      id, package_hours, book_count, total_minutes, total_price,
      balance_deduction, board_years_granted, board_years_applied,
      competition_uses_granted, competition_uses_used,
      transaction_date, notes, created_at
    FROM public.voucher_package_purchases
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.redeemed_at DESC), '[]'::JSONB)
  INTO v_redemptions
  FROM (
    SELECT id, books_redeemed, minutes_added, note, redeemed_at
    FROM public.voucher_package_competition_redemptions
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.applied_at DESC), '[]'::JSONB)
  INTO v_board_applications
  FROM (
    SELECT
      id, slot_number, years_applied, old_expires_at,
      new_expires_at, note, applied_at
    FROM public.voucher_package_board_applications
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.slot_number), '[]'::JSONB)
  INTO v_boards
  FROM (
    SELECT id, slot_number, expires_at, notes
    FROM public.board_storage
    WHERE member_id = p_member_id AND status = 'active'
  ) x;

  RETURN jsonb_build_object(
    'success', true,
    'purchases', v_purchases,
    'redemptions', v_redemptions,
    'board_applications', v_board_applications,
    'boards', v_boards
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_voucher_package_credit_lots(
  UUID, TEXT, INTEGER, NUMERIC, NUMERIC
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_voucher_package_credit_lots(
  UUID, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_voucher_package_credit_lots(
  UUID, TEXT, INTEGER, NUMERIC, NUMERIC
) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_voucher_package_credit_lots(
  UUID, TEXT, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.create_voucher_package_purchase(
  UUID, UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, DATE
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_voucher_package_purchase(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_voucher_package_board_years(
  UUID, UUID, INTEGER, TEXT, INTEGER, INTEGER, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_voucher_package_competition(
  UUID, UUID, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_voucher_package_competition_redemption(
  UUID, UUID
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_voucher_package_year_overview(INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_member_voucher_package_detail(UUID, INTEGER, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_voucher_package_purchase(
  UUID, UUID, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, DATE
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_voucher_package_purchase(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_voucher_package_board_years(
  UUID, UUID, INTEGER, TEXT, INTEGER, INTEGER, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_package_competition(
  UUID, UUID, INTEGER, TEXT, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_voucher_package_competition_redemption(
  UUID, UUID
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_voucher_package_year_overview(INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_voucher_package_detail(UUID, INTEGER, TEXT)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
