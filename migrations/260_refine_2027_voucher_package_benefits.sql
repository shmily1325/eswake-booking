-- =============================================================================
-- 260_refine_2027_voucher_package_benefits.sql
--
-- 2027 方案權益第二階段：
-- - 20 小時方案每本提供 180 分鐘活動／賽事贈送額度
-- - 活動只使用分鐘額度；賽事同時使用分鐘額度與一次賽事資格
-- - 置板可確認目標 DATE、可安全撤銷，亦可在新增置板時原子套用
--
-- 本 migration 不更新任何會員、流水、年度餘額或既有置板資料。
-- =============================================================================

BEGIN;

ALTER TABLE public.voucher_package_purchases
  ADD COLUMN IF NOT EXISTS benefit_minutes_granted INTEGER
  GENERATED ALWAYS AS (
    CASE WHEN package_hours = 20 THEN book_count * 180 ELSE 0 END
  ) STORED;

ALTER TABLE public.voucher_package_purchases
  ADD COLUMN IF NOT EXISTS benefit_minutes_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.voucher_package_purchases
  DROP CONSTRAINT IF EXISTS voucher_package_purchases_benefit_minutes_used_check;
ALTER TABLE public.voucher_package_purchases
  ADD CONSTRAINT voucher_package_purchases_benefit_minutes_used_check
  CHECK (
    benefit_minutes_used >= 0
    AND benefit_minutes_used <= benefit_minutes_granted
  );

ALTER TABLE public.voucher_package_competition_redemptions
  DROP CONSTRAINT IF EXISTS voucher_package_competition_redemptions_books_redeemed_check;
ALTER TABLE public.voucher_package_competition_redemptions
  DROP CONSTRAINT IF EXISTS voucher_package_benefit_redemptions_uses_check;
ALTER TABLE public.voucher_package_competition_redemptions
  ALTER COLUMN books_redeemed SET DEFAULT 0;
ALTER TABLE public.voucher_package_competition_redemptions
  ADD CONSTRAINT voucher_package_benefit_redemptions_uses_check
  CHECK (books_redeemed >= 0);
ALTER TABLE public.voucher_package_competition_redemptions
  ADD COLUMN IF NOT EXISTS redemption_type TEXT NOT NULL DEFAULT 'competition';
ALTER TABLE public.voucher_package_competition_redemptions
  DROP CONSTRAINT IF EXISTS voucher_package_benefit_redemptions_type_check;
ALTER TABLE public.voucher_package_competition_redemptions
  ADD CONSTRAINT voucher_package_benefit_redemptions_type_check
  CHECK (redemption_type IN ('activity', 'competition'));

COMMENT ON TABLE public.voucher_package_competition_redemptions IS
  '2027 方案活動／賽事贈送紀錄；沿用原表名以維持備份相容性。';
COMMENT ON COLUMN public.voucher_package_competition_redemptions.books_redeemed IS
  '本次使用的賽事資格次數；活動為 0，賽事為 1。';

ALTER TABLE public.voucher_package_board_applications
  ADD COLUMN IF NOT EXISTS application_kind TEXT NOT NULL DEFAULT 'extend';
ALTER TABLE public.voucher_package_board_applications
  DROP CONSTRAINT IF EXISTS voucher_package_board_applications_kind_check;
ALTER TABLE public.voucher_package_board_applications
  ADD CONSTRAINT voucher_package_board_applications_kind_check
  CHECK (application_kind IN ('extend', 'create'));
ALTER TABLE public.voucher_package_board_applications
  ADD COLUMN IF NOT EXISTS member_note_id INTEGER
  REFERENCES public.member_notes(id) ON DELETE SET NULL;
ALTER TABLE public.voucher_package_board_applications
  ADD COLUMN IF NOT EXISTS beneficiary_member_id UUID
  REFERENCES public.members(id) ON DELETE RESTRICT;
ALTER TABLE public.voucher_package_board_applications
  ADD COLUMN IF NOT EXISTS application_order BIGINT
  GENERATED ALWAYS AS IDENTITY;

CREATE OR REPLACE FUNCTION public.protect_package_linked_board_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.voucher_package_board_applications
    WHERE board_storage_id = OLD.id
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION '此置板已使用方案權益，請先到年度方案撤銷';
    END IF;
    IF NEW.member_id IS DISTINCT FROM OLD.member_id THEN
      RAISE EXCEPTION '此置板已使用方案權益，請先撤銷再更換會員';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_package_linked_board_storage
  ON public.board_storage;
CREATE TRIGGER trg_protect_package_linked_board_storage
BEFORE DELETE OR UPDATE OF member_id ON public.board_storage
FOR EACH ROW EXECUTE FUNCTION public.protect_package_linked_board_storage();

CREATE OR REPLACE FUNCTION public.prevent_used_voucher_package_purchase_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.board_years_applied > 0
     OR OLD.benefit_minutes_used > 0
     OR OLD.competition_uses_used > 0 THEN
    RAISE EXCEPTION '此方案已有使用紀錄，請先撤銷置板或刪除活動／賽事贈送';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_used_voucher_package_purchase_delete
  ON public.voucher_package_purchases;
CREATE TRIGGER trg_prevent_used_voucher_package_purchase_delete
BEFORE DELETE ON public.voucher_package_purchases
FOR EACH ROW EXECUTE FUNCTION public.prevent_used_voucher_package_purchase_delete();

CREATE OR REPLACE FUNCTION public.consume_voucher_package_board_year(
  p_member_id UUID,
  p_voucher_year INTEGER,
  p_category TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_purchase RECORD;
BEGIN
  FOR v_purchase IN
    SELECT id
    FROM public.voucher_package_purchases
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
      AND board_years_applied < board_years_granted
    ORDER BY transaction_date, created_at, id
    FOR UPDATE
  LOOP
    UPDATE public.voucher_package_purchases
    SET board_years_applied = board_years_applied + 1
    WHERE id = v_purchase.id;
    RETURN jsonb_build_array(
      jsonb_build_object('purchase_id', v_purchase.id, 'years', 1)
    );
  END LOOP;

  RAISE EXCEPTION '可使用的贈送置板年數不足';
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_voucher_package_board_allocations(
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
    RAISE EXCEPTION '置板權益配置格式錯誤';
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    UPDATE public.voucher_package_purchases
    SET board_years_applied = board_years_applied - (v_item ->> 'years')::INTEGER
    WHERE id = (v_item ->> 'purchase_id')::UUID
      AND board_years_applied >= (v_item ->> 'years')::INTEGER;
    IF NOT FOUND THEN
      RAISE EXCEPTION '找不到原始置板權益，無法安全撤銷';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_voucher_package_benefit(
  p_request_key UUID,
  p_member_id UUID,
  p_voucher_year INTEGER,
  p_category TEXT,
  p_redemption_type TEXT,
  p_minutes INTEGER DEFAULT 60,
  p_note TEXT DEFAULT NULL
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
  v_left INTEGER := p_minutes;
  v_take INTEGER;
  v_competition_purchase_id UUID;
  v_minute_allocations JSONB := '[]'::JSONB;
  v_competition_allocations JSONB := '[]'::JSONB;
  v_purchase_allocations JSONB;
  v_old_total NUMERIC;
  v_after NUMERIC;
  v_lot_allocations JSONB;
  v_transaction_id INTEGER;
  v_redemption_id UUID;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_request_key IS NULL
     OR p_redemption_type NOT IN ('activity', 'competition')
     OR p_minutes IS NULL OR p_minutes <= 0
     OR nullif(btrim(p_note), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '請確認贈送類型、分鐘與備註');
  END IF;
  IF p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    RETURN jsonb_build_object('success', false, 'error', '方案類別無效');
  END IF;

  SELECT id INTO v_existing
  FROM public.voucher_package_competition_redemptions
  WHERE request_key = p_request_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'redemption_id', v_existing, 'duplicate', true
    );
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  FOR v_purchase IN
    SELECT id, benefit_minutes_granted, benefit_minutes_used
    FROM public.voucher_package_purchases
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
      AND benefit_minutes_used < benefit_minutes_granted
    ORDER BY transaction_date, created_at, id
    FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(
      v_left,
      v_purchase.benefit_minutes_granted - v_purchase.benefit_minutes_used
    );
    UPDATE public.voucher_package_purchases
    SET benefit_minutes_used = benefit_minutes_used + v_take
    WHERE id = v_purchase.id;
    v_minute_allocations := v_minute_allocations || jsonb_build_array(
      jsonb_build_object('purchase_id', v_purchase.id, 'minutes', v_take)
    );
    v_left := v_left - v_take;
  END LOOP;

  IF v_left > 0 THEN
    RAISE EXCEPTION '活動／賽事贈送分鐘不足';
  END IF;

  IF p_redemption_type = 'competition' THEN
    SELECT id INTO v_competition_purchase_id
    FROM public.voucher_package_purchases
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
      AND competition_uses_used < competition_uses_granted
    ORDER BY transaction_date, created_at, id
    LIMIT 1
    FOR UPDATE;

    IF v_competition_purchase_id IS NULL THEN
      RAISE EXCEPTION '目前沒有可使用的賽事資格';
    END IF;

    UPDATE public.voucher_package_purchases
    SET competition_uses_used = competition_uses_used + 1
    WHERE id = v_competition_purchase_id;
    v_competition_allocations := jsonb_build_array(
      jsonb_build_object(
        'purchase_id', v_competition_purchase_id,
        'uses', 1
      )
    );
  END IF;

  v_purchase_allocations := jsonb_build_object(
    'minutes', v_minute_allocations,
    'competition_uses', v_competition_allocations
  );

  v_old_total := CASE p_category
    WHEN 'boat_voucher_g23' THEN COALESCE(v_member.boat_voucher_g23_minutes, 0)
    ELSE COALESCE(v_member.boat_voucher_g21_panther_minutes, 0)
  END;
  v_lot_allocations := public.apply_voucher_package_credit_lots(
    p_member_id, p_category, p_voucher_year, p_minutes, v_old_total
  );

  IF p_category = 'boat_voucher_g23' THEN
    UPDATE public.members
    SET boat_voucher_g23_minutes =
      COALESCE(boat_voucher_g23_minutes, 0) + p_minutes
    WHERE id = p_member_id
    RETURNING boat_voucher_g23_minutes INTO v_after;
  ELSE
    UPDATE public.members
    SET boat_voucher_g21_panther_minutes =
      COALESCE(boat_voucher_g21_panther_minutes, 0) + p_minutes
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
    p_member_id, 'adjust', p_category, 'increase', p_minutes,
    format(
      '%s %s贈送',
      p_voucher_year,
      CASE WHEN p_redemption_type = 'activity' THEN '活動' ELSE '賽事' END
    ),
    btrim(p_note),
    public.as_transaction_date_text(public.membership_venue_date()),
    auth.uid(), p_voucher_year, v_lot_allocations, true,
    m.balance, m.vip_voucher_amount, m.designated_lesson_minutes,
    m.boat_voucher_g23_minutes, m.boat_voucher_g21_panther_minutes,
    m.gift_boat_hours
  FROM public.members m WHERE m.id = p_member_id
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.voucher_package_competition_redemptions(
    request_key, member_id, voucher_year, category, redemption_type,
    books_redeemed, minutes_added, note, transaction_id,
    purchase_allocations, voucher_lot_allocations, redeemed_by
  ) VALUES (
    p_request_key, p_member_id, p_voucher_year, p_category, p_redemption_type,
    CASE WHEN p_redemption_type = 'competition' THEN 1 ELSE 0 END,
    p_minutes, btrim(p_note), v_transaction_id,
    v_purchase_allocations, v_lot_allocations, auth.uid()
  )
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'redemption_type', p_redemption_type,
    'minutes_added', p_minutes,
    'competition_uses_consumed',
      CASE WHEN p_redemption_type = 'competition' THEN 1 ELSE 0 END,
    'voucher_balance_after', v_after
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.voucher_package_competition_redemptions
    WHERE request_key = p_request_key;
    RETURN jsonb_build_object(
      'success', true, 'redemption_id', v_existing, 'duplicate', true
    );
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_voucher_package_benefit_redemption(
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
    RETURN jsonb_build_object('success', false, 'error', '找不到活動／賽事贈送紀錄');
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
    SELECT value
    FROM jsonb_array_elements(
      COALESCE(v_redemption.purchase_allocations -> 'minutes', '[]'::JSONB)
    )
  LOOP
    UPDATE public.voucher_package_purchases
    SET benefit_minutes_used =
      benefit_minutes_used - (v_item ->> 'minutes')::INTEGER
    WHERE id = (v_item ->> 'purchase_id')::UUID
      AND benefit_minutes_used >= (v_item ->> 'minutes')::INTEGER;
    IF NOT FOUND THEN
      RAISE EXCEPTION '找不到原始贈送分鐘配置，無法安全刪除';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(
      COALESCE(
        v_redemption.purchase_allocations -> 'competition_uses',
        '[]'::JSONB
      )
    )
  LOOP
    UPDATE public.voucher_package_purchases
    SET competition_uses_used =
      competition_uses_used - (v_item ->> 'uses')::INTEGER
    WHERE id = (v_item ->> 'purchase_id')::UUID
      AND competition_uses_used >= (v_item ->> 'uses')::INTEGER;
    IF NOT FOUND THEN
      RAISE EXCEPTION '找不到原始賽事資格配置，無法安全刪除';
    END IF;
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

CREATE OR REPLACE FUNCTION public.apply_voucher_package_board_benefit(
  p_request_key UUID,
  p_member_id UUID,
  p_voucher_year INTEGER,
  p_category TEXT,
  p_beneficiary_member_id UUID,
  p_board_storage_id INTEGER,
  p_expected_expires_at DATE,
  p_target_expires_at DATE,
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
  v_owner_label TEXT;
  v_old_expiry DATE;
  v_allocations JSONB;
  v_note_id INTEGER;
  v_application_id UUID;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_request_key IS NULL
     OR p_beneficiary_member_id IS NULL
     OR p_expected_expires_at IS NULL
     OR p_target_expires_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '請確認套用後到期日');
  END IF;
  IF p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    RETURN jsonb_build_object('success', false, 'error', '方案類別無效');
  END IF;

  SELECT COALESCE(nickname, name, '會員') INTO v_owner_label
  FROM public.members
  WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到方案持有人');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.members
    WHERE id = p_beneficiary_member_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到有效的置板會員');
  END IF;

  SELECT id INTO v_existing
  FROM public.voucher_package_board_applications
  WHERE request_key = p_request_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'application_id', v_existing, 'duplicate', true
    );
  END IF;

  SELECT * INTO v_board
  FROM public.board_storage
  WHERE id = p_board_storage_id
    AND member_id = p_beneficiary_member_id
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
  IF v_old_expiry <> p_expected_expires_at THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '置板到期日已被修改，請重新確認'
    );
  END IF;
  -- 允許維持原日期：用於老大已先手動調整日期、此處只補登權益的情況。
  IF p_target_expires_at < v_old_expiry THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '套用後到期日不可早於目前到期日'
    );
  END IF;

  v_allocations := public.consume_voucher_package_board_year(
    p_member_id, p_voucher_year, p_category
  );

  UPDATE public.board_storage
  SET expires_at = p_target_expires_at::TEXT
  WHERE id = p_board_storage_id;

  INSERT INTO public.member_notes(member_id, event_date, event_type, description)
  VALUES (
    p_beneficiary_member_id,
    public.membership_venue_date(),
    '續約置板',
    format(
      '由 %s 的 %s %s 方案贈送置板 #%s，使用 1 年權益（%s → %s）%s',
      v_owner_label,
      p_voucher_year,
      CASE WHEN p_category = 'boat_voucher_g23' THEN 'G23' ELSE 'G21／黑豹' END,
      v_board.slot_number,
      v_old_expiry,
      p_target_expires_at,
      CASE WHEN nullif(btrim(p_note), '') IS NULL
        THEN ''
        ELSE '，' || btrim(p_note)
      END
    )
  )
  RETURNING id INTO v_note_id;

  INSERT INTO public.voucher_package_board_applications(
    request_key, member_id, voucher_year, category, board_storage_id,
    slot_number, years_applied, old_expires_at, new_expires_at,
    purchase_allocations, note, applied_by, application_kind, member_note_id,
    beneficiary_member_id
  ) VALUES (
    p_request_key, p_member_id, p_voucher_year, p_category, p_board_storage_id,
    v_board.slot_number, 1, v_old_expiry, p_target_expires_at,
    v_allocations, nullif(btrim(p_note), ''), auth.uid(), 'extend', v_note_id,
    p_beneficiary_member_id
  )
  RETURNING id INTO v_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'new_expires_at', p_target_expires_at
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.voucher_package_board_applications
    WHERE request_key = p_request_key;
    RETURN jsonb_build_object(
      'success', true, 'application_id', v_existing, 'duplicate', true
    );
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_board_with_voucher_package_benefit(
  p_request_key UUID,
  p_member_id UUID,
  p_voucher_year INTEGER,
  p_category TEXT,
  p_beneficiary_member_id UUID,
  p_slot_number INTEGER,
  p_start_date DATE,
  p_target_expires_at DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_board_id INTEGER;
  v_owner_label TEXT;
  v_allocations JSONB;
  v_note_id INTEGER;
  v_application_id UUID;
BEGIN
  PERFORM public.assert_membership_admin();

  IF p_request_key IS NULL
     OR p_beneficiary_member_id IS NULL
     OR p_slot_number IS NULL OR p_slot_number < 1 OR p_slot_number > 145
     OR p_start_date IS NULL OR p_target_expires_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '請確認格位與置板日期');
  END IF;
  IF p_target_expires_at <= p_start_date THEN
    RETURN jsonb_build_object('success', false, 'error', '到期日必須晚於開始日');
  END IF;
  IF p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther') THEN
    RETURN jsonb_build_object('success', false, 'error', '方案類別無效');
  END IF;

  SELECT id INTO v_existing
  FROM public.voucher_package_board_applications
  WHERE request_key = p_request_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'application_id', v_existing, 'duplicate', true
    );
  END IF;

  PERFORM 1
  FROM public.members
  WHERE id IN (p_member_id, p_beneficiary_member_id)
  ORDER BY id
  FOR UPDATE;

  SELECT COALESCE(nickname, name, '會員') INTO v_owner_label
  FROM public.members
  WHERE id = p_member_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1
    FROM public.members
    WHERE id = p_beneficiary_member_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '找不到方案持有人或有效的置板會員'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(2027, p_slot_number);
  IF EXISTS (
    SELECT 1 FROM public.board_storage WHERE slot_number = p_slot_number
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '此格位已被使用');
  END IF;

  v_allocations := public.consume_voucher_package_board_year(
    p_member_id, p_voucher_year, p_category
  );

  INSERT INTO public.board_storage(
    member_id, slot_number, start_date, expires_at, notes, status
  ) VALUES (
    p_beneficiary_member_id, p_slot_number, p_start_date,
    p_target_expires_at::TEXT, nullif(btrim(p_notes), ''), 'active'
  )
  RETURNING id INTO v_board_id;

  INSERT INTO public.member_notes(member_id, event_date, event_type, description)
  VALUES (
    p_beneficiary_member_id,
    p_start_date,
    '續約置板',
    format(
      '由 %s 的 %s %s 方案新增置板 #%s，使用 1 年權益（%s → %s）%s',
      v_owner_label,
      p_voucher_year,
      CASE WHEN p_category = 'boat_voucher_g23' THEN 'G23' ELSE 'G21／黑豹' END,
      p_slot_number,
      p_start_date,
      p_target_expires_at,
      CASE WHEN nullif(btrim(p_notes), '') IS NULL
        THEN ''
        ELSE '，' || btrim(p_notes)
      END
    )
  )
  RETURNING id INTO v_note_id;

  INSERT INTO public.voucher_package_board_applications(
    request_key, member_id, voucher_year, category, board_storage_id,
    slot_number, years_applied, old_expires_at, new_expires_at,
    purchase_allocations, note, applied_by, application_kind, member_note_id,
    beneficiary_member_id
  ) VALUES (
    p_request_key, p_member_id, p_voucher_year, p_category, v_board_id,
    p_slot_number, 1, p_start_date, p_target_expires_at,
    v_allocations, nullif(btrim(p_notes), ''), auth.uid(), 'create', v_note_id,
    p_beneficiary_member_id
  )
  RETURNING id INTO v_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'board_storage_id', v_board_id,
    'new_expires_at', p_target_expires_at
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.voucher_package_board_applications
    WHERE request_key = p_request_key;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true, 'application_id', v_existing, 'duplicate', true
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'error', '此格位已被使用');
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_voucher_package_board_application(
  p_application_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.voucher_package_board_applications%ROWTYPE;
  v_board public.board_storage%ROWTYPE;
BEGIN
  PERFORM public.assert_membership_admin();

  SELECT * INTO v_application
  FROM public.voucher_package_board_applications
  WHERE id = p_application_id AND member_id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到置板套用紀錄');
  END IF;
  IF v_application.board_storage_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '原置板已不存在，無法自動撤銷'
    );
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.voucher_package_board_applications
    WHERE board_storage_id = v_application.board_storage_id
      AND application_order > v_application.application_order
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '此置板後面已有其他方案操作，請先處理最新一筆'
    );
  END IF;

  SELECT * INTO v_board
  FROM public.board_storage
  WHERE id = v_application.board_storage_id
  FOR UPDATE;
  IF NOT FOUND OR v_board.member_id <> v_application.beneficiary_member_id THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '置板已刪除或更換會員，無法自動撤銷'
    );
  END IF;
  IF v_application.application_kind = 'create'
     AND (
       v_board.start_date IS DISTINCT FROM v_application.old_expires_at
       OR v_board.notes IS DISTINCT FROM v_application.note
       OR v_board.status IS DISTINCT FROM 'active'
     ) THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '新建置板資料已有後續修改，無法自動撤銷'
    );
  END IF;
  IF v_board.expires_at IS NULL
     OR v_board.expires_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR v_board.expires_at::DATE <> v_application.new_expires_at THEN
    RETURN jsonb_build_object(
      'success', false, 'error', '置板到期日已有後續修改，無法自動撤銷'
    );
  END IF;

  PERFORM public.restore_voucher_package_board_allocations(
    v_application.purchase_allocations
  );

  IF v_application.member_note_id IS NOT NULL THEN
    DELETE FROM public.member_notes WHERE id = v_application.member_note_id;
  END IF;

  IF v_application.application_kind = 'create' THEN
    DELETE FROM public.voucher_package_board_applications
    WHERE id = p_application_id;
    DELETE FROM public.board_storage
    WHERE id = v_application.board_storage_id;
  ELSE
    UPDATE public.board_storage
    SET expires_at = v_application.old_expires_at::TEXT
    WHERE id = v_application.board_storage_id;
    DELETE FROM public.voucher_package_board_applications
    WHERE id = p_application_id;
  END IF;

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
      COALESCE(SUM(book_count) FILTER (WHERE package_hours = 10), 0)::INTEGER
        AS books_10h,
      COALESCE(SUM(book_count) FILTER (WHERE package_hours = 20), 0)::INTEGER
        AS books_20h,
      COALESCE(SUM(board_years_granted), 0)::INTEGER AS board_years_granted,
      COALESCE(SUM(board_years_applied), 0)::INTEGER AS board_years_applied,
      COALESCE(SUM(benefit_minutes_granted), 0)::INTEGER
        AS benefit_minutes_granted,
      COALESCE(SUM(benefit_minutes_used), 0)::INTEGER AS benefit_minutes_used,
      COALESCE(SUM(competition_uses_granted), 0)::INTEGER
        AS competition_uses_granted,
      COALESCE(SUM(competition_uses_used), 0)::INTEGER
        AS competition_uses_used
    FROM public.voucher_package_purchases
    WHERE voucher_year = p_voucher_year
    GROUP BY member_id, category
  )
  SELECT COALESCE(
    jsonb_agg(to_jsonb(x) ORDER BY x.category, x.display_name),
    '[]'::JSONB
  )
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
      COALESCE(t.benefit_minutes_granted, 0) AS benefit_minutes_granted,
      COALESCE(t.benefit_minutes_used, 0) AS benefit_minutes_used,
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

  SELECT COALESCE(
    jsonb_agg(to_jsonb(x) ORDER BY x.transaction_date DESC, x.created_at DESC),
    '[]'::JSONB
  )
  INTO v_purchases
  FROM (
    SELECT
      id, package_hours, book_count, total_minutes, total_price,
      balance_deduction, board_years_granted, board_years_applied,
      benefit_minutes_granted, benefit_minutes_used,
      competition_uses_granted, competition_uses_used,
      transaction_date, notes, created_at
    FROM public.voucher_package_purchases
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
  ) x;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(x) ORDER BY x.redeemed_at DESC),
    '[]'::JSONB
  )
  INTO v_redemptions
  FROM (
    SELECT
      id, redemption_type,
      books_redeemed AS competition_uses_redeemed,
      minutes_added, note, redeemed_at
    FROM public.voucher_package_competition_redemptions
    WHERE member_id = p_member_id
      AND voucher_year = p_voucher_year
      AND category = p_category
  ) x;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(x) ORDER BY x.application_order DESC),
    '[]'::JSONB
  )
  INTO v_board_applications
  FROM (
    SELECT
      a.id, a.board_storage_id, a.beneficiary_member_id,
      COALESCE(b.nickname, b.name, '—') AS beneficiary_name,
      COALESCE(s.slot_number, a.slot_number) AS slot_number,
      a.years_applied, a.old_expires_at,
      a.new_expires_at, a.application_kind, a.application_order,
      a.note, a.applied_at
    FROM public.voucher_package_board_applications a
    LEFT JOIN public.members b ON b.id = a.beneficiary_member_id
    LEFT JOIN public.board_storage s ON s.id = a.board_storage_id
    WHERE a.member_id = p_member_id
      AND a.voucher_year = p_voucher_year
      AND a.category = p_category
  ) x;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(x) ORDER BY x.slot_number),
    '[]'::JSONB
  )
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

REVOKE ALL ON FUNCTION public.consume_voucher_package_board_year(
  UUID, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_voucher_package_board_allocations(
  JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_package_linked_board_storage()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_used_voucher_package_purchase_delete()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_voucher_package_board_year(
  UUID, INTEGER, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_voucher_package_board_allocations(
  JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.redeem_voucher_package_competition(
  UUID, UUID, INTEGER, TEXT, TEXT
) FROM authenticated;
REVOKE ALL ON FUNCTION public.delete_voucher_package_competition_redemption(
  UUID, UUID
) FROM authenticated;
REVOKE ALL ON FUNCTION public.apply_voucher_package_board_years(
  UUID, UUID, INTEGER, TEXT, INTEGER, INTEGER, TEXT
) FROM authenticated;

REVOKE ALL ON FUNCTION public.redeem_voucher_package_benefit(
  UUID, UUID, INTEGER, TEXT, TEXT, INTEGER, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_voucher_package_benefit_redemption(
  UUID, UUID
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_voucher_package_board_benefit(
  UUID, UUID, INTEGER, TEXT, UUID, INTEGER, DATE, DATE, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_board_with_voucher_package_benefit(
  UUID, UUID, INTEGER, TEXT, UUID, INTEGER, DATE, DATE, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_voucher_package_board_application(
  UUID, UUID
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.redeem_voucher_package_benefit(
  UUID, UUID, INTEGER, TEXT, TEXT, INTEGER, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_voucher_package_benefit_redemption(
  UUID, UUID
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_voucher_package_board_benefit(
  UUID, UUID, INTEGER, TEXT, UUID, INTEGER, DATE, DATE, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_board_with_voucher_package_benefit(
  UUID, UUID, INTEGER, TEXT, UUID, INTEGER, DATE, DATE, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_voucher_package_board_application(
  UUID, UUID
) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
