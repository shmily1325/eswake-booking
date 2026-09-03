-- Deleting a saved non-member also clears older one-off booking mappings for
-- the same LINE account. Formal/manual member mappings and the webhook contact
-- remain untouched.

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
  v_line_user_id TEXT;
  v_deleted_count INTEGER;
BEGIN
  IF p_guest_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT line_user_id
  INTO v_line_user_id
  FROM public.line_reminder_guests
  WHERE id = p_guest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.line_reminder_mappings
  WHERE guest_id = p_guest_id
     OR (
       member_id IS NULL
       AND line_user_id = v_line_user_id
     );

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
  'Atomically deletes a saved reminder guest and every non-member mapping for the same LINE account';

CREATE OR REPLACE FUNCTION public.search_available_line_reminder_guests(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(candidate) ORDER BY candidate.name), '[]'::JSONB)
  FROM (
    SELECT
      guest.id,
      guest.line_user_id,
      guest.name,
      jsonb_build_object(
        'display_name', contact.display_name,
        'picture_url', contact.picture_url,
        'friend_status', contact.friend_status
      ) AS line_contact
    FROM public.line_reminder_guests AS guest
    JOIN public.line_webhook_contacts AS contact
      ON contact.line_user_id = guest.line_user_id
     AND contact.friend_status = 'friend'
    WHERE guest.is_active = TRUE
      AND guest.name ILIKE '%' || COALESCE(p_query, '') || '%'
      AND NOT EXISTS (
        SELECT 1
        FROM public.line_bindings AS binding
        WHERE binding.line_user_id = guest.line_user_id
          AND binding.status = 'active'
          AND binding.can_push = TRUE
      )
    ORDER BY guest.name
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
  ) AS candidate;
$$;

REVOKE ALL ON FUNCTION public.search_available_line_reminder_guests(TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_available_line_reminder_guests(TEXT, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.search_available_line_reminder_guests(TEXT, INTEGER) IS
  'Returns push-capable saved non-members after filtering, then applies the result limit';

COMMIT;
