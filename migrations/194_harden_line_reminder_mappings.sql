-- Follow-up hardening after 193:
-- - keep webhook contact timestamps monotonic when LINE events arrive out of order;
-- - keep incomplete profiles out of the staff mapping picker;
-- - remove reminder-only mappings when formal bindings supersede or are removed.

ALTER TABLE public.line_webhook_contacts
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.record_line_webhook_contact_event(
  p_webhook_event_id TEXT,
  p_line_user_id TEXT,
  p_event_type TEXT,
  p_action_key TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_display_name TEXT,
  p_picture_url TEXT,
  p_profile_complete BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count BIGINT;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.line_webhook_contacts (
    line_user_id,
    display_name,
    picture_url,
    first_seen_at,
    last_seen_at,
    last_action,
    profile_complete
  )
  VALUES (
    p_line_user_id,
    CASE WHEN p_profile_complete THEN p_display_name ELSE 'LINE 使用者' END,
    CASE WHEN p_profile_complete THEN p_picture_url ELSE NULL END,
    p_occurred_at,
    p_occurred_at,
    p_action_key,
    p_profile_complete
  )
  ON CONFLICT (line_user_id) DO UPDATE
  SET
    display_name = CASE
      WHEN EXCLUDED.profile_complete THEN EXCLUDED.display_name
      ELSE line_webhook_contacts.display_name
    END,
    picture_url = CASE
      WHEN EXCLUDED.profile_complete THEN EXCLUDED.picture_url
      ELSE line_webhook_contacts.picture_url
    END,
    profile_complete =
      line_webhook_contacts.profile_complete OR EXCLUDED.profile_complete,
    last_seen_at = GREATEST(
      line_webhook_contacts.last_seen_at,
      EXCLUDED.last_seen_at
    ),
    last_action = CASE
      WHEN EXCLUDED.last_seen_at >= line_webhook_contacts.last_seen_at
        THEN EXCLUDED.last_action
      ELSE line_webhook_contacts.last_action
    END;

  INSERT INTO public.line_webhook_events (
    webhook_event_id,
    line_user_id,
    event_type,
    action_key,
    occurred_at
  )
  VALUES (
    p_webhook_event_id,
    p_line_user_id,
    p_event_type,
    p_action_key,
    p_occurred_at
  )
  ON CONFLICT (webhook_event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.record_line_webhook_contact_event(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_line_webhook_contact_event(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN
) TO service_role;

CREATE OR REPLACE FUNCTION public.clear_line_reminder_mapping_on_binding_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_should_clear BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_member_id := OLD.member_id;
    v_should_clear := OLD.status = 'active';
  ELSIF TG_OP = 'INSERT' THEN
    v_member_id := NEW.member_id;
    v_should_clear := NEW.status = 'active' AND NEW.can_push = TRUE;
  ELSE
    v_member_id := COALESCE(NEW.member_id, OLD.member_id);
    v_should_clear :=
      (NEW.status = 'active' AND NEW.can_push = TRUE)
      OR (OLD.status = 'active' AND NEW.status <> 'active');
  END IF;

  IF v_should_clear AND v_member_id IS NOT NULL THEN
    DELETE FROM public.line_reminder_mappings
    WHERE member_id = v_member_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_line_reminder_mapping_on_binding_change
  ON public.line_bindings;
CREATE TRIGGER trg_clear_line_reminder_mapping_on_binding_change
AFTER INSERT OR UPDATE OR DELETE ON public.line_bindings
FOR EACH ROW
EXECUTE FUNCTION public.clear_line_reminder_mapping_on_binding_change();

REVOKE ALL ON FUNCTION public.clear_line_reminder_mapping_on_binding_change()
  FROM PUBLIC, anon, authenticated;
