import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Daily reminder function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if LINE reminder feature is enabled
    const { data: setting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'line_reminder_enabled')
      .single();

    if (!setting || setting.setting_value !== 'true') {
      return res.status(200).json({ message: 'LINE reminder disabled' });
    }

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Query bookings for tomorrow
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        id,
        start_at,
        duration_min,
        contact_name,
        member_id,
        members:member_id(line_user_id, name, phone),
        boats:boat_id(name)
      `)
      .gte('start_at', `${tomorrowStr}T00:00:00`)
      .lte('start_at', `${tomorrowStr}T23:59:59`);

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({ message: 'No bookings tomorrow' });
    }

    // Query coach information
    const bookingIds = bookings.map((b: any) => b.id);
    const { data: coachData } = await supabase
      .from('booking_coaches')
      .select('booking_id, coaches:coach_id(name)')
      .in('booking_id', bookingIds);

    // Map booking IDs to coaches
    const coachesByBooking: Record<string, string[]> = {};
    coachData?.forEach((item: any) => {
      if (!coachesByBooking[item.booking_id]) {
        coachesByBooking[item.booking_id] = [];
      }
      if (item.coaches) {
        coachesByBooking[item.booking_id].push(item.coaches.name);
      }
    });

    let sentCount = 0;

    // Send reminders
    for (const booking of bookings) {
      const member = (booking as any).members;
      
      if (!member || !member.line_user_id) continue;

      const [date, time] = (booking as any).start_at.split('T');
      const [year, month, day] = date.split('-');
      const dateStr = `${month}/${day}`;
      const timeStr = time.substring(0, 5);
      const coaches = coachesByBooking[(booking as any).id]?.join('、') || '未指定';
      const boat = (booking as any).boats?.name || '未指定';

      const message = `🌊 明日預約提醒\n\n${member.name} 您好！\n📅 明天 ${dateStr} ${timeStr}\n🚤 ${boat}\n👨‍🏫 教練：${coaches}\n⏱️ 時長：${(booking as any).duration_min}分鐘\n\n請提前10分鐘到場 🏄`;

      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${channelAccessToken}`
        },
        body: JSON.stringify({
          to: member.line_user_id,
          messages: [{ type: 'text', text: message }]
        })
      });

      sentCount++;
    }

    return res.status(200).json({ 
      success: true, 
      bookings: bookings.length,
      sent: sentCount 
    });
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

