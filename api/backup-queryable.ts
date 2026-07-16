import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { authorizeBackupRequest, setBackupResponseHeaders } from '../src/server/backup-auth.js';
import { BACKUP_FORMAT_VERSION, BACKUP_TABLES } from '../src/server/backup-config.js';
import { fetchBackupData, getBackupIntegrity } from '../src/server/backup-data.js';

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await authorizeBackupRequest(req);
    if (auth.ok === false) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('开始生成可查询备份（CSV格式）...');

    const { data: backupData, stats: backupStats } = await fetchBackupData(supabase);

    // 生成 JSON 备份
    const jsonBackup = {
      metadata: {
        backupTime: getLocalTimestamp(),
        version: BACKUP_FORMAT_VERSION,
        tables: BACKUP_TABLES,
        stats: backupStats,
      },
      data: backupData,
    };

    const totalTime = Date.now() - startTime;
    console.log(`备份完成 (${totalTime}ms)`);

    const jsonContent = JSON.stringify(jsonBackup);
    const integrity = getBackupIntegrity(jsonContent);

    // 返回 JSON 备份
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eswake_queryable_backup_${getLocalTimestamp().replace(/:/g, '-')}.json"`);
    res.setHeader('Content-Length', String(integrity.bytes));
    res.setHeader('X-Backup-SHA256', integrity.checksum);
    return res.status(200).send(jsonContent);

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('备份失败:', error);
    return res.status(500).json({
      error: '备份失败',
      message: error.message || 'Unknown error',
      executionTime: totalTime,
    });
  }
}

