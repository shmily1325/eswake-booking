-- 記錄會員最後成功進入 LIFF 會員專區的時間（Asia/Taipei，YYYY-MM-DDTHH:mm:ss）
ALTER TABLE line_bindings
  ADD COLUMN IF NOT EXISTS last_liff_login_at TEXT;

COMMENT ON COLUMN line_bindings.last_liff_login_at IS
  '最後成功進入 LIFF 會員專區的時間（Asia/Taipei）';
