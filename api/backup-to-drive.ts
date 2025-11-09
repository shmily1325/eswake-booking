import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

interface BackupRequest {
  startDate?: string;
  endDate?: string;
  manual?: boolean;
}

export default async function handler(req: Request): Promise<Response> {
  // 允许 GET (cron job) 和 POST (手动触发) 请求
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 获取环境变量
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }
    if (!googleClientEmail || !googlePrivateKey || !googleDriveFolderId) {
      throw new Error('Missing Google Drive credentials');
    }

    // 解析请求体（仅 POST 请求）
    let body: BackupRequest = {};
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
    }
    const { startDate, endDate, manual = false } = body;

    // 创建 Supabase 客户端（使用 service role key 以绕过 RLS）
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 构建查询
    let query = supabase
      .from('bookings')
      .select(`
        *,
        boats:boat_id (name, color)
      `)
      .order('start_at', { ascending: false });

    // 如果指定了日期范围
    if (startDate && endDate) {
      query = query
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDate}T23:59:59`);
    }

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) throw bookingsError;

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({ error: '沒有數據可以備份', bookingsCount: 0 }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 获取所有预约的教练信息和确认状态
    const bookingIds = bookings.map((b) => b.id);
    const { data: coachesData } = await supabase
      .from('booking_coaches')
      .select('booking_id, coaches:coach_id(name), coach_confirmed, confirmed_at, actual_duration_min')
      .in('booking_id', bookingIds);

    // 整理教练信息和确认状态
    const coachesByBooking: { [key: number]: string[] } = {};
    const confirmByBooking: {
      [key: number]: { confirmed: boolean; confirmedAt: string | null; actualDuration: number | null };
    } = {};

    for (const item of coachesData || []) {
      const bookingId = item.booking_id;
      const coach = (item as any).coaches;
      if (coach) {
        if (!coachesByBooking[bookingId]) {
          coachesByBooking[bookingId] = [];
        }
        coachesByBooking[bookingId].push(coach.name);
      }

      // 收集确认状态（任一教练确认即算已确认）
      if (item.coach_confirmed) {
        confirmByBooking[bookingId] = {
          confirmed: true,
          confirmedAt: item.confirmed_at,
          actualDuration: item.actual_duration_min,
        };
      } else if (!confirmByBooking[bookingId]) {
        confirmByBooking[bookingId] = {
          confirmed: false,
          confirmedAt: null,
          actualDuration: null,
        };
      }
    }

    // 格式化时间函数
    const formatDateTime = (isoString: string | null): string => {
      if (!isoString) return '';
      const dt = isoString.substring(0, 16); // "2025-10-30T08:30"
      const [date, time] = dt.split('T');
      if (!date || !time) return '';
      const [year, month, day] = date.split('-');
      return `${year}/${month}/${day} ${time}`;
    };

    // 生成 CSV
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += '學生姓名,預約日期,抵達時間,下水時間,時長(分鐘),船隻,教練,活動類型,教練回報,回報時間,狀態,備註,創建時間\n';

    bookings.forEach((booking) => {
      const boat = (booking as any).boats?.name || '未指定';
      const coaches = coachesByBooking[booking.id]?.join('/') || '未指定';
      const activities = booking.activity_types?.join('+') || '';
      const notes = (booking.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');

      // 计算抵达时间（提前30分钟）
      const startTime = booking.start_at.substring(11, 16); // "08:30"
      const [startHour, startMin] = startTime.split(':').map(Number);
      const totalMinutes = startHour * 60 + startMin - 30;
      const arrivalHour = Math.floor(totalMinutes / 60);
      const arrivalMin = totalMinutes % 60;
      const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMin.toString().padStart(2, '0')}`;

      // 预约日期
      const bookingDate = booking.start_at.substring(0, 10).replace(/-/g, '/');

      // 教练确认状态
      const confirmInfo = confirmByBooking[booking.id];
      const coachConfirmed = confirmInfo?.confirmed ? '已回報' : '未回報';
      const confirmedAt = formatDateTime(confirmInfo?.confirmedAt || null);

      // 状态翻译
      const statusMap: { [key: string]: string } = {
        Confirmed: '已確認',
        Cancelled: '已取消',
      };
      const status = statusMap[booking.status] || booking.status;

      csv += `"${booking.student}","${bookingDate}","${arrivalTime}","${startTime}",${booking.duration_min},"${boat}","${coaches}","${activities}","${coachConfirmed}","${confirmedAt}","${status}","${notes}","${formatDateTime(booking.created_at)}"\n`;
    });

    // 创建 Google Drive 客户端
    const auth = new google.auth.JWT({
      email: googleClientEmail,
      key: googlePrivateKey,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 生成文件名
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toISOString().split('T')[1].substring(0, 5).replace(':', '');
    const prefix = manual ? '手動備份' : '自動備份';
    const fileName = `${prefix}_預約備份_${dateStr}_${timeStr}.csv`;

    // 上传文件到 Google Drive
    const fileMetadata = {
      name: fileName,
      parents: [googleDriveFolderId],
    };

    const media = {
      mimeType: 'text/csv',
      body: csv,
    };

    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ 成功備份 ${bookings.length} 筆資料到 Google Drive`,
        fileName: uploadResponse.data.name,
        fileId: uploadResponse.data.id,
        webViewLink: uploadResponse.data.webViewLink,
        bookingsCount: bookings.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({
        error: '備份失敗',
        message: error.message || 'Unknown error',
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

