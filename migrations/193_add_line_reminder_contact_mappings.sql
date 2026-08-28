-- Capture LINE users who interact with the official account, without changing
-- formal LIFF member bindings. Staff can map an unbound member to one captured
-- contact for reminder delivery only.

CREATE TABLE IF NOT EXISTS public.line_webhook_contacts (
  line_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  picture_url TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_action TEXT NOT NULL DEFAULT 'message'
);

CREATE TABLE IF NOT EXISTS public.line_webhook_events (
  webhook_event_id TEXT PRIMARY KEY,
  line_user_id TEXT NOT NULL
    REFERENCES public.line_webhook_contacts(line_user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  action_key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.line_reminder_mappings (
  member_id UUID PRIMARY KEY
    REFERENCES public.members(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL
    REFERENCES public.line_webhook_contacts(line_user_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_email TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_line_reminder_mappings_line_user
  ON public.line_reminder_mappings(line_user_id);

CREATE INDEX IF NOT EXISTS idx_line_webhook_contacts_last_seen
  ON public.line_webhook_contacts(last_seen_at DESC);

ALTER TABLE public.line_webhook_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_reminder_mappings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.line_webhook_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.line_webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.line_reminder_mappings FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.line_webhook_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.line_webhook_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.line_reminder_mappings FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.line_webhook_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.line_webhook_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.line_reminder_mappings TO service_role;

DROP POLICY IF EXISTS "Service role manages LINE webhook contacts"
  ON public.line_webhook_contacts;
CREATE POLICY "Service role manages LINE webhook contacts"
  ON public.line_webhook_contacts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages LINE webhook events"
  ON public.line_webhook_events;
CREATE POLICY "Service role manages LINE webhook events"
  ON public.line_webhook_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages LINE reminder mappings"
  ON public.line_reminder_mappings;
CREATE POLICY "Service role manages LINE reminder mappings"
  ON public.line_reminder_mappings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.line_webhook_contacts IS
  'LINE users captured from signature-verified official-account webhook events';
COMMENT ON TABLE public.line_webhook_events IS
  'Deduplication and minimal action history for LINE webhook events; message content is not stored';
COMMENT ON TABLE public.line_reminder_mappings IS
  'Reminder-only mapping from an existing member to a captured LINE contact; does not alter line_bindings';
