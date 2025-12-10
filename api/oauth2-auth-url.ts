import { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

/**
 * 取得 OAuth 2.0 授權 URL
 * 用於產生授權連結，讓用戶授權應用程式存取 Google Drive
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/oauth2-callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'OAuth 憑證未設定',
        message: '請在 Vercel 環境變數中設定 GOOGLE_OAUTH_CLIENT_ID 和 GOOGLE_OAUTH_CLIENT_SECRET',
      });
    }

    // 建立 OAuth 2.0 客戶端
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // 產生授權 URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // 需要刷新令牌
      scope: ['https://www.googleapis.com/auth/drive.file'], // Google Drive 檔案存取權限
      prompt: 'consent', // 強制顯示同意畫面，確保取得刷新令牌
    });

    return res.status(200).json({
      success: true,
      authUrl,
      instructions: {
        step1: '請在瀏覽器中開啟以下 URL：',
        step2: authUrl,
        step3: '登入您的 Google 帳號並授權應用程式',
        step4: '授權後會重新導向到回調端點，取得刷新令牌',
      },
    });
  } catch (error: any) {
    console.error('產生授權 URL 錯誤:', error);
    return res.status(500).json({
      error: '產生授權 URL 失敗',
      message: error.message || 'Unknown error',
    });
  }
}

