-- Allow staff to save a reminder-only guest with zero bookings or atomically
-- pair one LINE account to multiple named participants across future bookings.

BEGIN;

CREATE OR REPLACE FUNCTION public.batch_upsert_line_reminder_guest_mappings(
  p_line_user_id TEXT,
  p_guest_name TEXT,
  p_targets JSONB,
  p_overwrite BOOLEAN,
  p_operator_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_count INTEGER;
  v_valid_count INTEGER;
  v_guest_id UUID;
  v_guest JSONB;
  v_conflicts JSONB;
BEGIN
  IF NULLIF(BTRIM(p_line_user_id), '') IS NULL THEN
    RAISE EXCEPTION 'LINE contact is required';
  END IF;
  IF NULLIF(BTRIM(p_operator_email), '') IS NULL THEN
    RAISE EXCEPTION 'Operator email is required';
  END IF;
  IF jsonb_typeof(COALESCE(p_targets, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'Targets must be an array';
  END IF;

  v_target_count := jsonb_array_length(COALESCE(p_targets, '[]'::JSONB));
  IF v_target_count > 50 THEN
    RAISE EXCEPTION 'Too many booking targets';
  END IF;
  IF v_target_count = 0 AND NULLIF(BTRIM(p_guest_name), '') IS NULL THEN
    RAISE EXCEPTION 'Choose a booking or save this guest';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_targets, '[]'::JSONB)) AS item
    WHERE NULLIF(BTRIM(item->>'contactName'), '') IS NULL
       OR COALESCE(item->>'bookingId', '') !~ '^[1-9][0-9]*$'
  ) THEN
    RAISE EXCEPTION 'Every target requires a booking and contact name';
  END IF;

  IF (
    SELECT COUNT(DISTINCT
      (item->>'bookingId') || ':' ||
      LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g'))
    )
    FROM jsonb_array_elements(COALESCE(p_targets, '[]'::JSONB)) AS item
  ) <> v_target_count THEN
    RAISE EXCEPTION 'Booking targets must be unique';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_line_user_id, 0));
  IF NOT EXISTS (
    SELECT 1
    FROM public.line_webhook_contacts
    WHERE line_user_id = p_line_user_id
      AND friend_status = 'friend'
  ) THEN
    RAISE EXCEPTION 'LINE contact is not available for reminders';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.line_bindings
    WHERE line_user_id = p_line_user_id
      AND status = 'active'
      AND can_push = TRUE
  ) THEN
    RAISE EXCEPTION 'LINE contact already has a formal member binding';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'booking:' || (item->>'bookingId') || ':' ||
    LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g')),
    0
  ))
  FROM jsonb_array_elements(COALESCE(p_targets, '[]'::JSONB)) AS item
  ORDER BY
    (item->>'bookingId')::INTEGER,
    LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g'));

  SELECT COUNT(*)
  INTO v_valid_count
  FROM jsonb_array_elements(COALESCE(p_targets, '[]'::JSONB)) AS item
  JOIN public.bookings AS booking
    ON booking.id = (item->>'bookingId')::INTEGER
   AND booking.status = 'confirmed'
  WHERE EXISTS (
    SELECT 1
    FROM regexp_split_to_table(
      COALESCE(booking.contact_name, ''),
      '\s*[,，]\s*'
    ) AS split_name(name)
    WHERE LOWER(regexp_replace(BTRIM(split_name.name), '\s+', ' ', 'g')) =
      LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g'))
  );
  IF v_valid_count <> v_target_count THEN
    RAISE EXCEPTION 'Selected name is not part of an active booking';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'bookingId', mapping.booking_id,
    'contactName', mapping.contact_name,
    'existingLineUserId', mapping.line_user_id,
    'existingDisplayName', contact.display_name
  )), '[]'::JSONB)
  INTO v_conflicts
  FROM public.line_reminder_mappings AS mapping
  JOIN jsonb_array_elements(COALESCE(p_targets, '[]'::JSONB)) AS item
    ON mapping.booking_id = (item->>'bookingId')::INTEGER
   AND mapping.member_id IS NULL
   AND mapping.normalized_name =
     LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g'))
  LEFT JOIN public.line_webhook_contacts AS contact
    ON contact.line_user_id = mapping.line_user_id
  WHERE mapping.line_user_id <> p_line_user_id;

  IF jsonb_array_length(v_conflicts) > 0 AND NOT COALESCE(p_overwrite, FALSE) THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'requiresConfirmation', TRUE,
      'conflicts', v_conflicts
    );
  END IF;

  IF NULLIF(BTRIM(p_guest_name), '') IS NOT NULL THEN
    INSERT INTO public.line_reminder_guests (
      line_user_id,
      name,
      normalized_name,
      is_active,
      created_by_email,
      updated_by_email
    )
    VALUES (
      p_line_user_id,
      BTRIM(p_guest_name),
      LOWER(regexp_replace(BTRIM(p_guest_name), '\s+', ' ', 'g')),
      TRUE,
      LOWER(BTRIM(p_operator_email)),
      LOWER(BTRIM(p_operator_email))
    )
    ON CONFLICT (line_user_id) DO UPDATE SET
      name = EXCLUDED.name,
      normalized_name = EXCLUDED.normalized_name,
      is_active = TRUE,
      updated_at = now(),
      updated_by_email = EXCLUDED.updated_by_email
    RETURNING id INTO v_guest_id;
  ELSE
    SELECT id
    INTO v_guest_id
    FROM public.line_reminder_guests
    WHERE line_user_id = p_line_user_id;
  END IF;

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
    p_line_user_id,
    NULL,
    (item->>'bookingId')::INTEGER,
    v_guest_id,
    BTRIM(item->>'contactName'),
    LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g')),
    NULL,
    LOWER(BTRIM(p_operator_email)),
    LOWER(BTRIM(p_operator_email))
  FROM jsonb_array_elements(COALESCE(p_targets, '[]'::JSONB)) AS item
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

  IF v_guest_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', guest.id,
      'line_user_id', guest.line_user_id,
      'name', guest.name,
      'normalized_name', guest.normalized_name,
      'is_active', guest.is_active
    )
    INTO v_guest
    FROM public.line_reminder_guests AS guest
    WHERE guest.id = v_guest_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'requiresConfirmation', FALSE,
    'mappingCount', v_target_count,
    'guest', v_guest
  );
END;
$$;

-- A single LINE account may legitimately represent more than one participant
-- on the same booking (for example, a parent receiving reminders for children).
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
    SELECT COUNT(DISTINCT LOWER(
      regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g')
    ))
    FROM jsonb_array_elements(COALESCE(p_guests, '[]'::JSONB)) AS item
  ) <> v_requested_count THEN
    RAISE EXCEPTION 'Contact names must be unique';
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
    WHERE LOWER(regexp_replace(BTRIM(split_name.name), '\s+', ' ', 'g')) =
      LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g'))
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
      WHERE LOWER(regexp_replace(BTRIM(item->>'contactName'), '\s+', ' ', 'g')) =
        mapping.normalized_name
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

REVOKE ALL ON FUNCTION public.batch_upsert_line_reminder_guest_mappings(
  TEXT, TEXT, JSONB, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.batch_upsert_line_reminder_guest_mappings(
  TEXT, TEXT, JSONB, BOOLEAN, TEXT
) TO service_role;
REVOKE ALL ON FUNCTION public.sync_line_reminder_booking_guests(INTEGER, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_line_reminder_booking_guests(INTEGER, JSONB, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.batch_upsert_line_reminder_guest_mappings(
  TEXT, TEXT, JSONB, BOOLEAN, TEXT
) IS
  'Atomically validates and upserts zero-to-many reminder booking targets for one LINE contact';

COMMIT;
