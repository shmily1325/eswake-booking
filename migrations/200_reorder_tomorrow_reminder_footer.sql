-- Keep the reminder ending in the same order for Chinese and English:
-- weather -> gate/parking -> closing.
UPDATE public.system_settings
SET setting_value = E'抵達時請按 LINE 官方帳號下方的「開門」鍵，通知教練協助開啟停車場鐵閘門。入場後請停黃色停車格，白色停車格請勿停放，謝謝配合🙏\n\n再麻煩準時抵達，明天見哦😊'
WHERE setting_key = 'tomorrow_reminder_footer_text'
  AND setting_value = E'再麻煩準時抵達，明天見哦😊\n\n抵達時請按 LINE 官方帳號下方的「開門」鍵，通知教練協助開啟停車場鐵閘門。入場後請停黃色停車格，白色停車格請勿停放，謝謝配合🙏';

UPDATE public.system_settings
SET setting_value = E'Hi {username}\n\nJust a reminder that we have {appointment}.{weather}\n\nWhen you arrive, tap "OPEN SESAME" at the bottom of our official LINE account to notify the coaches to open the parking gate. Please park in a yellow space; do not use the white spaces. Thank you for your cooperation 🙏\n\nPlease arrive on time. See you tomorrow! 😊'
WHERE setting_key = 'tomorrow_reminder_english_message_template'
  AND setting_value = E'Hi {username}\n\nJust a reminder that we have {appointment}.{weather}\n\nPlease arrive on time. See you tomorrow! 😊\n\nWhen you arrive, tap "OPEN SESAME" at the bottom of our official LINE account to notify the coaches to open the parking gate. Please park in a yellow space; do not use the white spaces. Thank you for your cooperation 🙏';
