-- =============================================================================
-- 171_liff_member_credit_lots.sql
--
-- LIFF 會員 snapshot 加上 credit_lots（VIP／G23／G21 分年剩餘），
-- 供會員專區儲值卡顯示年份／「已逾期」標籤。
-- 只擴充 _liff_member_snapshot 回傳欄位；不改餘額、不作廢。
-- =============================================================================

BEGIN;

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
    END,
    'credit_lots', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'category', cl.category,
          'voucher_year', cl.voucher_year,
          'remaining', cl.remaining
        )
        ORDER BY cl.category, cl.voucher_year
      )
      FROM public.credit_lots cl
      WHERE cl.member_id = m.id
        AND cl.remaining <> 0
    ), '[]'::jsonb)
  )
  FROM public.members m
  WHERE m.id = p_member_id
$$;

REVOKE ALL ON FUNCTION public._liff_member_snapshot(UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
