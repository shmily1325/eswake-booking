-- =============================================================================
-- ES Wake system integrity audit (read-only)
--
-- Run in Supabase SQL Editor after migration 148.
-- The first result is a compact summary. Later results contain review details.
-- "error" checks represent hard invariants. "review" checks need human judgment.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Summary
-- ---------------------------------------------------------------------------
WITH
expected_reserves AS (
  SELECT
    pv.id AS variant_id,
    pv.reserved_qty AS stored_reserved_qty,
    COALESCE(SUM(
      CASE
        WHEN so.id IS NOT NULL AND so.cancelled_at IS NULL
          THEN soi.qty_pending_bill
        ELSE 0
      END
    ), 0)::integer AS expected_reserved_qty
  FROM product_variants pv
  LEFT JOIN shop_order_items soi ON soi.variant_id = pv.id
  LEFT JOIN shop_orders so ON so.id = soi.order_id
  GROUP BY pv.id, pv.reserved_qty
),
ledger_totals AS (
  SELECT
    t.member_id,
    COALESCE(SUM(
      CASE WHEN t.category = 'balance'
        THEN CASE WHEN t.adjust_type = 'increase'
          THEN ABS(COALESCE(t.amount, 0))
          ELSE -ABS(COALESCE(t.amount, 0))
        END
        ELSE 0
      END
    ), 0) AS balance,
    COALESCE(SUM(
      CASE WHEN t.category = 'vip_voucher'
        THEN CASE WHEN t.adjust_type = 'increase'
          THEN ABS(COALESCE(t.amount, 0))
          ELSE -ABS(COALESCE(t.amount, 0))
        END
        ELSE 0
      END
    ), 0) AS vip_voucher_amount,
    COALESCE(SUM(
      CASE WHEN t.category = 'designated_lesson'
        THEN CASE WHEN t.adjust_type = 'increase'
          THEN ABS(COALESCE(t.minutes, 0))
          ELSE -ABS(COALESCE(t.minutes, 0))
        END
        ELSE 0
      END
    ), 0) AS designated_lesson_minutes,
    COALESCE(SUM(
      CASE WHEN t.category = 'boat_voucher_g23'
        THEN CASE WHEN t.adjust_type = 'increase'
          THEN ABS(COALESCE(t.minutes, 0))
          ELSE -ABS(COALESCE(t.minutes, 0))
        END
        ELSE 0
      END
    ), 0) AS boat_voucher_g23_minutes,
    COALESCE(SUM(
      CASE WHEN t.category = 'boat_voucher_g21_panther'
        THEN CASE WHEN t.adjust_type = 'increase'
          THEN ABS(COALESCE(t.minutes, 0))
          ELSE -ABS(COALESCE(t.minutes, 0))
        END
        ELSE 0
      END
    ), 0) AS boat_voucher_g21_panther_minutes,
    COALESCE(SUM(
      CASE WHEN t.category = 'gift_boat_hours'
        THEN CASE WHEN t.adjust_type = 'increase'
          THEN ABS(COALESCE(t.minutes, 0))
          ELSE -ABS(COALESCE(t.minutes, 0))
        END
        ELSE 0
      END
    ), 0) AS gift_boat_hours
  FROM transactions t
  GROUP BY t.member_id
),
ledger_mismatches AS (
  SELECT m.id
  FROM members m
  LEFT JOIN ledger_totals lt ON lt.member_id = m.id
  WHERE COALESCE(m.balance, 0) IS DISTINCT FROM COALESCE(lt.balance, 0)
     OR COALESCE(m.vip_voucher_amount, 0) IS DISTINCT FROM COALESCE(lt.vip_voucher_amount, 0)
     OR COALESCE(m.designated_lesson_minutes, 0) IS DISTINCT FROM COALESCE(lt.designated_lesson_minutes, 0)
     OR COALESCE(m.boat_voucher_g23_minutes, 0) IS DISTINCT FROM COALESCE(lt.boat_voucher_g23_minutes, 0)
     OR COALESCE(m.boat_voucher_g21_panther_minutes, 0) IS DISTINCT FROM COALESCE(lt.boat_voucher_g21_panther_minutes, 0)
     OR COALESCE(m.gift_boat_hours, 0) IS DISTINCT FROM COALESCE(lt.gift_boat_hours, 0)
),
duplicate_participant_transactions AS (
  SELECT
    booking_participant_id,
    member_id,
    category,
    adjust_type,
    COALESCE(amount, 0) AS amount,
    COALESCE(minutes, 0) AS minutes,
    description
  FROM transactions
  WHERE booking_participant_id IS NOT NULL
  GROUP BY
    booking_participant_id,
    member_id,
    category,
    adjust_type,
    COALESCE(amount, 0),
    COALESCE(minutes, 0),
    description
  HAVING count(*) > 1
),
boat_slots AS (
  SELECT
    b.id,
    b.boat_id,
    bt.name AS boat_name,
    b.start_at::timestamp AS starts_at,
    b.start_at::timestamp
      + ((b.duration_min + COALESCE(b.cleanup_minutes, 0))::text || ' minutes')::interval AS ends_at
  FROM bookings b
  JOIN boats bt ON bt.id = b.boat_id
  WHERE b.status IS DISTINCT FROM 'cancelled'
    AND COALESCE(b.is_coach_practice, false) = false
    AND bt.name <> '陸上課程'
),
boat_overlaps AS (
  SELECT left_slot.id AS left_booking_id, right_slot.id AS right_booking_id
  FROM boat_slots left_slot
  JOIN boat_slots right_slot
    ON right_slot.boat_id = left_slot.boat_id
   AND right_slot.id > left_slot.id
   AND left_slot.starts_at < right_slot.ends_at
   AND right_slot.starts_at < left_slot.ends_at
),
staff_assignments AS (
  SELECT bc.booking_id, bc.coach_id AS staff_id
  FROM booking_coaches bc
  UNION
  SELECT bd.booking_id, bd.driver_id AS staff_id
  FROM booking_drivers bd
),
staff_slots AS (
  SELECT
    sa.booking_id,
    sa.staff_id,
    b.start_at::timestamp AS starts_at,
    b.start_at::timestamp
      + ((b.duration_min + 15)::text || ' minutes')::interval AS ends_at
  FROM staff_assignments sa
  JOIN bookings b ON b.id = sa.booking_id
  WHERE b.status IS DISTINCT FROM 'cancelled'
    AND COALESCE(b.is_coach_practice, false) = false
),
staff_overlaps AS (
  SELECT left_slot.booking_id AS left_booking_id, right_slot.booking_id AS right_booking_id
  FROM staff_slots left_slot
  JOIN staff_slots right_slot
    ON right_slot.staff_id = left_slot.staff_id
   AND right_slot.booking_id > left_slot.booking_id
   AND left_slot.starts_at < right_slot.ends_at
   AND right_slot.starts_at < left_slot.ends_at
),
membership_invalid AS (
  SELECT a.id
  FROM members a
  LEFT JOIN members b ON b.id = a.membership_partner_id
  WHERE a.membership_type IS NULL
     OR a.membership_type NOT IN ('general', 'dual', 'guest', 'es')
     OR (
       a.membership_type = 'guest'
       AND (
         a.membership_start_date IS NOT NULL
         OR a.membership_end_date IS NOT NULL
         OR a.membership_partner_id IS NOT NULL
       )
     )
     OR (a.membership_type IN ('general', 'es') AND a.membership_partner_id IS NOT NULL)
     OR (
       a.membership_type = 'dual'
       AND (
         a.status IS DISTINCT FROM 'active'
         OR a.membership_partner_id IS NULL
         OR a.membership_partner_id = a.id
         OR a.membership_end_date IS NULL
         OR b.id IS NULL
         OR b.status IS DISTINCT FROM 'active'
         OR b.membership_type IS DISTINCT FROM 'dual'
         OR b.membership_partner_id IS DISTINCT FROM a.id
         OR b.membership_end_date IS DISTINCT FROM a.membership_end_date
       )
     )
     OR (
       a.membership_start_date IS NOT NULL
       AND NOT public.is_valid_membership_date(a.membership_start_date)
     )
     OR (
       a.membership_end_date IS NOT NULL
       AND NOT public.is_valid_membership_date(a.membership_end_date)
     )
     OR (
       a.membership_start_date IS NOT NULL
       AND a.membership_end_date IS NOT NULL
       AND a.membership_start_date > a.membership_end_date
     )
)
SELECT 'error' AS severity, 'shop' AS domain, 'shop_reserved_qty_mismatch' AS check_name, count(*) AS issue_count
FROM expected_reserves
WHERE stored_reserved_qty IS DISTINCT FROM expected_reserved_qty
UNION ALL
SELECT 'error', 'shop', 'shop_item_quantity_invalid', count(*)
FROM shop_order_items
WHERE qty <= 0
   OR qty_pending_bill < 0
   OR qty_paid < 0
   OR qty_pending_bill + qty_paid > qty
UNION ALL
SELECT 'error', 'shop', 'cancelled_order_holds_pending_qty', count(*)
FROM shop_orders so
JOIN shop_order_items soi ON soi.order_id = so.id
WHERE so.cancelled_at IS NOT NULL
  AND soi.qty_pending_bill > 0
UNION ALL
SELECT 'error', 'shop', 'balance_settlement_missing_transaction', count(*)
FROM shop_order_settlements settlement
WHERE settlement.payment_method = 'balance'
  AND NOT EXISTS (
    SELECT 1
    FROM transactions tx
    WHERE tx.shop_order_id = settlement.order_id
      AND tx.transaction_type = 'consume'
      AND tx.category = 'balance'
  )
UNION ALL
SELECT 'error', 'shop', 'empty_or_invalid_settlement_snapshot', count(*)
FROM shop_order_settlements
WHERE CASE
  WHEN jsonb_typeof(items_snapshot) = 'array' THEN jsonb_array_length(items_snapshot) = 0
  ELSE true
END
UNION ALL
SELECT 'error', 'ledger', 'member_ledger_snapshot_mismatch', count(*)
FROM ledger_mismatches
UNION ALL
SELECT 'error', 'reports', 'processed_participant_missing_transaction', count(*)
FROM booking_participants bp
WHERE bp.status = 'processed'
  AND COALESCE(bp.is_deleted, false) = false
  AND bp.member_id IS NOT NULL
  AND bp.payment_method IN ('balance', 'voucher')
  AND NOT EXISTS (
    SELECT 1 FROM transactions tx WHERE tx.booking_participant_id = bp.id
  )
  AND COALESCE(bp.notes, '') NOT LIKE '%[現金結清]%'
  AND COALESCE(bp.notes, '') NOT LIKE '%[匯款結清]%'
  AND COALESCE(bp.notes, '') NOT LIKE '%[指定課不收費]%'
  AND COALESCE(bp.notes, '') NOT LIKE '%[結清]%'
UNION ALL
SELECT 'review', 'reports', 'duplicate_participant_transaction_fingerprint', count(*)
FROM duplicate_participant_transactions
UNION ALL
SELECT 'error', 'reports', 'invalid_participant_status', count(*)
FROM booking_participants
WHERE COALESCE(is_deleted, false) = false
  AND (status IS NULL OR status NOT IN ('pending', 'processed', 'not_applicable'))
UNION ALL
SELECT 'error', 'reports', 'pending_participant_without_member', count(*)
FROM booking_participants
WHERE COALESCE(is_deleted, false) = false
  AND status = 'pending'
  AND member_id IS NULL
UNION ALL
SELECT 'error', 'reports', 'participant_missing_report_stamp', count(*)
FROM booking_participants bp
WHERE COALESCE(bp.is_deleted, false) = false
  AND bp.coach_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM coach_reports cr
    WHERE cr.booking_id = bp.booking_id
      AND cr.coach_id = bp.coach_id
  )
UNION ALL
SELECT 'review', 'reports', 'report_stamp_without_current_assignment', count(*)
FROM coach_reports cr
WHERE NOT EXISTS (
    SELECT 1
    FROM booking_coaches bc
    WHERE bc.booking_id = cr.booking_id
      AND bc.coach_id = cr.coach_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM booking_drivers bd
    WHERE bd.booking_id = cr.booking_id
      AND bd.driver_id = cr.coach_id
  )
UNION ALL
SELECT 'review', 'bookings', 'boat_time_overlap', count(*)
FROM boat_overlaps
UNION ALL
SELECT 'review', 'bookings', 'staff_time_overlap', count(*)
FROM staff_overlaps
UNION ALL
SELECT 'error', 'boards', 'invalid_board_expiry', count(*)
FROM board_storage
WHERE expires_at IS NOT NULL
  AND NOT public.is_valid_membership_date(expires_at)
UNION ALL
SELECT 'error', 'boards', 'board_date_order_invalid', count(*)
FROM board_storage
WHERE start_date IS NOT NULL
  AND expires_at IS NOT NULL
  AND CASE
    WHEN public.is_valid_membership_date(expires_at)
      THEN start_date > expires_at::date
    ELSE false
  END
UNION ALL
SELECT 'error', 'boards', 'duplicate_board_slot', count(*)
FROM (
  SELECT slot_number
  FROM board_storage
  GROUP BY slot_number
  HAVING count(*) > 1
) duplicates
UNION ALL
SELECT 'error', 'line', 'active_line_binding_without_member', count(*)
FROM line_bindings
WHERE status = 'active'
  AND member_id IS NULL
UNION ALL
SELECT 'error', 'line', 'active_line_binding_to_inactive_member', count(*)
FROM line_bindings lb
JOIN members m ON m.id = lb.member_id
WHERE lb.status = 'active'
  AND m.status IS DISTINCT FROM 'active'
UNION ALL
SELECT 'error', 'line', 'duplicate_active_line_binding', count(*)
FROM (
  SELECT member_id
  FROM line_bindings
  WHERE status = 'active'
    AND member_id IS NOT NULL
  GROUP BY member_id
  HAVING count(*) > 1
) duplicates
UNION ALL
SELECT 'error', 'membership', 'membership_integrity_invalid', count(*)
FROM membership_invalid
ORDER BY severity, domain, check_name;

-- ---------------------------------------------------------------------------
-- 2. Shop and inventory details
-- ---------------------------------------------------------------------------
WITH expected_reserves AS (
  SELECT
    pv.id AS variant_id,
    pv.stock,
    pv.reserved_qty AS stored_reserved_qty,
    COALESCE(SUM(
      CASE
        WHEN so.id IS NOT NULL AND so.cancelled_at IS NULL
          THEN soi.qty_pending_bill
        ELSE 0
      END
    ), 0)::integer AS expected_reserved_qty
  FROM product_variants pv
  LEFT JOIN shop_order_items soi ON soi.variant_id = pv.id
  LEFT JOIN shop_orders so ON so.id = soi.order_id
  GROUP BY pv.id, pv.stock, pv.reserved_qty
)
SELECT
  'shop_reserved_qty_mismatch' AS check_name,
  er.variant_id::text AS entity_id,
  jsonb_build_object(
    'stock', er.stock,
    'stored_reserved_qty', er.stored_reserved_qty,
    'expected_reserved_qty', er.expected_reserved_qty
  ) AS details
FROM expected_reserves er
WHERE er.stored_reserved_qty IS DISTINCT FROM er.expected_reserved_qty
UNION ALL
SELECT
  'shop_item_quantity_invalid',
  soi.id::text,
  jsonb_build_object(
    'order_id', soi.order_id,
    'qty', soi.qty,
    'qty_pending_bill', soi.qty_pending_bill,
    'qty_paid', soi.qty_paid
  )
FROM shop_order_items soi
WHERE soi.qty <= 0
   OR soi.qty_pending_bill < 0
   OR soi.qty_paid < 0
   OR soi.qty_pending_bill + soi.qty_paid > soi.qty
UNION ALL
SELECT
  'cancelled_order_holds_pending_qty',
  soi.id::text,
  jsonb_build_object(
    'order_id', so.id,
    'order_no', so.order_no,
    'variant_id', soi.variant_id,
    'qty_pending_bill', soi.qty_pending_bill,
    'cancelled_at', so.cancelled_at
  )
FROM shop_orders so
JOIN shop_order_items soi ON soi.order_id = so.id
WHERE so.cancelled_at IS NOT NULL
  AND soi.qty_pending_bill > 0
UNION ALL
SELECT
  'balance_settlement_missing_transaction',
  settlement.id::text,
  jsonb_build_object(
    'order_id', settlement.order_id,
    'charge_member_id', settlement.charge_member_id,
    'amount_total', settlement.amount_total,
    'settled_at', settlement.settled_at
  )
FROM shop_order_settlements settlement
WHERE settlement.payment_method = 'balance'
  AND NOT EXISTS (
    SELECT 1
    FROM transactions tx
    WHERE tx.shop_order_id = settlement.order_id
      AND tx.transaction_type = 'consume'
      AND tx.category = 'balance'
  )
UNION ALL
SELECT
  'empty_or_invalid_settlement_snapshot',
  settlement.id::text,
  jsonb_build_object(
    'order_id', settlement.order_id,
    'payment_method', settlement.payment_method,
    'amount_total', settlement.amount_total,
    'items_snapshot', settlement.items_snapshot
  )
FROM shop_order_settlements settlement
WHERE CASE
  WHEN jsonb_typeof(settlement.items_snapshot) = 'array'
    THEN jsonb_array_length(settlement.items_snapshot) = 0
  ELSE true
END
ORDER BY check_name, entity_id;

-- ---------------------------------------------------------------------------
-- 3. Member ledger and participant settlement details
-- ---------------------------------------------------------------------------
WITH
ledger_totals AS (
  SELECT
    t.member_id,
    COALESCE(SUM(CASE WHEN t.category = 'balance'
      THEN CASE WHEN t.adjust_type = 'increase' THEN ABS(COALESCE(t.amount, 0)) ELSE -ABS(COALESCE(t.amount, 0)) END
      ELSE 0 END), 0) AS balance,
    COALESCE(SUM(CASE WHEN t.category = 'vip_voucher'
      THEN CASE WHEN t.adjust_type = 'increase' THEN ABS(COALESCE(t.amount, 0)) ELSE -ABS(COALESCE(t.amount, 0)) END
      ELSE 0 END), 0) AS vip_voucher_amount,
    COALESCE(SUM(CASE WHEN t.category = 'designated_lesson'
      THEN CASE WHEN t.adjust_type = 'increase' THEN ABS(COALESCE(t.minutes, 0)) ELSE -ABS(COALESCE(t.minutes, 0)) END
      ELSE 0 END), 0) AS designated_lesson_minutes,
    COALESCE(SUM(CASE WHEN t.category = 'boat_voucher_g23'
      THEN CASE WHEN t.adjust_type = 'increase' THEN ABS(COALESCE(t.minutes, 0)) ELSE -ABS(COALESCE(t.minutes, 0)) END
      ELSE 0 END), 0) AS boat_voucher_g23_minutes,
    COALESCE(SUM(CASE WHEN t.category = 'boat_voucher_g21_panther'
      THEN CASE WHEN t.adjust_type = 'increase' THEN ABS(COALESCE(t.minutes, 0)) ELSE -ABS(COALESCE(t.minutes, 0)) END
      ELSE 0 END), 0) AS boat_voucher_g21_panther_minutes,
    COALESCE(SUM(CASE WHEN t.category = 'gift_boat_hours'
      THEN CASE WHEN t.adjust_type = 'increase' THEN ABS(COALESCE(t.minutes, 0)) ELSE -ABS(COALESCE(t.minutes, 0)) END
      ELSE 0 END), 0) AS gift_boat_hours
  FROM transactions t
  GROUP BY t.member_id
),
duplicate_participant_transactions AS (
  SELECT
    booking_participant_id,
    member_id,
    category,
    adjust_type,
    COALESCE(amount, 0) AS amount,
    COALESCE(minutes, 0) AS minutes,
    description,
    count(*) AS duplicate_count,
    array_agg(id ORDER BY id) AS transaction_ids
  FROM transactions
  WHERE booking_participant_id IS NOT NULL
  GROUP BY
    booking_participant_id,
    member_id,
    category,
    adjust_type,
    COALESCE(amount, 0),
    COALESCE(minutes, 0),
    description
  HAVING count(*) > 1
)
SELECT
  'member_ledger_snapshot_mismatch' AS check_name,
  m.id::text AS entity_id,
  jsonb_build_object(
    'name', m.name,
    'nickname', m.nickname,
    'current', jsonb_build_object(
      'balance', COALESCE(m.balance, 0),
      'vip_voucher_amount', COALESCE(m.vip_voucher_amount, 0),
      'designated_lesson_minutes', COALESCE(m.designated_lesson_minutes, 0),
      'boat_voucher_g23_minutes', COALESCE(m.boat_voucher_g23_minutes, 0),
      'boat_voucher_g21_panther_minutes', COALESCE(m.boat_voucher_g21_panther_minutes, 0),
      'gift_boat_hours', COALESCE(m.gift_boat_hours, 0)
    ),
    'calculated', jsonb_build_object(
      'balance', COALESCE(lt.balance, 0),
      'vip_voucher_amount', COALESCE(lt.vip_voucher_amount, 0),
      'designated_lesson_minutes', COALESCE(lt.designated_lesson_minutes, 0),
      'boat_voucher_g23_minutes', COALESCE(lt.boat_voucher_g23_minutes, 0),
      'boat_voucher_g21_panther_minutes', COALESCE(lt.boat_voucher_g21_panther_minutes, 0),
      'gift_boat_hours', COALESCE(lt.gift_boat_hours, 0)
    )
  ) AS details
FROM members m
LEFT JOIN ledger_totals lt ON lt.member_id = m.id
WHERE COALESCE(m.balance, 0) IS DISTINCT FROM COALESCE(lt.balance, 0)
   OR COALESCE(m.vip_voucher_amount, 0) IS DISTINCT FROM COALESCE(lt.vip_voucher_amount, 0)
   OR COALESCE(m.designated_lesson_minutes, 0) IS DISTINCT FROM COALESCE(lt.designated_lesson_minutes, 0)
   OR COALESCE(m.boat_voucher_g23_minutes, 0) IS DISTINCT FROM COALESCE(lt.boat_voucher_g23_minutes, 0)
   OR COALESCE(m.boat_voucher_g21_panther_minutes, 0) IS DISTINCT FROM COALESCE(lt.boat_voucher_g21_panther_minutes, 0)
   OR COALESCE(m.gift_boat_hours, 0) IS DISTINCT FROM COALESCE(lt.gift_boat_hours, 0)
UNION ALL
SELECT
  'processed_participant_missing_transaction',
  bp.id::text,
  jsonb_build_object(
    'booking_id', bp.booking_id,
    'participant_name', bp.participant_name,
    'member_id', bp.member_id,
    'payment_method', bp.payment_method,
    'lesson_type', bp.lesson_type,
    'notes', bp.notes,
    'reported_at', bp.reported_at
  )
FROM booking_participants bp
WHERE bp.status = 'processed'
  AND COALESCE(bp.is_deleted, false) = false
  AND bp.member_id IS NOT NULL
  AND bp.payment_method IN ('balance', 'voucher')
  AND NOT EXISTS (
    SELECT 1 FROM transactions tx WHERE tx.booking_participant_id = bp.id
  )
  AND COALESCE(bp.notes, '') NOT LIKE '%[現金結清]%'
  AND COALESCE(bp.notes, '') NOT LIKE '%[匯款結清]%'
  AND COALESCE(bp.notes, '') NOT LIKE '%[指定課不收費]%'
  AND COALESCE(bp.notes, '') NOT LIKE '%[結清]%'
UNION ALL
SELECT
  'duplicate_participant_transaction_fingerprint',
  dpt.booking_participant_id::text,
  jsonb_build_object(
    'member_id', dpt.member_id,
    'category', dpt.category,
    'adjust_type', dpt.adjust_type,
    'amount', dpt.amount,
    'minutes', dpt.minutes,
    'description', dpt.description,
    'duplicate_count', dpt.duplicate_count,
    'transaction_ids', dpt.transaction_ids
  )
FROM duplicate_participant_transactions dpt
UNION ALL
SELECT
  'invalid_participant_status',
  bp.id::text,
  jsonb_build_object(
    'booking_id', bp.booking_id,
    'participant_name', bp.participant_name,
    'member_id', bp.member_id,
    'status', bp.status
  )
FROM booking_participants bp
WHERE COALESCE(bp.is_deleted, false) = false
  AND (bp.status IS NULL OR bp.status NOT IN ('pending', 'processed', 'not_applicable'))
UNION ALL
SELECT
  'pending_participant_without_member',
  bp.id::text,
  jsonb_build_object(
    'booking_id', bp.booking_id,
    'participant_name', bp.participant_name,
    'payment_method', bp.payment_method,
    'status', bp.status
  )
FROM booking_participants bp
WHERE COALESCE(bp.is_deleted, false) = false
  AND bp.status = 'pending'
  AND bp.member_id IS NULL
ORDER BY check_name, entity_id;

-- ---------------------------------------------------------------------------
-- 4. Report stamp and booking overlap details
-- ---------------------------------------------------------------------------
WITH
boat_slots AS (
  SELECT
    b.id,
    b.boat_id,
    bt.name AS boat_name,
    b.contact_name,
    b.start_at::timestamp AS starts_at,
    b.start_at::timestamp
      + ((b.duration_min + COALESCE(b.cleanup_minutes, 0))::text || ' minutes')::interval AS ends_at
  FROM bookings b
  JOIN boats bt ON bt.id = b.boat_id
  WHERE b.status IS DISTINCT FROM 'cancelled'
    AND COALESCE(b.is_coach_practice, false) = false
    AND bt.name <> '陸上課程'
),
raw_staff_assignments AS (
  SELECT bc.booking_id, bc.coach_id AS staff_id, 'coach'::text AS assignment_type
  FROM booking_coaches bc
  UNION ALL
  SELECT bd.booking_id, bd.driver_id AS staff_id, 'driver'::text AS assignment_type
  FROM booking_drivers bd
),
staff_assignments AS (
  SELECT
    booking_id,
    staff_id,
    string_agg(DISTINCT assignment_type, ',' ORDER BY assignment_type) AS assignment_type
  FROM raw_staff_assignments
  GROUP BY booking_id, staff_id
),
staff_slots AS (
  SELECT
    sa.booking_id,
    sa.staff_id,
    sa.assignment_type,
    c.name AS staff_name,
    b.contact_name,
    b.start_at::timestamp AS starts_at,
    b.start_at::timestamp
      + ((b.duration_min + 15)::text || ' minutes')::interval AS ends_at
  FROM staff_assignments sa
  JOIN bookings b ON b.id = sa.booking_id
  JOIN coaches c ON c.id = sa.staff_id
  WHERE b.status IS DISTINCT FROM 'cancelled'
    AND COALESCE(b.is_coach_practice, false) = false
)
SELECT
  'participant_missing_report_stamp' AS check_name,
  bp.id::text AS entity_id,
  jsonb_build_object(
    'booking_id', bp.booking_id,
    'coach_id', bp.coach_id,
    'participant_name', bp.participant_name,
    'reported_at', bp.reported_at
  ) AS details
FROM booking_participants bp
WHERE COALESCE(bp.is_deleted, false) = false
  AND bp.coach_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM coach_reports cr
    WHERE cr.booking_id = bp.booking_id
      AND cr.coach_id = bp.coach_id
  )
UNION ALL
SELECT
  'report_stamp_without_current_assignment',
  cr.id::text,
  jsonb_build_object(
    'booking_id', cr.booking_id,
    'coach_id', cr.coach_id,
    'reported_at', cr.reported_at,
    'driver_duration_min', cr.driver_duration_min
  )
FROM coach_reports cr
WHERE NOT EXISTS (
    SELECT 1
    FROM booking_coaches bc
    WHERE bc.booking_id = cr.booking_id
      AND bc.coach_id = cr.coach_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM booking_drivers bd
    WHERE bd.booking_id = cr.booking_id
      AND bd.driver_id = cr.coach_id
  )
UNION ALL
SELECT
  'boat_time_overlap',
  left_slot.id::text || ':' || right_slot.id::text,
  jsonb_build_object(
    'boat_id', left_slot.boat_id,
    'boat_name', left_slot.boat_name,
    'left_booking_id', left_slot.id,
    'left_contact', left_slot.contact_name,
    'left_start', left_slot.starts_at,
    'left_end_with_cleanup', left_slot.ends_at,
    'right_booking_id', right_slot.id,
    'right_contact', right_slot.contact_name,
    'right_start', right_slot.starts_at,
    'right_end_with_cleanup', right_slot.ends_at
  )
FROM boat_slots left_slot
JOIN boat_slots right_slot
  ON right_slot.boat_id = left_slot.boat_id
 AND right_slot.id > left_slot.id
 AND left_slot.starts_at < right_slot.ends_at
 AND right_slot.starts_at < left_slot.ends_at
UNION ALL
SELECT
  'staff_time_overlap',
  left_slot.booking_id::text || ':' || right_slot.booking_id::text || ':' || left_slot.staff_id::text,
  jsonb_build_object(
    'staff_id', left_slot.staff_id,
    'staff_name', left_slot.staff_name,
    'left_booking_id', left_slot.booking_id,
    'left_assignment_type', left_slot.assignment_type,
    'left_contact', left_slot.contact_name,
    'left_start', left_slot.starts_at,
    'left_end', left_slot.ends_at,
    'right_booking_id', right_slot.booking_id,
    'right_assignment_type', right_slot.assignment_type,
    'right_contact', right_slot.contact_name,
    'right_start', right_slot.starts_at,
    'right_end', right_slot.ends_at
  )
FROM staff_slots left_slot
JOIN staff_slots right_slot
  ON right_slot.staff_id = left_slot.staff_id
 AND right_slot.booking_id > left_slot.booking_id
 AND left_slot.starts_at < right_slot.ends_at
 AND right_slot.starts_at < left_slot.ends_at
ORDER BY check_name, entity_id;

-- ---------------------------------------------------------------------------
-- 5. Membership, board storage, and LINE binding details
-- ---------------------------------------------------------------------------
SELECT
  'membership_integrity_invalid' AS check_name,
  a.id::text AS entity_id,
  jsonb_build_object(
    'name', a.name,
    'nickname', a.nickname,
    'status', a.status,
    'membership_type', a.membership_type,
    'membership_start_date', a.membership_start_date,
    'membership_end_date', a.membership_end_date,
    'membership_partner_id', a.membership_partner_id,
    'partner_status', b.status,
    'partner_type', b.membership_type,
    'partner_end_date', b.membership_end_date,
    'partner_points_to', b.membership_partner_id
  ) AS details
FROM members a
LEFT JOIN members b ON b.id = a.membership_partner_id
WHERE a.membership_type IS NULL
   OR a.membership_type NOT IN ('general', 'dual', 'guest', 'es')
   OR (
     a.membership_type = 'guest'
     AND (
       a.membership_start_date IS NOT NULL
       OR a.membership_end_date IS NOT NULL
       OR a.membership_partner_id IS NOT NULL
     )
   )
   OR (a.membership_type IN ('general', 'es') AND a.membership_partner_id IS NOT NULL)
   OR (
     a.membership_type = 'dual'
     AND (
       a.status IS DISTINCT FROM 'active'
       OR a.membership_partner_id IS NULL
       OR a.membership_partner_id = a.id
       OR a.membership_end_date IS NULL
       OR b.id IS NULL
       OR b.status IS DISTINCT FROM 'active'
       OR b.membership_type IS DISTINCT FROM 'dual'
       OR b.membership_partner_id IS DISTINCT FROM a.id
       OR b.membership_end_date IS DISTINCT FROM a.membership_end_date
     )
   )
   OR (
     a.membership_start_date IS NOT NULL
     AND NOT public.is_valid_membership_date(a.membership_start_date)
   )
   OR (
     a.membership_end_date IS NOT NULL
     AND NOT public.is_valid_membership_date(a.membership_end_date)
   )
   OR (
     a.membership_start_date IS NOT NULL
     AND a.membership_end_date IS NOT NULL
     AND a.membership_start_date > a.membership_end_date
   )
UNION ALL
SELECT
  'invalid_board_expiry',
  bs.id::text,
  jsonb_build_object(
    'member_id', bs.member_id,
    'slot_number', bs.slot_number,
    'start_date', bs.start_date,
    'expires_at', bs.expires_at,
    'status', bs.status
  )
FROM board_storage bs
WHERE bs.expires_at IS NOT NULL
  AND NOT public.is_valid_membership_date(bs.expires_at)
UNION ALL
SELECT
  'board_date_order_invalid',
  bs.id::text,
  jsonb_build_object(
    'member_id', bs.member_id,
    'slot_number', bs.slot_number,
    'start_date', bs.start_date,
    'expires_at', bs.expires_at,
    'status', bs.status
  )
FROM board_storage bs
WHERE bs.start_date IS NOT NULL
  AND bs.expires_at IS NOT NULL
  AND CASE
    WHEN public.is_valid_membership_date(bs.expires_at)
      THEN bs.start_date > bs.expires_at::date
    ELSE false
  END
UNION ALL
SELECT
  'duplicate_board_slot',
  duplicates.slot_number::text,
  jsonb_build_object(
    'slot_number', duplicates.slot_number,
    'row_ids', duplicates.row_ids,
    'member_ids', duplicates.member_ids
  )
FROM (
  SELECT
    slot_number,
    array_agg(id ORDER BY id) AS row_ids,
    array_agg(member_id ORDER BY id) AS member_ids
  FROM board_storage
  GROUP BY slot_number
  HAVING count(*) > 1
) duplicates
UNION ALL
SELECT
  'active_line_binding_without_member',
  lb.id::text,
  jsonb_build_object(
    'line_user_id', lb.line_user_id,
    'status', lb.status,
    'created_at', lb.created_at
  )
FROM line_bindings lb
WHERE lb.status = 'active'
  AND lb.member_id IS NULL
UNION ALL
SELECT
  'active_line_binding_to_inactive_member',
  lb.id::text,
  jsonb_build_object(
    'line_user_id', lb.line_user_id,
    'member_id', lb.member_id,
    'member_name', m.name,
    'member_status', m.status
  )
FROM line_bindings lb
JOIN members m ON m.id = lb.member_id
WHERE lb.status = 'active'
  AND m.status IS DISTINCT FROM 'active'
UNION ALL
SELECT
  'duplicate_active_line_binding',
  duplicates.member_id::text,
  jsonb_build_object(
    'member_id', duplicates.member_id,
    'binding_ids', duplicates.binding_ids,
    'line_user_ids', duplicates.line_user_ids
  )
FROM (
  SELECT
    member_id,
    array_agg(id ORDER BY id) AS binding_ids,
    array_agg(line_user_id ORDER BY id) AS line_user_ids
  FROM line_bindings
  WHERE status = 'active'
    AND member_id IS NOT NULL
  GROUP BY member_id
  HAVING count(*) > 1
) duplicates
ORDER BY check_name, entity_id;
