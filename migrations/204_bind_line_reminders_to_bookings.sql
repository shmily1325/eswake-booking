-- New/unfiled guests are linked to one concrete booking, not guessed from
-- names or phone numbers. Member reminder mappings continue to use member_id.

BEGIN;

ALTER TABLE public.line_reminder_mappings
  ADD COLUMN IF NOT EXISTS booking_id INTEGER
    REFERENCES public.bookings(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.uq_line_reminder_mapping_phone;
DROP INDEX IF EXISTS public.uq_line_reminder_mapping_line_identity;

CREATE UNIQUE INDEX IF NOT EXISTS uq_line_reminder_mapping_booking
  ON public.line_reminder_mappings(booking_id)
  WHERE member_id IS NULL AND booking_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_line_reminder_mapping_line_identity
  ON public.line_reminder_mappings(
    line_user_id,
    COALESCE(member_id::TEXT, ''),
    COALESCE(booking_id::TEXT, ''),
    COALESCE(contact_phone, ''),
    COALESCE(normalized_name, '')
  );

CREATE INDEX IF NOT EXISTS idx_line_reminder_mapping_booking
  ON public.line_reminder_mappings(booking_id)
  WHERE booking_id IS NOT NULL;

COMMENT ON COLUMN public.line_reminder_mappings.booking_id IS
  'One-booking reminder target for a person who has no member record';

COMMIT;
