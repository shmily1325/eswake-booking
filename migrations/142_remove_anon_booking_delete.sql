-- =============================================================================
-- 142_remove_anon_booking_delete.sql
--
-- LIFF no longer supports deleting bookings. Remove the obsolete anonymous
-- DELETE policies and table privileges without changing authenticated staff
-- access or any SELECT/INSERT/UPDATE policy.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "bookings_members_delete_anon" ON public.booking_members;
DROP POLICY IF EXISTS "booking_coaches_delete_anon" ON public.booking_coaches;
DROP POLICY IF EXISTS "booking_drivers_delete_anon" ON public.booking_drivers;
DROP POLICY IF EXISTS "bookings_delete_anon" ON public.bookings;

REVOKE DELETE ON TABLE public.booking_members FROM anon;
REVOKE DELETE ON TABLE public.booking_coaches FROM anon;
REVOKE DELETE ON TABLE public.booking_drivers FROM anon;
REVOKE DELETE ON TABLE public.bookings FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT
  table_name,
  has_table_privilege('anon', format('public.%I', table_name), 'DELETE') AS anon_can_delete,
  EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = table_name
      AND p.cmd = 'DELETE'
      AND 'anon' = ANY (p.roles)
  ) AS anon_delete_policy_exists
FROM (
  VALUES
    ('bookings'),
    ('booking_members'),
    ('booking_coaches'),
    ('booking_drivers')
) AS target_tables(table_name)
ORDER BY table_name;
