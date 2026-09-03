-- Permanently deleting a saved reminder guest must also remove every booking
-- mapping created from that profile. The original webhook contact is retained.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_line_reminder_guest(
  p_guest_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  IF p_guest_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.line_reminder_mappings
  WHERE guest_id = p_guest_id;

  DELETE FROM public.line_reminder_guests
  WHERE id = p_guest_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_line_reminder_guest(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_line_reminder_guest(UUID)
  TO service_role;

COMMENT ON FUNCTION public.delete_line_reminder_guest(UUID) IS
  'Atomically deletes a saved reminder guest and its booking reminder mappings';

COMMIT;
