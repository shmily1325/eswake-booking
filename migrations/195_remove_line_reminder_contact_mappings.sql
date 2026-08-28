-- Roll back the reminder-only LINE contact collection and mapping feature.
-- 193 and 194 were already applied, so this migration removes their live objects.

BEGIN;

DROP TRIGGER IF EXISTS trg_clear_line_reminder_mapping_on_binding_change
  ON public.line_bindings;

DROP FUNCTION IF EXISTS public.clear_line_reminder_mapping_on_binding_change();
DROP FUNCTION IF EXISTS public.record_line_webhook_contact_event(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  BOOLEAN
);

DROP TABLE IF EXISTS public.line_reminder_mappings;
DROP TABLE IF EXISTS public.line_webhook_events;
DROP TABLE IF EXISTS public.line_webhook_contacts;

COMMIT;
