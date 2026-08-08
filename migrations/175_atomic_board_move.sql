-- =============================================================================
-- 175_atomic_board_move.sql
--
-- Atomically move one active board-storage row to an empty slot and record the
-- operational memo in the same transaction. Historical rows are not changed.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.move_board_storage(
  p_board_id integer,
  p_target_slot_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board board_storage%ROWTYPE;
BEGIN
  PERFORM public.assert_membership_admin();
  PERFORM pg_advisory_xact_lock(hashtext('membership_lifecycle'));

  IF p_board_id IS NULL THEN
    RAISE EXCEPTION 'Board storage id is required';
  END IF;
  IF p_target_slot_number IS NULL OR p_target_slot_number NOT BETWEEN 1 AND 145 THEN
    RAISE EXCEPTION 'Board slot number must be between 1 and 145';
  END IF;

  SELECT *
  INTO v_board
  FROM board_storage
  WHERE id = p_board_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active board storage not found';
  END IF;
  IF v_board.slot_number = p_target_slot_number THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM board_storage
    WHERE slot_number = p_target_slot_number
      AND id <> p_board_id
  ) THEN
    RAISE EXCEPTION 'Board slot % is already occupied', p_target_slot_number
      USING ERRCODE = '23505';
  END IF;

  UPDATE board_storage
  SET slot_number = p_target_slot_number
  WHERE id = p_board_id;

  INSERT INTO member_notes (member_id, event_date, event_type, description)
  VALUES (
    v_board.member_id,
    public.membership_venue_date(),
    '備註',
    format('置板格位 #%s → #%s', v_board.slot_number, p_target_slot_number)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.move_board_storage(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_board_storage(integer, integer) TO authenticated;

COMMENT ON FUNCTION public.move_board_storage(integer, integer) IS
  '管理員原子換格：保留原置板資料並於同一交易寫入一筆換格備忘';

COMMIT;
