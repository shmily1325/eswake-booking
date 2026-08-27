-- LIFF provider migration:
-- - Keep legacy bindings for history.
-- - Mark bindings created by the Messaging API provider as push-capable.
-- - Replace a member's active legacy binding atomically after successful re-binding.

ALTER TABLE public.line_bindings
  ADD COLUMN IF NOT EXISTS source_channel_id TEXT;

ALTER TABLE public.line_bindings
  ADD COLUMN IF NOT EXISTS can_push BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.line_bindings.source_channel_id IS
  'LINE Login channel that issued the access token used for this binding';

COMMENT ON COLUMN public.line_bindings.can_push IS
  'True only when this user ID belongs to the same provider as the Messaging API channel';

CREATE INDEX IF NOT EXISTS idx_line_bindings_pushable_member
  ON public.line_bindings(member_id)
  WHERE status = 'active' AND can_push = TRUE;

CREATE OR REPLACE FUNCTION public.bind_liff_member(
  p_line_user_id TEXT,
  p_phone TEXT,
  p_birthday DATE,
  p_source_channel_id TEXT,
  p_can_push BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone TEXT;
  v_match_count INTEGER;
  v_member_id UUID;
  v_member_phone TEXT;
  v_member JSONB;
  v_now_text TEXT;
  v_existing_member_id UUID;
BEGIN
  IF NULLIF(trim(p_line_user_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE 使用者識別');
  END IF;

  IF NULLIF(trim(p_source_channel_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE Channel 識別');
  END IF;

  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF length(v_clean_phone) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', '手機號碼格式無效');
  END IF;

  -- Preserve the current registration behavior: a valid birthday is required
  -- and is written to the member after the phone number identifies one member.
  IF p_birthday IS NULL OR p_birthday > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', '生日日期無效');
  END IF;

  SELECT count(*)
  INTO v_match_count
  FROM public.members m
  WHERE regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g') = v_clean_phone
    AND m.status = 'active';

  IF v_match_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到此手機號碼的會員資料');
  END IF;
  IF v_match_count > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', '手機號碼對應多筆會員，請聯絡工作人員');
  END IF;

  SELECT m.id, m.phone
  INTO v_member_id, v_member_phone
  FROM public.members m
  WHERE regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g') = v_clean_phone
    AND m.status = 'active'
  LIMIT 1;

  SELECT member_id
  INTO v_existing_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_existing_member_id IS NOT NULL AND v_existing_member_id <> v_member_id THEN
    RETURN jsonb_build_object('success', false, 'error', '此 LINE 帳號已綁定其他會員');
  END IF;

  v_now_text := to_char(
    CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei',
    'YYYY-MM-DD"T"HH24:MI:SS'
  );

  -- This update and the insert below run in the same function transaction.
  -- A failed insert therefore cannot leave the member without an active binding.
  UPDATE public.line_bindings
  SET status = 'inactive'
  WHERE member_id = v_member_id
    AND line_user_id <> p_line_user_id
    AND status = 'active';

  INSERT INTO public.line_bindings (
    line_user_id,
    member_id,
    phone,
    status,
    source_channel_id,
    can_push,
    last_liff_login_at,
    completed_at,
    created_at
  ) VALUES (
    p_line_user_id,
    v_member_id,
    v_member_phone,
    'active',
    trim(p_source_channel_id),
    p_can_push,
    v_now_text,
    v_now_text,
    v_now_text
  )
  ON CONFLICT (line_user_id) DO UPDATE
  SET
    member_id = EXCLUDED.member_id,
    phone = EXCLUDED.phone,
    status = 'active',
    source_channel_id = EXCLUDED.source_channel_id,
    can_push = EXCLUDED.can_push,
    last_liff_login_at = EXCLUDED.last_liff_login_at,
    completed_at = EXCLUDED.completed_at,
    created_at = COALESCE(line_bindings.created_at, EXCLUDED.created_at);

  UPDATE public.members
  SET birthday = to_char(p_birthday, 'YYYY-MM-DD')
  WHERE id = v_member_id;

  v_member := public._liff_member_snapshot(v_member_id);
  RETURN jsonb_build_object('success', true, 'member', v_member);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', '會員綁定服務暫時無法使用');
END;
$$;

REVOKE ALL ON FUNCTION public.bind_liff_member(TEXT, TEXT, DATE, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_liff_member(TEXT, TEXT, DATE, TEXT, BOOLEAN)
  TO service_role;
