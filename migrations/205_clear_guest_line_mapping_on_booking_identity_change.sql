-- A booking-specific LINE reminder mapping belongs to the person who was
-- confirmed at pairing time. Clear it when the booking identity changes so
-- reminders cannot be sent to the previous person's LINE account.

BEGIN;

CREATE OR REPLACE FUNCTION public.clear_guest_line_mapping_on_booking_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_name IS DISTINCT FROM OLD.contact_name
     OR NEW.member_id IS DISTINCT FROM OLD.member_id THEN
    DELETE FROM public.line_reminder_mappings
    WHERE booking_id = NEW.id
      AND member_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_guest_line_mapping_on_booking_identity_change
  ON public.bookings;
CREATE TRIGGER trg_clear_guest_line_mapping_on_booking_identity_change
AFTER UPDATE OF contact_name, member_id ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.clear_guest_line_mapping_on_booking_identity_change();

REVOKE ALL ON FUNCTION public.clear_guest_line_mapping_on_booking_identity_change()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.clear_guest_line_mapping_on_booking_identity_change() IS
  'Clears booking-specific LINE reminder mappings when the booked person changes';

COMMIT;
