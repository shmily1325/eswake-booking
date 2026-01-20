import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// 需要备份的所有表（完整備份，用于查询）
// ⚠️ 重要：新增資料表時請務必同步更新此列表！
const KEY_TABLES = [
  // === 基礎資料表（無外鍵依賴）===
  'members',
  'coaches',
  'boats',
  
  // === 權限相關表 ===
  'admin_users',        // ⭐ 管理員用戶
  'allowed_users',      // ⭐ 允許登入用戶
  'editor_users',       // ⭐ 小編權限用戶
  'view_users',         // ⭐ 一般權限用戶
  
  // === 會員相關 ===
  'member_notes',       // ⭐ 會員備註/事件記錄
  'billing_relations',  // ⭐ 代扣關係表
  'board_storage',
  
  // === 船隻與教練相關 ===
  'boat_unavailable_dates',
  'coach_time_off',
  
  // === 預約相關（有外鍵依賴）===
  'bookings',
  'booking_members',
  'booking_coaches',
  'booking_drivers',    // 駕駛資料
  'coach_reports',
  'booking_participants',
  
  // === 財務相關 ===
  'transactions',
  
  // === 系統相關 ===
  'daily_announcements',
  'audit_log',
  'system_settings',
  'line_bindings',
  'backup_logs',        // 備份記錄
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('开始生成可查询备份（CSV格式）...');

    // 生成 JSON 格式的备份（包含所有表的数据）
    const backupData: { [table: string]: any[] } = {};
    const backupStats: { [table: string]: number } = {};

    for (const tableName of KEY_TABLES) {
      try {
        // 使用分頁查詢取得所有資料（Supabase 預設限制 1000 筆）
        const PAGE_SIZE = 1000;
        let allData: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) {
            console.error(`查询表 ${tableName} 失败:`, error);
            hasMore = false;
            break;
          }

          if (data && data.length > 0) {
            allData = allData.concat(data);
            offset += PAGE_SIZE;
            hasMore = data.length === PAGE_SIZE;
          } else {
            hasMore = false;
          }
        }

        backupData[tableName] = allData;
        backupStats[tableName] = allData.length;
        console.log(`✓ 表 ${tableName}: ${backupStats[tableName]} 条记录`);
      } catch (error: any) {
        console.error(`备份表 ${tableName} 时出错:`, error);
        backupData[tableName] = [];
        backupStats[tableName] = 0;
      }
    }

    // 生成 JSON 备份
    const jsonBackup = {
      metadata: {
        backupTime: getLocalTimestamp(),
        version: '1.0',
        tables: KEY_TABLES,
        stats: backupStats,
      },
      data: backupData,
    };

    const totalTime = Date.now() - startTime;
    console.log(`备份完成 (${totalTime}ms)`);

    // 返回 JSON 备份
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eswake_queryable_backup_${getLocalTimestamp().replace(/:/g, '-')}.json"`);
    return res.status(200).json(jsonBackup);

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

