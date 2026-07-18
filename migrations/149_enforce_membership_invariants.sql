-- =============================================================================
-- 149_enforce_membership_invariants.sql
--
-- Enforce membership shape for new/changed rows. CHECK constraints are added
-- NOT VALID so existing production anomalies can be audited and repaired before
-- a later VALIDATE CONSTRAINT migration.
--
-- Apply after the application has switched membership writes to migration 148.
-- =============================================================================

BEGIN;

ALTER TABLE members
  ADD CONSTRAINT members_membership_type_check
  CHECK (
    membership_type IS NOT NULL
    AND membership_type IN ('general', 'dual', 'guest', 'es')
  )
  NOT VALID;

ALTER TABLE members
  ADD CONSTRAINT members_membership_shape_check
  CHECK (
    (membership_type = 'guest'
      AND membership_start_date IS NULL
      AND membership_end_date IS NULL
      AND membership_partner_id IS NULL)
    OR
    (membership_type IN ('general', 'es')
      AND membership_partner_id IS NULL)
    OR
    (membership_type = 'dual'
      AND membership_partner_id IS NOT NULL
      AND membership_partner_id <> id
      AND membership_end_date IS NOT NULL)
  )
  NOT VALID;

ALTER TABLE members
  ADD CONSTRAINT members_membership_date_format_check
  CHECK (
    (membership_start_date IS NULL OR public.is_valid_membership_date(membership_start_date))
    AND
    (membership_end_date IS NULL OR public.is_valid_membership_date(membership_end_date))
  )
  NOT VALID;

ALTER TABLE members
  ADD CONSTRAINT members_membership_date_order_check
  CHECK (
    membership_start_date IS NULL
    OR membership_end_date IS NULL
    OR membership_start_date <= membership_end_date
  )
  NOT VALID;

CREATE OR REPLACE FUNCTION public.enforce_membership_pair_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_partner members%ROWTYPE;
  v_old_partner members%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.membership_partner_id IS NOT NULL
     AND OLD.membership_partner_id IS DISTINCT FROM NEW.membership_partner_id THEN
    SELECT *
    INTO v_old_partner
    FROM members
    WHERE id = OLD.membership_partner_id;
    IF FOUND AND v_old_partner.membership_partner_id = NEW.id THEN
      RAISE EXCEPTION 'Old dual membership partner still points to the changed member';
    END IF;
  END IF;

  IF NEW.membership_type <> 'dual' THEN
    IF NEW.membership_partner_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only dual members may have a membership partner';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Dual members must be active';
  END IF;

  SELECT *
  INTO v_partner
  FROM members
  WHERE id = NEW.membership_partner_id;

  IF NOT FOUND OR v_partner.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Dual membership partner must be active';
  END IF;
  IF v_partner.membership_type IS DISTINCT FROM 'dual'
     OR v_partner.membership_partner_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Dual membership pairing must be reciprocal';
  END IF;
  IF v_partner.membership_end_date IS DISTINCT FROM NEW.membership_end_date THEN
    RAISE EXCEPTION 'Dual membership partners must share the same end date';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_membership_pair_consistency ON members;
CREATE CONSTRAINT TRIGGER trg_enforce_membership_pair_consistency
AFTER INSERT OR UPDATE OF membership_type, membership_partner_id, membership_end_date, status
ON members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_membership_pair_consistency();

REVOKE ALL ON FUNCTION public.enforce_membership_pair_consistency() FROM PUBLIC, anon, authenticated;

-- Membership lifecycle writes must go through the authorized RPCs. Keep direct
-- access only for non-lifecycle profile and balance fields used elsewhere.
REVOKE INSERT, DELETE, UPDATE ON TABLE members FROM authenticated;
GRANT UPDATE (
  name,
  nickname,
  birthday,
  phone,
  balance,
  vip_voucher_amount,
  designated_lesson_minutes,
  boat_voucher_g23_minutes,
  boat_voucher_g21_minutes,
  boat_voucher_g21_panther_minutes,
  gift_boat_hours,
  free_hours,
  free_hours_notes,
  free_hours_used,
  notes,
  updated_at
) ON TABLE members TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_membership_integrity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
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
  ) THEN
    RAISE EXCEPTION 'Membership integrity validation failed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_membership_integrity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_membership_integrity() TO service_role;

COMMIT;
