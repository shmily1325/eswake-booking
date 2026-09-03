-- Persistent reminder-only guests are optional. One-off guests continue to use
-- booking-specific mappings without creating a saved guest record.

BEGIN;

CREATE TABLE public.line_reminder_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL UNIQUE
    REFERENCES public.line_webhook_contacts(line_user_id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  normalized_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_email TEXT NOT NULL
);

CREATE INDEX idx_line_reminder_guests_normalized_name
  ON public.line_reminder_guests(normalized_name)
  WHERE is_active = TRUE;

ALTER TABLE public.line_reminder_mappings
  ADD COLUMN IF NOT EXISTS guest_id UUID
    REFERENCES public.line_reminder_guests(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.uq_line_reminder_mapping_booking;

-- Older booking mappings stored the entire comma-separated contact_name.
-- Those rows are ambiguous on multi-person bookings, so require staff to pair
-- the specific person again instead of risking a reminder to the wrong LINE.
DELETE FROM public.line_reminder_mappings AS mapping
USING public.bookings AS booking
WHERE mapping.booking_id = booking.id
  AND mapping.member_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(
      COALESCE(booking.contact_name, ''),
      '\s*[,，]\s*'
    ) AS split_name(name)
    WHERE LOWER(
      regexp_replace(BTRIM(split_name.name), '\s+', ' ', 'g')
    ) = mapping.normalized_name
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_line_reminder_mapping_booking_person
  ON public.line_reminder_mappings(booking_id, normalized_name)
  WHERE member_id IS NULL
    AND booking_id IS NOT NULL
    AND normalized_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_line_reminder_mappings_guest
  ON public.line_reminder_mappings(guest_id)
  WHERE guest_id IS NOT NULL;

DELETE FROM public.line_reminder_mappings AS mapping
USING public.line_bindings AS binding
WHERE binding.status = 'active'
  AND binding.can_push = TRUE
  AND (
    mapping.line_user_id = binding.line_user_id
    OR mapping.member_id = binding.member_id
  );

ALTER TABLE public.line_reminder_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_reminder_guests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.line_reminder_guests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_reminder_guests TO service_role;

COMMENT ON TABLE public.line_reminder_guests IS
  'Optional saved non-members that can be reused in staff booking forms';
COMMENT ON COLUMN public.line_reminder_mappings.guest_id IS
  'Saved reminder-only guest selected for this booking; null means a one-off mapping';

-- Preserve reminder mappings for names that remain on a multi-person booking,
-- while removing mappings for people who were actually removed.
CREATE OR REPLACE FUNCTION public.clear_guest_line_mapping_on_booking_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.line_reminder_mappings AS mapping
  WHERE mapping.booking_id = NEW.id
    AND mapping.member_id IS NULL
    AND (
      mapping.normalized_name IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM regexp_split_to_table(
          COALESCE(NEW.contact_name, ''),
          '\s*[,，]\s*'
        ) AS split_name(name)
        WHERE LOWER(
          regexp_replace(BTRIM(split_name.name), '\s+', ' ', 'g')
        ) = mapping.normalized_name
      )
    );
  RETURN NEW;
END;
$$;

-- A formal push-capable binding takes precedence over every reminder-only
-- mapping for the same LINE account.
CREATE OR REPLACE FUNCTION public.clear_line_reminder_mapping_on_push_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.member_id IS NOT NULL AND NEW.status = 'active' AND NEW.can_push = TRUE THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.line_user_id, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('member:' || NEW.member_id::TEXT, 0));
    DELETE FROM public.line_reminder_mappings
    WHERE member_id = NEW.member_id
       OR line_user_id = NEW.line_user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_formally_bound_reminder_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.line_user_id, 0));
  IF NEW.member_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('member:' || NEW.member_id::TEXT, 0));
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.line_bindings
    WHERE status = 'active'
      AND can_push = TRUE
      AND (
        line_user_id = NEW.line_user_id
        OR (NEW.member_id IS NOT NULL AND member_id = NEW.member_id)
      )
  ) THEN
    RAISE EXCEPTION 'LINE contact already has a formal member binding';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_formally_bound_reminder_mapping
  ON public.line_reminder_mappings;
CREATE TRIGGER trg_reject_formally_bound_reminder_mapping
BEFORE INSERT OR UPDATE OF line_user_id ON public.line_reminder_mappings
FOR EACH ROW
EXECUTE FUNCTION public.reject_formally_bound_reminder_mapping();

CREATE OR REPLACE FUNCTION public.sync_line_reminder_booking_guests(
  p_booking_id INTEGER,
  p_guests JSONB,
  p_operator_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_name TEXT;
  v_requested_count INTEGER;
  v_valid_count INTEGER;
BEGIN
  IF p_booking_id IS NULL OR p_booking_id <= 0 THEN
    RAISE EXCEPTION 'Booking is required';
  END IF;
  IF jsonb_typeof(COALESCE(p_guests, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'Guests must be an array';
  END IF;
  IF NULLIF(BTRIM(p_operator_email), '') IS NULL THEN
    RAISE EXCEPTION 'Operator email is required';
  END IF;

  SELECT contact_name
  INTO v_contact_name
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  v_requested_count := jsonb_array_length(COALESCE(p_guests, '[]'::JSONB));
  IF v_requested_count > 20 THEN
    RAISE EXCEPTION 'Too many saved guests';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS item
    WHERE NULLIF(BTRIM(item->>'guestId'), '') IS NULL
       OR NULLIF(BTRIM(item->>'contactName'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Guest ID and contact name are required';
  END IF;

  IF (
    SELECT COUNT(DISTINCT item->>'guestId')
    FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS item
  ) <> v_requested_count OR (
    SELECT COUNT(DISTINCT LOWER(
      regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g')
    ))
    FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS item
  ) <> v_requested_count THEN
    RAISE EXCEPTION 'Guest IDs and contact names must be unique';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(guest.line_user_id, 0))
  FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS item
  JOIN public.line_reminder_guests AS guest
    ON guest.id = (item->>'guestId')::UUID
  ORDER BY guest.line_user_id;

  SELECT COUNT(*)
  INTO v_valid_count
  FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS item
  JOIN public.line_reminder_guests AS guest
    ON guest.id = (item->>'guestId')::UUID
   AND guest.is_active = TRUE
  JOIN public.line_webhook_contacts AS contact
    ON contact.line_user_id = guest.line_user_id
   AND contact.friend_status = 'friend'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.line_bindings AS binding
    WHERE binding.line_user_id = guest.line_user_id
      AND binding.status = 'active'
      AND binding.can_push = TRUE
  )
  AND EXISTS (
    SELECT 1
    FROM regexp_split_to_table(
      COALESCE(v_contact_name, ''),
      '\s*[,，]\s*'
    ) AS split_name(name)
    WHERE LOWER(
      regexp_replace(BTRIM(split_name.name), '\s+', ' ', 'g')
    ) = LOWER(
      regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g')
    )
  );

  IF v_valid_count <> v_requested_count THEN
    RAISE EXCEPTION 'Saved guest is not available for this booking';
  END IF;

  DELETE FROM public.line_reminder_mappings AS mapping
  WHERE mapping.booking_id = p_booking_id
    AND mapping.member_id IS NULL
    AND mapping.guest_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS item
      WHERE LOWER(
        regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g')
      ) = mapping.normalized_name
    );

  INSERT INTO public.line_reminder_mappings (
    line_user_id,
    member_id,
    booking_id,
    guest_id,
    contact_name,
    normalized_name,
    contact_phone,
    created_by_email,
    updated_by_email
  )
  SELECT
    guest.line_user_id,
    NULL,
    p_booking_id,
    guest.id,
    BTRIM(item->>'contactName'),
    LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g')),
    NULL,
    LOWER(BTRIM(p_operator_email)),
    LOWER(BTRIM(p_operator_email))
  FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS item
  JOIN public.line_reminder_guests AS guest
    ON guest.id = (item->>'guestId')::UUID
  ON CONFLICT (booking_id, normalized_name)
    WHERE member_id IS NULL
      AND booking_id IS NOT NULL
      AND normalized_name IS NOT NULL
  DO UPDATE SET
    line_user_id = EXCLUDED.line_user_id,
    guest_id = EXCLUDED.guest_id,
    contact_name = EXCLUDED.contact_name,
    contact_phone = NULL,
    updated_at = now(),
    updated_by_email = EXCLUDED.updated_by_email;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_guest_line_mapping_on_booking_identity_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_line_reminder_mapping_on_push_binding()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_formally_bound_reminder_mapping()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_line_reminder_booking_guests(INTEGER, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_line_reminder_booking_guests(INTEGER, JSONB, TEXT)
  TO service_role;

COMMIT;
