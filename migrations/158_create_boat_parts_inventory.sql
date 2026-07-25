-- =============================================
-- 船艇零件庫存（V0）
-- 僅開放給「區間時數合計」相同的 hard-code 白名單。
-- 庫存只能透過 RPC 以流水方式異動，避免數量與紀錄不同步。
-- =============================================

CREATE OR REPLACE FUNCTION public.can_access_boat_parts()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'authenticated'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) IN (
      'hsulittlepang2015@gmail.com',
      'minlin1325@gmail.com',
      'callumbao1122@gmail.com',
      'pjpan0511@gmail.com'
    )
$$;

REVOKE ALL ON FUNCTION public.can_access_boat_parts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_boat_parts() TO authenticated;

CREATE TABLE IF NOT EXISTS public.boat_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text UNIQUE,
  source_row integer,
  category text,
  part_no text,
  name text NOT NULL,
  appearance text,
  initial_quantity integer NOT NULL DEFAULT 0 CHECK (initial_quantity >= 0),
  current_quantity integer NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  safety_quantity integer NOT NULL DEFAULT 0 CHECK (safety_quantity >= 0),
  brand text,
  unit_price numeric(12, 2) CHECK (unit_price IS NULL OR unit_price >= 0),
  compatible_boats text[] NOT NULL DEFAULT '{}'::text[],
  storage_location text,
  notes text,
  pending_repair_quantity integer NOT NULL DEFAULT 0 CHECK (pending_repair_quantity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boat_parts_part_no
  ON public.boat_parts (lower(part_no))
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_boat_parts_name
  ON public.boat_parts (lower(name))
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_boat_parts_category
  ON public.boat_parts (category)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_boat_parts_compatible_boats
  ON public.boat_parts USING gin (compatible_boats);

CREATE TABLE IF NOT EXISTS public.boat_part_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text UNIQUE,
  part_id uuid NOT NULL REFERENCES public.boat_parts(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('inbound', 'outbound', 'adjustment')),
  quantity integer NOT NULL CHECK (quantity <> 0),
  boat_code text CHECK (boat_code IS NULL OR boat_code IN ('G21', 'G23', 'FI23', 'ALL')),
  note text,
  moved_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email text,
  affects_inventory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boat_part_movement_direction CHECK (
    (movement_type = 'inbound' AND quantity > 0)
    OR (movement_type = 'outbound' AND quantity < 0)
    OR movement_type = 'adjustment'
  )
);

CREATE INDEX IF NOT EXISTS idx_boat_part_movements_part_date
  ON public.boat_part_movements (part_id, moved_at DESC);

CREATE OR REPLACE FUNCTION public.touch_boat_part_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boat_parts_updated_at ON public.boat_parts;
CREATE TRIGGER trg_boat_parts_updated_at
  BEFORE UPDATE ON public.boat_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_boat_part_updated_at();

ALTER TABLE public.boat_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boat_part_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boat_parts_whitelist_select ON public.boat_parts;
CREATE POLICY boat_parts_whitelist_select
  ON public.boat_parts
  FOR SELECT
  TO authenticated
  USING (public.can_access_boat_parts());

DROP POLICY IF EXISTS boat_part_movements_whitelist_select ON public.boat_part_movements;
CREATE POLICY boat_part_movements_whitelist_select
  ON public.boat_part_movements
  FOR SELECT
  TO authenticated
  USING (public.can_access_boat_parts());

REVOKE ALL ON TABLE public.boat_parts FROM anon, authenticated;
REVOKE ALL ON TABLE public.boat_part_movements FROM anon, authenticated;
GRANT SELECT ON TABLE public.boat_parts TO authenticated;
GRANT SELECT ON TABLE public.boat_part_movements TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_boat_part_movement(
  p_part_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_boat_code text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_moved_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part public.boat_parts%ROWTYPE;
  v_delta integer;
  v_boat_code text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_movement_id uuid;
BEGIN
  IF NOT public.can_access_boat_parts() THEN
    RAISE EXCEPTION 'Not allowed to manage boat parts'
      USING ERRCODE = '42501';
  END IF;

  IF p_movement_type NOT IN ('inbound', 'outbound', 'adjustment') THEN
    RAISE EXCEPTION 'Invalid movement type';
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'Quantity must not be zero';
  END IF;

  v_delta := CASE
    WHEN p_movement_type = 'inbound' THEN abs(p_quantity)
    WHEN p_movement_type = 'outbound' THEN -abs(p_quantity)
    ELSE p_quantity
  END;

  v_boat_code := NULLIF(upper(trim(coalesce(p_boat_code, ''))), '');
  IF v_boat_code = '黑豹' THEN
    v_boat_code := 'FI23';
  END IF;
  IF v_boat_code IS NOT NULL AND v_boat_code NOT IN ('G21', 'G23', 'FI23', 'ALL') THEN
    RAISE EXCEPTION 'Invalid boat code';
  END IF;

  SELECT *
    INTO v_part
    FROM public.boat_parts
    WHERE id = p_part_id
      AND is_active = true
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found';
  END IF;
  IF v_part.current_quantity + v_delta < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory';
  END IF;

  UPDATE public.boat_parts
    SET current_quantity = current_quantity + v_delta
    WHERE id = p_part_id;

  INSERT INTO public.boat_part_movements (
    part_id,
    movement_type,
    quantity,
    boat_code,
    note,
    moved_at,
    created_by,
    created_by_email,
    affects_inventory
  )
  VALUES (
    p_part_id,
    p_movement_type,
    v_delta,
    v_boat_code,
    NULLIF(trim(coalesce(p_note, '')), ''),
    coalesce(p_moved_at, now()),
    auth.uid(),
    v_email,
    true
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'part_id', p_part_id,
    'previous_quantity', v_part.current_quantity,
    'current_quantity', v_part.current_quantity + v_delta,
    'delta', v_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_boat_part_movement(uuid, text, integer, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_boat_part_movement(uuid, text, integer, text, text, timestamptz) TO authenticated;

COMMENT ON TABLE public.boat_parts IS '船艇維修零件主檔與目前庫存';
COMMENT ON TABLE public.boat_part_movements IS '零件進貨、領用與盤點調整流水';
COMMENT ON COLUMN public.boat_part_movements.affects_inventory IS '舊 Excel 歷史紀錄為 false；系統啟用後交易為 true';
