import { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// 需要备份的所有表（按依赖顺序）
const TABLES_TO_BACKUP = [
  'members',
  'coaches',
  'boats',
  'board_storage',
  'boat_unavailable_dates',
  'coach_time_off',
  'bookings',
  'booking_members',
  'booking_coaches',
  'coach_reports',
  'booking_participants',
  'transactions',
  'daily_tasks',
  'daily_announcements',
  'audit_log',
  'system_settings',
  'line_bindings',
];

function getLocalTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
}

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const logStep = (step: string, data?: any) => {
    const elapsed = Date.now() - startTime;
    console.log(`[${elapsed}ms] ${step}`, data ? JSON.stringify(data).substring(0, 200) : '');
  };

  // 允许 GET (cron job) 和 POST (手动触发) 请求
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    logStep('1. 開始備份流程');
    
    // 获取环境变量
    logStep('2. 檢查環境變數');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Google Drive 資料夾 ID

    if (!supabaseUrl || !supabaseServiceKey) {
      logStep('錯誤: Missing Supabase credentials');
      throw new Error('Missing Supabase credentials');
    }
    if (!googleClientEmail || !googlePrivateKey) {
      logStep('錯誤: Missing Google Drive credentials');
      throw new Error('Missing Google Drive credentials');
    }

    // 初始化 Google Drive 客户端
    logStep('3. 初始化 Google Drive 客戶端');
    const auth = new google.auth.JWT({
      email: googleClientEmail,
      key: googlePrivateKey,
      scopes: [
        'https://www.googleapis.com/auth/drive.file', // 只能存取服務帳號建立的檔案
      ],
    });
    const drive = google.drive({ version: 'v3', auth });
    logStep('3.1 Google Drive 客戶端初始化完成');

    // 创建 Supabase 客户端
    logStep('4. 建立 Supabase 客戶端');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep('5. 開始生成完整資料庫備份');
    
    // 生成 SQL 备份内容
    let sqlContent = `-- =============================================\n`;
    sqlContent += `-- ESWake 預約系統 - 完整資料庫備份\n`;
    sqlContent += `-- 備份時間: ${getLocalTimestamp()}\n`;
    sqlContent += `-- =============================================\n\n`;

    const backupStats: { [table: string]: number } = {};

    // 备份每个表
    for (const tableName of TABLES_TO_BACKUP) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('id', { ascending: true });

        if (error) {
          console.error(`查詢表 ${tableName} 失敗:`, error);
          sqlContent += `-- ⚠️ 表 ${tableName} 備份失敗: ${error.message}\n`;
          continue;
        }

        if (!data || data.length === 0) {
          sqlContent += `-- 表 ${tableName} 無資料\n\n`;
          backupStats[tableName] = 0;
          continue;
        }

        sqlContent += `-- =============================================\n`;
        sqlContent += `-- 表: ${tableName} (${data.length} 筆記錄)\n`;
        sqlContent += `-- =============================================\n\n`;
        sqlContent += `-- 刪除表 ${tableName} 的現有資料\n`;
        sqlContent += `DELETE FROM ${tableName};\n\n`;

        // 生成 INSERT 语句
        for (const row of data) {
          const columns = Object.keys(row).join(', ');
          const values = Object.values(row).map((val: any) => {
            if (val === null) return 'NULL';
            if (typeof val === 'string') {
              const escaped = val.replace(/'/g, "''");
              return `'${escaped}'`;
            }
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (Array.isArray(val)) {
              const arrayValues = val.map(v => {
                if (typeof v === 'string') {
                  return `'${v.replace(/'/g, "''")}'`;
                }
                return String(v);
              }).join(', ');
              return `ARRAY[${arrayValues}]`;
            }
            return String(val);
          }).join(', ');

          sqlContent += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
        }

        sqlContent += `\n`;
        backupStats[tableName] = data.length;
        console.log(`✓ 表 ${tableName}: ${data.length} 筆記錄`);
      } catch (error: any) {
        console.error(`備份表 ${tableName} 時出錯:`, error);
        sqlContent += `-- ⚠️ 表 ${tableName} 備份出錯: ${error.message}\n\n`;
      }
    }

    // 添加备份统计
    sqlContent += `-- =============================================\n`;
    sqlContent += `-- 備份統計\n`;
    sqlContent += `-- =============================================\n`;
    sqlContent += `-- 備份時間: ${getLocalTimestamp()}\n`;
    sqlContent += `-- 總表數: ${TABLES_TO_BACKUP.length}\n`;
    const totalRecords = Object.values(backupStats).reduce((sum, count) => sum + count, 0);
    sqlContent += `-- 總記錄數: ${totalRecords}\n\n`;
    sqlContent += `-- 各表記錄數:\n`;
    for (const [table, count] of Object.entries(backupStats)) {
      sqlContent += `--   ${table}: ${count}\n`;
    }
    sqlContent += `-- =============================================\n`;

    logStep('6. 備份 SQL 內容生成完成', { 
      totalRecords,
      sqlSize: `${(sqlContent.length / 1024).toFixed(2)} KB`
    });

    // 上传到 Google Drive
    logStep('7. 開始上傳到 Google Drive');
    const fileName = `eswake_backup_${getLocalTimestamp()}.sql`;
    const fileMetadata = {
      name: fileName,
      mimeType: 'text/plain',
    };

    // 如果有指定資料夾 ID，將檔案上傳到該資料夾
    if (googleDriveFolderId) {
      (fileMetadata as any).parents = [googleDriveFolderId];
    }

    const media = {
      mimeType: 'text/plain',
      body: sqlContent, // 直接使用字符串，Google Drive API 會自動處理
    };

    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, size, createdTime',
    });

    logStep('8. 檔案上傳完成', {
      fileId: uploadResponse.data.id,
      fileName: uploadResponse.data.name,
      size: uploadResponse.data.size,
    });

    // 清理舊備份（保留最近 90 天的備份）
    logStep('9. 開始清理舊備份');
    const keepDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    const cutoffDateStr = cutoffDate.toISOString();

    try {
      // 查詢所有備份檔案
      const query = googleDriveFolderId
        ? `'${googleDriveFolderId}' in parents and name contains 'eswake_backup_' and name endsWith '.sql'`
        : `name contains 'eswake_backup_' and name endsWith '.sql'`;

      const listResponse = await drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
      });

      if (listResponse.data.files) {
        let deletedCount = 0;
        for (const file of listResponse.data.files) {
          if (file.createdTime && file.createdTime < cutoffDateStr) {
            try {
              await drive.files.delete({ fileId: file.id! });
              deletedCount++;
              logStep(`刪除舊備份: ${file.name}`, { createdTime: file.createdTime });
            } catch (deleteError) {
              console.error(`刪除檔案失敗: ${file.name}`, deleteError);
            }
          }
        }
        if (deletedCount > 0) {
          logStep(`清理完成: 刪除 ${deletedCount} 個舊備份`, { keepDays });
        }
      }
    } catch (cleanupError) {
      console.error('清理舊備份時出錯:', cleanupError);
      // 清理失敗不影響備份成功
    }

    const totalTime = Date.now() - startTime;
    logStep('10. 備份完成', { totalTime: `${totalTime}ms` });

    return res.status(200).json({
      success: true,
      message: `✅ 成功備份 ${totalRecords} 筆資料到 Google Drive`,
      fileId: uploadResponse.data.id,
      fileName: uploadResponse.data.name,
      fileUrl: uploadResponse.data.webViewLink,
      fileSize: uploadResponse.data.size,
      totalRecords,
      executionTime: totalTime,
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    logStep('錯誤: 備份失敗', { 
      error: error.message, 
      stack: error.stack?.substring(0, 500),
      totalTime: `${totalTime}ms`
    });
    console.error('Backup error:', error);

    return res.status(500).json({
      error: '備份失敗',
      message: error.message || 'Unknown error',
      executionTime: totalTime,
    });
  }
}

