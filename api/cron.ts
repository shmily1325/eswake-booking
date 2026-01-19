import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 統一的備份 Cron 端點（可選用）
 * 
 * 由於 Vercel Hobby 方案限制：
 * - 最多 2 個 Cron Jobs
 * - 每個 Cron Job 每天只能執行一次
 * 
 * 目前配置（vercel.json）：
 * - 18:00 UTC: /api/backup-to-cloud-drive (Google Drive 備份)
 * - 19:00 UTC: /api/line-reminder (LINE 提醒)
 * 
 * 注意：Google Sheets 備份（原定 19:20）已移除，需要手動執行或升級方案
 * 
 * 如需將 Google Sheets 備份也自動執行，可以：
 * 1. 在此端點中合併執行（18:00 一起執行）
 * 2. 升級到 Pro 方案以獲得更多 Cron Jobs
 * 3. 使用外部 Cron 服務（如 GitHub Actions）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允許 GET 請求（來自 Vercel Cron）
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  console.log(`[Cron] 執行時間: ${currentTime} UTC`);

  try {
    // 18:00 - 執行兩個備份任務
    if (hours === 18 && minutes === 0) {
      console.log('[Cron] 開始執行備份任務...');
      
      const results: any[] = [];
      
      // 1. Google Drive 備份
      try {
        console.log('[Cron] 執行 Google Drive 備份...');
        const backupHandler = (await import('./backup-to-cloud-drive')).default;
        // 創建一個模擬的 response 對象來捕獲結果
        const mockRes = {
          status: (code: number) => ({
            json: (data: any) => {
              results.push({ type: 'cloud-drive', status: code, data });
              return mockRes;
            }
          })
        } as any;
        await backupHandler(req, mockRes);
      } catch (error: any) {
        console.error('[Cron] Google Drive 備份失敗:', error);
        results.push({ type: 'cloud-drive', error: error.message });
      }
      
      // 2. Google Sheets 備份
      try {
        console.log('[Cron] 執行 Google Sheets 備份...');
        const driveBackupHandler = (await import('./backup-to-drive')).default;
        const mockRes = {
          status: (code: number) => ({
            json: (data: any) => {
              results.push({ type: 'sheets', status: code, data });
              return mockRes;
            }
          })
        } as any;
        await driveBackupHandler(req, mockRes);
      } catch (error: any) {
        console.error('[Cron] Google Sheets 備份失敗:', error);
        results.push({ type: 'sheets', error: error.message });
      }
      
      return res.status(200).json({
        success: true,
        message: '備份任務執行完成',
        currentTime: `${currentTime} UTC`,
        results,
      });
    }

    // 如果時間不匹配，返回提示
    return res.status(200).json({
      message: 'Cron 端點已接收請求，但當前時間不匹配',
      currentTime: `${currentTime} UTC`,
      note: '此端點在 18:00 UTC 執行備份任務',
    });

  } catch (error: any) {
    console.error('[Cron] 錯誤:', error);
    return res.status(500).json({
      error: 'Cron 執行失敗',
      message: error.message || 'Unknown error',
      currentTime: `${currentTime} UTC`,
    });
  }
}

