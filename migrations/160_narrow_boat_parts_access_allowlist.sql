-- Narrow boat-operations allowlist for 區間時數合計 / 船艇零件庫存.

CREATE OR REPLACE FUNCTION public.can_access_boat_parts()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'authenticated'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) IN (
      'minlin1325@gmail.com',
      'pjpan0511@gmail.com'
    )
$$;

REVOKE ALL ON FUNCTION public.can_access_boat_parts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_boat_parts() TO authenticated;
