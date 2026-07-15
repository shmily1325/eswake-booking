import { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { authorizeBackupRequest } from './backup-auth';
import { fetchBackupData, generateSqlBackup } from './backup-data';

function getLocalTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
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
    const requestAuth = await authorizeBackupRequest(req);
    if (requestAuth.ok === false) {
      return res.status(requestAuth.status).json({ error: requestAuth.error });
    }

    logStep('1. 開始備份流程');
    
    // 获取环境变量
    logStep('2. 檢查環境變數');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Google Drive 資料夾 ID

    // OAuth 2.0 憑證（優先使用）
    const googleOAuthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const googleOAuthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const googleOAuthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    // 服務帳號憑證（備用）
    const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!supabaseUrl || !supabaseServiceKey) {
      logStep('錯誤: Missing Supabase credentials');
      throw new Error('Missing Supabase credentials');
    }
    if (!googleDriveFolderId) {
      logStep('錯誤: GOOGLE_DRIVE_FOLDER_ID 必須設定');
      throw new Error('GOOGLE_DRIVE_FOLDER_ID 必須設定');
    }

    // 初始化 Google Drive 客户端
    logStep('3. 初始化 Google Drive 客戶端');
    let auth: any;
    let authType: string;

    // 優先使用 OAuth 2.0（如果已配置）
    if (googleOAuthClientId && googleOAuthClientSecret && googleOAuthRefreshToken) {
      logStep('3.0 使用 OAuth 2.0 認證');
      authType = 'OAuth 2.0';
      const oauth2Client = new google.auth.OAuth2(
        googleOAuthClientId,
        googleOAuthClientSecret
      );
      
      try {
        oauth2Client.setCredentials({
          refresh_token: googleOAuthRefreshToken,
        });
        
        // 測試 token 是否有效（嘗試獲取 access token）
        await oauth2Client.getAccessToken();
        logStep('3.0.1 OAuth token 驗證成功');
      } catch (tokenError: any) {
        logStep('3.0.1 OAuth token 驗證失敗', { error: tokenError.message });
        
        // 檢查是否是 invalid_grant 錯誤
        if (tokenError.message?.includes('invalid_grant') || tokenError.code === 400) {
          throw new Error(
            'OAuth 刷新令牌無效或已過期。請重新取得刷新令牌：\n\n' +
            '1. 訪問：https://eswake-booking.vercel.app/api/oauth2-auth-url\n' +
            '2. 複製返回的 authUrl 並在瀏覽器中開啟\n' +
            '3. 授權應用程式存取 Google Drive\n' +
            '4. 取得新的刷新令牌後，更新 Vercel 環境變數 GOOGLE_OAUTH_REFRESH_TOKEN\n' +
            '5. 重新部署應用程式\n\n' +
            '詳細說明請參考：docs/OAUTH2_BACKUP_SETUP.md'
          );
        }
        throw tokenError;
      }
      
      auth = oauth2Client;
    } else if (googleClientEmail && googlePrivateKey) {
      // 使用服務帳號（JWT）
      logStep('3.0 使用服務帳號認證');
      authType = 'Service Account';
      auth = new google.auth.JWT({
        email: googleClientEmail,
        key: googlePrivateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive', // 需要完整權限以存取共享資料夾
        ],
      });
    } else {
      logStep('錯誤: Missing Google Drive credentials');
      throw new Error('必須設定 OAuth 2.0 憑證（GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN）或服務帳號憑證（GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY）');
    }

    const drive = google.drive({ version: 'v3', auth });
    logStep(`3.1 Google Drive 客戶端初始化完成（使用 ${authType}）`);

    // 创建 Supabase 客户端
    logStep('4. 建立 Supabase 客戶端');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep('5. 開始生成完整資料庫備份');
    
    const backupTime = getLocalTimestamp();
    const { data, stats, totalRecords } = await fetchBackupData(supabase);
    const sqlContent = generateSqlBackup(data, stats, backupTime);

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
      parents: [googleDriveFolderId], // 必須上傳到共享資料夾
    };

    const media = {
      mimeType: 'text/plain',
      body: sqlContent, // 直接使用字符串，Google Drive API 會自動處理
    };

    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, size, createdTime',
      supportsAllDrives: true, // 支援共享雲端硬碟
      supportsTeamDrives: true, // 支援團隊雲端硬碟（舊版 API）
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
      // 注意：Google Drive API 不支援 endsWith，使用 contains 並在程式碼中過濾
      const query = `'${googleDriveFolderId}' in parents and name contains 'eswake_backup_' and name contains '.sql'`;

      const listResponse = await drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
        supportsAllDrives: true, // 支援共享雲端硬碟
        includeItemsFromAllDrives: true, // 包含所有雲端硬碟的檔案
        supportsTeamDrives: true, // 支援團隊雲端硬碟（舊版 API）
      });

      if (listResponse.data.files) {
        let deletedCount = 0;
        // 過濾出以 .sql 結尾的檔案（因為 API 不支援 endsWith）
        const backupFiles = listResponse.data.files.filter(file => 
          file.name && file.name.endsWith('.sql')
        );
        
        for (const file of backupFiles) {
          if (file.createdTime && file.createdTime < cutoffDateStr) {
            try {
              await drive.files.delete({ 
                fileId: file.id!,
                supportsAllDrives: true, // 支援共享雲端硬碟
              });
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

    // 記錄備份成功到 backup_logs
    try {
      await supabase.from('backup_logs').insert({
        backup_type: 'cloud_drive',
        status: 'success',
        records_count: totalRecords,
        file_name: uploadResponse.data.name,
        file_size: uploadResponse.data.size,
        file_url: uploadResponse.data.webViewLink,
        execution_time: totalTime,
      });
      logStep('11. 備份記錄已寫入 backup_logs');
    } catch (logError) {
      // 記錄失敗不影響備份結果
      console.error('寫入 backup_logs 失敗:', logError);
    }

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

    // 記錄備份失敗到 backup_logs
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseForLog = createClient(supabaseUrl, supabaseServiceKey);
        await supabaseForLog.from('backup_logs').insert({
          backup_type: 'cloud_drive',
          status: 'failed',
          error_message: error.message || 'Unknown error',
          execution_time: totalTime,
        });
      }
    } catch (logError) {
      console.error('寫入 backup_logs 失敗:', logError);
    }

    // 檢查是否是 invalid_grant 錯誤（OAuth token 問題）
    if (error.message?.includes('invalid_grant') || 
        error.message?.includes('Token has been expired') ||
        error.message?.includes('Token has been revoked') ||
        error.code === 400) {
      return res.status(401).json({
        error: 'OAuth 授權失敗',
        message: error.message || '刷新令牌無效或已過期',
        solution: {
          title: '如何修復：',
          steps: [
            '1. 訪問：https://eswake-booking.vercel.app/api/oauth2-auth-url',
            '2. 複製返回的 authUrl 並在瀏覽器中開啟',
            '3. 使用您的 Google 帳號登入並授權應用程式',
            '4. 授權完成後，複製新的刷新令牌（refresh_token）',
            '5. 在 Vercel Dashboard 中更新環境變數 GOOGLE_OAUTH_REFRESH_TOKEN',
            '6. 重新部署應用程式',
          ],
          documentation: '詳細說明請參考：docs/OAUTH2_BACKUP_SETUP.md',
        },
        executionTime: totalTime,
        errorCode: 'INVALID_GRANT',
      });
    }

    // 檢查是否是存儲配額錯誤
    if (error.message?.includes('storage quota') || error.message?.includes('Service Accounts do not have storage quota')) {
      return res.status(500).json({
        error: '備份失敗：服務帳號儲存配額限制',
        message: '服務帳號無法在共享資料夾中建立檔案。請使用以下解決方案：\n\n' +
          '方案 1：使用共享雲端硬碟（Shared Drive）\n' +
          '- 需要 Google Workspace 帳號\n' +
          '- 在共享雲端硬碟中建立資料夾\n' +
          '- 將服務帳號加入共享雲端硬碟\n\n' +
          '方案 2：使用 OAuth 2.0（需要用戶授權）\n' +
          '- 需要設定 OAuth 2.0 憑證\n' +
          '- 用戶需要授權應用程式存取 Google Drive\n\n' +
          '方案 3：使用本地備份\n' +
          '- 使用「自動備份到 WD MY BOOK」功能\n' +
          '- 參考文件：docs/AUTO_BACKUP_SETUP.md',
        executionTime: totalTime,
        errorCode: 'STORAGE_QUOTA_EXCEEDED',
      });
    }

    return res.status(500).json({
      error: '備份失敗',
      message: error.message || 'Unknown error',
      executionTime: totalTime,
    });
  }
}

