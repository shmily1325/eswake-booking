-- 102
-- Feature: Reservation Restrictions linked to Daily Announcements
-- Purpose:
--   - Allow admins to set a time window in which creating/editing bookings is blocked
--   - Reason text is taken from the linked daily announcement's content
-- Notes:
--   - Script is idempotent where possible
--   - Adjust GRANT/RLS to your security model if needed

-- 1) Table
create table if not exists public.reservation_restrictions (
  id bigserial primary key,
  announcement_id bigint not null unique
    references public.daily_announcements(id) on delete cascade,
  start_date date not null,
  start_time time without time zone,
  end_date date not null,
  end_time time without time zone,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Indexes
create index if not exists idx_resv_restr_start_date on public.reservation_restrictions(start_date);
create index if not exists idx_resv_restr_end_date on public.reservation_restrictions(end_date);
create index if not exists idx_resv_restr_active on public.reservation_restrictions(is_active);

-- 3) View for convenient reads with announcement content
create or replace view public.reservation_restrictions_with_announcement_view as
select
  r.announcement_id,
  r.start_date,
  r.start_time,
  r.end_date,
  r.end_time,
  r.is_active,
  a.content
from public.reservation_restrictions r
join public.daily_announcements a
  on a.id = r.announcement_id;

-- 4) Minimal grants (adjust per your RLS model)
grant select on public.reservation_restrictions_with_announcement_view to anon, authenticated;
grant select, insert, update, delete on public.reservation_restrictions to authenticated;

