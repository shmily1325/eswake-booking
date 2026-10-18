-- =============================================================================
-- 259_fix_voucher_package_board_note_date.sql
--
-- member_notes.event_date 正式欄位為 DATE。258 誤轉成 TEXT，導致方案置板
-- 套用在寫備註時整筆回滾。僅替換 RPC，不更新任何既有資料。
-- =============================================================================

BEGIN;

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
    public.membership_venue_date(),
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

REVOKE ALL ON FUNCTION public.apply_voucher_package_board_years(
  UUID, UUID, INTEGER, TEXT, INTEGER, INTEGER, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_voucher_package_board_years(
  UUID, UUID, INTEGER, TEXT, INTEGER, INTEGER, TEXT
) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
