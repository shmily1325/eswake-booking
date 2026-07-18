-- Membership integrity audit (read-only).
-- Apply migration 148 first, then run this before applying migration 149.

-- Summary counts
SELECT 'invalid_membership_type' AS check_name, count(*) AS issue_count
FROM members
WHERE membership_type IS NULL
   OR membership_type NOT IN ('general', 'dual', 'guest', 'es')
UNION ALL
SELECT 'guest_with_membership_data', count(*)
FROM members
WHERE membership_type = 'guest'
  AND (
    membership_start_date IS NOT NULL
    OR membership_end_date IS NOT NULL
    OR membership_partner_id IS NOT NULL
  )
UNION ALL
SELECT 'non_dual_with_partner', count(*)
FROM members
WHERE membership_type IN ('general', 'es')
  AND membership_partner_id IS NOT NULL
UNION ALL
SELECT 'dual_without_partner', count(*)
FROM members
WHERE membership_type = 'dual'
  AND membership_partner_id IS NULL
UNION ALL
SELECT 'dual_self_pair', count(*)
FROM members
WHERE membership_type = 'dual'
  AND membership_partner_id = id
UNION ALL
SELECT 'dual_without_end_date', count(*)
FROM members
WHERE membership_type = 'dual'
  AND membership_end_date IS NULL
UNION ALL
SELECT 'non_reciprocal_pair', count(*)
FROM members a
LEFT JOIN members b ON b.id = a.membership_partner_id
WHERE a.membership_partner_id IS NOT NULL
  AND (
    b.id IS NULL
    OR b.membership_partner_id IS DISTINCT FROM a.id
    OR b.membership_type IS DISTINCT FROM 'dual'
    OR a.membership_type IS DISTINCT FROM 'dual'
  )
UNION ALL
SELECT 'dual_end_date_mismatch', count(*)
FROM members a
JOIN members b ON b.id = a.membership_partner_id
WHERE a.membership_type = 'dual'
  AND b.membership_type = 'dual'
  AND b.membership_partner_id = a.id
  AND a.membership_end_date IS DISTINCT FROM b.membership_end_date
UNION ALL
SELECT 'pair_points_to_inactive_member', count(*)
FROM members a
JOIN members b ON b.id = a.membership_partner_id
WHERE b.status IS DISTINCT FROM 'active'
UNION ALL
SELECT 'invalid_membership_date', count(*)
FROM members
WHERE (
    membership_start_date IS NOT NULL
    AND NOT public.is_valid_membership_date(membership_start_date)
  )
  OR (
    membership_end_date IS NOT NULL
    AND NOT public.is_valid_membership_date(membership_end_date)
  )
UNION ALL
SELECT 'invalid_date_order', count(*)
FROM members
WHERE membership_start_date IS NOT NULL
  AND membership_end_date IS NOT NULL
  AND membership_start_date > membership_end_date;

-- Details requiring review. Reciprocal pair problems may show both members.
SELECT
  a.id AS member_id,
  a.name,
  a.nickname,
  a.status,
  a.membership_type,
  a.membership_start_date,
  a.membership_end_date,
  a.membership_partner_id,
  b.name AS partner_name,
  b.nickname AS partner_nickname,
  b.status AS partner_status,
  b.membership_type AS partner_type,
  b.membership_end_date AS partner_end_date,
  b.membership_partner_id AS partner_points_to
FROM members a
LEFT JOIN members b ON b.id = a.membership_partner_id
WHERE
  a.membership_type IS NULL
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
      a.membership_partner_id IS NULL
      OR a.membership_partner_id = a.id
      OR a.membership_end_date IS NULL
    )
  )
  OR (
    a.membership_partner_id IS NOT NULL
    AND (
      b.id IS NULL
      OR b.status IS DISTINCT FROM 'active'
      OR b.membership_type IS DISTINCT FROM 'dual'
      OR b.membership_partner_id IS DISTINCT FROM a.id
      OR a.membership_type IS DISTINCT FROM 'dual'
      OR b.membership_end_date IS DISTINCT FROM a.membership_end_date
    )
  )
  OR (
    (a.membership_start_date IS NOT NULL AND NOT public.is_valid_membership_date(a.membership_start_date))
    OR
    (a.membership_end_date IS NOT NULL AND NOT public.is_valid_membership_date(a.membership_end_date))
  )
  OR (
    a.membership_start_date IS NOT NULL
    AND a.membership_end_date IS NOT NULL
    AND a.membership_start_date > a.membership_end_date
  )
ORDER BY a.name, a.id;

-- Legacy member board columns still populated and requiring manual review.
SELECT
  m.id,
  m.name,
  m.nickname,
  m.board_slot_number AS legacy_slot,
  m.board_expiry_date AS legacy_expiry,
  jsonb_agg(
    jsonb_build_object(
      'slot_number', bs.slot_number,
      'expires_at', bs.expires_at,
      'status', bs.status
    )
    ORDER BY bs.slot_number
  ) FILTER (WHERE bs.id IS NOT NULL) AS board_storage_rows
FROM members m
LEFT JOIN board_storage bs ON bs.member_id = m.id
WHERE m.board_slot_number IS NOT NULL
   OR m.board_expiry_date IS NOT NULL
GROUP BY m.id, m.name, m.nickname, m.board_slot_number, m.board_expiry_date
ORDER BY m.name;

-- Invalid canonical board expiry dates.
SELECT id, member_id, slot_number, expires_at, status
FROM board_storage
WHERE expires_at IS NOT NULL
  AND NOT public.is_valid_membership_date(expires_at)
ORDER BY slot_number;
