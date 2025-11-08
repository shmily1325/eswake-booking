import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// LINE webhook handler for member binding
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = req.body;
    const events = body.events || [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const lineUserId = event.source.userId;
        const messageText = event.message.text.trim();

        // Handle binding command
        if (messageText.startsWith('綁定')) {
          const phone = messageText.replace('綁定', '').trim();
          
          const { data: member } = await supabase
            .from('members')
            .select('id, name, phone')
            .eq('phone', phone)
            .eq('status', 'active')
            .single();

          if (member) {
            await supabase
              .from('members')
              .update({ line_user_id: lineUserId })
              .eq('id', member.id);

            await replyMessage(
              event.replyToken, 
              `✅ 綁定成功！\n\n${member.name} 您好，您已成功綁定 LINE 帳號。\n未來將自動收到預約提醒 🏄`
            );
          } else {
            await replyMessage(
              event.replyToken,
              `❌ 找不到此電話號碼的會員資料。\n\n請確認：\n1. 電話號碼正確\n2. 已在系統中註冊為會員`
            );
          }
        }
        else if (messageText === '取消綁定') {
          await supabase
            .from('members')
            .update({ line_user_id: null })
            .eq('line_user_id', lineUserId);

          await replyMessage(
            event.replyToken,
            '✅ 已取消綁定。\n如需重新綁定，請發送：綁定 您的電話號碼'
          );
        }
        else if (messageText === '說明' || messageText === '幫助') {
          await replyMessage(
            event.replyToken,
            `📱 ES Wake 預約提醒系統\n\n使用方式：\n1️⃣ 綁定帳號：\n   發送「綁定 您的電話號碼」\n   例如：綁定 0912345678\n\n2️⃣ 取消綁定：\n   發送「取消綁定」\n\n綁定後將自動收到預約提醒 🏄`
          );
        }
        else {
          await replyMessage(
            event.replyToken,
            '您好！請發送「說明」查看使用方式'
          );
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function replyMessage(replyToken: string, message: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
  
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: message }]
    })
  });
}

