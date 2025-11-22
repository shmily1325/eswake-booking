import { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// 時區處理：獲取本地日期和時間字串（避免 UTC 時區問題）
function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}${minutes}`
}

function getLocalTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

interface BackupRequest {
  startDate?: string;
  endDate?: string;
  manual?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const logStep = (step: string, data?: any) => {
    const elapsed = Date.now() - startTime;
    console.log(`[${elapsed}ms] ${step}`, data ? JSON.stringify(data).substring(0, 200) : '');
  };

  let appendLogEntry: (status: 'SUCCESS' | 'ERROR', payload: {
    manual: boolean;
    bookingsCount: number;
    sheetTitle?: string;
    sheetUrl?: string;
    executionTime: number;
    message: string;
    details?: string;
  }) => Promise<void> = async () => {};
  let bookingsForLog = 0;
  let manualFlag = false;

  // 允许 GET (cron job) 和 POST (手动触发) 请求
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    logStep('1. 开始备份流程');
    
    // 获取环境变量
    logStep('2. 检查环境变量');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const googleSheetsSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!supabaseUrl || !supabaseServiceKey) {
      logStep('错误: Missing Supabase credentials');
      throw new Error('Missing Supabase credentials');
    }
    if (!googleClientEmail || !googlePrivateKey || !googleSheetsSpreadsheetId) {
      logStep('错误: Missing Google Sheets credentials');
      throw new Error('Missing Google Sheets credentials');
    }

    // 验证試算表 ID
    const cleanedSpreadsheetId = googleSheetsSpreadsheetId.split('?')[0].split('&')[0].trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanedSpreadsheetId)) {
      logStep('错误: 无效的 Google Sheets 試算表 ID', { spreadsheetId: cleanedSpreadsheetId });
      throw new Error(`無效的 Google Sheets 試算表 ID。請確認 GOOGLE_SHEETS_SPREADSHEET_ID 只包含 ID，本次取得: ${cleanedSpreadsheetId.substring(0, 50)}`);
    }

    logStep('2.1 环境变量检查完成', { 
      spreadsheetIdLength: cleanedSpreadsheetId.length,
      spreadsheetIdPreview: cleanedSpreadsheetId.substring(0, 12) + '...'
    });

    logStep('2.2 初始化 Google Sheets 客户端');
    const auth = new google.auth.JWT({
      email: googleClientEmail,
      key: googlePrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    logStep('2.3 Google Sheets 客户端初始化完成');

    const spreadsheetId = cleanedSpreadsheetId;
    const logSheetTitle = 'Backup Logs';
    let logSheetReady = false;

    const ensureLogSheet = async () => {
      if (logSheetReady) return;
      const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      });
      const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === logSheetTitle);
      if (!exists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: logSheetTitle,
                  },
                },
              },
            ],
          },
        });
      }
      logSheetReady = true;
    };

    appendLogEntry = async (status: 'SUCCESS' | 'ERROR', payload: {
      manual: boolean;
      bookingsCount: number;
      sheetTitle?: string;
      sheetUrl?: string;
      executionTime: number;
      message: string;
      details?: string;
    }) => {
      try {
        await ensureLogSheet();
        const timestamp = getLocalTimestamp();
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${logSheetTitle}'!A1`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [[
              timestamp,
              status,
              payload.manual ? '手動' : '自動',
              payload.bookingsCount,
              payload.sheetTitle ?? '',
              payload.sheetUrl ?? '',
              payload.executionTime,
              payload.message,
              payload.details ?? '',
            ]],
          },
        });
      } catch (logError) {
        console.error('Backup log append failed:', logError);
      }
    };

    // 解析请求体（仅 POST 请求）
    let body: BackupRequest = {};
    if (req.method === 'POST') {
      body = req.body || {};
    }
    const { startDate, endDate, manual = false } = body;
    manualFlag = Boolean(manual);
    logStep('3. 请求参数', { startDate, endDate, manual: manualFlag });

    // 创建 Supabase 客户端（使用 service role key 以绕过 RLS）
    logStep('4. 创建 Supabase 客户端');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 构建查询
    logStep('5. 查询预约数据');
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
    logStep('5.1 预约数据查询完成', { count: bookings?.length || 0, error: bookingsError?.message });

    if (bookingsError) {
      logStep('错误: 预约查询失败', bookingsError);
      throw bookingsError;
    }

    if (!bookings || bookings.length === 0) {
      logStep('警告: 没有数据可以备份');
      return res.status(400).json({ error: '沒有數據可以備份', bookingsCount: 0 });
    }
    bookingsForLog = bookings.length;

    // 获取所有预约的教练信息、参与者和驾驶信息
    logStep('6. 查询关联数据（教练、参与者、驾驶）');
    const bookingIds = bookings.map((b) => b.id);
    logStep('6.1 预约ID列表', { count: bookingIds.length });
    
    const [coachesResult, participantsResult, driversResult] = await Promise.all([
      supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(name)')
        .in('booking_id', bookingIds),
      supabase
        .from('booking_participants')
        .select('booking_id, participant_name, duration_min, lesson_type')
        .in('booking_id', bookingIds),
      supabase
        .from('bookings')
        .select('id, driver_coach_id')
        .in('id', bookingIds)
        .not('driver_coach_id', 'is', null)
    ]);
    logStep('6.2 关联数据查询完成', {
      coaches: coachesResult.data?.length || 0,
      participants: participantsResult.data?.length || 0,
      drivers: driversResult.data?.length || 0
    });

    // 整理教练信息
    const coachesByBooking: { [key: number]: string[] } = {};
    for (const item of coachesResult.data || []) {
      const bookingId = item.booking_id;
      const coach = (item as any).coaches;
      if (coach) {
        if (!coachesByBooking[bookingId]) {
          coachesByBooking[bookingId] = [];
        }
        coachesByBooking[bookingId].push(coach.name);
      }
    }
    
    // 整理参与者信息
    const participantsByBooking: { [key: number]: Array<{ name: string, duration: number, designated: boolean }> } = {};
    for (const p of participantsResult.data || []) {
      if (!participantsByBooking[p.booking_id]) {
        participantsByBooking[p.booking_id] = [];
      }
      // 使用 lesson_type 判斷是否為指定課
      const isDesignated = p.lesson_type === 'designated_paid' || p.lesson_type === 'designated_free';
      participantsByBooking[p.booking_id].push({
        name: p.participant_name,
        duration: p.duration_min,
        designated: isDesignated
      });
    }
    
    // 查询驾驶名称
    const driverIds = driversResult.data?.filter(b => b.driver_coach_id).map(b => b.driver_coach_id) || [];
    const driversById: { [key: string]: string } = {};
    if (driverIds.length > 0) {
      const { data: driversData } = await supabase
        .from('coaches')
        .select('id, name')
        .in('id', driverIds);
      driversData?.forEach(d => {
        driversById[d.id] = d.name;
      });
    }
    
    const driverByBooking: { [key: number]: string } = {};
    driversResult.data?.forEach(b => {
      if (b.driver_coach_id) {
        driverByBooking[b.id] = driversById[b.driver_coach_id] || '';
      }
    });

    // 格式化时间函数
    const formatDateTime = (isoString: string | null): string => {
      if (!isoString) return '';
      const dt = isoString.substring(0, 16);
      const [date, time] = dt.split('T');
      if (!date || !time) return '';
      const [year, month, day] = date.split('-');
      return `${year}/${month}/${day} ${time}`;
    };

    logStep('7. 生成工作表資料');
    const headerRow = ['預約人', '預約日期', '抵達時間', '下水時間', '預約時長(分鐘)', '船隻', '教練', '駕駛', '活動類型', '回報狀態', '參與者', '參與者時長', '指定課', '狀態', '備註', '創建時間'];
    const sheetRows: Array<Array<string | number>> = [headerRow];

    bookings.forEach((booking) => {
      const boat = (booking as any).boats?.name || '未指定';
      const coaches = coachesByBooking[booking.id]?.join('/') || '未指定';
      const driver = driverByBooking[booking.id] || '';
      const activities = booking.activity_types?.join('+') || '';
      const notes = (booking.notes || '').replace(/\n/g, ' ');

      const startTimeStr = booking.start_at.substring(11, 16);
      const [startHour, startMin] = startTimeStr.split(':').map(Number);
      const totalMinutes = startHour * 60 + startMin - 30;
      const arrivalHour = Math.floor(totalMinutes / 60);
      const arrivalMin = totalMinutes % 60;
      const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMin.toString().padStart(2, '0')}`;

      const bookingDate = booking.start_at.substring(0, 10).replace(/-/g, '/');

      const participants = participantsByBooking[booking.id] || [];
      const reportStatus = participants.length > 0 ? '已回報' : '未回報';

      const statusMap: { [key: string]: string } = {
        Confirmed: '已確認',
        confirmed: '已確認',
        Cancelled: '已取消',
        cancelled: '已取消',
      };
      const status = statusMap[booking.status] || booking.status;

      if (participants.length > 0) {
        participants.forEach((p, idx) => {
          const row: Array<string | number> = new Array(headerRow.length).fill('');
          if (idx === 0) {
            row[0] = booking.contact_name;
            row[1] = bookingDate;
            row[2] = arrivalTime;
            row[3] = startTimeStr;
            row[4] = booking.duration_min;
            row[5] = boat;
            row[6] = coaches;
            row[7] = driver;
            row[8] = activities;
            row[9] = reportStatus;
            row[13] = status;
            row[14] = notes;
            row[15] = formatDateTime(booking.created_at);
          }
          row[10] = p.name;
          row[11] = p.duration;
          row[12] = p.designated ? '是' : '否';
          sheetRows.push(row);
        });
      } else {
        sheetRows.push([
          booking.contact_name,
          bookingDate,
          arrivalTime,
          startTimeStr,
          booking.duration_min,
          boat,
          coaches,
          driver,
          activities,
          reportStatus,
          '',
          '',
          '',
          status,
          notes,
          formatDateTime(booking.created_at),
        ]);
      }
    });
    logStep('7.1 工作表資料生成完成', { rowCount: sheetRows.length });

    const now = new Date();
    const dateStr = getLocalDateString(now);
    const timeStr = getLocalTimeString(now);
    const prefix = manualFlag ? '手動備份' : '自動備份';
    let sheetTitle = `${prefix}_${dateStr}_${timeStr}`;
    logStep('9. 建立工作表', { sheetTitle });

    let sheetId: number | undefined;
    try {
      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTitle,
                },
              },
            },
          ],
        },
      });
      sheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
      logStep('9.1 工作表建立完成', { sheetId, sheetTitle });
    } catch (sheetError: any) {
      if (sheetError.message?.includes('already exists')) {
        sheetTitle = `${sheetTitle}_${Date.now().toString().slice(-4)}`;
        logStep('9.1 工作表名稱重複，使用新名稱', { sheetTitle });
        const retryResponse = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetTitle,
                  },
                },
              },
            ],
          },
        });
        sheetId = retryResponse.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
      } else {
        (sheetError as any).step = 'create_sheet';
        throw sheetError;
      }
    }

    logStep('9.2 寫入備份資料', { sheetTitle, rows: sheetRows.length });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: sheetRows,
      },
    });
    logStep('9.3 工作表資料寫入完成');

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId ?? 0}`;
    const totalTime = Date.now() - startTime;
    logStep('10. 备份完成', { totalTime: `${totalTime}ms`, bookingsCount: bookings.length, sheetTitle });

    await appendLogEntry('SUCCESS', {
      manual: manualFlag,
      bookingsCount: bookings.length,
      sheetTitle,
      sheetUrl,
      executionTime: totalTime,
      message: '備份成功',
    });

    return res.status(200).json({
      success: true,
      message: `✅ 成功備份 ${bookings.length} 筆資料到 Google Sheets`,
      sheetTitle,
      sheetUrl,
      bookingsCount: bookings.length,
      executionTime: totalTime,
    });
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    logStep('错误: 备份失败', { 
      error: error.message, 
      stack: error.stack?.substring(0, 500),
      totalTime: `${totalTime}ms`
    });
    console.error('Backup error:', error);

    try {
      const message = error.message || '未知錯誤';
      const details = error.details || error.stack?.substring(0, 1000);
      await appendLogEntry('ERROR', {
        manual: manualFlag,
        bookingsCount: bookingsForLog,
        executionTime: totalTime,
        message,
        details,
      });
    } catch (logError) {
      console.error('寫入失敗紀錄時發生錯誤', logError);
    }
    return res.status(500).json({
      error: '備份失敗',
      message: error.message || 'Unknown error',
      details: error.toString(),
      step: error.step || 'unknown',
      executionTime: totalTime,
    });
  }
}

