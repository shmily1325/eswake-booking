-- Reminder-only LINE contacts. This is intentionally separate from line_bindings:
-- member-area access still requires the formal LIFF binding flow.

BEGIN;

CREATE TABLE public.line_webhook_contacts (
  line_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'LINE 使用者',
  picture_url TEXT,
  profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  friend_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (friend_status IN ('friend', 'blocked', 'unknown')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_action TEXT NOT NULL DEFAULT 'message',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.line_webhook_events (
  webhook_event_id TEXT PRIMARY KEY,
  line_user_id TEXT NOT NULL
    REFERENCES public.line_webhook_contacts(line_user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  action_key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.line_reminder_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL
    REFERENCES public.line_webhook_contacts(line_user_id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  contact_name TEXT,
  normalized_name TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_email TEXT NOT NULL,
  CONSTRAINT line_reminder_mapping_has_identity CHECK (
    member_id IS NOT NULL OR contact_phone IS NOT NULL OR normalized_name IS NOT NULL
  ),
  CONSTRAINT line_reminder_mapping_phone_format CHECK (
    contact_phone IS NULL OR contact_phone ~ '^09[0-9]{8}$'
  )
);

CREATE UNIQUE INDEX uq_line_reminder_mapping_member
  ON public.line_reminder_mappings(member_id)
  WHERE member_id IS NOT NULL;
CREATE UNIQUE INDEX uq_line_reminder_mapping_phone
  ON public.line_reminder_mappings(contact_phone)
  WHERE member_id IS NULL AND contact_phone IS NOT NULL;
CREATE UNIQUE INDEX uq_line_reminder_mapping_line_identity
  ON public.line_reminder_mappings(
    line_user_id,
    COALESCE(member_id::TEXT, ''),
    COALESCE(contact_phone, ''),
    COALESCE(normalized_name, '')
  );
CREATE INDEX idx_line_webhook_contacts_last_seen
  ON public.line_webhook_contacts(last_seen_at DESC);
CREATE INDEX idx_line_reminder_mapping_name
  ON public.line_reminder_mappings(normalized_name)
  WHERE normalized_name IS NOT NULL;

ALTER TABLE public.line_webhook_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_reminder_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_webhook_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.line_webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.line_reminder_mappings FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.line_webhook_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.line_webhook_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.line_reminder_mappings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_webhook_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_webhook_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_reminder_mappings TO service_role;

CREATE OR REPLACE FUNCTION public.record_line_webhook_contact_event(
  p_webhook_event_id TEXT,
  p_line_user_id TEXT,
  p_event_type TEXT,
  p_action_key TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_display_name TEXT,
  p_picture_url TEXT,
  p_profile_complete BOOLEAN,
  p_friend_status TEXT
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
    line_user_id, display_name, picture_url, profile_complete, friend_status,
    first_seen_at, last_seen_at, last_action, updated_at
  )
  VALUES (
    p_line_user_id,
    CASE WHEN p_profile_complete THEN p_display_name ELSE 'LINE 使用者' END,
    CASE WHEN p_profile_complete THEN p_picture_url ELSE NULL END,
    p_profile_complete,
    p_friend_status,
    p_occurred_at,
    p_occurred_at,
    p_action_key,
    now()
  )
  ON CONFLICT (line_user_id) DO UPDATE SET
    display_name = CASE
      WHEN EXCLUDED.profile_complete THEN EXCLUDED.display_name
      ELSE line_webhook_contacts.display_name
    END,
    picture_url = CASE
      WHEN EXCLUDED.profile_complete THEN EXCLUDED.picture_url
      ELSE line_webhook_contacts.picture_url
    END,
    profile_complete = line_webhook_contacts.profile_complete OR EXCLUDED.profile_complete,
    friend_status = CASE
      WHEN p_event_type = 'unfollow' THEN 'blocked'
      WHEN p_event_type = 'follow' THEN 'friend'
      WHEN EXCLUDED.friend_status = 'friend' THEN 'friend'
      ELSE line_webhook_contacts.friend_status
    END,
    last_seen_at = GREATEST(line_webhook_contacts.last_seen_at, EXCLUDED.last_seen_at),
    last_action = CASE
      WHEN EXCLUDED.last_seen_at >= line_webhook_contacts.last_seen_at
        THEN EXCLUDED.last_action
      ELSE line_webhook_contacts.last_action
    END,
    updated_at = now();

  INSERT INTO public.line_webhook_events (
    webhook_event_id, line_user_id, event_type, action_key, occurred_at
  )
  VALUES (
    p_webhook_event_id, p_line_user_id, p_event_type, p_action_key, p_occurred_at
  )
  ON CONFLICT (webhook_event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.record_line_webhook_contact_event(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_line_webhook_contact_event(
  TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.clear_line_reminder_mapping_on_push_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.member_id IS NOT NULL AND NEW.status = 'active' AND NEW.can_push = TRUE THEN
    DELETE FROM public.line_reminder_mappings WHERE member_id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_line_reminder_mapping_on_push_binding
  ON public.line_bindings;
CREATE TRIGGER trg_clear_line_reminder_mapping_on_push_binding
AFTER INSERT OR UPDATE ON public.line_bindings
FOR EACH ROW
EXECUTE FUNCTION public.clear_line_reminder_mapping_on_push_binding();

REVOKE ALL ON FUNCTION public.clear_line_reminder_mapping_on_push_binding()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.line_webhook_contacts IS
  'Minimal LINE OA identities captured from signature-verified webhook events';
COMMENT ON TABLE public.line_reminder_mappings IS
  'Reminder-only identities; never grants LIFF member-area access';

COMMIT;
