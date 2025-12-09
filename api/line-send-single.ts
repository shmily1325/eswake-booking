import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!channelAccessToken) {
      return res.status(500).json({ error: 'LINE Channel Access Token not configured' });
    }

    const { lineUserId, message } = req.body;

    if (!lineUserId || !message) {
      return res.status(400).json({ error: 'Missing lineUserId or message' });
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LINE API Error:', errorData);
      return res.status(response.status).json({ 
        success: false, 
        error: errorData.message || 'Failed to send message',
        details: errorData
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error sending LINE message:', error);
    return res.status(500).json({ error: error.message });
  }
}

