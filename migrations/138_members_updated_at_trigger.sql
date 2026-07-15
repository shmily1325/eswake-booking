-- 記錄會員「非金流」資料的實際異動時間。
-- 包含基本資料、會籍、備忘錄與置板；交易同步的餘額／票券異動不計入。

CREATE OR REPLACE FUNCTION update_members_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(
    NEW.name,
    NEW.nickname,
    NEW.phone,
    NEW.birthday,
    NEW.notes,
    NEW.membership_type,
    NEW.membership_start_date,
    NEW.membership_end_date,
    NEW.membership_partner_id,
    NEW.board_slot_number,
    NEW.board_expiry_date,
    NEW.status
  ) IS DISTINCT FROM ROW(
    OLD.name,
    OLD.nickname,
    OLD.phone,
    OLD.birthday,
    OLD.notes,
    OLD.membership_type,
    OLD.membership_start_date,
    OLD.membership_end_date,
    OLD.membership_partner_id,
    OLD.board_slot_number,
    OLD.board_expiry_date,
    OLD.status
  ) OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at = TO_CHAR(
      clock_timestamp() AT TIME ZONE 'Asia/Taipei',
      'YYYY-MM-DD"T"HH24:MI:SS'
    );
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_members_updated_at ON members;

CREATE TRIGGER trigger_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_members_updated_at();

CREATE OR REPLACE FUNCTION touch_member_from_related_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_member_id UUID;
  new_member_id UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_member_id := OLD.member_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_member_id := NEW.member_id;
  END IF;

  UPDATE members
  SET updated_at = TO_CHAR(
    clock_timestamp() AT TIME ZONE 'Asia/Taipei',
    'YYYY-MM-DD"T"HH24:MI:SS'
  )
  WHERE id IN (old_member_id, new_member_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_member_notes_touch_member ON member_notes;
CREATE TRIGGER trigger_member_notes_touch_member
  AFTER INSERT OR UPDATE OR DELETE ON member_notes
  FOR EACH ROW
  EXECUTE FUNCTION touch_member_from_related_record();

DROP TRIGGER IF EXISTS trigger_board_storage_touch_member ON board_storage;
CREATE TRIGGER trigger_board_storage_touch_member
  AFTER INSERT OR UPDATE OR DELETE ON board_storage
  FOR EACH ROW
  EXECUTE FUNCTION touch_member_from_related_record();
