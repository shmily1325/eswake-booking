-- Remove boat parts inventory feature (tables, RPC, helper).

DROP FUNCTION IF EXISTS public.apply_boat_part_movement(
  uuid,
  text,
  integer,
  text,
  text,
  timestamptz
);

DROP TABLE IF EXISTS public.boat_part_movements CASCADE;
DROP TABLE IF EXISTS public.boat_parts CASCADE;

DROP FUNCTION IF EXISTS public.touch_boat_part_updated_at();
DROP FUNCTION IF EXISTS public.can_access_boat_parts();
