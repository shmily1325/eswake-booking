import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { authorizeBackupRequest, setBackupResponseHeaders } from '../src/server/backup-auth.js';
import {
  fetchBackupData,
  generateSqlBackup,
  getBackupIntegrity,
} from '../src/server/backup-data.js';
import { BACKUP_FORMAT_VERSION } from '../src/server/backup-config.js';

function getLocalTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  setBackupResponseHeaders(res);

  // 允许 POST 和 GET 请求（GET 用于自动备份）
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await authorizeBackupRequest(req);
    if (auth.ok === false) {
      return res.status(auth.status).json({ error: auth.error });
    }

    // 获取环境变量
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    // 创建 Supabase 客户端（使用 service role key 以绕过 RLS）
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('开始完整数据库备份...');

    const backupTime = getLocalTimestamp();
    const { data, stats, totalRecords } = await fetchBackupData(supabase);
    const sqlContent = generateSqlBackup(data, stats, backupTime);
    const integrity = getBackupIntegrity(sqlContent);
    console.log(`已備份 ${totalRecords} 筆資料`);

    const totalTime = Date.now() - startTime;
    console.log(`备份完成 (${totalTime}ms)`);

    // 返回 SQL 内容（作为文本响应）
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eswake_backup_${getLocalTimestamp().replace(/:/g, '-')}.sql"`);
    res.setHeader('Content-Length', String(integrity.bytes));
    res.setHeader('X-Backup-SHA256', integrity.checksum);

    if (req.method === 'POST') {
      await supabase.from('backup_logs').insert({
        backup_type: 'full_database',
        destination: 'manual_download',
        status: 'success',
        records_count: totalRecords,
        file_size: String(integrity.bytes),
        file_size_bytes: integrity.bytes,
        checksum: integrity.checksum,
        format_version: BACKUP_FORMAT_VERSION,
        execution_time: totalTime,
      });
    }

    return res.status(200).send(sqlContent);

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('备份失败:', error);
    if (req.method === 'POST') {
      try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          await createClient(supabaseUrl, serviceKey).from('backup_logs').insert({
            backup_type: 'full_database',
            destination: 'manual_download',
            status: 'failed',
            error_message: String(error?.message || error).slice(0, 1000),
            execution_time: totalTime,
          });
        }
      } catch (logError) {
        console.error('寫入手動備份失敗紀錄時出錯:', logError);
      }
    }
    return res.status(500).json({
      error: '备份失败',
      message: error.message || 'Unknown error',
      executionTime: totalTime,
    });
  }
}

