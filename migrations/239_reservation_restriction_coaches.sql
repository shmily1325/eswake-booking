BEGIN;

ALTER TABLE public.reservation_restrictions
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'all';

ALTER TABLE public.reservation_restrictions
  DROP CONSTRAINT IF EXISTS reservation_restrictions_scope_check;
ALTER TABLE public.reservation_restrictions
  ADD CONSTRAINT reservation_restrictions_scope_check
  CHECK (scope IN ('all', 'coaches'));

CREATE TABLE IF NOT EXISTS public.reservation_restriction_coaches (
  restriction_id BIGINT NOT NULL
    REFERENCES public.reservation_restrictions(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL
    REFERENCES public.coaches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (restriction_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_restriction_coaches_coach
  ON public.reservation_restriction_coaches(coach_id);

ALTER TABLE public.reservation_restriction_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_restriction_coaches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservation_restriction_coaches_all_staff"
  ON public.reservation_restriction_coaches;
CREATE POLICY "reservation_restriction_coaches_all_staff"
  ON public.reservation_restriction_coaches
  FOR ALL TO authenticated
  USING (public.is_allowed_staff())
  WITH CHECK (public.is_allowed_staff());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.reservation_restriction_coaches TO authenticated;

CREATE OR REPLACE VIEW public.reservation_restrictions_with_announcement_view AS
SELECT
  r.announcement_id,
  r.start_date,
  r.start_time,
  r.end_date,
  r.end_time,
  r.is_active,
  a.content,
  r.id,
  r.scope,
  COALESCE(
    ARRAY_AGG(rrc.coach_id ORDER BY rrc.coach_id)
      FILTER (WHERE rrc.coach_id IS NOT NULL),
    ARRAY[]::UUID[]
  ) AS coach_ids,
  COALESCE(
    ARRAY_AGG(c.name ORDER BY c.name)
      FILTER (WHERE c.name IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS coach_names
FROM public.reservation_restrictions r
JOIN public.daily_announcements a ON a.id = r.announcement_id
LEFT JOIN public.reservation_restriction_coaches rrc
  ON rrc.restriction_id = r.id
LEFT JOIN public.coaches c ON c.id = rrc.coach_id
GROUP BY r.id, a.id, a.content;

GRANT SELECT ON public.reservation_restrictions_with_announcement_view
  TO anon, authenticated;

COMMENT ON COLUMN public.reservation_restrictions.scope IS
  'all=全部預約；coaches=僅限制 reservation_restriction_coaches 中的人員';
COMMENT ON TABLE public.reservation_restriction_coaches IS
  '預約限制指定的人員；同一人擔任教練或駕駛都受限制';

CREATE OR REPLACE FUNCTION public.save_reservation_restriction(
  p_announcement_id BIGINT,
  p_start_date DATE,
  p_start_time TIME,
  p_end_date DATE,
  p_end_time TIME,
  p_scope TEXT,
  p_coach_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_restriction_id BIGINT;
BEGIN
  IF NOT public.is_allowed_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_scope NOT IN ('all', 'coaches') THEN
    RAISE EXCEPTION 'Invalid restriction scope';
  END IF;
  IF p_scope = 'coaches'
     AND COALESCE(array_length(p_coach_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one coach is required';
  END IF;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Restriction end date precedes start date';
  END IF;
  IF p_end_date = p_start_date
     AND p_start_time IS NOT NULL
     AND p_end_time IS NOT NULL
     AND p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'Restriction end time must be later than start time';
  END IF;

  INSERT INTO public.reservation_restrictions (
    announcement_id,
    start_date,
    start_time,
    end_date,
    end_time,
    is_active,
    scope
  ) VALUES (
    p_announcement_id,
    p_start_date,
    p_start_time,
    p_end_date,
    p_end_time,
    true,
    p_scope
  )
  ON CONFLICT (announcement_id) DO UPDATE SET
    start_date = EXCLUDED.start_date,
    start_time = EXCLUDED.start_time,
    end_date = EXCLUDED.end_date,
    end_time = EXCLUDED.end_time,
    is_active = true,
    scope = EXCLUDED.scope
  RETURNING id INTO v_restriction_id;

  DELETE FROM public.reservation_restriction_coaches
  WHERE restriction_id = v_restriction_id;

  IF p_scope = 'coaches' THEN
    INSERT INTO public.reservation_restriction_coaches (
      restriction_id,
      coach_id
    )
    SELECT v_restriction_id, coach_id
    FROM unnest(p_coach_ids) AS coach_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_restriction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_reservation_restriction(
  BIGINT, DATE, TIME, DATE, TIME, TEXT, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_reservation_restriction(
  BIGINT, DATE, TIME, DATE, TIME, TEXT, UUID[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.booking_restriction_reason(
  p_booking_id INTEGER,
  p_person_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_include_global BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.content
  FROM public.bookings b
  JOIN public.reservation_restrictions r
    ON r.is_active
  JOIN public.daily_announcements a ON a.id = r.announcement_id
  WHERE b.id = p_booking_id
    AND COALESCE(b.status, '') <> 'cancelled'
    AND (
      (p_include_global AND r.scope = 'all')
      OR (
        r.scope = 'coaches'
        AND EXISTS (
          SELECT 1
          FROM public.reservation_restriction_coaches rrc
          WHERE rrc.restriction_id = r.id
            AND rrc.coach_id = ANY(COALESCE(p_person_ids, ARRAY[]::UUID[]))
        )
      )
    )
    AND (
      (LEFT(b.start_at, 10)::DATE + SUBSTRING(b.start_at FROM 12 FOR 5)::TIME)
        < CASE
            WHEN r.end_time IS NULL THEN r.end_date::TIMESTAMP + INTERVAL '1 day'
            ELSE r.end_date + r.end_time
          END
      AND
      (LEFT(b.start_at, 10)::DATE + SUBSTRING(b.start_at FROM 12 FOR 5)::TIME
        + make_interval(mins => b.duration_min))
        > (r.start_date + COALESCE(r.start_time, TIME '00:00'))
    )
  ORDER BY r.start_date, r.start_time NULLS FIRST, r.id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.enforce_booking_restriction_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
  v_people UUID[];
BEGIN
  IF COALESCE(NEW.status, '') = 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.start_at IS NOT DISTINCT FROM OLD.start_at
     AND NEW.duration_min IS NOT DISTINCT FROM OLD.duration_min
     AND NOT (
       COALESCE(OLD.status, '') = 'cancelled'
       AND COALESCE(NEW.status, '') <> 'cancelled'
     ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(ARRAY_AGG(person_id), ARRAY[]::UUID[])
  INTO v_people
  FROM (
    SELECT coach_id AS person_id
    FROM public.booking_coaches
    WHERE booking_id = NEW.id
    UNION
    SELECT driver_id AS person_id
    FROM public.booking_drivers
    WHERE booking_id = NEW.id
  ) people;

  SELECT public.booking_restriction_reason(
    NEW.id,
    v_people,
    true
  ) INTO v_reason;

  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'BOOKING_RESTRICTION: %', v_reason
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_booking_restriction_on_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
  v_person_id UUID;
BEGIN
  v_person_id := CASE
    WHEN TG_TABLE_NAME = 'booking_drivers' THEN NEW.driver_id
    ELSE NEW.coach_id
  END;

  SELECT public.booking_restriction_reason(
    NEW.booking_id,
    ARRAY[v_person_id],
    true
  ) INTO v_reason;

  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'BOOKING_RESTRICTION: %', v_reason
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_booking_people(
  p_booking_id INTEGER,
  p_coach_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_driver_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_allowed_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.booking_coaches
  WHERE booking_id = p_booking_id
    AND NOT (coach_id = ANY(COALESCE(p_coach_ids, ARRAY[]::UUID[])));

  INSERT INTO public.booking_coaches (booking_id, coach_id)
  SELECT p_booking_id, desired.coach_id
  FROM unnest(COALESCE(p_coach_ids, ARRAY[]::UUID[])) AS desired(coach_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.booking_coaches existing
    WHERE existing.booking_id = p_booking_id
      AND existing.coach_id = desired.coach_id
  )
  ON CONFLICT (booking_id, coach_id) DO NOTHING;

  DELETE FROM public.booking_drivers
  WHERE booking_id = p_booking_id
    AND NOT (driver_id = ANY(COALESCE(p_driver_ids, ARRAY[]::UUID[])));

  INSERT INTO public.booking_drivers (booking_id, driver_id)
  SELECT p_booking_id, desired.driver_id
  FROM unnest(COALESCE(p_driver_ids, ARRAY[]::UUID[])) AS desired(driver_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.booking_drivers existing
    WHERE existing.booking_id = p_booking_id
      AND existing.driver_id = desired.driver_id
  )
  ON CONFLICT (booking_id, driver_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_booking_schedule_and_people(
  p_booking_id INTEGER,
  p_boat_id INTEGER,
  p_start_at TEXT,
  p_duration_min INTEGER,
  p_cleanup_minutes INTEGER,
  p_coach_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_driver_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_allowed_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.bookings
  SET
    boat_id = p_boat_id,
    start_at = p_start_at,
    duration_min = p_duration_min,
    cleanup_minutes = p_cleanup_minutes
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  PERFORM public.save_booking_people(
    p_booking_id,
    p_coach_ids,
    p_driver_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_booking_people(INTEGER, UUID[], UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_people(INTEGER, UUID[], UUID[])
  TO authenticated;
REVOKE ALL ON FUNCTION public.save_booking_schedule_and_people(
  INTEGER, INTEGER, TEXT, INTEGER, INTEGER, UUID[], UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_schedule_and_people(
  INTEGER, INTEGER, TEXT, INTEGER, INTEGER, UUID[], UUID[]
) TO authenticated;

DROP TRIGGER IF EXISTS trg_enforce_booking_restriction
  ON public.bookings;
CREATE CONSTRAINT TRIGGER trg_enforce_booking_restriction
  AFTER INSERT OR UPDATE
  ON public.bookings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_restriction_on_booking();

DROP TRIGGER IF EXISTS trg_enforce_booking_coach_restriction
  ON public.booking_coaches;
CREATE CONSTRAINT TRIGGER trg_enforce_booking_coach_restriction
  AFTER INSERT OR UPDATE
  ON public.booking_coaches
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_restriction_on_person();

DROP TRIGGER IF EXISTS trg_enforce_booking_driver_restriction
  ON public.booking_drivers;
CREATE CONSTRAINT TRIGGER trg_enforce_booking_driver_restriction
  AFTER INSERT OR UPDATE
  ON public.booking_drivers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_restriction_on_person();

REVOKE ALL ON FUNCTION public.booking_restriction_reason(INTEGER, UUID[], BOOLEAN)
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
