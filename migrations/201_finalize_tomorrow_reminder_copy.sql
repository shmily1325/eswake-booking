-- Keep the shared Chinese and English reminder copy concise and structurally aligned.
UPDATE public.system_settings
SET setting_value = '近期天氣變化較大，請在出發前透過官方 LINE 與我們確認最新天氣，並留意最新訊息哦！'
WHERE setting_key = 'tomorrow_reminder_weather_warning';

UPDATE public.system_settings
SET setting_value = E'抵達時請按官方 LINE 下方的「芝麻開門」，通知教練協助開啟停車場鐵閘門。\n入場後請停黃色停車格，白色停車格請勿停放，謝謝配合🙏\n\n再麻煩準時抵達，明天見哦😊'
WHERE setting_key = 'tomorrow_reminder_footer_text';

UPDATE public.system_settings
SET setting_value = E'Hi {username}\n\nJust a reminder that you have {appointment}.{weather}\n\nWhen you arrive, tap "OPEN SESAME" at the bottom of our official LINE account to notify the coaches to open the parking gate.\nPlease park in a yellow space. Do not park in the white spaces. Thank you for your cooperation. 🙏\n\nPlease arrive on time. See you tomorrow! 😊'
WHERE setting_key = 'tomorrow_reminder_english_message_template';

UPDATE public.system_settings
SET setting_value = 'Weather conditions have been changing recently. Before you leave, please check the latest weather with us through our official LINE account and watch for updates.'
WHERE setting_key = 'tomorrow_reminder_english_weather_warning';
