-- Refresh only the original built-in Chinese copy; preserve independently customized text.
UPDATE public.system_settings
SET setting_value = '近期天氣變化較大，請務必在出發前透過官方 LINE 與我們確認最新天氣狀況，並留意最新訊息哦！'
WHERE setting_key = 'tomorrow_reminder_weather_warning'
  AND setting_value LIKE '由於近期天氣變化較大%';

UPDATE public.system_settings
SET setting_value = E'再麻煩準時抵達，明天見哦😊\n\n抵達時請按 LINE 官方帳號下方的「開門」鍵，通知教練協助開啟停車場鐵閘門。入場後請停黃色停車格，白色停車格請勿停放，謝謝配合🙏'
WHERE setting_key = 'tomorrow_reminder_footer_text'
  AND setting_value LIKE '再麻煩幫我們準時抵達哦！謝謝！%';

UPDATE public.system_settings
SET setting_value = E'Hi {username}\n\nJust a reminder that we have {appointment}.{weather}\n\nPlease arrive on time. See you tomorrow! 😊\n\nWhen you arrive, tap "OPEN SESAME" at the bottom of our official LINE account to notify the coaches to open the parking gate. Please park in a yellow space; do not use the white spaces. Thank you for your cooperation 🙏'
WHERE setting_key = 'tomorrow_reminder_english_message_template'
  AND setting_value LIKE '%Your punctual arrival would be appreciated!%';

UPDATE public.system_settings
SET setting_value = 'Weather conditions have been changing recently. Before setting out, please confirm the latest conditions with us via our official LINE account and check for updates.'
WHERE setting_key = 'tomorrow_reminder_english_weather_warning'
  AND setting_value LIKE 'Due to the unstable weather conditions in recent days%';

INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES
  (
    'tomorrow_reminder_english_message_template',
    E'Hi {username}\n\nJust a reminder that we have {appointment}.{weather}\n\nPlease arrive on time. See you tomorrow! 😊\n\nWhen you arrive, tap "OPEN SESAME" at the bottom of our official LINE account to notify the coaches to open the parking gate. Please park in a yellow space; do not use the white spaces. Thank you for your cooperation 🙏',
    '明日提醒英文訊息模板'
  ),
  (
    'tomorrow_reminder_english_weather_warning',
    'Weather conditions have been changing recently. Before setting out, please confirm the latest conditions with us via our official LINE account and check for updates.',
    '明日提醒英文天氣警告文字'
  )
ON CONFLICT (setting_key) DO NOTHING;
