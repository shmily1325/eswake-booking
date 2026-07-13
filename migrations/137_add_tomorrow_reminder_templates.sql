-- 明日提醒文字模板改為資料庫共用，讓所有管理員使用同一份設定。
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
  (
    'tomorrow_reminder_include_weather_warning',
    'true',
    '明日提醒是否包含天氣警告'
  ),
  (
    'tomorrow_reminder_weather_warning',
    E'由於近期天氣變化較大，請務必在『啟程前』\n透過官方訊息與我們確認最新天氣狀況\n別忘了在出發前查收最新訊息哦！',
    '明日提醒天氣警告文字'
  ),
  (
    'tomorrow_reminder_footer_text',
    E'再麻煩幫我們準時抵達哦！謝謝！\n明天見哦😊\n抵達時 再麻煩幫我按開門鍵提醒教練們幫你開啟停車場鐵閘門 \n進來後再麻煩幫我停黃色停車格 \n白色的不能停 煩請配合🙏',
    '明日提醒結尾文字'
  )
ON CONFLICT (setting_key) DO NOTHING;
