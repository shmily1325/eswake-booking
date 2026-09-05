-- Persist manual LINE reminder attempts so the UI keeps its "sent" state
-- across refreshes and can prevent accidental duplicate sends.

BEGIN;

CREATE TABLE IF NOT EXISTS public.line_reminder_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_date DATE NOT NULL,
  recipient_key TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  member_id TEXT,
  booking_ids BIGINT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  sent_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_reminder_send_logs_sent_lookup
  ON public.line_reminder_send_logs (reminder_date, recipient_key, created_at DESC)
  WHERE status = 'sent';

ALTER TABLE public.line_reminder_send_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.line_reminder_send_logs
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.line_reminder_send_logs TO service_role;

COMMENT ON TABLE public.line_reminder_send_logs IS
  'Append-only audit log for manual LINE reminder attempts; accessed only by the staff API';

COMMIT;
