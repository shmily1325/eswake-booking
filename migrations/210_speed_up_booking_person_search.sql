-- Substring searches use ILIKE '%query%', so regular btree indexes cannot help.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_members_active_name_trgm
  ON public.members USING gin (name gin_trgm_ops)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_members_active_nickname_trgm
  ON public.members USING gin (nickname gin_trgm_ops)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_members_active_phone_trgm
  ON public.members USING gin (phone gin_trgm_ops)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_line_reminder_guests_active_name_trgm
  ON public.line_reminder_guests USING gin (name gin_trgm_ops)
  WHERE is_active = TRUE;
