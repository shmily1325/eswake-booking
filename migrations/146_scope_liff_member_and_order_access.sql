-- =============================================================================
-- 146_scope_liff_member_and_order_access.sql
--
-- Add token-gateway-only RPCs for LIFF members and shop orders.
--
-- This phase is additive and must be applied before deploying the matching
-- LIFF client. Migration 147 performs the final anonymous access revocation.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.line_bindings
    WHERE status = 'active'
      AND member_id IS NOT NULL
    GROUP BY member_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot harden LIFF bindings: a member has multiple active LINE bindings';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_line_bindings_active_member
  ON public.line_bindings(member_id)
  WHERE status = 'active' AND member_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._liff_member_snapshot(p_member_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'nickname', m.nickname,
    'phone', m.phone,
    'birthday', m.birthday,
    'membership_type', m.membership_type,
    'membership_partner_id', m.membership_partner_id,
    'membership_end_date', m.membership_end_date,
    'board_slot_number', m.board_slot_number,
    'board_expiry_date', m.board_expiry_date,
    'balance', m.balance,
    'vip_voucher_amount', m.vip_voucher_amount,
    'designated_lesson_minutes', m.designated_lesson_minutes,
    'boat_voucher_g23_minutes', m.boat_voucher_g23_minutes,
    'boat_voucher_g21_panther_minutes', m.boat_voucher_g21_panther_minutes,
    'gift_boat_hours', m.gift_boat_hours,
    'board_slots', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', bs.id,
          'slot_number', bs.slot_number,
          'start_date', bs.start_date,
          'expires_at', bs.expires_at
        )
        ORDER BY bs.slot_number
      )
      FROM public.board_storage bs
      WHERE bs.member_id = m.id
        AND bs.status = 'active'
    ), '[]'::jsonb),
    'partner', CASE
      WHEN m.membership_type = 'dual' AND m.membership_partner_id IS NOT NULL
      THEN (
        SELECT jsonb_build_object('name', partner.name, 'nickname', partner.nickname)
        FROM public.members partner
        WHERE partner.id = m.membership_partner_id
      )
      ELSE NULL
    END
  )
  FROM public.members m
  WHERE m.id = p_member_id
$$;

REVOKE ALL ON FUNCTION public._liff_member_snapshot(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_liff_member_profile(
  p_line_user_id TEXT,
  p_record_login BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_member JSONB;
  v_now_text TEXT;
BEGIN
  IF NULLIF(trim(p_line_user_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE 使用者識別');
  END IF;

  SELECT member_id
  INTO v_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'member', NULL);
  END IF;

  IF p_record_login THEN
    v_now_text := to_char(
      CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei',
      'YYYY-MM-DD"T"HH24:MI:SS'
    );
    UPDATE public.line_bindings
    SET last_liff_login_at = v_now_text
    WHERE line_user_id = p_line_user_id
      AND status = 'active';
  END IF;

  v_member := public._liff_member_snapshot(v_member_id);
  IF v_member IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到會員');
  END IF;

  RETURN jsonb_build_object('success', true, 'member', v_member);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', '會員資料服務暫時無法使用');
END;
$$;

REVOKE ALL ON FUNCTION public.get_liff_member_profile(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_liff_member_profile(TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.bind_liff_member(
  p_line_user_id TEXT,
  p_phone TEXT,
  p_birthday DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone TEXT;
  v_match_count INTEGER;
  v_member_id UUID;
  v_member_phone TEXT;
  v_member JSONB;
  v_now_text TEXT;
  v_existing_member_id UUID;
BEGIN
  IF NULLIF(trim(p_line_user_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE 使用者識別');
  END IF;

  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF length(v_clean_phone) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', '手機號碼格式無效');
  END IF;

  IF p_birthday IS NULL OR p_birthday > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', '生日日期無效');
  END IF;

  SELECT count(*)
  INTO v_match_count
  FROM public.members m
  WHERE regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g') = v_clean_phone
    AND m.status = 'active';

  IF v_match_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到此手機號碼的會員資料');
  END IF;
  IF v_match_count > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', '手機號碼對應多筆會員，請聯絡工作人員');
  END IF;

  SELECT m.id, m.phone
  INTO v_member_id, v_member_phone
  FROM public.members m
  WHERE regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g') = v_clean_phone
    AND m.status = 'active'
  LIMIT 1;

  SELECT member_id
  INTO v_existing_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_existing_member_id IS NOT NULL AND v_existing_member_id <> v_member_id THEN
    RETURN jsonb_build_object('success', false, 'error', '此 LINE 帳號已綁定其他會員');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.line_bindings
    WHERE member_id = v_member_id
      AND line_user_id <> p_line_user_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '此會員已綁定其他 LINE 帳號');
  END IF;

  v_now_text := to_char(
    CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei',
    'YYYY-MM-DD"T"HH24:MI:SS'
  );

  INSERT INTO public.line_bindings (
    line_user_id,
    member_id,
    phone,
    status,
    last_liff_login_at,
    completed_at,
    created_at
  ) VALUES (
    p_line_user_id,
    v_member_id,
    v_member_phone,
    'active',
    v_now_text,
    v_now_text,
    v_now_text
  )
  ON CONFLICT (line_user_id) DO UPDATE
  SET
    member_id = EXCLUDED.member_id,
    phone = EXCLUDED.phone,
    status = 'active',
    last_liff_login_at = EXCLUDED.last_liff_login_at,
    completed_at = EXCLUDED.completed_at,
    created_at = COALESCE(line_bindings.created_at, EXCLUDED.created_at);

  UPDATE public.members
  SET birthday = to_char(p_birthday, 'YYYY-MM-DD')
  WHERE id = v_member_id;

  v_member := public._liff_member_snapshot(v_member_id);
  RETURN jsonb_build_object('success', true, 'member', v_member);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', '會員綁定服務暫時無法使用');
END;
$$;

REVOKE ALL ON FUNCTION public.bind_liff_member(TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_liff_member(TEXT, TEXT, DATE) TO service_role;

CREATE OR REPLACE FUNCTION public.get_liff_shop_orders(p_line_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_orders JSONB;
BEGIN
  IF NULLIF(trim(p_line_user_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE 使用者識別');
  END IF;

  SELECT member_id
  INTO v_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到有效的會員綁定');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'order_no', o.order_no,
        'contact_name', o.contact_name,
        'delivery_method', o.delivery_method,
        'shipping_info', o.shipping_info,
        'customer_note', o.customer_note,
        'cancelled_at', o.cancelled_at,
        'created_at', o.created_at,
        'settlements', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('amount_total', s.amount_total)
            ORDER BY s.settled_at
          )
          FROM public.shop_order_settlements s
          WHERE s.order_id = o.id
        ), '[]'::jsonb),
        'items', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', i.id,
              'qty', i.qty,
              'qty_pending_bill', i.qty_pending_bill,
              'qty_paid', i.qty_paid,
              'unit_price', i.unit_price,
              'variant', CASE
                WHEN v.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                  'id', v.id,
                  'vendor_code', v.vendor_code,
                  'attributes', v.attributes,
                  'last_stock_in_at', v.last_stock_in_at,
                  'stock', v.stock,
                  'reserved_qty', v.reserved_qty,
                  'product', CASE
                    WHEN product.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                      'id', product.id,
                      'brand', product.brand,
                      'model', product.model,
                      'category', product.category
                    )
                  END
                )
              END
            )
            ORDER BY i.created_at, i.id
          )
          FROM public.shop_order_items i
          LEFT JOIN public.product_variants v ON v.id = i.variant_id
          LEFT JOIN public.products product ON product.id = v.product_id
          WHERE i.order_id = o.id
        ), '[]'::jsonb)
      )
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_orders
  FROM public.shop_orders o
  WHERE o.member_id = v_member_id
    AND o.cancelled_at IS NULL;

  RETURN jsonb_build_object('success', true, 'orders', v_orders);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', '商品訂單服務暫時無法使用');
END;
$$;

REVOKE ALL ON FUNCTION public.get_liff_shop_orders(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_liff_shop_orders(TEXT) TO service_role;

-- Let the token-verifying API use the existing birthday and transaction RPCs.
-- Their legacy anon grants are removed by migration 147 after client deploy.
GRANT EXECUTE ON FUNCTION public.update_liff_member_birthday(TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_liff_member_transactions(TEXT, TEXT, DATE) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT
  p.oid::regprocedure::text AS function_signature,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc p
WHERE p.oid IN (
  'public.get_liff_member_profile(text,boolean)'::regprocedure,
  'public.bind_liff_member(text,text,date)'::regprocedure,
  'public.get_liff_shop_orders(text)'::regprocedure,
  'public.update_liff_member_birthday(text,date)'::regprocedure,
  'public.get_liff_member_transactions(text,text,date)'::regprocedure
)
ORDER BY function_signature;
