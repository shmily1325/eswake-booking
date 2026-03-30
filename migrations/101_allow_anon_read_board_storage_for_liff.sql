-- =============================================================================
-- 101_allow_anon_read_board_storage_for_liff.sql
--
-- 問題：LIFF 使用 Supabase anon；若 board_storage 沒有給 anon 的 SELECT 政策，
--       前端查詢會失敗，畫面置板區會變「—」（程式會改讀 members 備用欄位，可能仍空）。
--
-- 執行本檔「之前」若要自己先看現狀，可在 SQL Editor 單獨跑（不寫入）：
--
--   SELECT tablename, policyname, roles, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'board_storage'
--   ORDER BY policyname;
--
--   SELECT c.relname, c.relrowsecurity AS rls_enabled
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relname = 'board_storage';
--
-- 套用後仍查不到置板時請查：
--   1) 本檔是否已成功執行、pg_policies 是否出現 anon + SELECT
--   2) board_storage 是否有該 member_id、status = 'active' 的列
--   3) line_bindings 綁定的 member_id 是否與上列一致
--   4) 僅有 members.board_slot_number / board_expiry_date 舊欄位時，LIFF 會顯示備援列
-- =============================================================================

-- 變更前先將「當下」RLS／政策列在 migration log（Supabase / psql 的 Messages 可看 NOTICE）
DO $diag$
DECLARE
  r RECORD;
  rls_enabled BOOLEAN;
  tbl_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'board_storage'
  ) INTO tbl_exists;

  IF NOT tbl_exists THEN
    RAISE NOTICE '[101] board_storage: 在 public 找不到資料表，後續 CREATE POLICY 可能失敗';
  ELSE
    SELECT c.relrowsecurity INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'board_storage';

    RAISE NOTICE '[101] board_storage: RLS 是否開啟 = %', rls_enabled;
  END IF;

  RAISE NOTICE '[101] board_storage 既有政策（變更前）:';
  FOR r IN
    SELECT policyname, cmd::text AS cmd, array_to_string(roles, ', ') AS role_list
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'board_storage'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '[101]   · % | % | roles: %', r.policyname, r.cmd, r.role_list;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'board_storage'
  ) THEN
    RAISE NOTICE '[101] （尚無任何政策；僅 authenticated 時 anon 無法讀取）';
  END IF;
END
$diag$;

DROP POLICY IF EXISTS "Allow anon users to read board_storage" ON board_storage;

CREATE POLICY "Allow anon users to read board_storage"
ON board_storage FOR SELECT
TO anon
USING (true);

-- 套用後請再查一次 pg_policies，應多一筆 policyname 同上、roles 含 anon、cmd 為 SELECT
