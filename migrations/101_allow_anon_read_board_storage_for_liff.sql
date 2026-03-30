-- LIFF 使用 anon key；board_storage 僅有 authenticated 政策時，置板查詢會失敗，畫面永遠顯示「—」。
-- 與 add_transactions_read_policy.sql 相同模式：僅開放 SELECT，寫入仍僅限後台 authenticated；
-- 應用層以 member_id 查詢，僅載入當前綁定會員之置板。

DROP POLICY IF EXISTS "Allow anon users to read board_storage" ON board_storage;

CREATE POLICY "Allow anon users to read board_storage"
ON board_storage FOR SELECT
TO anon
USING (true);
