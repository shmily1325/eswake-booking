-- =============================================================================
-- 182_swap_bookings_atomic.sql
--
-- Atomically swap two bookings' boat + start_at + cleanup_minutes in one
-- transaction, with optimistic concurrency on the expected current values.
-- Business conflict checks stay in the app; this prevents half-applied swaps.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.swap_bookings(
  p_booking_a_id integer,
  p_booking_b_id integer,
  p_a_expected_boat_id integer,
  p_a_expected_start_at text,
  p_a_new_boat_id integer,
  p_a_new_start_at text,
  p_a_new_cleanup_minutes integer,
  p_b_expected_boat_id integer,
  p_b_expected_start_at text,
  p_b_new_boat_id integer,
  p_b_new_start_at text,
  p_b_new_cleanup_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_first_id integer;
  v_second_id integer;
  v_a bookings%ROWTYPE;
  v_b bookings%ROWTYPE;
  v_day text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_booking_a_id IS NULL OR p_booking_b_id IS NULL THEN
    RAISE EXCEPTION 'Both booking ids are required';
  END IF;

  IF p_booking_a_id = p_booking_b_id THEN
    RAISE EXCEPTION 'Cannot swap a booking with itself';
  END IF;

  v_day := left(p_a_expected_start_at, 10);
  IF left(p_b_expected_start_at, 10) IS DISTINCT FROM v_day
     OR left(p_a_new_start_at, 10) IS DISTINCT FROM v_day
     OR left(p_b_new_start_at, 10) IS DISTINCT FROM v_day THEN
    RAISE EXCEPTION 'Swap is only allowed within the same day';
  END IF;

  -- Serialize same-day swaps; business conflict checks stay in the app
  PERFORM pg_advisory_xact_lock(hashtext('swap_bookings:' || v_day));

  -- Stable lock order to avoid deadlocks between concurrent swaps
  IF p_booking_a_id < p_booking_b_id THEN
    v_first_id := p_booking_a_id;
    v_second_id := p_booking_b_id;
  ELSE
    v_first_id := p_booking_b_id;
    v_second_id := p_booking_a_id;
  END IF;

  PERFORM 1 FROM bookings WHERE id = v_first_id FOR UPDATE;
  PERFORM 1 FROM bookings WHERE id = v_second_id FOR UPDATE;

  SELECT * INTO v_a FROM bookings WHERE id = p_booking_a_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking A not found';
  END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_b_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking B not found';
  END IF;

  IF COALESCE(v_a.status, '') = 'cancelled' OR COALESCE(v_b.status, '') = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled bookings cannot be swapped';
  END IF;

  IF v_a.boat_id IS DISTINCT FROM p_a_expected_boat_id
     OR v_a.start_at IS DISTINCT FROM p_a_expected_start_at
     OR v_b.boat_id IS DISTINCT FROM p_b_expected_boat_id
     OR v_b.start_at IS DISTINCT FROM p_b_expected_start_at THEN
    RAISE EXCEPTION 'Bookings were modified by someone else (stale)';
  END IF;

  UPDATE bookings
  SET
    boat_id = p_a_new_boat_id,
    start_at = p_a_new_start_at,
    cleanup_minutes = p_a_new_cleanup_minutes
  WHERE id = p_booking_a_id;

  UPDATE bookings
  SET
    boat_id = p_b_new_boat_id,
    start_at = p_b_new_start_at,
    cleanup_minutes = p_b_new_cleanup_minutes
  WHERE id = p_booking_b_id;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_bookings(
  integer, integer,
  integer, text, integer, text, integer,
  integer, text, integer, text, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.swap_bookings(
  integer, integer,
  integer, text, integer, text, integer,
  integer, text, integer, text, integer
) TO authenticated;

COMMENT ON FUNCTION public.swap_bookings(
  integer, integer,
  integer, text, integer, text, integer,
  integer, text, integer, text, integer
) IS
  'Atomically swap two bookings boat/start/cleanup with optimistic concurrency';

COMMIT;
