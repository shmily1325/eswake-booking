import { VercelRequest, VercelResponse } from '@vercel/node';
import { authorizeBackupRequest, setBackupResponseHeaders } from '../src/server/backup-auth.js';

/**
 * Optional unified backup endpoint kept for external schedulers.
 * The active Vercel schedules call the SQL and Storage endpoints directly.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBackupResponseHeaders(res);

  // 只允許 GET 請求（來自 Vercel Cron）
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authorizeBackupRequest(req);
  if (auth.ok === false) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  console.log(`[Cron] 執行時間: ${currentTime} UTC`);

  try {
    // 18:00 UTC - SQL backup
    if (hours === 18 && minutes === 0) {
      console.log('[Cron] 開始執行備份任務...');
      
      const results: any[] = [];
      
      // 1. Google Drive 備份
      try {
        console.log('[Cron] 執行 Google Drive 備份...');
        const backupHandler = (await import('./backup-to-cloud-drive.js')).default;
        // 創建一個模擬的 response 對象來捕獲結果
        const mockRes = {
          setHeader: () => mockRes,
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
      
      return res.status(200).json({
        success: true,
        message: '備份任務執行完成',
        currentTime: `${currentTime} UTC`,
        results,
      });
    }

    // 18:30 UTC - incremental product-image backup
    if (hours === 18 && minutes === 30) {
      const storageHandler = (await import('./backup-storage.js')).default;
      const storageReq = {
        ...req,
        query: { ...req.query, mode: 'cloud' },
      } as VercelRequest;
      return storageHandler(storageReq, res);
    }

    // 如果時間不匹配，返回提示
    return res.status(200).json({
      message: 'Cron 端點已接收請求，但當前時間不匹配',
      currentTime: `${currentTime} UTC`,
      note: '此端點在 18:00 UTC 執行 SQL、18:30 UTC 執行商品圖片備份',
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

