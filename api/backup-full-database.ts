import { VercelRequest, VercelResponse } from '@vercel/node';
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
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  // 允许 POST 和 GET 请求（GET 用于自动备份）
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 获取环境变量
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    // 创建 Supabase 客户端（使用 service role key 以绕过 RLS）
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('开始完整数据库备份...');

    // 生成 SQL 备份内容
    let sqlContent = `-- =============================================\n`;
    sqlContent += `-- ESWake 预约系统 - 完整数据库备份\n`;
    sqlContent += `-- 备份时间: ${getLocalTimestamp()}\n`;
    sqlContent += `-- =============================================\n\n`;

    // 备份每个表
    const backupStats: { [table: string]: number } = {};

    for (const tableName of TABLES_TO_BACKUP) {
      try {
        // 查询表的所有数据
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('id', { ascending: true });

        if (error) {
          console.error(`查询表 ${tableName} 失败:`, error);
          sqlContent += `-- ⚠️ 表 ${tableName} 备份失败: ${error.message}\n`;
          continue;
        }

        if (!data || data.length === 0) {
          sqlContent += `-- 表 ${tableName} 无数据\n\n`;
          backupStats[tableName] = 0;
          continue;
        }

        // 生成 INSERT 语句
        sqlContent += `-- =============================================\n`;
        sqlContent += `-- 表: ${tableName} (${data.length} 条记录)\n`;
        sqlContent += `-- =============================================\n\n`;

        // 先删除现有数据（如果存在）
        sqlContent += `-- 删除表 ${tableName} 的现有数据\n`;
        sqlContent += `DELETE FROM ${tableName};\n\n`;

        // 生成 INSERT 语句
        for (const row of data) {
          const columns = Object.keys(row).join(', ');
          const values = Object.values(row).map((val: any) => {
            if (val === null) return 'NULL';
            if (typeof val === 'string') {
              // 转义单引号
              const escaped = val.replace(/'/g, "''");
              return `'${escaped}'`;
            }
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (Array.isArray(val)) {
              // PostgreSQL 数组格式: ARRAY['val1', 'val2']
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
        console.log(`✓ 表 ${tableName}: ${data.length} 条记录`);
      } catch (error: any) {
        console.error(`备份表 ${tableName} 时出错:`, error);
        sqlContent += `-- ⚠️ 表 ${tableName} 备份出错: ${error.message}\n\n`;
      }
    }

    // 添加备份统计
    sqlContent += `-- =============================================\n`;
    sqlContent += `-- 备份统计\n`;
    sqlContent += `-- =============================================\n`;
    sqlContent += `-- 备份时间: ${getLocalTimestamp()}\n`;
    sqlContent += `-- 总表数: ${TABLES_TO_BACKUP.length}\n`;
    const totalRecords = Object.values(backupStats).reduce((sum, count) => sum + count, 0);
    sqlContent += `-- 总记录数: ${totalRecords}\n\n`;
    sqlContent += `-- 各表记录数:\n`;
    for (const [table, count] of Object.entries(backupStats)) {
      sqlContent += `--   ${table}: ${count}\n`;
    }
    sqlContent += `-- =============================================\n`;

    const totalTime = Date.now() - startTime;
    console.log(`备份完成 (${totalTime}ms)`);

    // 返回 SQL 内容（作为文本响应）
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eswake_backup_${getLocalTimestamp().replace(/:/g, '-')}.sql"`);
    return res.status(200).send(sqlContent);

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

