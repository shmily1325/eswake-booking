-- Optional rider display used when the person riding differs from the booking contact.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS actual_rider TEXT;

COMMENT ON COLUMN public.bookings.actual_rider IS
  'Optional actual rider names, normalized with the full-width ＋ separator';
