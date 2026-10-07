-- =============================================================================
-- 247_create_coach_designated_hours.sql
--
-- 教練個別指定課時數：全新、隔離的流水與修訂紀錄。
--
-- 安全邊界：
-- - 不讀寫 transactions
-- - 不讀寫 members 的任何餘額欄位
-- - 不修改 process_deduction_transaction
-- - 不回填舊資料
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.coach_designated_hour_entries (
  id BIGSERIAL PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'report_deduction')),
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  request_key UUID,
  booking_participant_id INTEGER
    REFERENCES public.booking_participants(id) ON DELETE CASCADE,
  voided_at TIMESTAMPTZ,
  voided_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by_email TEXT NOT NULL,
  CONSTRAINT coach_designated_hour_entry_source_check CHECK (
    (entry_type = 'credit' AND booking_participant_id IS NULL)
    OR
    (entry_type = 'report_deduction' AND booking_participant_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_coach_designated_hour_active_report_deduction
  ON public.coach_designated_hour_entries (booking_participant_id)
  WHERE entry_type = 'report_deduction'
    AND voided_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_coach_designated_hour_credit_request
  ON public.coach_designated_hour_entries (request_key)
  WHERE request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_designated_hour_member_coach_time
  ON public.coach_designated_hour_entries
  (coach_id, member_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_coach_designated_hour_active_member
  ON public.coach_designated_hour_entries (member_id, coach_id)
  WHERE voided_at IS NULL;

CREATE TABLE IF NOT EXISTS public.coach_designated_hour_revisions (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT,
  coach_id UUID NOT NULL,
  member_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('update', 'void')),
  before_data JSONB NOT NULL,
  after_data JSONB,
  actor_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coach_designated_hour_revisions_entry
  ON public.coach_designated_hour_revisions (entry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.coach_designated_hour_report_skips (
  booking_participant_id INTEGER PRIMARY KEY
    REFERENCES public.booking_participants(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by_email TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coach_designated_hour_report_skips_member
  ON public.coach_designated_hour_report_skips (coach_id, member_id);

COMMENT ON TABLE public.coach_designated_hour_entries IS
  '教練×會員指定課時數的隔離流水；不屬於場館 transactions';
COMMENT ON COLUMN public.coach_designated_hour_entries.minutes IS
  '絕對分鐘數；credit 為增加、report_deduction 為扣除';
COMMENT ON COLUMN public.coach_designated_hour_entries.booking_participant_id IS
  '扣除來源；來源回報硬刪除時僅 cascade 清除此新流水';
COMMENT ON TABLE public.coach_designated_hour_revisions IS
  '指定課流水修改／取消稽核，不影響既有 audit 或 transactions';
COMMENT ON TABLE public.coach_designated_hour_report_skips IS
  '明確保存指定不收費回報的本次不扣決定；不影響既有帳目';

ALTER TABLE public.coach_designated_hour_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_designated_hour_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coach_designated_hour_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_designated_hour_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coach_designated_hour_report_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_designated_hour_report_skips FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.coach_designated_hour_entries
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.coach_designated_hour_revisions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.coach_designated_hour_report_skips
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.coach_designated_hour_entries_id_seq
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.coach_designated_hour_revisions_id_seq
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.coach_designated_hour_entries TO service_role;
GRANT ALL ON TABLE public.coach_designated_hour_revisions TO service_role;
GRANT ALL ON TABLE public.coach_designated_hour_report_skips TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.coach_designated_hour_entries_id_seq
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.coach_designated_hour_revisions_id_seq
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT 'coach designated-hour isolated schema created' AS status;
