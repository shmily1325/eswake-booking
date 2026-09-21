BEGIN;

-- The same trigger function serves booking_coaches and booking_drivers.
-- Accessing NEW.driver_id directly makes PostgreSQL resolve a field that does
-- not exist when the trigger is running for booking_coaches (and vice versa).
-- Reading through JSON keeps the function valid for both record shapes.
CREATE OR REPLACE FUNCTION public.enforce_booking_restriction_on_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
  v_person_id UUID;
BEGIN
  v_person_id := CASE
    WHEN TG_TABLE_NAME = 'booking_drivers'
      THEN (to_jsonb(NEW) ->> 'driver_id')::UUID
    ELSE (to_jsonb(NEW) ->> 'coach_id')::UUID
  END;

  SELECT public.booking_restriction_reason(
    NEW.booking_id,
    ARRAY[v_person_id],
    true
  ) INTO v_reason;

  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'BOOKING_RESTRICTION: %', v_reason
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
